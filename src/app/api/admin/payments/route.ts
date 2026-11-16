import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  auditLogs,
  customerOrders,
  customers,
  products,
} from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { getStaffSession, hasPermission } from "@/lib/security";
import { createSaleTransaction } from "@/lib/loyalty-engine";
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
    if (!session || !hasPermission(session.role, "manage_payments")) {
      return NextResponse.json(
        { error: "To‘lov bo‘limiga kirish ruxsati yo‘q." },
        { status: 403 }
      );
    }

    const config = await getAppConfig();
    const paynetUrl = (config.paynetPaymentUrl || "").trim();

    let paynetQrPng = "";
    let paynetQrSvg = "";

    if (paynetUrl) {
      paynetQrPng = await QRCode.toDataURL(paynetUrl, {
        width: 560,
        margin: 2,
        color: { dark: "#064E3B", light: "#FFFFFF" },
      });
      paynetQrSvg = await QRCode.toString(paynetUrl, {
        type: "svg",
        width: 560,
        margin: 2,
        color: { dark: "#064E3B", light: "#FFFFFF" },
      });
    }

    const orders = await db
      .select({
        id: customerOrders.id,
        orderCode: customerOrders.orderCode,
        customerId: customerOrders.customerId,
        productId: customerOrders.productId,
        productName: customerOrders.productName,
        brand: customerOrders.brand,
        saleMode: customerOrders.saleMode,
        selectedGramsOrQty: customerOrders.selectedGramsOrQty,
        deductedMl: customerOrders.deductedMl,
        unitPrice: customerOrders.unitPrice,
        subtotalAmount: customerOrders.subtotalAmount,
        discountPercent: customerOrders.discountPercent,
        discountAmount: customerOrders.discountAmount,
        finalAmount: customerOrders.finalAmount,
        paymentMethod: customerOrders.paymentMethod,
        receiptImageData: customerOrders.receiptImageData,
        receiptNote: customerOrders.receiptNote,
        status: customerOrders.status,
        linkedSaleId: customerOrders.linkedSaleId,
        createdAt: customerOrders.createdAt,
        customerName: customers.fullName,
        customerPhone: customers.phone,
        customerCode: customers.customerCode,
        customerIsVip: customers.isVip,
      })
      .from(customerOrders)
      .innerJoin(customers, eq(customerOrders.customerId, customers.id))
      .orderBy(desc(customerOrders.createdAt))
      .limit(100);

    return NextResponse.json({
      paymentConfig: {
        paynetPaymentUrl: config.paynetPaymentUrl,
        paynetMerchantTitle: config.paynetMerchantTitle,
        paynetInstructions: config.paynetInstructions,
        cashInstructions: config.cashInstructions,
        paynetQrPng,
        paynetQrSvg,
      },
      orders,
    });
  } catch (err) {
    console.error("GET /api/admin/payments error:", err);
    return NextResponse.json(
      { error: "To‘lov ma’lumotlarini yuklashda xatolik." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_payments")) {
      return NextResponse.json(
        { ok: false, error: "Ruxsat berilmagan." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action;

    if (action === "save_paynet") {
      const paynetPaymentUrl = String(body.paynetPaymentUrl || "").trim();
      if (!paynetPaymentUrl) {
        return NextResponse.json(
          { ok: false, error: "Paynet to‘lov havolasini kiriting." },
          { status: 400 }
        );
      }

      const updated = await updateAppConfig(
        {
          paynetPaymentUrl,
          paynetMerchantTitle:
            String(body.paynetMerchantTitle || "").trim() ||
            "AYUB PARFUM — Rasmiy Paynet To‘lov",
          paynetInstructions:
            String(body.paynetInstructions || "").trim() ||
            "Paynet QR-kodini skaner qilib to‘lovni amalga oshiring va to‘lov chekini yuboring.",
          cashInstructions:
            String(body.cashInstructions || "").trim() ||
            "Buyurtmangiz tayyorlab qo‘yiladi — do‘konda naqd to‘lashingiz mumkin.",
        },
        session.fullName
      );

      await db.insert(auditLogs).values({
        actorType: session.role,
        actorId: session.employeeId,
        actorName: session.fullName,
        action: "UPDATE_PAYNET_QR",
        entityType: "PAYMENT_CONFIG",
        details: `Paynet QR havolasi yangilandi: ${paynetPaymentUrl}`,
      });

      const paynetQrPng = await QRCode.toDataURL(updated.paynetPaymentUrl, {
        width: 560,
        margin: 2,
        color: { dark: "#064E3B", light: "#FFFFFF" },
      });

      return NextResponse.json({
        ok: true,
        paynetPaymentUrl: updated.paynetPaymentUrl,
        paynetQrPng,
      });
    }

    if (action === "approve_order") {
      const orderId = Number(body.orderId);
      const rows = await db
        .select()
        .from(customerOrders)
        .where(eq(customerOrders.id, orderId))
        .limit(1);

      if (rows.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Buyurtma topilmadi." },
          { status: 404 }
        );
      }

      const ord = rows[0];
      if (ord.status !== "PENDING") {
        return NextResponse.json(
          { ok: false, error: "Ushbu buyurtma allaqachon ko‘rib chiqilgan." },
          { status: 400 }
        );
      }

      const isRazliv = ord.saleMode === "RAZLIV";
      const volumeLabel = isRazliv
        ? `Razliv ${ord.selectedGramsOrQty} gr`
        : `Butun flakon (${Math.round(
            ord.deductedMl / Math.max(1, ord.selectedGramsOrQty)
          )} ml)`;

      // Convert order into official loyalty sale (stock was already deducted upon customer order!)
      const saleRes = await createSaleTransaction({
        customerId: ord.customerId,
        items: [
          {
            productId: ord.productId,
            quantity: isRazliv
              ? 1
              : Math.max(1, Math.round(ord.selectedGramsOrQty)),
            saleMode: isRazliv ? "RAZLIV" : "BOTTLE",
            razlivGrams: isRazliv ? ord.selectedGramsOrQty : undefined,
            customUnitPrice: isRazliv ? ord.subtotalAmount : ord.unitPrice,
            volumeLabel,
          },
        ],
        paymentMethod:
          ord.paymentMethod === "PAYNET"
            ? "Paynet QR (Chek tasdiqlandi)"
            : "Naqd (Joyida to‘landi)",
        notes: `Mijoz buyurtmasi #${ord.orderCode}`,
        employeeId: session.employeeId,
        cashierName: session.fullName,
        skipStockDeduction: true,
      });

      if (!saleRes.ok) {
        return NextResponse.json(
          { ok: false, error: saleRes.error },
          { status: 400 }
        );
      }

      await db
        .update(customerOrders)
        .set({
          status: "APPROVED",
          linkedSaleId: saleRes.sale.id,
          reviewedByEmployeeId: session.employeeId,
          updatedAt: new Date(),
        })
        .where(eq(customerOrders.id, ord.id));

      return NextResponse.json({
        ok: true,
        saleCode: saleRes.sale.saleCode,
      });
    }

    if (action === "reject_order") {
      const orderId = Number(body.orderId);
      const rows = await db
        .select()
        .from(customerOrders)
        .where(eq(customerOrders.id, orderId))
        .limit(1);

      if (rows.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Buyurtma topilmadi." },
          { status: 404 }
        );
      }

      const ord = rows[0];
      if (ord.status !== "PENDING") {
        return NextResponse.json(
          { ok: false, error: "Ushbu buyurtma allaqachon ko‘rib chiqilgan." },
          { status: 400 }
        );
      }

      // Restore reserved warehouse stock!
      await db
        .update(products)
        .set({
          stockMl: sql`${products.stockMl} + ${ord.deductedMl}`,
          updatedAt: new Date(),
        })
        .where(eq(products.id, ord.productId));

      await db
        .update(customerOrders)
        .set({
          status: "REJECTED",
          reviewedByEmployeeId: session.employeeId,
          updatedAt: new Date(),
        })
        .where(eq(customerOrders.id, ord.id));

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: "Noma’lum amal." },
      { status: 400 }
    );
  } catch (err) {
    console.error("POST /api/admin/payments error:", err);
    return NextResponse.json(
      { ok: false, error: "Amalni bajarishda xatolik." },
      { status: 500 }
    );
  }
}
