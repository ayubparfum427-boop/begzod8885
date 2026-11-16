import { db } from "@/db";
import {
  auditLogs,
  bonusTransactions,
  customers,
  customerVipHistory,
  discountTransactions,
  employees,
  products,
  profiles,
  qrRegistrations,
  qrSources,
  saleItems,
  sales,
} from "@/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import { normalizeUzbekPhone } from "./format";
import {
  AppConfig,
  getAppConfig,
  reconcileDatabaseIntegrity,
} from "./settings-service";

export interface RegisterCustomerInput {
  fullName: string;
  phone: string;
  consentAccepted: boolean;
  qrSource?: string | null;
  referralUrl?: string | null;
  userAgent?: string | null;
  registeredByEmployeeId?: number | null;
  actorName?: string;
}

export async function generateUniqueCustomerCode(): Promise<string> {
  const allCodes = await db
    .select({ code: customers.customerCode })
    .from(customers);

  let maxNum = 10000;
  for (const r of allCodes) {
    const match = /^AYB-(\d+)$/.exec(r.code);
    if (match) {
      const n = Number(match[1]);
      if (n > maxNum) maxNum = n;
    }
  }

  return `AYB-${maxNum + 1}`;
}

export async function generateUniqueSaleCode(): Promise<string> {
  const latest = await db
    .select({ id: sales.id })
    .from(sales)
    .orderBy(desc(sales.id))
    .limit(1);
  const year = new Date().getFullYear();
  const nextNum = 1001 + (latest[0]?.id ?? 0);
  const candidate = `SAV-${year}-${nextNum}`;
  const exists = await db
    .select({ id: sales.id })
    .from(sales)
    .where(eq(sales.saleCode, candidate))
    .limit(1);

  if (exists.length === 0) return candidate;
  return `SAV-${year}-${nextNum}-${Math.floor(10 + Math.random() * 89)}`;
}

