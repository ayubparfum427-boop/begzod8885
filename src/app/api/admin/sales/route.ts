import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, products, saleItems, sales } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { getStaffSession, hasPermission } from "@/lib/security";
import {
  computeLoyaltyBreakdown,
  createSaleTransaction,
  SaleLineInput,
} from "@/lib/loyalty-engine";
import { ensureSystemBootstrapped, getAppConfig } from "@/lib/settings-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureSystemBootstrapped();
    const session = await getStaffSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Avtorizatsiya talab qilinadi." },
        { status: 401 }
      );
    }

    const salesRows = await db
      .select({
        id: sales.id,
        saleCode: sales.saleCode,
        customerId: sales.customerId,
        employeeId: sales.employeeId,
        cashierName: sales.cashierName,
        subtotalAmount: sales.subtotalAmount,
        discountPercent: sales.discountPercent,
        discountAmount: sales.discountAmount,
        finalAmount: sales.finalAmount,
        bonusGramsUsed: sales.bonusGramsUsed,
        bonusGramsEarned: sales.bonusGramsEarned,
        isVipSale: sales.isVipSale,
        paymentMethod: sales.paymentMethod,
        notes: sales.notes,
        createdAt: sales.createdAt,
        customerName: customers.fullName,
        customerPhone: customers.phone,
        customerCode: customers.customerCode,
      })
      .from(sales)
      .innerJoin(customers, eq(sales.customerId, customers.id))
      .orderBy(desc(sales.createdAt))
      .limit(100);

    const saleIds = salesRows.map((s) => s.id);
    const items =
      saleIds.length > 0
        ? await db
            .select()
            .from(saleItems)
            .where(inArray(saleItems.saleId, saleIds))
        : [];

    return NextResponse.json({
      sales: salesRows.map((s) => ({
        ...s,
        items: items.filter((it) => it.saleId === s.id),
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/sales error:", err);
    return NextResponse.json(
      { error: "Savdolarni yuklashda xatolik." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "create_sale")) {
      return NextResponse.json(
        { ok: false, error: "Savdo kiritish uchun ruxsat yo‘q." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action || "create";
    const customerId = Number(body.customerId);
    const itemsInput: SaleLineInput[] = Array.isArray(body.items)
      ? body.items
      : [];

    if (!customerId || itemsInput.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Mijoz va kamida bitta atir tanlanishi shart." },
        { status: 400 }
      );
    }

    if (action === "preview") {
      const config = await getAppConfig();
      const custRows = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (custRows.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Mijoz topilmadi." },
          { status: 404 }
        );
      }

      const rawLines = [];
      for (const item of itemsInput) {
        const prodRows = await db
          .select()
          .from(products)
          .where(eq(products.id, Number(item.productId)))
          .limit(1);
        if (prodRows.length === 0) continue;
        const prod = prodRows[0];
        const unitPrice =
          item.customUnitPrice !== undefined && Number(item.customUnitPrice) >= 0
            ? Math.round(Number(item.customUnitPrice))
            : Number(prod.price);
        rawLines.push({
          product: prod,
          quantity: Math.max(1, Math.round(Number(item.quantity || 1))),
          unitPrice,
        });
      }

      const preview = computeLoyaltyBreakdown({
        config,
        customer: custRows[0],
        rawLines,
        requestedRedeemGrams: Number(body.redeemBonusGrams || 0),
      });

      return NextResponse.json({ ok: true, preview });
    }

    // Create actual sale transaction
    const result = await createSaleTransaction({
      customerId,
      items: itemsInput,
      redeemBonusGrams: Number(body.redeemBonusGrams || 0),
      paymentMethod: body.paymentMethod,
      notes: body.notes,
      employeeId: session.employeeId,
      cashierName: session.fullName,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      sale: result.sale,
      preview: result.preview,
      promotedToVip: result.promotedToVip,
    });
  } catch (err) {
    console.error("POST /api/admin/sales error:", err);
    return NextResponse.json(
      { ok: false, error: "Savdoni saqlashda xatolik yuz berdi." },
      { status: 500 }
    );
  }
}
