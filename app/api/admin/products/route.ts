import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, products, saleItems } from "@/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import { getStaffSession, hasPermission } from "@/lib/security";
import { ensureSystemBootstrapped } from "@/lib/settings-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureSystemBootstrapped();
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "view_products")) {
      return NextResponse.json(
        { error: "Ruxsat berilmagan." },
        { status: 403 }
      );
    }

    const list = await db
      .select()
      .from(products)
      .orderBy(desc(products.createdAt));

    return NextResponse.json({ products: list });
  } catch (err) {
    console.error("GET /api/admin/products error:", err);
    return NextResponse.json(
      { error: "Ombor mahsulotlarini yuklashda xatolik." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_products")) {
      return NextResponse.json(
        { ok: false, error: "Omborga atir qo‘shish ruxsati yo‘q." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const brand = String(body.brand || "").trim();
    const category = String(body.category || "Uniseks").trim();
    const bottleVolumeMl = Math.max(
      1,
      Number(body.bottleVolumeMl || parseFloat(String(body.volume || "100")) || 100)
    );
    const volume =
      String(body.volume || "").trim() || `${bottleVolumeMl} ml`;
    const stockMl = Math.max(0, Number(body.stockMl ?? bottleVolumeMl));
    const price = Math.round(Number(body.price || 0));
    const razlivPricePerGram = Math.max(
      0,
      Math.round(Number(body.razlivPricePerGram || 0))
    );
    const razlivSizes =
      String(body.razlivSizes || "5,10,20,30,50")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => n > 0)
        .join(",") || "5,10,20,30,50";

    const allowBottleSale =
      body.allowBottleSale !== undefined ? Boolean(body.allowBottleSale) : true;
    const allowRazlivSale =
      body.allowRazlivSale !== undefined ? Boolean(body.allowRazlivSale) : true;

    const productCode =
      String(body.productCode || "").trim().toUpperCase() ||
      `AYP-${Math.floor(100 + Math.random() * 900)}`;

    if (!name || !brand || price <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Atir nomi, brendi va butun flakon narxini to‘liq kiriting.",
        },
        { status: 400 }
      );
    }

    const dup = await db
      .select()
      .from(products)
      .where(eq(products.productCode, productCode))
      .limit(1);

    if (dup.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Ushbu mahsulot kodi allaqachon mavjud." },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(products)
      .values({
        productCode,
        name,
        brand,
        category,
        volume,
        bottleVolumeMl,
        stockMl,
        price,
        razlivPricePerGram,
        razlivSizes,
        allowBottleSale,
        allowRazlivSale,
        imageUrl:
          String(body.imageUrl || "").trim() || "/images/ayub-hero-perfume.jpg",
        description: String(body.description || "").trim() || null,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      })
      .returning();

    await db.insert(auditLogs).values({
      actorType: session.role,
      actorId: session.employeeId,
      actorName: session.fullName,
      action: "CREATE_PRODUCT",
      entityType: "PRODUCT",
      entityId: String(created.id),
      details: `Omborga yangi atir qo‘shildi: ${name} (${productCode}), qoldiq: ${stockMl} ml`,
    });

    return NextResponse.json({ ok: true, product: created });
  } catch (err) {
    console.error("POST /api/admin/products error:", err);
    return NextResponse.json(
      { ok: false, error: "Atir qo‘shishda xatolik." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_products")) {
      return NextResponse.json(
        { ok: false, error: "Ombor mahsulotini tahrirlash ruxsati yo‘q." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const id = Number(body.id);
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Mahsulot ID ko‘rsatilmadi." },
        { status: 400 }
      );
    }

    const updates: Partial<typeof products.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.productCode !== undefined) {
      const code = String(body.productCode).trim().toUpperCase();
      const dup = await db
        .select()
        .from(products)
        .where(and(eq(products.productCode, code), ne(products.id, id)))
        .limit(1);
      if (dup.length > 0) {
        return NextResponse.json(
          { ok: false, error: "Ushbu mahsulot kodi band." },
          { status: 400 }
        );
      }
      updates.productCode = code;
    }

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.brand !== undefined) updates.brand = String(body.brand).trim();
    if (body.category !== undefined)
      updates.category = String(body.category).trim();
    if (body.bottleVolumeMl !== undefined) {
      const bml = Math.max(1, Number(body.bottleVolumeMl));
      updates.bottleVolumeMl = bml;
      updates.volume = body.volume
        ? String(body.volume).trim()
        : `${bml} ml`;
    } else if (body.volume !== undefined) {
      updates.volume = String(body.volume).trim();
    }

    if (body.stockMl !== undefined) {
      updates.stockMl = Math.max(0, Number(body.stockMl));
    }
    if (body.price !== undefined) {
      updates.price = Math.max(0, Math.round(Number(body.price)));
    }
    if (body.razlivPricePerGram !== undefined) {
      updates.razlivPricePerGram = Math.max(
        0,
        Math.round(Number(body.razlivPricePerGram))
      );
    }
    if (body.razlivSizes !== undefined) {
      updates.razlivSizes =
        String(body.razlivSizes)
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => n > 0)
          .join(",") || "5,10,20,30,50";
    }
    if (body.allowBottleSale !== undefined) {
      updates.allowBottleSale = Boolean(body.allowBottleSale);
    }
    if (body.allowRazlivSale !== undefined) {
      updates.allowRazlivSale = Boolean(body.allowRazlivSale);
    }
    if (body.imageUrl !== undefined) {
      updates.imageUrl = String(body.imageUrl).trim();
    }
    if (body.description !== undefined) {
      updates.description = String(body.description).trim();
    }
    if (body.isActive !== undefined) {
      updates.isActive = Boolean(body.isActive);
    }

    const [updated] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();

    return NextResponse.json({ ok: true, product: updated });
  } catch (err) {
    console.error("PATCH /api/admin/products error:", err);
    return NextResponse.json(
      { ok: false, error: "Atir tahrirlashda xatolik." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_products")) {
      return NextResponse.json(
        { ok: false, error: "Atir o‘chirish ruxsati yo‘q." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Mahsulot ID ko‘rsatilmadi." },
        { status: 400 }
      );
    }

    const usedInSales = await db
      .select({ id: saleItems.id })
      .from(saleItems)
      .where(eq(saleItems.productId, id))
      .limit(1);

    if (usedInSales.length > 0) {
      await db
        .update(products)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(products.id, id));
      return NextResponse.json({
        ok: true,
        archived: true,
        message:
          "Ushbu atir xaridlar tarixida qatnashgani sababli arxivlandi (nofaol holatga o‘tkazildi).",
      });
    }

    await db.delete(products).where(eq(products.id, id));
    return NextResponse.json({
      ok: true,
      archived: false,
      message: "Atir ombordan to‘liq o‘chirildi.",
    });
  } catch (err) {
    console.error("DELETE /api/admin/products error:", err);
    return NextResponse.json(
      { ok: false, error: "O‘chirishda xatolik yuz berdi." },
      { status: 500 }
    );
  }
}
