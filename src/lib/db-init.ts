import { pool } from "@/db";

let tablesInitialized = false;

const DDL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'CUSTOMER',
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    login TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CASHIER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    registered_customers_count INTEGER NOT NULL DEFAULT 0,
    sales_count INTEGER NOT NULL DEFAULT 0,
    total_sales_amount BIGINT NOT NULL DEFAULT 0,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
    customer_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    consent_accepted BOOLEAN NOT NULL DEFAULT TRUE,
    qr_source TEXT NOT NULL DEFAULT 'direct',
    bonus_grams DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_bonus_earned_grams DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_bonus_used_grams DOUBLE PRECISION NOT NULL DEFAULT 0,
    custom_discount_percent INTEGER,
    is_vip BOOLEAN NOT NULL DEFAULT FALSE,
    vip_since TIMESTAMP,
    total_spent BIGINT NOT NULL DEFAULT 0,
    purchases_count INTEGER NOT NULL DEFAULT 0,
    total_items_bought INTEGER NOT NULL DEFAULT 0,
    last_purchase_at TIMESTAMP,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    registered_by_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    product_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    volume TEXT NOT NULL,
    bottle_volume_ml DOUBLE PRECISION NOT NULL DEFAULT 100,
    stock_ml DOUBLE PRECISION NOT NULL DEFAULT 110,
    price BIGINT NOT NULL,
    razliv_price_per_gram BIGINT NOT NULL DEFAULT 3500,
    razliv_sizes TEXT NOT NULL DEFAULT '5,10,20,30,50',
    allow_bottle_sale BOOLEAN NOT NULL DEFAULT TRUE,
    allow_razliv_sale BOOLEAN NOT NULL DEFAULT TRUE,
    image_url TEXT NOT NULL DEFAULT '/images/ayub-hero-perfume.jpg',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sold_count INTEGER NOT NULL DEFAULT 0,
    total_revenue BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    sale_code TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    cashier_name TEXT NOT NULL DEFAULT 'Admin',
    subtotal_amount BIGINT NOT NULL,
    discount_percent INTEGER NOT NULL DEFAULT 0,
    discount_amount BIGINT NOT NULL DEFAULT 0,
    final_amount BIGINT NOT NULL,
    bonus_grams_used DOUBLE PRECISION NOT NULL DEFAULT 0,
    bonus_grams_earned DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_vip_sale BOOLEAN NOT NULL DEFAULT FALSE,
    payment_method TEXT NOT NULL DEFAULT 'Naqd / Karta',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    volume TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price BIGINT NOT NULL,
    line_subtotal BIGINT NOT NULL,
    discount_percent INTEGER NOT NULL DEFAULT 0,
    discount_amount BIGINT NOT NULL DEFAULT 0,
    line_final_amount BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS bonus_transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    amount_grams DOUBLE PRECISION NOT NULL,
    balance_after_grams DOUBLE PRECISION NOT NULL,
    description TEXT NOT NULL,
    expires_at TIMESTAMP,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS discount_transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    discount_percent INTEGER NOT NULL,
    original_amount BIGINT NOT NULL DEFAULT 0,
    discount_amount BIGINT NOT NULL DEFAULT 0,
    final_amount BIGINT NOT NULL DEFAULT 0,
    rule_applied TEXT NOT NULL,
    expires_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS qr_sources (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    custom_path TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    scans_count INTEGER NOT NULL DEFAULT 0,
    registrations_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS qr_registrations (
    id SERIAL PRIMARY KEY,
    qr_source_id INTEGER NOT NULL REFERENCES qr_sources(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    source_code TEXT NOT NULL,
    referral_url TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS telegram_bots (
    id SERIAL PRIMARY KEY,
    bot_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    bot_username TEXT,
    bot_token_secret TEXT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    is_connected BOOLEAN NOT NULL DEFAULT FALSE,
    last_checked_at TIMESTAMP,
    status_message TEXT DEFAULT 'Token kiritilmagan',
    welcome_template TEXT NOT NULL,
    promo_template TEXT NOT NULL,
    bonus_template TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS telegram_subscribers (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    telegram_chat_id TEXT NOT NULL,
    telegram_username TEXT,
    full_name TEXT NOT NULL,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER REFERENCES telegram_bots(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    recipients_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'SENT',
    error_detail TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_by TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS customer_vip_history (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    previous_status BOOLEAN NOT NULL,
    new_status BOOLEAN NOT NULL,
    reason TEXT NOT NULL,
    total_spent_at_change BIGINT NOT NULL DEFAULT 0,
    changed_by_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    actor_type TEXT NOT NULL,
    actor_id INTEGER,
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS customer_orders (
    id SERIAL PRIMARY KEY,
    order_code TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    sale_mode TEXT NOT NULL DEFAULT 'BOTTLE',
    selected_grams_or_qty DOUBLE PRECISION NOT NULL DEFAULT 1,
    deducted_ml DOUBLE PRECISION NOT NULL DEFAULT 100,
    unit_price BIGINT NOT NULL,
    subtotal_amount BIGINT NOT NULL,
    discount_percent INTEGER NOT NULL DEFAULT 0,
    discount_amount BIGINT NOT NULL DEFAULT 0,
    final_amount BIGINT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'CASH',
    receipt_image_data TEXT,
    receipt_note TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    linked_sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
    reviewed_by_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
];

export async function ensureTablesExist(): Promise<void> {
  if (tablesInitialized) return;

  // Fast-path check: if customer_orders and products.stock_ml already exist, skip DDL locks completely!
  try {
    await pool.query(
      "SELECT id FROM app_settings LIMIT 1"
    );
    await pool.query(
      "SELECT stock_ml, razliv_price_per_gram FROM products LIMIT 1"
    );
    await pool.query(
      "SELECT id FROM customer_orders LIMIT 1"
    );
    tablesInitialized = true;
    return;
  } catch {
    // Missing table or column — run individual DDL statements safely
  }

  for (const stmt of DDL_STATEMENTS) {
    await pool.query(stmt);
  }

  // Ensure warehouse columns exist if upgrading an older `products` table
  const alterCols = [
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS bottle_volume_ml DOUBLE PRECISION NOT NULL DEFAULT 100",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_ml DOUBLE PRECISION NOT NULL DEFAULT 110",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS razliv_price_per_gram BIGINT NOT NULL DEFAULT 3500",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS razliv_sizes TEXT NOT NULL DEFAULT '5,10,20,30,50'",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_bottle_sale BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_razliv_sale BOOLEAN NOT NULL DEFAULT TRUE",
  ];

  for (const alt of alterCols) {
    try {
      await pool.query(alt);
    } catch {
      // Ignore if column already exists
    }
  }

  tablesInitialized = true;
}
