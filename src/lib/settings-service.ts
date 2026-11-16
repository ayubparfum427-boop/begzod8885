import { db } from "@/db";
import {
  appSettings,
  auditLogs,
  bonusTransactions,
  customers,
  customerVipHistory,
  discountTransactions,
  employees,
  notificationLogs,
  products,
  profiles,
  qrRegistrations,
  qrSources,
  saleItems,
  sales,
  telegramBots,
} from "@/db/schema";
import { asc, eq, like } from "drizzle-orm";
import { ensureTablesExist } from "./db-init";
import { hashSecret, verifySecret } from "./security";

export interface AppConfig {
  // Store & Branding
  storeName: string;
  clubName: string;
  logoUrl: string;
  storePhone: string;
  publicBaseUrl: string;
  telegramChannelUrl: string;
  instagramUrl: string;
  emeraldColor: string;
  premiumGreenColor: string;
  goldColor: string;
  currency: string;
  dateFormat: string;

  // Bonus System
  bonusEnabled: boolean;
  welcomeBonusGrams: number; // Default: 5 gr
  repeatBonusGrams: number; // Default: 5 gr (up to 250,000 so'm)
  repeatBonusMaxAmount: number; // Default: 250,000 so'm
  gramValueInSom: number; // Monetary value per gram for reporting (e.g., 15,000 so'm)
  bonusExpiryDays: number; // Default: 90 days

  // Discount System
  discountsEnabled: boolean;
  discountThresholdAmount: number; // Default: 250,000 so'm
  regularDiscountPercent: number; // Default: 30%
  vipDiscountPercent: number; // Default: 45%
  minPurchaseForDiscount: number; // Default: 250,000 so'm
  maxDiscountAmount: number; // Default: 5,000,000 so'm
  discountExpiryDays: number; // Default: 60 days
  applicableCategories: string; // "Barchasi" or comma-separated
  bonusDiscountRule: "DISCOUNT_PRIORITY" | "ALLOW_BOTH" | "BONUS_ONLY";

  // VIP System
  autoVipEnabled: boolean;
  vipMinTotalSpent: number; // Default: 1,000,000 so'm

  // Registration & Sales & Notifications
  requireConsent: boolean;
  allowSelfRegistration: boolean;
  defaultPaymentMethod: string;
  autoNotifyWelcome: boolean;
  autoNotifySale: boolean;

  // Payment & Paynet QR System
  paynetPaymentUrl: string;
  paynetMerchantTitle: string;
  paynetInstructions: string;
  cashInstructions: string;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  storeName: "AYUB PARFUM",
  clubName: "AYUB CLUB PRO",
  logoUrl: "/images/ayub-hero-perfume.jpg",
  storePhone: "+998 90 777 55 77",
  publicBaseUrl: "",
  telegramChannelUrl: "https://t.me/ayub_parfum",
  instagramUrl: "https://instagram.com/ayub_parfum",
  emeraldColor: "#064E3B",
  premiumGreenColor: "#047857",
  goldColor: "#D4AF37",
  currency: "so‘m",
  dateFormat: "DD.MM.YYYY",

  bonusEnabled: true,
  welcomeBonusGrams: 5,
  repeatBonusGrams: 5,
  repeatBonusMaxAmount: 250000,
  gramValueInSom: 15000,
  bonusExpiryDays: 90,

  discountsEnabled: true,
  discountThresholdAmount: 250000,
  regularDiscountPercent: 30,
  vipDiscountPercent: 45,
  minPurchaseForDiscount: 250000,
  maxDiscountAmount: 5000000,
  discountExpiryDays: 60,
  applicableCategories: "Barchasi",
  bonusDiscountRule: "DISCOUNT_PRIORITY",

  autoVipEnabled: true,
  vipMinTotalSpent: 1000000,

  requireConsent: true,
  allowSelfRegistration: true,
  defaultPaymentMethod: "Naqd / Karta",
  autoNotifyWelcome: true,
  autoNotifySale: true,

  paynetPaymentUrl:
    "https://app.paynet.uz/qr-online/00020101021140440012qr-online.uz01186qqUVaTWFKr2WaPJkW0202115204531153038605802UZ5910AO'PAYNET'6008Tashkent610610002164280002uz0106PAYNET0208Toshkent80520012qr-online.uz03097120207070419marketing@paynet.uz63049290",
  paynetMerchantTitle: "AYUB PARFUM — Rasmiy Paynet QR To‘lov",
  paynetInstructions:
    "Paynet ilovasi yoki kamera orqali QR-kodni skanerlab to‘lov qiling va to‘lov chekini (skrinshotini) pastdagi tugma orqali yuklab yuboring.",
  cashInstructions:
    "Buyurtmangiz band qilinadi — atirni do‘kondan olayotganda kassaga naqd to‘lashingiz mumkin.",
};

const CONFIG_KEY = "system_config_json";
const ADMIN_PIN_KEY = "admin_pin_hash";
const BOOTSTRAPPED_KEY = "initial_bootstrap_v2_consistent";

let bootstrapPromise: Promise<void> | null = null;
let bootstrapCompleteInMemory = false;
let envSyncedThisProcess = false;