export async function registerCustomerOnServer(input: RegisterCustomerInput) {
  const config = await getAppConfig();

  const trimmedName = (input.fullName || "").trim();
  if (trimmedName.length < 2) {
    return {
      ok: false as const,
      error: "Iltimos, to‘liq ismingizni kiriting (kamida 2 ta harf).",
    };
  }

  const normalizedPhone = normalizeUzbekPhone(input.phone || "");
  if (!normalizedPhone) {
    return {
      ok: false as const,
      error:
        "Telefon raqami O‘zbekiston formatida bo‘lishi shart: +998 XX XXX XX XX",
    };
  }

  if (config.requireConsent && !input.consentAccepted) {
    return {
      ok: false as const,
      error:
        "Davom etish uchun shaxsiy ma’lumotlarga rozilik belgisini qo‘ying.",
    };
  }

  // Enforce unique phone constraint cleanly before insert
  const existing = await db
    .select()
    .from(customers)
    .where(eq(customers.phone, normalizedPhone))
    .limit(1);

  if (existing.length > 0) {
    return {
      ok: false as const,
      code: "DUPLICATE_PHONE",
      error:
        "Ushbu telefon raqami bilan mijoz avval ro‘yxatdan o‘tgan! Bitta raqamga faqat bitta profil ochiladi.",
    };
  }

  // Resolve QR source
  const rawSource = (input.qrSource || "direct").trim().toLowerCase();
  let matchedQr: typeof qrSources.$inferSelect | null = null;
  if (rawSource && rawSource !== "direct") {
    const qrRows = await db
      .select()
      .from(qrSources)
      .where(eq(qrSources.code, rawSource))
      .limit(1);
    if (qrRows.length > 0 && qrRows[0].isActive) {
      matchedQr = qrRows[0];
    }
  }

  const finalQrSource = matchedQr ? matchedQr.code : rawSource || "direct";
  const customerCode = await generateUniqueCustomerCode();

  // First-time welcome bonus rule (5g once upon registration)
  const welcomeGrams =
    config.bonusEnabled && config.welcomeBonusGrams > 0
      ? Number(config.welcomeBonusGrams)
      : 0;

  const expiresAt =
    config.bonusExpiryDays > 0
      ? new Date(Date.now() + config.bonusExpiryDays * 24 * 60 * 60 * 1000)
      : null;

  const [profile] = await db
    .insert(profiles)
    .values({
      role: "CUSTOMER",
      fullName: trimmedName,
      phone: normalizedPhone,
      isActive: true,
    })
    .returning();

  const [newCustomer] = await db
    .insert(customers)
    .values({
      profileId: profile.id,
      customerCode,
      fullName: trimmedName,
      phone: normalizedPhone,
      consentAccepted: Boolean(input.consentAccepted),
      qrSource: finalQrSource,
      bonusGrams: welcomeGrams,
      totalBonusEarnedGrams: welcomeGrams,
      totalBonusUsedGrams: 0,
      isVip: false,
      totalSpent: 0,
      purchasesCount: 0,
      totalItemsBought: 0,
      isBlocked: false,
      registeredByEmployeeId: input.registeredByEmployeeId ?? null,
    })
    .returning();

  if (matchedQr) {
    await db.insert(qrRegistrations).values({
      qrSourceId: matchedQr.id,
      customerId: newCustomer.id,
      sourceCode: matchedQr.code,
      referralUrl: input.referralUrl || matchedQr.customPath,
      userAgent: input.userAgent || null,
    });

    await db
      .update(qrSources)
      .set({
        registrationsCount: sql`${qrSources.registrationsCount} + 1`,
        scansCount: sql`GREATEST(${qrSources.scansCount}, ${qrSources.registrationsCount} + 1)`,
        updatedAt: new Date(),
      })
      .where(eq(qrSources.id, matchedQr.id));
  }

  if (welcomeGrams > 0) {
    await db.insert(bonusTransactions).values({
      customerId: newCustomer.id,
      employeeId: input.registeredByEmployeeId ?? null,
      type: "WELCOME",
      amountGrams: welcomeGrams,
      balanceAfterGrams: welcomeGrams,
      description: `Yangi mijoz birinchi ro‘yxatdan o‘tish bonusi (+${welcomeGrams} gr atir)`,
      expiresAt,
      isUsed: false,
    });
  }

  if (input.registeredByEmployeeId) {
    await db
      .update(employees)
      .set({
        registeredCustomersCount: sql`${employees.registeredCustomersCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, input.registeredByEmployeeId));
  }

  await db.insert(auditLogs).values({
    actorType: input.registeredByEmployeeId ? "EMPLOYEE" : "CUSTOMER",
    actorId: input.registeredByEmployeeId ?? newCustomer.id,
    actorName: input.actorName || trimmedName,
    action: "REGISTER_CUSTOMER",
    entityType: "CUSTOMER",
    entityId: String(newCustomer.id),
    details: `${trimmedName} (${normalizedPhone}) manba: ${finalQrSource}, bonus: +${welcomeGrams} gr`,
  });

  return {
    ok: true as const,
    customer: newCustomer,
    welcomeBonusGranted: welcomeGrams,
  };
}

export interface SaleLineInput {
  productId: number;
  quantity: number;
  customUnitPrice?: number;
  saleMode?: "BOTTLE" | "RAZLIV";
  razlivGrams?: number;
  volumeLabel?: string;
}

export interface SalePreviewResult {
  subtotalAmount: number;
  discountPercent: number;
  discountAmount: number;
  finalAmount: number;
  ruleApplied: string;
  bonusGramsAvailable: number;
  bonusGramsUsed: number;
  bonusGramsEarned: number;
  willBecomeVip: boolean;
  explanation: string;
  lines: Array<{
    productId: number;
    productName: string;
    brand: string;
    volume: string;
    category: string;
    quantity: number;
    unitPrice: number;
    lineSubtotal: number;
    discountPercent: number;
    discountAmount: number;
    lineFinalAmount: number;
  }>;
}

export function computeLoyaltyBreakdown(params: {
  config: AppConfig;
  customer: typeof customers.$inferSelect;
  rawLines: Array<{
    product: typeof products.$inferSelect;
    quantity: number;
    unitPrice: number;
    volumeLabel?: string;
  }>;
  requestedRedeemGrams: number;
}): SalePreviewResult {
  const { config, customer, rawLines, requestedRedeemGrams } = params;

  const subtotalAmount = rawLines.reduce(
    (acc, item) =>
      acc + Math.max(1, item.quantity) * Math.max(0, item.unitPrice),
    0
  );

  // Check category eligibility for discounts
  const allowedCatsRaw = (config.applicableCategories || "Barchasi").trim();
  const isAllCategories =
    allowedCatsRaw.toLowerCase() === "barchasi" ||
    allowedCatsRaw.toLowerCase() === "all" ||
    allowedCatsRaw === "";

  const allowedCats = isAllCategories
    ? []
    : allowedCatsRaw.split(",").map((c) => c.trim().toLowerCase());

  const hasEligibleCategory =
    isAllCategories ||
    rawLines.some((l) =>
      allowedCats.includes(l.product.category.toLowerCase())
    );

  // 1. Determine single non-stacking percentage discount
  let eligiblePercent = 0;
  let ruleApplied = "NONE";

  if (config.discountsEnabled && hasEligibleCategory) {
    if (
      subtotalAmount > config.discountThresholdAmount &&
      subtotalAmount >= config.minPurchaseForDiscount
    ) {
      if (customer.isVip) {
        eligiblePercent = config.vipDiscountPercent;
        ruleApplied = `VIP_${config.vipDiscountPercent}`;
      } else {
        eligiblePercent = config.regularDiscountPercent;
        ruleApplied = `STANDARD_${config.regularDiscountPercent}`;
      }
    }

    // Personal coupon discount (non-stacking; takes single best)
    if (
      customer.customDiscountPercent &&
      customer.customDiscountPercent > eligiblePercent &&
      subtotalAmount >= config.minPurchaseForDiscount
    ) {
      eligiblePercent = customer.customDiscountPercent;
      ruleApplied = `PERSONAL_${customer.customDiscountPercent}`;
    }
  }

  // 2. Bonus + Discount combination rule
  const availableGrams = Math.max(0, Number(customer.bonusGrams || 0));
  let bonusGramsUsed = Math.min(
    availableGrams,
    Math.max(0, Number(requestedRedeemGrams || 0))
  );

  const explanationNotes: string[] = [];

  if (bonusGramsUsed > 0 && eligiblePercent > 0) {
    if (config.bonusDiscountRule === "DISCOUNT_PRIORITY") {
      bonusGramsUsed = 0;
      explanationNotes.push(
        "Chegirma ustuvorligi qoidasiga ko‘ra foizli chegirma qo‘llandi, bonus grammlar keyingi xarid uchun saqlab qolindi."
      );
    } else if (config.bonusDiscountRule === "BONUS_ONLY") {
      eligiblePercent = 0;
      ruleApplied = "BONUS_PRIORITY";
      explanationNotes.push(
        "Bonus ishlatilgani sababli foizli chegirma o‘rniga bonus atir taqdim etildi."
      );
    } else {
      explanationNotes.push(
        "Admin sozlamasiga ko‘ra chegirma va bonus grammlar birgalikda qo‘llandi."
      );
    }
  } else if (bonusGramsUsed > 0) {
    explanationNotes.push(
      `Mijoz balansidan ${bonusGramsUsed} gr atir bonusi ishlatildi.`
    );
  }

  // 3. Calculate capped discount amount
  let discountAmount = Math.round((subtotalAmount * eligiblePercent) / 100);
  if (
    config.maxDiscountAmount > 0 &&
    discountAmount > config.maxDiscountAmount
  ) {
    discountAmount = config.maxDiscountAmount;
  }

  const finalAmount = Math.max(0, subtotalAmount - discountAmount);

  // 4. Repeat purchase bonus rule:
  // - Only for repeat purchases (customer.purchasesCount >= 1, since 1st registration already granted +5g welcome bonus)
  // - Only up to 250,000 so'm (when no percentage discount & no bonus redemption on this receipt)
  let bonusGramsEarned = 0;
  const isRepeatPurchase = Number(customer.purchasesCount || 0) >= 1;

  if (
    config.bonusEnabled &&
    subtotalAmount > 0 &&
    subtotalAmount <= config.repeatBonusMaxAmount &&
    eligiblePercent === 0 &&
    bonusGramsUsed === 0
  ) {
    if (isRepeatPurchase) {
      bonusGramsEarned = Number(config.repeatBonusGrams || 0);
      explanationNotes.push(
        `Qayta xarid qoidasiga ko‘ra (${config.repeatBonusMaxAmount.toLocaleString("ru-RU")} so‘mgacha) +${bonusGramsEarned} gr atir bonusi hisoblandi.`
      );
    } else {
      explanationNotes.push(
        `Birinchi xarid (ro‘yxatdan o‘tishda +${config.welcomeBonusGrams} gr bonus berilgan; keyingi qayta xaridlardan boshlab +${config.repeatBonusGrams} gr bonus beriladi).`
      );
    }
  } else if (eligiblePercent > 0) {
    explanationNotes.push(
      `${eligiblePercent}% chegirma (-${discountAmount.toLocaleString("ru-RU")} so‘m) qo‘llandi.`
    );
  }

  const projectedTotalSpent = Number(customer.totalSpent || 0) + finalAmount;
  const willBecomeVip =
    config.autoVipEnabled &&
    !customer.isVip &&
    projectedTotalSpent >= config.vipMinTotalSpent;

  if (willBecomeVip) {
    explanationNotes.push(
      "Ushbu xarid bilan mijoz jami xarid chegarasidan o‘tib avtomatik VIP maqom oladi!"
    );
  }

  // Distribute discount across lines with exact remainder reconciliation so SUM(lineFinalAmount) === finalAmount
  let allocatedDiscount = 0;
  const lines = rawLines.map((item, idx) => {
    const qty = Math.max(1, item.quantity);
    const lineSubtotal = qty * item.unitPrice;
    const isLast = idx === rawLines.length - 1;
    const lineDisc =
      subtotalAmount > 0
        ? isLast
          ? Math.max(0, discountAmount - allocatedDiscount)
          : Math.round((lineSubtotal / subtotalAmount) * discountAmount)
        : 0;
    allocatedDiscount += lineDisc;

    return {
      productId: item.product.id,
      productName: item.product.name,
      brand: item.product.brand,
      volume: item.volumeLabel || item.product.volume,
      category: item.product.category,
      quantity: qty,
      unitPrice: item.unitPrice,
      lineSubtotal,
      discountPercent: eligiblePercent,
      discountAmount: lineDisc,
      lineFinalAmount: Math.max(0, lineSubtotal - lineDisc),
    };
  });

  return {
    subtotalAmount,
    discountPercent: eligiblePercent,
    discountAmount,
    finalAmount,
    ruleApplied,
    bonusGramsAvailable: availableGrams,
    bonusGramsUsed,
    bonusGramsEarned,
    willBecomeVip,
    explanation:
      explanationNotes.join(" ") || "Standart hisob-kitob bajarildi.",
    lines,
  };
}

export async function createSaleTransaction(params: {
  customerId: number;
  items: SaleLineInput[];
  redeemBonusGrams?: number;
  paymentMethod?: string;
  notes?: string;
  employeeId?: number | null;
  cashierName?: string;
  skipStockDeduction?: boolean;
}) {
  const config = await getAppConfig();

  const custRows = await db
    .select()
    .from(customers)
    .where(eq(customers.id, params.customerId))
    .limit(1);

  if (custRows.length === 0) {
    return { ok: false as const, error: "Mijoz topilmadi." };
  }
  const customer = custRows[0];
  if (customer.isBlocked) {
    return {
      ok: false as const,
      error: "Ushbu mijoz profili bloklangan. Savdo kiritish mumkin emas.",
    };
  }

  if (!params.items || params.items.length === 0) {
    return { ok: false as const, error: "Kamida bitta atir tanlanishi kerak." };
  }

  const rawLines: Array<{
    product: typeof products.$inferSelect;
    quantity: number;
    unitPrice: number;
    volumeLabel: string;
    deductMl: number;
  }> = [];

  for (const line of params.items) {
    const prodRows = await db
      .select()
      .from(products)
      .where(eq(products.id, Number(line.productId)))
      .limit(1);
    if (prodRows.length === 0) {
      return { ok: false as const, error: "Tanlangan mahsulot topilmadi." };
    }
    const prod = prodRows[0];
    const isRazliv = line.saleMode === "RAZLIV";
    const qty = Math.max(1, Math.round(Number(line.quantity || 1)));
    const grams = Math.max(1, Number(line.razlivGrams || 10));

    const deductMl = isRazliv
      ? grams * qty
      : Number(prod.bottleVolumeMl || 100) * qty;

    if (!params.skipStockDeduction && Number(prod.stockMl || 0) < deductMl) {
      return {
        ok: false as const,
        error: isRazliv
          ? `Omborda yetarli razliv atir qolmagan! Mavjud: ${prod.stockMl} ml/gr`
          : `Omborda butun flakon atir tugadi! (Qoldiq: ${prod.stockMl} ml, butun flakon uchun ${prod.bottleVolumeMl} ml kerak)`,
      };
    }

    const defaultPrice = isRazliv
      ? Math.round(grams * Number(prod.razlivPricePerGram || 0))
      : Number(prod.price);

    const unitPrice =
      line.customUnitPrice !== undefined && line.customUnitPrice >= 0
        ? Math.round(Number(line.customUnitPrice))
        : defaultPrice;

    const volumeLabel =
      line.volumeLabel ||
      (isRazliv
        ? `Razliv ${grams} gr`
        : `Butun flakon (${prod.bottleVolumeMl || 100} ml)`);

    rawLines.push({
      product: prod,
      quantity: qty,
      unitPrice,
      volumeLabel,
      deductMl,
    });
  }

  const preview = computeLoyaltyBreakdown({
    config,
    customer,
    rawLines,
    requestedRedeemGrams: Number(params.redeemBonusGrams || 0),
  });

  const saleCode = await generateUniqueSaleCode();
  const now = new Date();
  const expiresAt =
    config.bonusExpiryDays > 0
      ? new Date(now.getTime() + config.bonusExpiryDays * 24 * 60 * 60 * 1000)
      : null;

  const [newSale] = await db
    .insert(sales)
    .values({
      saleCode,
      customerId: customer.id,
      employeeId: params.employeeId ?? null,
      cashierName: params.cashierName || "Admin",
      subtotalAmount: preview.subtotalAmount,
      discountPercent: preview.discountPercent,
      discountAmount: preview.discountAmount,
      finalAmount: preview.finalAmount,
      bonusGramsUsed: preview.bonusGramsUsed,
      bonusGramsEarned: preview.bonusGramsEarned,
      isVipSale: customer.isVip,
      paymentMethod: params.paymentMethod || config.defaultPaymentMethod,
      notes: params.notes || null,
    })
    .returning();

  for (let i = 0; i < preview.lines.length; i++) {
    const l = preview.lines[i];
    const rl = rawLines[i];
    await db.insert(saleItems).values({
      saleId: newSale.id,
      productId: l.productId,
      productName: l.productName,
      brand: l.brand,
      volume: l.volume,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineSubtotal: l.lineSubtotal,
      discountPercent: l.discountPercent,
      discountAmount: l.discountAmount,
      lineFinalAmount: l.lineFinalAmount,
    });

    if (!params.skipStockDeduction && rl && rl.deductMl > 0) {
      await db
        .update(products)
        .set({
          stockMl: sql`GREATEST(0, ${products.stockMl} - ${rl.deductMl})`,
          updatedAt: now,
        })
        .where(eq(products.id, l.productId));
    }
  }

  if (preview.discountPercent > 0 && preview.discountAmount > 0) {
    await db.insert(discountTransactions).values({
      customerId: customer.id,
      saleId: newSale.id,
      employeeId: params.employeeId ?? null,
      discountPercent: preview.discountPercent,
      originalAmount: preview.subtotalAmount,
      discountAmount: preview.discountAmount,
      finalAmount: preview.finalAmount,
      ruleApplied: preview.ruleApplied,
      isActive: true,
      notes: `Savdo ${saleCode} bo‘yicha ${preview.discountPercent}% chegirma`,
    });
  }

  let runningBonus = Number(customer.bonusGrams || 0);
  if (preview.bonusGramsUsed > 0) {
    runningBonus = Math.max(0, runningBonus - preview.bonusGramsUsed);
    await db.insert(bonusTransactions).values({
      customerId: customer.id,
      saleId: newSale.id,
      employeeId: params.employeeId ?? null,
      type: "REDEEMED",
      amountGrams: -preview.bonusGramsUsed,
      balanceAfterGrams: runningBonus,
      description: `Savdo (${saleCode}) da ${preview.bonusGramsUsed} gr bonus ishlatildi`,
      isUsed: true,
    });

    // Mark oldest unused positive bonuses as used
    const unusedPos = await db
      .select()
      .from(bonusTransactions)
      .where(eq(bonusTransactions.customerId, customer.id))
      .orderBy(asc(bonusTransactions.id));
    let rem = preview.bonusGramsUsed;
    for (const row of unusedPos) {
      if (rem <= 0) break;
      if (row.amountGrams > 0 && !row.isUsed) {
        await db
          .update(bonusTransactions)
          .set({ isUsed: true, updatedAt: now })
          .where(eq(bonusTransactions.id, row.id));
        rem -= row.amountGrams;
      }
    }
  }

  if (preview.bonusGramsEarned > 0) {
    runningBonus += preview.bonusGramsEarned;
    await db.insert(bonusTransactions).values({
      customerId: customer.id,
      saleId: newSale.id,
      employeeId: params.employeeId ?? null,
      type: "REPEAT_PURCHASE",
      amountGrams: preview.bonusGramsEarned,
      balanceAfterGrams: runningBonus,
      description: `Qayta xarid bonusi (+${preview.bonusGramsEarned} gr atir) — ${saleCode}`,
      expiresAt,
      isUsed: false,
    });
  }

  const newTotalSpent = Number(customer.totalSpent || 0) + preview.finalAmount;
  const shouldPromoteVip =
    config.autoVipEnabled &&
    !customer.isVip &&
    newTotalSpent >= config.vipMinTotalSpent;

  await db
    .update(customers)
    .set({
      isVip: customer.isVip || shouldPromoteVip,
      vipSince: shouldPromoteVip ? now : customer.vipSince,
      customDiscountPercent: preview.ruleApplied.startsWith("PERSONAL_")
        ? null
        : customer.customDiscountPercent,
      updatedAt: now,
    })
    .where(eq(customers.id, customer.id));

  if (shouldPromoteVip) {
    await db.insert(customerVipHistory).values({
      customerId: customer.id,
      previousStatus: false,
      newStatus: true,
      reason: `Avtomatik VIP: jami xarid ${newTotalSpent.toLocaleString("ru-RU")} so‘mga yetdi`,
      totalSpentAtChange: newTotalSpent,
      changedByEmployeeId: params.employeeId ?? null,
    });
  }

  // Reconcile all customer, product, and employee totals so zero drift is possible
  await reconcileDatabaseIntegrity();

  await db.insert(auditLogs).values({
    actorType: params.employeeId ? "EMPLOYEE" : "ADMIN",
    actorId: params.employeeId ?? null,
    actorName: params.cashierName || "Admin",
    action: "CREATE_SALE",
    entityType: "SALE",
    entityId: String(newSale.id),
    details: `Savdo ${saleCode}: ${customer.fullName}, yakuniy summa: ${preview.finalAmount} so‘m`,
  });

  return {
    ok: true as const,
    sale: newSale,
    preview,
    promotedToVip: shouldPromoteVip,
  };
}
