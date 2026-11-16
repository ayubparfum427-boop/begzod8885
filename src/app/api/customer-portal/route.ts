import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  auditLogs,
  bonusTransactions,
  customerOrders,
  customers,
  discountTransactions,
  products,
  qrSources,
  saleItems,
  sales,
} from "@/db/schema";
import { desc, eq, inArray, sql } from "drizzle-orm";
import QRCode from "qrcode";
import {
  clearCustomerSessionCookie,
  createCustomerSessionCookie,
  getCustomerSession,
} from "@/lib/security";
import {
  computeLoyaltyBreakdown,
  registerCustomerOnServer,
} from "@/lib/loyalty-engine";
import { normalizeUzbekPhone } from "@/lib/format";
import { ensureSystemBootstrapped, getAppConfig } from "@/lib/settings-service";

export const dynamic = "force-dynamic";

async function loadSingleCustomerPortalData(customerId: number) {
  const custRows = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (custRows.length === 0) return null;
  const customer = custRows[0];

  const [bonuses, discounts, customerSales, orders] = await Promise.all([
    db
      .select()
      .from(bonusTransactions)
      .where(eq(bonusTransactions.customerId, customer.id))
      .orderBy(desc(bonusTransactions.createdAt)),
    db
      .select()
      .from(discountTransactions)
      .where(eq(discountTransactions.customerId, customer.id))
      .orderBy(desc(discountTransactions.createdAt)),
    db
      .select()
      .from(sales)
      .where(eq(sales.customerId, customer.id))
      .orderBy(desc(sales.createdAt)),
    db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.customerId, customer.id))
      .orderBy(desc(customerOrders.createdAt)),
  ]);

  const saleIds = customerSales.map((s) => s.id);
  const items =
    saleIds.length > 0
      ? await db
          .select()
          .from(saleItems)
          .where(inArray(saleItems.saleId, saleIds))
      : [];

  const purchasesHistory = customerSales.map((s) => ({
    ...s,
    items: items.filter((it) => it.saleId === s.id),
  }));

  return {
    customer: {
      id: customer.id,
      customerCode: customer.customerCode,
      fullName: customer.fullName,
      phone: customer.phone,
      qrSource: customer.qrSource,
      bonusGrams: customer.bonusGrams,
      totalBonusEarnedGrams: customer.totalBonusEarnedGrams,
      totalBonusUsedGrams: customer.totalBonusUsedGrams,
      customDiscountPercent: customer.customDiscountPercent,
      isVip: customer.isVip,
      vipSince: customer.vipSince,
      totalSpent: customer.totalSpent,
      purchasesCount: customer.purchasesCount,
      totalItemsBought: customer.totalItemsBought,
      lastPurchaseAt: customer.lastPurchaseAt,
      createdAt: customer.createdAt,
    },
    bonuses,
    discounts,
    purchasesHistory,
    orders,
  };
}

