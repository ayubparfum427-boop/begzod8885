import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  doublePrecision,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// 1. PROFILES
export const profiles = pgTable(
  "profiles",
  {
    id: serial("id").primaryKey(),
    role: text("role").notNull().default("CUSTOMER"), // ADMIN | MANAGER | CASHIER | CUSTOMER
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("profiles_role_idx").on(table.role),
    index("profiles_phone_idx").on(table.phone),
  ]
);

// 3. EMPLOYEES (defined before customers so customers can reference registered_by_employee_id)
export const employees = pgTable(
  "employees",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull().unique(),
    login: text("login").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("CASHIER"), // ADMIN | MANAGER | CASHIER
    isActive: boolean("is_active").notNull().default(true),
    isBlocked: boolean("is_blocked").notNull().default(false),
    registeredCustomersCount: integer("registered_customers_count")
      .notNull()
      .default(0),
    salesCount: integer("sales_count").notNull().default(0),
    totalSalesAmount: bigint("total_sales_amount", { mode: "number" })
      .notNull()
      .default(0),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("employees_login_uidx").on(table.login),
    uniqueIndex("employees_phone_uidx").on(table.phone),
    index("employees_role_idx").on(table.role),
  ]
);

// 2. CUSTOMERS
export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    customerCode: text("customer_code").notNull().unique(),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull().unique(),
    consentAccepted: boolean("consent_accepted").notNull().default(true),
    qrSource: text("qr_source").notNull().default("direct"), // immutable once registered
    bonusGrams: doublePrecision("bonus_grams").notNull().default(0),
    totalBonusEarnedGrams: doublePrecision("total_bonus_earned_grams")
      .notNull()
      .default(0),
    totalBonusUsedGrams: doublePrecision("total_bonus_used_grams")
      .notNull()
      .default(0),
    customDiscountPercent: integer("custom_discount_percent"),
    isVip: boolean("is_vip").notNull().default(false),
    vipSince: timestamp("vip_since"),
    totalSpent: bigint("total_spent", { mode: "number" }).notNull().default(0),
    purchasesCount: integer("purchases_count").notNull().default(0),
    totalItemsBought: integer("total_items_bought").notNull().default(0),
    lastPurchaseAt: timestamp("last_purchase_at"),
    isBlocked: boolean("is_blocked").notNull().default(false),
    registeredByEmployeeId: integer("registered_by_employee_id").references(
      () => employees.id,
      { onDelete: "set null" }
    ),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("customers_phone_uidx").on(table.phone),
    uniqueIndex("customers_code_uidx").on(table.customerCode),
    index("customers_qr_source_idx").on(table.qrSource),
    index("customers_is_vip_idx").on(table.isVip),
    index("customers_created_at_idx").on(table.createdAt),
  ]
);

// 4. PRODUCTS (WAREHOUSE / OMBOR)
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    productCode: text("product_code").notNull().unique(),
    name: text("name").notNull(),
    brand: text("brand").notNull(),
    category: text("category").notNull(), // Erkaklar | Ayollar | Uniseks | Niche | Yog'li atir
    volume: text("volume").notNull(), // e.g., 100 ml
    bottleVolumeMl: doublePrecision("bottle_volume_ml").notNull().default(100),
    stockMl: doublePrecision("stock_ml").notNull().default(110),
    price: bigint("price", { mode: "number" }).notNull(), // Butun flakon narxi (e.g. 250 000 so'm)
    razlivPricePerGram: bigint("razliv_price_per_gram", { mode: "number" })
      .notNull()
      .default(3500), // 1 gr / ml razliv narxi
    razlivSizes: text("razliv_sizes").notNull().default("5,10,20,30,50"),
    allowBottleSale: boolean("allow_bottle_sale").notNull().default(true),
    allowRazlivSale: boolean("allow_razliv_sale").notNull().default(true),
    imageUrl: text("image_url")
      .notNull()
      .default("/images/ayub-hero-perfume.jpg"),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    soldCount: integer("sold_count").notNull().default(0),
    totalRevenue: bigint("total_revenue", { mode: "number" })
      .notNull()
      .default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("products_code_uidx").on(table.productCode),
    index("products_category_idx").on(table.category),
    index("products_active_idx").on(table.isActive),
  ]
);