async function syncEnvironmentSecretsAndDomain(): Promise<void> {
  if (envSyncedThisProcess) return;
  envSyncedThisProcess = true;

  try {
    const pairs: Array<{ key: string; token: string | undefined }> = [
      { key: "ayub_club", token: process.env.TELEGRAM_CLUB_BOT_TOKEN },
      { key: "ayub_info", token: process.env.TELEGRAM_INFO_BOT_TOKEN },
    ];

    for (const pair of pairs) {
      const cleanToken = (pair.token || "").trim();
      if (!cleanToken) continue;

      const rows = await db
        .select()
        .from(telegramBots)
        .where(eq(telegramBots.botKey, pair.key))
        .limit(1);

      if (rows.length > 0 && !rows[0].botTokenSecret) {
        let botUsername = rows[0].botUsername;
        let isConnected = true;
        let statusMessage = "Muhit o‘zgaruvchisi orqali ulandi";

        try {
          const tgRes = await fetch(
            `https://api.telegram.org/bot${cleanToken}/getMe`,
            { signal: AbortSignal.timeout(2500) }
          );
          const tgJson = await tgRes.json();
          if (tgJson.ok && tgJson.result) {
            botUsername = `@${tgJson.result.username}`;
            isConnected = true;
            statusMessage = `Telegram API ulandi: ${tgJson.result.first_name} (${botUsername})`;
          }
        } catch {
          // Keep token saved even if external check times out
        }

        await db
          .update(telegramBots)
          .set({
            botTokenSecret: cleanToken,
            botUsername,
            isActive: isConnected,
            isConnected,
            lastCheckedAt: new Date(),
            statusMessage,
            updatedAt: new Date(),
          })
          .where(eq(telegramBots.id, rows[0].id));
      }
    }

    // Auto-detect clean Vercel / custom domain if publicBaseUrl is not set yet
    const vercelProd = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "")
    )
      .trim()
      .replace(/\/+$/, "");

    if (vercelProd && !vercelProd.includes(".e2b.app")) {
      const cfgRows = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.settingKey, CONFIG_KEY))
        .limit(1);
      if (cfgRows.length > 0) {
        const parsed = JSON.parse(cfgRows[0].settingValue) as Partial<AppConfig>;
        if (!parsed.publicBaseUrl) {
          parsed.publicBaseUrl = vercelProd;
          await db
            .update(appSettings)
            .set({
              settingValue: JSON.stringify({
                ...DEFAULT_APP_CONFIG,
                ...parsed,
              }),
              updatedAt: new Date(),
            })
            .where(eq(appSettings.settingKey, CONFIG_KEY));
        }
      }
    }
  } catch {
    // Non-fatal sync
  }
}

export async function ensureSystemBootstrapped(): Promise<void> {
  if (bootstrapCompleteInMemory) {
    return;
  }
  if (bootstrapPromise) {
    return bootstrapPromise;
  }
  bootstrapPromise = (async () => {
    await runBootstrap();
    bootstrapCompleteInMemory = true;
    void syncEnvironmentSecretsAndDomain();
  })().finally(() => {
    bootstrapPromise = null;
  });
  return bootstrapPromise;
}

/**
 * Recomputes all cached summary fields on customers, products, employees,
 * qr_sources, and bonus_transactions so every table, KPI, and report
 * matches 100% down to every single so'm, gram, and count.
 */