export async function GET(request: Request) {
  try {
    await ensureSystemBootstrapped();
    const { searchParams } = new URL(request.url);
    const trackSource = searchParams.get("trackSource");

    if (trackSource) {
      const code = trackSource.trim().toLowerCase();
      await db
        .update(qrSources)
        .set({
          scansCount: sql`${qrSources.scansCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(qrSources.code, code));
    }

    const config = await getAppConfig();
    const catalogProducts = await db
      .select({
        id: products.id,
        productCode: products.productCode,
        name: products.name,
        brand: products.brand,
        category: products.category,
        volume: products.volume,
        bottleVolumeMl: products.bottleVolumeMl,
        stockMl: products.stockMl,
        price: products.price,
        razlivPricePerGram: products.razlivPricePerGram,
        razlivSizes: products.razlivSizes,
        allowBottleSale: products.allowBottleSale,
        allowRazlivSale: products.allowRazlivSale,
        imageUrl: products.imageUrl,
        description: products.description,
      })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(products.id);

    let paynetQrPng = "";
    if (config.paynetPaymentUrl) {
      try {
        paynetQrPng = await QRCode.toDataURL(config.paynetPaymentUrl, {
          width: 480,
          margin: 2,
          color: { dark: "#064E3B", light: "#FFFFFF" },
        });
      } catch {
        // Ignore QR generation error if invalid URL
      }
    }

    const session = await getCustomerSession(request);
    let portalData = null;

    if (session?.customerId) {
      portalData = await loadSingleCustomerPortalData(session.customerId);
    }

    return NextResponse.json({
      branding: {
        storeName: config.storeName,
        clubName: config.clubName,
        logoUrl: config.logoUrl,
        storePhone: config.storePhone,
        telegramChannelUrl: config.telegramChannelUrl,
        instagramUrl: config.instagramUrl,
        welcomeBonusGrams: config.welcomeBonusGrams,
        repeatBonusGrams: config.repeatBonusGrams,
        repeatBonusMaxAmount: config.repeatBonusMaxAmount,
        discountThresholdAmount: config.discountThresholdAmount,
        regularDiscountPercent: config.regularDiscountPercent,
        vipDiscountPercent: config.vipDiscountPercent,
        vipMinTotalSpent: config.vipMinTotalSpent,
        requireConsent: config.requireConsent,
        paynetPaymentUrl: config.paynetPaymentUrl,
        paynetMerchantTitle: config.paynetMerchantTitle,
        paynetInstructions: config.paynetInstructions,
        cashInstructions: config.cashInstructions,
        paynetQrPng,
      },
      featuredProducts: catalogProducts,
      authenticated: Boolean(portalData),
      portalData,
    });
  } catch (err) {
    console.error("GET /api/customer-portal error:", err);
    return NextResponse.json(
      { error: "Ma’lumotlarni yuklashda xatolik yuz berdi." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureSystemBootstrapped();
    const body = await request.json();
    const action = body.action || "register";

    if (action === "register") {
      const userAgent = request.headers.get("user-agent") || undefined;
      const result = await registerCustomerOnServer({
        fullName: body.fullName,
        phone: body.phone,
        consentAccepted: Boolean(body.consentAccepted),
        qrSource: body.qrSource || "direct",
        referralUrl: body.referralUrl || null,
        userAgent,
      });

      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error, code: result.code },
          { status: 400 }
        );
      }

      const customerToken = await createCustomerSessionCookie({
        customerId: result.customer.id,
        customerCode: result.customer.customerCode,
        phone: result.customer.phone,
      });

      const portalData = await loadSingleCustomerPortalData(result.customer.id);

      return NextResponse.json({
        ok: true,
        customerToken,
        welcomeBonusGranted: result.welcomeBonusGranted,
        message:
          result.welcomeBonusGranted > 0
            ? `Tabriklaymiz! Siz muvaffaqiyatli ro‘yxatdan o‘tdingiz va +${result.welcomeBonusGranted} gramm atir bonusiga ega bo‘ldingiz!`
            : "Tabriklaymiz! Siz muvaffaqiyatli ro‘yxatdan o‘tdingiz!",
        portalData,
      });
    }

    if (action === "lookup_own") {
      const normalizedPhone = normalizeUzbekPhone(String(body.phone || ""));
      const identifier = String(body.identifier || "").trim().toLowerCase();

      if (!normalizedPhone) {
        return NextResponse.json(
          {
            ok: false,
            error: "Telefon raqamingizni +998 XX XXX XX XX formatida kiriting.",
          },
          { status: 400 }
        );
      }

      const rows = await db
        .select()
        .from(customers)
        .where(eq(customers.phone, normalizedPhone))
        .limit(1);

      if (rows.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Ushbu telefon raqami ro‘yxatdan o‘tmagan. Avval ro‘yxatdan o‘ting.",
          },
          { status: 404 }
        );
      }

      const cust = rows[0];
      if (identifier) {
        const nameMatches = cust.fullName.toLowerCase().includes(identifier);
        const codeMatches = cust.customerCode.toLowerCase() === identifier;
        if (!nameMatches && !codeMatches) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Kiritilgan ism yoki Mijoz ID telefon raqamiga mos kelmadi.",
            },
            { status: 403 }
          );
        }
      }

      if (cust.isBlocked) {
        return NextResponse.json(
          { ok: false, error: "Ushbu profil vaqtincha cheklangan." },
          { status: 403 }
        );
      }

      const customerToken = await createCustomerSessionCookie({
        customerId: cust.id,
        customerCode: cust.customerCode,
        phone: cust.phone,
      });

      const portalData = await loadSingleCustomerPortalData(cust.id);
      return NextResponse.json({
        ok: true,
        customerToken,
        portalData,
      });
    }

    // CUSTOMER CATALOG ORDER + PAYMENT (CASH OR PAYNET QR + RECEIPT)
    if (action === "create_order") {
      const session = await getCustomerSession(request);
      if (!session?.customerId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Buyurtma va to‘lov qilish uchun avval ismingiz va telefon raqamingiz bilan ro‘yxatdan o‘ting (yoki profilingizga kiring).",
          },
          { status: 401 }
        );
      }

      const custRows = await db
        .select()
        .from(customers)
        .where(eq(customers.id, session.customerId))
        .limit(1);

      if (custRows.length === 0 || custRows[0].isBlocked) {
        return NextResponse.json(
          { ok: false, error: "Mijoz profili topilmadi yoki cheklangan." },
          { status: 403 }
        );
      }
      const customer = custRows[0];

      const productId = Number(body.productId);
      const saleMode: "BOTTLE" | "RAZLIV" =
        body.saleMode === "RAZLIV" ? "RAZLIV" : "BOTTLE";
      const paymentMethod: "CASH" | "PAYNET" =
        body.paymentMethod === "PAYNET" ? "PAYNET" : "CASH";
      const receiptImageData = body.receiptImageData
        ? String(body.receiptImageData)
        : null;
      const receiptNote = body.receiptNote
        ? String(body.receiptNote).trim()
        : null;

      if (paymentMethod === "PAYNET" && !receiptImageData) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Paynet orqali to‘lov tanlanganda to‘lov cheki rasmini (skrinshotni) yuklash shart!",
          },
          { status: 400 }
        );
      }

      const prodRows = await db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (prodRows.length === 0 || !prodRows[0].isActive) {
        return NextResponse.json(
          { ok: false, error: "Tanlangan atir topilmadi." },
          { status: 404 }
        );
      }
      const prod = prodRows[0];

      const bottleMl = Math.max(1, Number(prod.bottleVolumeMl || 100));
      const availableMl = Math.max(0, Number(prod.stockMl || 0));

      let selectedGramsOrQty = 1;
      let deductedMl = bottleMl;
      let unitPrice = Number(prod.price);
      let rawQtyForLoyalty = 1;

      if (saleMode === "BOTTLE") {
        if (!prod.allowBottleSale) {
          return NextResponse.json(
            { ok: false, error: "Ushbu atir faqat razlivda sotiladi." },
            { status: 400 }
          );
        }
        const qty = Math.max(1, Math.round(Number(body.quantity || 1)));
        selectedGramsOrQty = qty;
        deductedMl = bottleMl * qty;
        unitPrice = Number(prod.price);
        rawQtyForLoyalty = qty;

        if (availableMl < deductedMl) {
          return NextResponse.json(
            {
              ok: false,
              error: `Omborda butun flakon atir tugadi! (Ombordagi qoldiq: ${availableMl} ml, butun flakon uchun ${bottleMl} ml kerak — razliv tanlashingiz mumkin).`,
            },
            { status: 400 }
          );
        }
      } else {
        if (!prod.allowRazlivSale) {
          return NextResponse.json(
            { ok: false, error: "Ushbu atir faqat butun flakonda sotiladi." },
            { status: 400 }
          );
        }
        const grams = Math.max(1, Number(body.grams || 10));
        selectedGramsOrQty = grams;
        deductedMl = grams;
        unitPrice = Math.round(grams * Number(prod.razlivPricePerGram || 0));
        rawQtyForLoyalty = 1;

        if (availableMl < deductedMl) {
          return NextResponse.json(
            {
              ok: false,
              error: `Omborda yetarli razliv atir qolmagan! Mavjud qoldiq: ${availableMl} gr/ml.`,
            },
            { status: 400 }
          );
        }
      }

      const config = await getAppConfig();
      const breakdown = computeLoyaltyBreakdown({
        config,
        customer,
        rawLines: [
          {
            product: prod,
            quantity: rawQtyForLoyalty,
            unitPrice,
          },
        ],
        requestedRedeemGrams: 0,
      });

      // Immediately deduct stockMl from warehouse so remaining bottles/razliv update in real time!
      await db
        .update(products)
        .set({
          stockMl: sql`GREATEST(0, ${products.stockMl} - ${deductedMl})`,
          updatedAt: new Date(),
        })
        .where(eq(products.id, prod.id));

      const latestOrd = await db
        .select({ id: customerOrders.id })
        .from(customerOrders)
        .orderBy(desc(customerOrders.id))
        .limit(1);
      const orderCode = `ORD-${1001 + (latestOrd[0]?.id ?? 0)}`;

      const [createdOrder] = await db
        .insert(customerOrders)
        .values({
          orderCode,
          customerId: customer.id,
          productId: prod.id,
          productName: prod.name,
          brand: prod.brand,
          saleMode,
          selectedGramsOrQty,
          deductedMl,
          unitPrice,
          subtotalAmount: breakdown.subtotalAmount,
          discountPercent: breakdown.discountPercent,
          discountAmount: breakdown.discountAmount,
          finalAmount: breakdown.finalAmount,
          paymentMethod,
          receiptImageData,
          receiptNote,
          status: "PENDING",
        })
        .returning();

      await db.insert(auditLogs).values({
        actorType: "CUSTOMER",
        actorId: customer.id,
        actorName: customer.fullName,
        action: "CREATE_CUSTOMER_ORDER",
        entityType: "ORDER",
        entityId: String(createdOrder.id),
        details: `${customer.fullName}: ${prod.name} (${
          saleMode === "RAZLIV"
            ? `Razliv ${selectedGramsOrQty} gr`
            : `Butun flakon × ${selectedGramsOrQty}`
        }) — ${paymentMethod} — ${breakdown.finalAmount} so‘m`,
      });

      const portalData = await loadSingleCustomerPortalData(customer.id);
      const updatedProducts = await db
        .select({
          id: products.id,
          productCode: products.productCode,
          name: products.name,
          brand: products.brand,
          category: products.category,
          volume: products.volume,
          bottleVolumeMl: products.bottleVolumeMl,
          stockMl: products.stockMl,
          price: products.price,
          razlivPricePerGram: products.razlivPricePerGram,
          razlivSizes: products.razlivSizes,
          allowBottleSale: products.allowBottleSale,
          allowRazlivSale: products.allowRazlivSale,
          imageUrl: products.imageUrl,
          description: products.description,
        })
        .from(products)
        .where(eq(products.isActive, true))
        .orderBy(products.id);

      return NextResponse.json({
        ok: true,
        order: createdOrder,
        portalData,
        featuredProducts: updatedProducts,
        message:
          paymentMethod === "PAYNET"
            ? `Buyurtma (#${orderCode}) va Paynet to‘lov chekingiz adminga yuborildi! Yakuniy summa: ${breakdown.finalAmount.toLocaleString("ru-RU")} so‘m.`
            : `Buyurtma (#${orderCode}) qabul qilindi! Do‘kondan olishda naqd to‘lashingiz mumkin (${breakdown.finalAmount.toLocaleString("ru-RU")} so‘m).`,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Noma’lum amal." },
      { status: 400 }
    );
  } catch (err) {
    console.error("POST /api/customer-portal error:", err);
    return NextResponse.json(
      { ok: false, error: "Amalni bajarishda xatolik yuz berdi." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  await clearCustomerSessionCookie();
  return NextResponse.json({ ok: true });
}
