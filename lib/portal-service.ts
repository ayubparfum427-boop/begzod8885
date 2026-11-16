import { db } from "@/db";
import {
  bonusTransactions,
  customerOrders,
  customers,
  discountTransactions,
  products,
  saleItems,
  sales,
} from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import QRCode from "qrcode";
import { ensureSystemBootstrapped, getAppConfig } from "./settings-service";

export async function loadCustomerPortalById(customerId: number) {
  const custRows = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (custRows.length === 0 || custRows[0].isBlocked) return null;
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
    id: s.id,
    saleCode: s.saleCode,
    cashierName: s.cashierName,
    subtotalAmount: s.subtotalAmount,
    discountPercent: s.discountPercent,
    discountAmount: s.discountAmount,
    finalAmount: s.finalAmount,
    bonusGramsUsed: s.bonusGramsUsed,
    bonusGramsEarned: s.bonusGramsEarned,
    createdAt: s.createdAt.toISOString(),
    items: items
      .filter((it) => it.saleId === s.id)
      .map((it) => ({
        id: it.id,
        productName: it.productName,
        brand: it.brand,
        volume: it.volume,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountPercent: it.discountPercent,
        discountAmount: it.discountAmount,
        lineFinalAmount: it.lineFinalAmount,
      })),
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
      vipSince: customer.vipSince ? customer.vipSince.toISOString() : null,
      totalSpent: customer.totalSpent,
      purchasesCount: customer.purchasesCount,
      totalItemsBought: customer.totalItemsBought,
      lastPurchaseAt: customer.lastPurchaseAt
        ? customer.lastPurchaseAt.toISOString()
        : null,
      createdAt: customer.createdAt.toISOString(),
    },
    bonuses: bonuses.map((b) => ({
      id: b.id,
      type: b.type,
      amountGrams: b.amountGrams,
      balanceAfterGrams: b.balanceAfterGrams,
      description: b.description,
      expiresAt: b.expiresAt ? b.expiresAt.toISOString() : null,
      isUsed: b.isUsed,
      createdAt: b.createdAt.toISOString(),
    })),
    discounts: discounts.map((d) => ({
      id: d.id,
      discountPercent: d.discountPercent,
      originalAmount: d.originalAmount,
      discountAmount: d.discountAmount,
      finalAmount: d.finalAmount,
      ruleApplied: d.ruleApplied,
      expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
      notes: d.notes,
      createdAt: d.createdAt.toISOString(),
    })),
    purchasesHistory,
    orders: orders.map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      productName: o.productName,
      brand: o.brand,
      saleMode: o.saleMode,
      selectedGramsOrQty: o.selectedGramsOrQty,
      deductedMl: o.deductedMl,
      finalAmount: o.finalAmount,
      paymentMethod: o.paymentMethod,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

export async function getInitialPublicPortalPayload() {
  await ensureSystemBootstrapped();
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
      // Ignore
    }
  }

  return {
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
  };
}