export async function reconcileDatabaseIntegrity(): Promise<void> {
  const [
    allCusts,
    allSales,
    allItems,
    allBonuses,
    allProducts,
    allEmployees,
    allQrSources,
    allQrRegs,
  ] = await Promise.all([
    db.select().from(customers),
    db.select().from(sales).orderBy(asc(sales.createdAt), asc(sales.id)),
    db.select().from(saleItems),
    db
      .select()
      .from(bonusTransactions)
      .orderBy(asc(bonusTransactions.createdAt), asc(bonusTransactions.id)),
    db.select().from(products),
    db.select().from(employees),
    db.select().from(qrSources),
    db.select().from(qrRegistrations),
  ]);

  // 1. Reconcile Customers (sales totals, item counts, last purchase, and bonus running balances)
  for (const cust of allCusts) {
    const custSales = allSales.filter((s) => s.customerId === cust.id);
    const custSaleIds = new Set(custSales.map((s) => s.id));
    const custItems = allItems.filter((it) => custSaleIds.has(it.saleId));

    const totalSpent = custSales.reduce(
      (sum, s) => sum + Number(s.finalAmount || 0),
      0
    );
    const purchasesCount = custSales.length;
    const totalItemsBought = custItems.reduce(
      (sum, it) => sum + Number(it.quantity || 0),
      0
    );
    const lastPurchaseAt =
      custSales.length > 0
        ? custSales[custSales.length - 1].createdAt
        : null;

    const custBonuses = allBonuses.filter((b) => b.customerId === cust.id);
    let earnedGrams = 0;
    let usedGrams = 0;
    let runningBalance = 0;

    for (const b of custBonuses) {
      const amt = Number(b.amountGrams || 0);
      if (amt >= 0) {
        earnedGrams += amt;
        runningBalance += amt;
      } else {
        const deduct = Math.min(runningBalance, Math.abs(amt));
        usedGrams += deduct;
        runningBalance = Math.max(0, runningBalance - deduct);
      }

      if (Number(b.balanceAfterGrams) !== runningBalance) {
        await db
          .update(bonusTransactions)
          .set({ balanceAfterGrams: runningBalance })
          .where(eq(bonusTransactions.id, b.id));
      }
    }

    // Mark positive bonus rows as isUsed = true up to usedGrams (FIFO)
    let remainingUsedToMark = usedGrams;
    for (const b of custBonuses) {
      const amt = Number(b.amountGrams || 0);
      if (amt > 0) {
        const shouldBeUsed = remainingUsedToMark >= amt;
        if (shouldBeUsed) {
          remainingUsedToMark -= amt;
        }
        if (b.isUsed !== shouldBeUsed) {
          await db
            .update(bonusTransactions)
            .set({ isUsed: shouldBeUsed })
            .where(eq(bonusTransactions.id, b.id));
        }
      }
    }

    await db
      .update(customers)
      .set({
        totalSpent,
        purchasesCount,
        totalItemsBought,
        lastPurchaseAt,
        bonusGrams: runningBalance,
        totalBonusEarnedGrams: earnedGrams,
        totalBonusUsedGrams: usedGrams,
      })
      .where(eq(customers.id, cust.id));
  }

  // 2. Reconcile Products (sold_count & total_revenue from actual sale_items)
  for (const prod of allProducts) {
    const pItems = allItems.filter((it) => it.productId === prod.id);
    const soldCount = pItems.reduce(
      (sum, it) => sum + Number(it.quantity || 0),
      0
    );
    const totalRevenue = pItems.reduce(
      (sum, it) => sum + Number(it.lineFinalAmount || 0),
      0
    );

    if (
      prod.soldCount !== soldCount ||
      Number(prod.totalRevenue) !== totalRevenue
    ) {
      await db
        .update(products)
        .set({ soldCount, totalRevenue })
        .where(eq(products.id, prod.id));
    }
  }

  // 3. Reconcile Employees (registered_customers_count, sales_count, total_sales_amount)
  for (const emp of allEmployees) {
    const regCount = allCusts.filter(
      (c) => c.registeredByEmployeeId === emp.id
    ).length;
    const empSales = allSales.filter((s) => s.employeeId === emp.id);
    const salesCount = empSales.length;
    const totalSalesAmount = empSales.reduce(
      (sum, s) => sum + Number(s.finalAmount || 0),
      0
    );

    if (
      emp.registeredCustomersCount !== regCount ||
      emp.salesCount !== salesCount ||
      Number(emp.totalSalesAmount) !== totalSalesAmount
    ) {
      await db
        .update(employees)
        .set({
          registeredCustomersCount: regCount,
          salesCount,
          totalSalesAmount,
        })
        .where(eq(employees.id, emp.id));
    }
  }

  // 4. Reconcile QR Sources & missing qr_registrations
  const regCustomerIds = new Set(allQrRegs.map((r) => r.customerId));
  for (const q of allQrSources) {
    const matchedCusts = allCusts.filter((c) => c.qrSource === q.code);
    for (const mc of matchedCusts) {
      if (!regCustomerIds.has(mc.id)) {
        await db.insert(qrRegistrations).values({
          qrSourceId: q.id,
          customerId: mc.id,
          sourceCode: q.code,
          referralUrl: q.customPath,
          userAgent: "RECONCILED",
          createdAt: mc.createdAt,
        });
        regCustomerIds.add(mc.id);
      }
    }

    const actualRegs = matchedCusts.length;
    const minScans = Math.max(q.scansCount, actualRegs);
    if (q.registrationsCount !== actualRegs || q.scansCount !== minScans) {
      await db
        .update(qrSources)
        .set({
          registrationsCount: actualRegs,
          scansCount: minScans,
        })
        .where(eq(qrSources.id, q.id));
    }
  }
}