// 5. SALES
export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    saleCode: text("sale_code").notNull().unique(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id").references(() => employees.id, {
      onDelete: "set null",
    }),
    cashierName: text("cashier_name").notNull().default("Admin"),
    subtotalAmount: bigint("subtotal_amount", { mode: "number" }).notNull(),
    discountPercent: integer("discount_percent").notNull().default(0),
    discountAmount: bigint("discount_amount", { mode: "number" })
      .notNull()
      .default(0),
    finalAmount: bigint("final_amount", { mode: "number" }).notNull(),
    bonusGramsUsed: doublePrecision("bonus_grams_used").notNull().default(0),
    bonusGramsEarned: doublePrecision("bonus_grams_earned").notNull().default(0),
    isVipSale: boolean("is_vip_sale").notNull().default(false),
    paymentMethod: text("payment_method").notNull().default("Naqd / Karta"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sales_code_uidx").on(table.saleCode),
    index("sales_customer_idx").on(table.customerId),
    index("sales_employee_idx").on(table.employeeId),
    index("sales_created_at_idx").on(table.createdAt),
  ]
);

// 6. SALE ITEMS
export const saleItems = pgTable(
  "sale_items",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productName: text("product_name").notNull(),
    brand: text("brand").notNull(),
    volume: text("volume").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: bigint("unit_price", { mode: "number" }).notNull(),
    lineSubtotal: bigint("line_subtotal", { mode: "number" }).notNull(),
    discountPercent: integer("discount_percent").notNull().default(0),
    discountAmount: bigint("discount_amount", { mode: "number" })
      .notNull()
      .default(0),
    lineFinalAmount: bigint("line_final_amount", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("sale_items_sale_idx").on(table.saleId),
    index("sale_items_product_idx").on(table.productId),
  ]
);

// 7. BONUS TRANSACTIONS
export const bonusTransactions = pgTable(
  "bonus_transactions",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    saleId: integer("sale_id").references(() => sales.id, {
      onDelete: "set null",
    }),
    employeeId: integer("employee_id").references(() => employees.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(), // WELCOME | REPEAT_PURCHASE | MANUAL_GRANT | REDEEMED | EXPIRED
    amountGrams: doublePrecision("amount_grams").notNull(),
    balanceAfterGrams: doublePrecision("balance_after_grams").notNull(),
    description: text("description").notNull(),
    expiresAt: timestamp("expires_at"),
    isUsed: boolean("is_used").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("bonus_tx_customer_idx").on(table.customerId),
    index("bonus_tx_type_idx").on(table.type),
    index("bonus_tx_created_at_idx").on(table.createdAt),
  ]
);

// 8. DISCOUNT TRANSACTIONS
export const discountTransactions = pgTable(
  "discount_transactions",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    saleId: integer("sale_id").references(() => sales.id, {
      onDelete: "set null",
    }),
    employeeId: integer("employee_id").references(() => employees.id, {
      onDelete: "set null",
    }),
    discountPercent: integer("discount_percent").notNull(),
    originalAmount: bigint("original_amount", { mode: "number" })
      .notNull()
      .default(0),
    discountAmount: bigint("discount_amount", { mode: "number" })
      .notNull()
      .default(0),
    finalAmount: bigint("final_amount", { mode: "number" })
      .notNull()
      .default(0),
    ruleApplied: text("rule_applied").notNull(), // STANDARD_30 | VIP_45 | PERSONAL_COUPON
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("discount_tx_customer_idx").on(table.customerId),
    index("discount_tx_percent_idx").on(table.discountPercent),
    index("discount_tx_created_at_idx").on(table.createdAt),
  ]
);

