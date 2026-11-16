import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  auditLogs,
  customers,
  qrRegistrations,
  qrSources,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { getStaffSession, hasPermission } from "@/lib/security";
import {
  ensureSystemBootstrapped,
  getAppConfig,
  updateAppConfig,
} from "@/lib/settings-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureSystemBootstrapped();
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "view_qr")) {
      return NextResponse.json(
        { error: "Ruxsat berilmagan." },
        { status: 403 }
      );
    }

    const config = await getAppConfig();
    const reqUrl = new URL(request.url);
    const configuredBase = (config.publicBaseUrl || "").trim().replace(/\/+$/, "");
    const origin =
      configuredBase ||
      reqUrl.searchParams.get("origin") ||
      `${reqUrl.protocol}//${reqUrl.host}`;

    const sources = await db
      .select()
      .from(qrSources)
      .orderBy(qrSources.id);

    const allCusts = await db.select().from(customers);

    const enriched = await Promise.all(
      sources.map(async (src) => {
        const isFullUrl =
          src.customPath.startsWith("http://") ||
          src.customPath.startsWith("https://");
        const normalizedPath = src.customPath.startsWith("/")
          ? src.customPath
          : `/${src.customPath}`;
        const fullUrl = isFullUrl ? src.customPath : `${origin}${normalizedPath}`;

        const pngDataUrl = await QRCode.toDataURL(fullUrl, {
          width: 600,
          margin: 2,
          color: {
            dark: "#064E3B",
            light: "#FFFFFF",
          },
        });

        const svgString = await QRCode.toString(fullUrl, {
          type: "svg",
          width: 600,
          margin: 2,
          color: {
            dark: "#064E3B",
            light: "#FFFFFF",
          },
        });

        const matchedCustomers = allCusts.filter(
          (c) => c.qrSource === src.code
        );

        return {
          ...src,
          actualRegistrations: matchedCustomers.length,
          totalRevenue: matchedCustomers.reduce(
            (a, c) => a + Number(c.totalSpent || 0),
            0
          ),
          fullUrl,
          pngDataUrl,
          svgString,
        };
      })
    );

    const recentRegs = await db
      .select({
        id: qrRegistrations.id,
        sourceCode: qrRegistrations.sourceCode,
        referralUrl: qrRegistrations.referralUrl,
        createdAt: qrRegistrations.createdAt,
        customerId: customers.id,
        customerCode: customers.customerCode,
        customerName: customers.fullName,
        customerPhone: customers.phone,
      })
      .from(qrRegistrations)
      .innerJoin(customers, eq(qrRegistrations.customerId, customers.id))
      .orderBy(desc(qrRegistrations.createdAt))
      .limit(30);

    return NextResponse.json({
      publicBaseUrl: config.publicBaseUrl || "",
      sources: enriched,
      recentRegistrations: recentRegs,
    });
  } catch (err) {
    console.error("GET /api/admin/qr error:", err);
    return NextResponse.json(
      { error: "QR ma’lumotlarini yuklashda xatolik." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_qr")) {
      return NextResponse.json(
        { ok: false, error: "QR yaratish uchun Admin huquqi kerak." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const rawCode = String(body.code || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    const name = String(body.name || "").trim();

    if (!rawCode || !name) {
      return NextResponse.json(
        {
          ok: false,
          error: "QR manbasi kodi (masalan: instagram) va nomini kiriting.",
        },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(qrSources)
      .where(eq(qrSources.code, rawCode))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Ushbu kodli QR manbasi allaqachon mavjud." },
        { status: 400 }
      );
    }

    const customPath =
      String(body.customPath || "").trim() || `/register?source=${rawCode}`;

    const [created] = await db
      .insert(qrSources)
      .values({
        code: rawCode,
        name,
        customPath,
        description: String(body.description || "").trim() || null,
        isActive: true,
      })
      .returning();

    await db.insert(auditLogs).values({
      actorType: session.role,
      actorId: session.employeeId,
      actorName: session.fullName,
      action: "CREATE_QR_SOURCE",
      entityType: "QR_SOURCE",
      entityId: String(created.id),
      details: `Yangi QR manbasi yaratildi: ${name} (${rawCode})`,
    });

    return NextResponse.json({ ok: true, qrSource: created });
  } catch (err) {
    console.error("POST /api/admin/qr error:", err);
    return NextResponse.json(
      { ok: false, error: "QR yaratishda xatolik yuz berdi." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_qr")) {
      return NextResponse.json(
        { ok: false, error: "QR tahrirlash uchun Admin huquqi kerak." },
        { status: 403 }
      );
    }

    const body = await request.json();
    if (body.action === "set_base_url") {
      const cleanUrl = String(body.publicBaseUrl || "")
        .trim()
        .replace(/\/+$/, "");
      await updateAppConfig({ publicBaseUrl: cleanUrl }, session.fullName);
      return NextResponse.json({ ok: true, publicBaseUrl: cleanUrl });
    }

    const id = Number(body.id);
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "QR ID ko‘rsatilmadi." },
        { status: 400 }
      );
    }

    const updates: Partial<typeof qrSources.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.customPath !== undefined)
      updates.customPath = String(body.customPath).trim();
    if (body.description !== undefined)
      updates.description = String(body.description).trim();
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);

    const [updated] = await db
      .update(qrSources)
      .set(updates)
      .where(eq(qrSources.id, id))
      .returning();

    await db.insert(auditLogs).values({
      actorType: session.role,
      actorId: session.employeeId,
      actorName: session.fullName,
      action: "UPDATE_QR_SOURCE",
      entityType: "QR_SOURCE",
      entityId: String(id),
      details: `QR manbasi tahrirlandi: ${updated?.name}`,
    });

    return NextResponse.json({ ok: true, qrSource: updated });
  } catch (err) {
    console.error("PATCH /api/admin/qr error:", err);
    return NextResponse.json(
      { ok: false, error: "QR tahrirlashda xatolik." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_qr")) {
      return NextResponse.json(
        { ok: false, error: "QR o‘chirish uchun Admin huquqi kerak." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "QR ID ko‘rsatilmadi." },
        { status: 400 }
      );
    }

    await db.delete(qrSources).where(eq(qrSources.id, id));

    await db.insert(auditLogs).values({
      actorType: session.role,
      actorId: session.employeeId,
      actorName: session.fullName,
      action: "DELETE_QR_SOURCE",
      entityType: "QR_SOURCE",
      entityId: String(id),
      details: `QR manbasi o‘chirildi (#${id})`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/qr error:", err);
    return NextResponse.json(
      { ok: false, error: "QR o‘chirishda xatolik." },
      { status: 500 }
    );
  }
}