async function runBootstrap(): Promise<void> {
  await ensureTablesExist();
  const existingFlag = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.settingKey, BOOTSTRAPPED_KEY))
    .limit(1);

  if (existingFlag.length > 0) {
    return;
  }

  // 1. Ensure system config
  const existingConfig = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.settingKey, CONFIG_KEY))
    .limit(1);

  if (existingConfig.length === 0) {
    await db.insert(appSettings).values({
      settingKey: CONFIG_KEY,
      settingValue: JSON.stringify(DEFAULT_APP_CONFIG),
      description: "AYUB CLUB PRO global system settings",
      updatedBy: "SYSTEM",
    });
  }

  // 2. Ensure Admin PIN hash (Default: 7777, stored hashed server-side only)
  const existingPin = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.settingKey, ADMIN_PIN_KEY))
    .limit(1);

  if (existingPin.length === 0) {
    const initialPin = process.env.ADMIN_INITIAL_PIN || "7777";
    await db.insert(appSettings).values({
      settingKey: ADMIN_PIN_KEY,
      settingValue: hashSecret(initialPin),
      description: "Encrypted server-side Admin PIN hash",
      updatedBy: "SYSTEM",
    });
  }

  // 3. Ensure core QR Sources (flyer & cashier)
  const existingQr = await db.select().from(qrSources);
  if (existingQr.length === 0) {
    await db.insert(qrSources).values([
      {
        code: "flyer",
        name: "FLAYER QR",
        customPath: "/register?source=flyer",
        description:
          "Reklama flayerlari va tarqatma materiallar uchun QR manbasi",
        isActive: true,
        scansCount: 38,
        registrationsCount: 3,
      },
      {
        code: "cashier",
        name: "KASSIR QR",
        customPath: "/register?source=cashier",
        description: "Do‘kon kassasi oldida tezkor ro‘yxatdan o‘tish QR kodi",
        isActive: true,
        scansCount: 52,
        registrationsCount: 3,
      },
    ]);
  }

  // 4. Ensure Telegram Bots (AYUB CLUB & AYUB INFO)
  const existingBots = await db.select().from(telegramBots);
  if (existingBots.length === 0) {
    await db.insert(telegramBots).values([
      {
        botKey: "ayub_club",
        name: "BOT 1: AYUB CLUB",
        botUsername: "@ayub_club_bot",
        botTokenSecret: process.env.TELEGRAM_CLUB_BOT_TOKEN || null,
        isActive: Boolean(process.env.TELEGRAM_CLUB_BOT_TOKEN),
        isConnected: Boolean(process.env.TELEGRAM_CLUB_BOT_TOKEN),
        statusMessage: process.env.TELEGRAM_CLUB_BOT_TOKEN
          ? "Muhit o‘zgaruvchisi orqali ulangan"
          : "Token kiritilishini kutmoqda",
        welcomeTemplate:
          "Assalomu alaykum, {ism}! ✨ AYUB CLUB PRO sodiqlik dasturiga xush kelibsiz! Sizga {bonus} gr atir bonusi taqdim etildi. Mijoz ID: {id}",
        promoTemplate:
          "Hurmatli {ism}, sizning joriy bonusingiz: {bonus} gr. VIP maqom: {vip}. Xaridlaringiz uchun rahmat!",
        bonusTemplate:
          "🎁 Tabriklaymiz, {ism}! Hisobingizga {bonus} gr atir bonusi qo‘shildi. Amal qilish muddati: {muddat}.",
      },
      {
        botKey: "ayub_info",
        name: "BOT 2: AYUB INFO",
        botUsername: "@ayub_info_bot",
        botTokenSecret: process.env.TELEGRAM_INFO_BOT_TOKEN || null,
        isActive: Boolean(process.env.TELEGRAM_INFO_BOT_TOKEN),
        isConnected: Boolean(process.env.TELEGRAM_INFO_BOT_TOKEN),
        statusMessage: process.env.TELEGRAM_INFO_BOT_TOKEN
          ? "Muhit o‘zgaruvchisi orqali ulangan"
          : "Token kiritilishini kutmoqda",
        welcomeTemplate:
          "AYUB PARFUM rasmiy yangiliklar va aksiyalar kanaliga xush kelibsiz!",
        promoTemplate:
          "🔥 YANGI AKSIYA: Ayub Parfum do‘konida 250 000 so‘mdan yuqori xaridlarga 30% gacha, VIP mijozlarga 45% gacha maxsus chegirma!",
        bonusTemplate:
          "✨ Yangi eksklyuziv atirlar kolleksiyasi sotuvda! Bonuslaringizdan foydalanishga ulguring.",
      },
    ]);
  }

  // 5. Ensure initial Employees (ADMIN, MANAGER, CASHIER)
  let allEmps = await db.select().from(employees);
  if (allEmps.length === 0) {
    const [pAdmin, pManager, pCashier] = await db
      .insert(profiles)
      .values([
        {
          role: "ADMIN",
          fullName: "Ayubxon Karimov",
          phone: "+998907775577",
          isActive: true,
        },
        {
          role: "MANAGER",
          fullName: "Dilnoza Raximova",
          phone: "+998901112233",
          isActive: true,
        },
        {
          role: "CASHIER",
          fullName: "Javohir Tursunov",
          phone: "+998934445566",
          isActive: true,
        },
      ])
      .returning();

    allEmps = await db
      .insert(employees)
      .values([
        {
          profileId: pAdmin.id,
          fullName: "Ayubxon Karimov",
          phone: "+998907775577",
          login: "admin",
          passwordHash: hashSecret("admin123"),
          role: "ADMIN",
          isActive: true,
          isBlocked: false,
        },
        {
          profileId: pManager.id,
          fullName: "Dilnoza Raximova",
          phone: "+998901112233",
          login: "menejer",
          passwordHash: hashSecret("menejer123"),
          role: "MANAGER",
          isActive: true,
          isBlocked: false,
        },
        {
          profileId: pCashier.id,
          fullName: "Javohir Tursunov",
          phone: "+998934445566",
          login: "kassir",
          passwordHash: hashSecret("kassir123"),
          role: "CASHIER",
          isActive: true,
          isBlocked: false,
        },
      ])
      .returning();
  }

  // 6. Ensure Perfume Products Catalog
  const existingProducts = await db.select().from(products);
  if (existingProducts.length === 0) {
    await db.insert(products).values([
      {
        productCode: "AYP-001",
        name: "Ayub Oud Imperial Extrait",
        brand: "AYUB PRIVÉ",
        category: "Niche",
        volume: "100 ml",
        bottleVolumeMl: 100,
        stockMl: 110,
        price: 250000,
        razlivPricePerGram: 3500,
        razlivSizes: "5,10,20,30,50",
        allowBottleSale: true,
        allowRazlivSale: true,
        imageUrl: "/images/oud-imperial.jpg",
        description: "Qirollik ud daraxti, za’faron va qahrabo uyg‘unligi",
        isActive: true,
      },
      {
        productCode: "AYP-002",
        name: "Emerald Royal Musk",
        brand: "AYUB PRIVÉ",
        category: "Uniseks",
        volume: "100 ml",
        bottleVolumeMl: 100,
        stockMl: 220,
        price: 320000,
        razlivPricePerGram: 4000,
        razlivSizes: "5,10,20,30,50",
        allowBottleSale: true,
        allowRazlivSale: true,
        imageUrl: "/images/emerald-musk.jpg",
        description: "Toza oq mushk, bergamot va zumrad kedr notalari",
        isActive: true,
      },
      {
        productCode: "AYP-003",
        name: "Velvet Damask Rose",
        brand: "AYUB ATELIER",
        category: "Ayollar",
        volume: "100 ml",
        bottleVolumeMl: 100,
        stockMl: 150,
        price: 280000,
        razlivPricePerGram: 3800,
        razlivSizes: "5,10,20,30,50",
        allowBottleSale: true,
        allowRazlivSale: true,
        imageUrl: "/images/velvet-rose.jpg",
        description: "Damashq atirguli, vanil va pushti qalampir",
        isActive: true,
      },
      {
        productCode: "AYP-004",
        name: "Santal & Gold Elixir",
        brand: "AYUB ATELIER",
        category: "Erkaklar",
        volume: "50 ml",
        bottleVolumeMl: 50,
        stockMl: 95,
        price: 180000,
        razlivPricePerGram: 4200,
        razlivSizes: "5,10,15,25",
        allowBottleSale: true,
        allowRazlivSale: true,
        imageUrl: "/images/ayub-hero-perfume.jpg",
        description: "Avstraliya sandali, kardamon va charm",
        isActive: true,
      },
      {
        productCode: "AYP-005",
        name: "Baccarat Amber Oil",
        brand: "MAISON EDITION",
        category: "Yog‘li atir",
        volume: "50 ml",
        bottleVolumeMl: 50,
        stockMl: 40,
        price: 220000,
        razlivPricePerGram: 5000,
        razlivSizes: "5,10,15,20",
        allowBottleSale: true,
        allowRazlivSale: true,
        imageUrl: "/images/oud-imperial.jpg",
        description: "Yuqori konsentratsiyali yog‘li atir — 48 soat turg‘unlik",
        isActive: true,
      },
      {
        productCode: "AYP-006",
        name: "Blue Aventus Intense",
        brand: "ROYAL BLEND",
        category: "Erkaklar",
        volume: "100 ml",
        bottleVolumeMl: 100,
        stockMl: 180,
        price: 360000,
        razlivPricePerGram: 4500,
        razlivSizes: "5,10,20,30,50",
        allowBottleSale: true,
        allowRazlivSale: true,
        imageUrl: "/images/emerald-musk.jpg",
        description: "Ananas, tutunli qayin va eman moxi",
        isActive: true,
      },
    ]);
  }

  // Clean any v1 inconsistent [DEMO] records while preserving all real customers!
  const oldDemoCusts = await db
    .select()
    .from(customers)
    .where(like(customers.notes, "%[DEMO]%"));
  for (const dc of oldDemoCusts) {
    await db.delete(customers).where(eq(customers.id, dc.id));
  }
  await db
    .delete(notificationLogs)
    .where(like(notificationLogs.message, "%[DEMO]%"));

  // Seed mathematically exact [DEMO] dataset if no demo customers exist
  await seedDemoDatasetIfEmpty(
    allEmps[0]?.id ?? null,
    allEmps[1]?.id ?? null,
    allEmps[2]?.id ?? null
  );

  // Run full integrity reconciliation across all tables
  await reconcileDatabaseIntegrity();

  // Mark v2 bootstrap complete
  await db.insert(appSettings).values({
    settingKey: BOOTSTRAPPED_KEY,
    settingValue: "true",
    description: "Consistent DB bootstrap v2 flag",
    updatedBy: "SYSTEM",
  });
}