// 9. QR SOURCES
export const qrSources = pgTable(
  "qr_sources",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // flyer | cashier | instagram | custom...
    name: text("name").notNull(),
    customPath: text("custom_path").notNull(), // e.g. /register?source=flyer
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    scansCount: integer("scans_count").notNull().default(0),
    registrationsCount: integer("registrations_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("qr_sources_code_uidx").on(table.code)]
);

// 10. QR REGISTRATIONS
export const qrRegistrations = pgTable(
  "qr_registrations",
  {
    id: serial("id").primaryKey(),
    qrSourceId: integer("qr_source_id")
      .notNull()
      .references(() => qrSources.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .unique()
      .references(() => customers.id, { onDelete: "cascade" }),
    sourceCode: text("source_code").notNull(),
    referralUrl: text("referral_url").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("qr_reg_source_idx").on(table.qrSourceId),
    uniqueIndex("qr_reg_customer_uidx").on(table.customerId),
  ]
);

// 11. TELEGRAM BOTS
export const telegramBots = pgTable(
  "telegram_bots",
  {
    id: serial("id").primaryKey(),
    botKey: text("bot_key").notNull().unique(), // ayub_club | ayub_info
    name: text("name").notNull(),
    botUsername: text("bot_username"),
    botTokenSecret: text("bot_token_secret"), // NEVER returned to frontend
    isActive: boolean("is_active").notNull().default(false),
    isConnected: boolean("is_connected").notNull().default(false),
    lastCheckedAt: timestamp("last_checked_at"),
    statusMessage: text("status_message").default("Token kiritilmagan"),
    welcomeTemplate: text("welcome_template").notNull(),
    promoTemplate: text("promo_template").notNull(),
    bonusTemplate: text("bonus_template").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("telegram_bots_key_uidx").on(table.botKey)]
);

// 12. TELEGRAM SUBSCRIBERS
export const telegramSubscribers = pgTable(
  "telegram_subscribers",
  {
    id: serial("id").primaryKey(),
    botId: integer("bot_id")
      .notNull()
      .references(() => telegramBots.id, { onDelete: "cascade" }),
    customerId: integer("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    telegramChatId: text("telegram_chat_id").notNull(),
    telegramUsername: text("telegram_username"),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("tg_sub_bot_idx").on(table.botId),
    index("tg_sub_customer_idx").on(table.customerId),
  ]
);

// 13. NOTIFICATION LOGS
export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: serial("id").primaryKey(),
    botId: integer("bot_id").references(() => telegramBots.id, {
      onDelete: "set null",
    }),
    customerId: integer("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    employeeId: integer("employee_id").references(() => employees.id, {
      onDelete: "set null",
    }),
    category: text("category").notNull(), // WELCOME | NEW_PERFUME | PROMO | DISCOUNT | BONUS_REMINDER | NEWS | BROADCAST
    title: text("title").notNull(),
    message: text("message").notNull(),
    recipientsCount: integer("recipients_count").notNull().default(0),
    status: text("status").notNull().default("SENT"),
    errorDetail: text("error_detail"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("notif_logs_created_idx").on(table.createdAt)]
);

// 14. APP SETTINGS
export const appSettings = pgTable(
  "app_settings",
  {
    id: serial("id").primaryKey(),
    settingKey: text("setting_key").notNull().unique(),
    settingValue: text("setting_value").notNull(),
    description: text("description"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("app_settings_key_uidx").on(table.settingKey)]
);

// 15. CUSTOMER VIP HISTORY
export const customerVipHistory = pgTable(
  "customer_vip_history",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    previousStatus: boolean("previous_status").notNull(),
    newStatus: boolean("new_status").notNull(),
    reason: text("reason").notNull(),
    totalSpentAtChange: bigint("total_spent_at_change", { mode: "number" })
      .notNull()
      .default(0),
    changedByEmployeeId: integer("changed_by_employee_id").references(
      () => employees.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("vip_history_customer_idx").on(table.customerId)]
);

// 16. AUDIT LOGS
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorType: text("actor_type").notNull(), // ADMIN | MANAGER | CASHIER | CUSTOMER | SYSTEM
    actorId: integer("actor_id"),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: text("details"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_created_idx").on(table.createdAt),
    index("audit_logs_entity_idx").on(table.entityType),
  ]
);

// 17. CUSTOMER ORDERS & PAYMENTS (NAQD & PAYNET QR + CHEK)
export const customerOrders = pgTable(
  "customer_orders",
  {
    id: serial("id").primaryKey(),
    orderCode: text("order_code").notNull().unique(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productName: text("product_name").notNull(),
    brand: text("brand").notNull(),
    saleMode: text("sale_mode").notNull().default("BOTTLE"), // BOTTLE (Butun flakon) | RAZLIV (Razliv gr/ml)
    selectedGramsOrQty: doublePrecision("selected_grams_or_qty")
      .notNull()
      .default(1), // e.g. 1 bottle OR 20 gr
    deductedMl: doublePrecision("deducted_ml").notNull().default(100), // exact ml deducted from warehouse
    unitPrice: bigint("unit_price", { mode: "number" }).notNull(),
    subtotalAmount: bigint("subtotal_amount", { mode: "number" }).notNull(),
    discountPercent: integer("discount_percent").notNull().default(0),
    discountAmount: bigint("discount_amount", { mode: "number" })
      .notNull()
      .default(0),
    finalAmount: bigint("final_amount", { mode: "number" }).notNull(),
    paymentMethod: text("payment_method").notNull().default("CASH"), // CASH (Naqd joyida) | PAYNET (Paynet QR skaner)
    receiptImageData: text("receipt_image_data"), // Base64 image / URL of uploaded Paynet receipt
    receiptNote: text("receipt_note"),
    status: text("status").notNull().default("PENDING"), // PENDING | APPROVED | REJECTED
    linkedSaleId: integer("linked_sale_id").references(() => sales.id, {
      onDelete: "set null",
    }),
    reviewedByEmployeeId: integer("reviewed_by_employee_id").references(
      () => employees.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("customer_orders_code_uidx").on(table.orderCode),
    index("customer_orders_customer_idx").on(table.customerId),
    index("customer_orders_status_idx").on(table.status),
  ]
);