export async function seedDemoDatasetIfEmpty(
  adminEmpId?: number | null,
  managerEmpId?: number | null,
  cashierEmpId?: number | null
): Promise<void> {
  const existingDemo = await db
    .select()
    .from(customers)
    .where(like(customers.notes, "%[DEMO]%"))
    .limit(1);
  if (existingDemo.length > 0) return;

  const allQr = await db.select().from(qrSources);
  const flyerQr = allQr.find((q) => q.code === "flyer");
  const cashierQr = allQr.find((q) => q.code === "cashier");

  const allProds = await db.select().from(products).orderBy(asc(products.id));
  if (allProds.length < 6) return;

  const allEmps = await db.select().from(employees).orderBy(asc(employees.id));
  const empAdmin = adminEmpId ?? allEmps[0]?.id ?? null;
  const empManager = managerEmpId ?? allEmps[1]?.id ?? empAdmin;
  const empCashier = cashierEmpId ?? allEmps[2]?.id ?? empAdmin;

  const now = new Date();
  const daysAgo = (d: number) =>
    new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
  const plus90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Create 6 demo customers (with safe non-colliding codes/phones)
  const demoSpecs = [
    {
      customerCode: "AYB-10001",
      fullName: "Sardorbek Mirzayev",
      phone: "+998901234567",
      qrSource: "flyer",
      isVip: true,
      vipSince: daysAgo(15),
      registeredByEmployeeId: empCashier,
      notes: "[DEMO] Doimiy VIP mijoz",
      createdAt: daysAgo(18),
    },
    {
      customerCode: "AYB-10002",
      fullName: "Madinabonu Usmonova",
      phone: "+998932345678",
      qrSource: "cashier",
      isVip: true,
      vipSince: daysAgo(10),
      registeredByEmployeeId: empManager,
      notes: "[DEMO] Ayollar niche atirlari xaridori",
      createdAt: daysAgo(12),
    },
    {
      customerCode: "AYB-10003",
      fullName: "Bekzod Nurmatov",
      phone: "+998973456789",
      qrSource: "flyer",
      isVip: false,
      vipSince: null,
      registeredByEmployeeId: empCashier,
      notes: "[DEMO] Flayer aksiyasi orqali kelgan",
      createdAt: daysAgo(7),
    },
    {
      customerCode: "AYB-10004",
      fullName: "Shahlo Qodirova",
      phone: "+998994567890",
      qrSource: "cashier",
      isVip: false,
      vipSince: null,
      registeredByEmployeeId: empCashier,
      notes: "[DEMO] Yangi mijoz",
      createdAt: daysAgo(2),
    },
    {
      customerCode: "AYB-10005",
      fullName: "Otabek Xoliqov",
      phone: "+998915678901",
      qrSource: "flyer",
      isVip: false,
      vipSince: null,
      registeredByEmployeeId: empAdmin,
      notes: "[DEMO] Flayer orqali kelgan",
      createdAt: daysAgo(4),
    },
    {
      customerCode: "AYB-10006",
      fullName: "Zarina Alimova",
      phone: "+998946789012",
      qrSource: "cashier",
      isVip: false,
      vipSince: null,
      registeredByEmployeeId: empAdmin,
      notes: "[DEMO] Bugun ro‘yxatdan o‘tgan",
      createdAt: daysAgo(0),
    },
  ];

  const insertedCusts: Array<typeof customers.$inferSelect> = [];
  for (const spec of demoSpecs) {
    const existingByPhone = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, spec.phone))
      .limit(1);
    if (existingByPhone.length > 0) {
      insertedCusts.push(existingByPhone[0]);
      continue;
    }

    const [created] = await db
      .insert(customers)
      .values({
        customerCode: spec.customerCode,
        fullName: spec.fullName,
        phone: spec.phone,
        qrSource: spec.qrSource,
        bonusGrams: 5,
        totalBonusEarnedGrams: 5,
        totalBonusUsedGrams: 0,
        isVip: spec.isVip,
        vipSince: spec.vipSince,
        registeredByEmployeeId: spec.registeredByEmployeeId,
        notes: spec.notes,
        createdAt: spec.createdAt,
      })
      .returning();

    insertedCusts.push(created);

    const src = spec.qrSource === "flyer" ? flyerQr : cashierQr;
    if (src) {
      await db.insert(qrRegistrations).values({
        qrSourceId: src.id,
        customerId: created.id,
        sourceCode: src.code,
        referralUrl: src.customPath,
        userAgent: "DEMO-SEED",
        createdAt: spec.createdAt,
      });
    }

    // Welcome +5g bonus transaction for every newly registered customer
    await db.insert(bonusTransactions).values({
      customerId: created.id,
      employeeId: spec.registeredByEmployeeId,
      type: "WELCOME",
      amountGrams: 5,
      balanceAfterGrams: 5,
      description: "Birinchi ro‘yxatdan o‘tish bonusi (+5 gr atir) [DEMO]",
      expiresAt: plus90,
      isUsed: false,
      createdAt: spec.createdAt,
    });
  }

  if (insertedCusts.length < 6) return;

  const pOud = allProds[0]; // 680,000
  const pMusk = allProds[1]; // 420,000
  const pRose = allProds[2]; // 540,000
  const pSantal = allProds[3]; // 180,000
  const pAmber = allProds[4]; // 220,000
  const pAventus = allProds[5]; // 360,000

  // Every single sale below strictly obeys AYUB CLUB PRO rules:
  // - Regular > 250,000 so'm => 30% discount
  // - Crossing 1,000,000 so'm total_spent => promotes customer to VIP
  // - Subsequent VIP purchase > 250,000 so'm => 45% VIP discount
  // - Repeat purchase <= 250,000 so'm (without bonus redemption) => +5g bonus
  // - Bonus redemption (-5g) => applied cleanly on non-discounted purchase
  const exactSales = [
    // 1. Sardorbek Sale #1 (15 days ago): Regular 30% discount -> crosses 1,000,000 -> becomes VIP!
    {
      saleCode: "SAV-2026-1001",
      customer: insertedCusts[0],
      empId: empAdmin,
      cashierName: "Ayubxon Karimov",
      product: pOud,
      qty: 3,
      subtotal: 2040000,
      discPct: 30,
      discAmt: 612000,
      finalAmt: 1428000,
      bonusUsed: 0,
      bonusEarned: 0,
      isVip: false,
      createdAt: daysAgo(15),
    },
    // 2. Madinabonu Sale #1 (10 days ago): Regular 30% discount -> crosses 1,000,000 -> becomes VIP!
    {
      saleCode: "SAV-2026-1002",
      customer: insertedCusts[1],
      empId: empManager,
      cashierName: "Dilnoza Raximova",
      product: pRose,
      qty: 3,
      subtotal: 1620000,
      discPct: 30,
      discAmt: 486000,
      finalAmt: 1134000,
      bonusUsed: 0,
      bonusEarned: 0,
      isVip: false,
      createdAt: daysAgo(10),
    },
    // 3. Bekzod Sale #1 (6 days ago): Regular 30% discount
    {
      saleCode: "SAV-2026-1003",
      customer: insertedCusts[2],
      empId: empCashier,
      cashierName: "Javohir Tursunov",
      product: pAventus,
      qty: 1,
      subtotal: 360000,
      discPct: 30,
      discAmt: 108000,
      finalAmt: 252000,
      bonusUsed: 0,
      bonusEarned: 0,
      isVip: false,
      createdAt: daysAgo(6),
    },
    // 4. Sardorbek Sale #2 (5 days ago): Redeems his 5g welcome bonus on 220,000 purchase
    {
      saleCode: "SAV-2026-1004",
      customer: insertedCusts[0],
      empId: empCashier,
      cashierName: "Javohir Tursunov",
      product: pAmber,
      qty: 1,
      subtotal: 220000,
      discPct: 0,
      discAmt: 0,
      finalAmt: 220000,
      bonusUsed: 5,
      bonusEarned: 0,
      isVip: true,
      createdAt: daysAgo(5),
    },
    // 5. Otabek Sale #1 (4 days ago): Regular 30% discount
    {
      saleCode: "SAV-2026-1005",
      customer: insertedCusts[4],
      empId: empManager,
      cashierName: "Dilnoza Raximova",
      product: pOud,
      qty: 1,
      subtotal: 680000,
      discPct: 30,
      discAmt: 204000,
      finalAmt: 476000,
      bonusUsed: 0,
      bonusEarned: 0,
      isVip: false,
      createdAt: daysAgo(4),
    },
    // 6. Bekzod Sale #2 (2 days ago): Repeat purchase <= 250,000 -> earns +5g repeat bonus!
    {
      saleCode: "SAV-2026-1006",
      customer: insertedCusts[2],
      empId: empCashier,
      cashierName: "Javohir Tursunov",
      product: pSantal,
      qty: 1,
      subtotal: 180000,
      discPct: 0,
      discAmt: 0,
      finalAmt: 180000,
      bonusUsed: 0,
      bonusEarned: 5,
      isVip: false,
      createdAt: daysAgo(2),
    },
    // 7. Madinabonu Sale #2 (1 day ago): Now VIP -> gets 45% VIP discount!
    {
      saleCode: "SAV-2026-1007",
      customer: insertedCusts[1],
      empId: empManager,
      cashierName: "Dilnoza Raximova",
      product: pMusk,
      qty: 2,
      subtotal: 840000,
      discPct: 45,
      discAmt: 378000,
      finalAmt: 462000,
      bonusUsed: 0,
      bonusEarned: 0,
      isVip: true,
      createdAt: daysAgo(1),
    },
    // 8. Shahlo Sale #1 (1 day ago): Redeems 5g welcome bonus on 220,000 purchase
    {
      saleCode: "SAV-2026-1008",
      customer: insertedCusts[3],
      empId: empCashier,
      cashierName: "Javohir Tursunov",
      product: pAmber,
      qty: 1,
      subtotal: 220000,
      discPct: 0,
      discAmt: 0,
      finalAmt: 220000,
      bonusUsed: 5,
      bonusEarned: 0,
      isVip: false,
      createdAt: daysAgo(1),
    },
    // 9. Sardorbek Sale #3 (Today): VIP -> gets 45% VIP discount!
    {
      saleCode: "SAV-2026-1009",
      customer: insertedCusts[0],
      empId: empAdmin,
      cashierName: "Ayubxon Karimov",
      product: pRose,
      qty: 2,
      subtotal: 1080000,
      discPct: 45,
      discAmt: 486000,
      finalAmt: 594000,
      bonusUsed: 0,
      bonusEarned: 0,
      isVip: true,
      createdAt: daysAgo(0),
    },
    // 10. Zarina Sale #1 (Today): Regular 30% discount
    {
      saleCode: "SAV-2026-1010",
      customer: insertedCusts[5],
      empId: empAdmin,
      cashierName: "Ayubxon Karimov",
      product: pMusk,
      qty: 2,
      subtotal: 840000,
      discPct: 30,
      discAmt: 252000,
      finalAmt: 588000,
      bonusUsed: 0,
      bonusEarned: 0,
      isVip: false,
      createdAt: daysAgo(0),
    },
  ];

  for (const s of exactSales) {
    const [insertedSale] = await db
      .insert(sales)
      .values({
        saleCode: s.saleCode,
        customerId: s.customer.id,
        employeeId: s.empId,
        cashierName: s.cashierName,
        subtotalAmount: s.subtotal,
        discountPercent: s.discPct,
        discountAmount: s.discAmt,
        finalAmount: s.finalAmt,
        bonusGramsUsed: s.bonusUsed,
        bonusGramsEarned: s.bonusEarned,
        isVipSale: s.isVip,
        paymentMethod: "Naqd / Karta",
        notes: "[DEMO]",
        createdAt: s.createdAt,
      })
      .returning();

    await db.insert(saleItems).values({
      saleId: insertedSale.id,
      productId: s.product.id,
      productName: s.product.name,
      brand: s.product.brand,
      volume: s.product.volume,
      quantity: s.qty,
      unitPrice: s.product.price,
      lineSubtotal: s.subtotal,
      discountPercent: s.discPct,
      discountAmount: s.discAmt,
      lineFinalAmount: s.finalAmt,
      createdAt: s.createdAt,
    });

    if (s.discPct > 0) {
      await db.insert(discountTransactions).values({
        customerId: s.customer.id,
        saleId: insertedSale.id,
        employeeId: s.empId,
        discountPercent: s.discPct,
        originalAmount: s.subtotal,
        discountAmount: s.discAmt,
        finalAmount: s.finalAmt,
        ruleApplied: s.isVip ? "VIP_45" : "STANDARD_30",
        isActive: true,
        notes: `Savdo ${s.saleCode} bo‘yicha ${s.discPct}% chegirma [DEMO]`,
        createdAt: s.createdAt,
      });
    }

    if (s.bonusEarned > 0) {
      await db.insert(bonusTransactions).values({
        customerId: s.customer.id,
        saleId: insertedSale.id,
        employeeId: s.empId,
        type: "REPEAT_PURCHASE",
        amountGrams: s.bonusEarned,
        balanceAfterGrams: 10,
        description: `Qayta xarid bonusi (+${s.bonusEarned} gr atir) — ${s.saleCode} [DEMO]`,
        expiresAt: plus90,
        isUsed: false,
        createdAt: s.createdAt,
      });
    }

    if (s.bonusUsed > 0) {
      await db.insert(bonusTransactions).values({
        customerId: s.customer.id,
        saleId: insertedSale.id,
        employeeId: s.empId,
        type: "REDEEMED",
        amountGrams: -s.bonusUsed,
        balanceAfterGrams: 0,
        description: `Savdo (${s.saleCode}) da ${s.bonusUsed} gr bonus ishlatildi [DEMO]`,
        isUsed: true,
        createdAt: s.createdAt,
      });
    }
  }

  // Exact VIP History matching the exact sale where each crossed 1,000,000 so'm
  await db.insert(customerVipHistory).values([
    {
      customerId: insertedCusts[0].id,
      previousStatus: false,
      newStatus: true,
      reason:
        "Avtomatik VIP: SAV-2026-1001 xaridi bilan jami xarid 1 428 000 so‘mga yetdi [DEMO]",
      totalSpentAtChange: 1428000,
      changedByEmployeeId: empAdmin,
      createdAt: daysAgo(15),
    },
    {
      customerId: insertedCusts[1].id,
      previousStatus: false,
      newStatus: true,
      reason:
        "Avtomatik VIP: SAV-2026-1002 xaridi bilan jami xarid 1 134 000 so‘mga yetdi [DEMO]",
      totalSpentAtChange: 1134000,
      changedByEmployeeId: empManager,
      createdAt: daysAgo(10),
    },
  ]);

  await db.insert(notificationLogs).values([
    {
      category: "WELCOME",
      title: "Xush kelibsiz xabarnomasi",
      message: "Zarina Alimova ro‘yxatdan o‘tdi va +5 gr bonus oldi [DEMO]",
      recipientsCount: 1,
      status: "SENT",
      createdAt: daysAgo(0),
    },
    {
      category: "PROMO",
      title: "Yangi Oud Imperial kolleksiyasi",
      message: "VIP mijozlarga 45% gacha chegirma e’lon qilindi [DEMO]",
      recipientsCount: 6,
      status: "SENT",
      createdAt: daysAgo(1),
    },
  ]);

  await reconcileDatabaseIntegrity();
}

export async function clearDemoData(): Promise<{ deletedCustomers: number }> {
  const demoCusts = await db
    .select()
    .from(customers)
    .where(like(customers.notes, "%[DEMO]%"));

  for (const c of demoCusts) {
    await db.delete(customers).where(eq(customers.id, c.id));
  }
  await db
    .delete(notificationLogs)
    .where(like(notificationLogs.message, "%[DEMO]%"));

  // Reconcile all product, employee, and QR counters so zero stale demo numbers remain!
  await reconcileDatabaseIntegrity();

  return { deletedCustomers: demoCusts.length };
}

export async function getAppConfig(): Promise<AppConfig> {
  await ensureSystemBootstrapped();
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.settingKey, CONFIG_KEY))
    .limit(1);

  if (rows.length === 0) {
    return DEFAULT_APP_CONFIG;
  }

  try {
    const parsed = JSON.parse(rows[0].settingValue) as Partial<AppConfig>;
    return { ...DEFAULT_APP_CONFIG, ...parsed };
  } catch {
    return DEFAULT_APP_CONFIG;
  }
}

export async function updateAppConfig(
  partial: Partial<AppConfig>,
  updatedBy = "ADMIN"
): Promise<AppConfig> {
  const current = await getAppConfig();
  const merged: AppConfig = { ...current, ...partial };
  await db
    .update(appSettings)
    .set({
      settingValue: JSON.stringify(merged),
      updatedBy,
      updatedAt: new Date(),
    })
    .where(eq(appSettings.settingKey, CONFIG_KEY));

  return merged;
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  await ensureSystemBootstrapped();
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.settingKey, ADMIN_PIN_KEY))
    .limit(1);

  if (rows.length === 0) return false;
  return verifySecret(pin.trim(), rows[0].settingValue);
}

export async function updateAdminPin(
  currentPin: string,
  newPin: string,
  actorName = "Admin"
): Promise<{ ok: boolean; error?: string }> {
  if (!newPin || newPin.trim().length < 4) {
    return {
      ok: false,
      error: "Yangi PIN-kod kamida 4 ta belgidan iborat bo‘lishi kerak.",
    };
  }
  const valid = await verifyAdminPin(currentPin);
  if (!valid) {
    return { ok: false, error: "Joriy Admin PIN-kod noto‘g‘ri kiritildi." };
  }

  await db
    .update(appSettings)
    .set({
      settingValue: hashSecret(newPin.trim()),
      updatedBy: actorName,
      updatedAt: new Date(),
    })
    .where(eq(appSettings.settingKey, ADMIN_PIN_KEY));

  await db.insert(auditLogs).values({
    actorType: "ADMIN",
    actorName,
    action: "UPDATE_ADMIN_PIN",
    entityType: "SECURITY",
    details: "Admin PIN-kodi muvaffaqiyatli yangilandi",
  });

  return { ok: true };
}
