import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";

export type StaffRole = "ADMIN" | "MANAGER" | "CASHIER";

export interface StaffSession {
  staffType: "MASTER_ADMIN" | "EMPLOYEE";
  employeeId: number | null;
  role: StaffRole;
  fullName: string;
  login: string;
  exp: number;
}

export interface CustomerSession {
  customerId: number;
  customerCode: string;
  phone: string;
  exp: number;
}

const STAFF_COOKIE_NAME = "ayub_staff_session";
const CUSTOMER_COOKIE_NAME = "ayub_customer_session";

function getSigningSecret(): string {
  const envSecret = (process.env.SESSION_SECRET || "").trim();
  if (envSecret) return envSecret;
  const dbSecret = (process.env.DATABASE_URL || "").trim();
  if (dbSecret) return dbSecret;
  return "ayub-club-pro-server-hmac-secret-2026";
}

export function hashSecret(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifySecret(plain: string, storedHash: string): boolean {
  try {
    const [salt, keyHex] = storedHash.split(":");
    if (!salt || !keyHex) return false;
    const keyBuf = Buffer.from(keyHex, "hex");
    const derivedBuf = scryptSync(plain, salt, 64);
    if (keyBuf.length !== derivedBuf.length) return false;
    return timingSafeEqual(keyBuf, derivedBuf);
  } catch {
    return false;
  }
}

function signPayload(payloadObj: object): string {
  const json = JSON.stringify(payloadObj);
  const base64 = Buffer.from(json, "utf8").toString("base64url");
  const sig = createHmac("sha256", getSigningSecret())
    .update(base64)
    .digest("base64url");
  return `${base64}.${sig}`;
}

export function verifyToken<T extends { exp: number }>(
  token: string | undefined | null
): T | null {
  if (!token) return null;
  const parts = token.trim().split(".");
  if (parts.length !== 2) return null;
  const [base64, sig] = parts;
  const expectedSig = createHmac("sha256", getSigningSecret())
    .update(base64)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(base64, "base64url").toString("utf8")
    ) as T;
    if (!parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function isHttpsRequest(): Promise<boolean> {
  try {
    const hdrs = await headers();
    const proto = hdrs.get("x-forwarded-proto") || "";
    return proto.includes("https");
  } catch {
    return false;
  }
}

export async function createStaffSessionCookie(
  session: Omit<StaffSession, "exp">
): Promise<string> {
  const fullSession: StaffSession = {
    ...session,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const token = signPayload(fullSession);
  try {
    const https = await isHttpsRequest();
    const cookieStore = await cookies();
    cookieStore.set(STAFF_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: https ? "none" : "lax",
      secure: https,
      ...(https ? { partitioned: true } : {}),
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  } catch {
    // Signed token returned to client guarantees auth even if cookie setting fails
  }
  return token;
}

export async function clearStaffSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(STAFF_COOKIE_NAME);
  } catch {
    // Ignore
  }
}

export async function getStaffSession(
  request?: Request
): Promise<StaffSession | null> {
  // 1. Check URL query parameter `?_st=...` (never stripped by any proxy or iframe)
  if (request) {
    try {
      const reqUrl = new URL(request.url);
      const queryToken = reqUrl.searchParams.get("_st");
      if (queryToken) {
        const verified = verifyToken<StaffSession>(queryToken);
        if (verified) return verified;
      }

      const reqHdrToken = request.headers.get("x-ayub-staff-token");
      if (reqHdrToken) {
        const verified = verifyToken<StaffSession>(reqHdrToken);
        if (verified) return verified;
      }
    } catch {
      // Fall through
    }
  }

  // 2. Check Next.js headers()
  try {
    const hdrs = await headers();
    const customHeaderToken = hdrs.get("x-ayub-staff-token");
    if (customHeaderToken) {
      const verified = verifyToken<StaffSession>(customHeaderToken);
      if (verified) return verified;
    }

    const authHeader = hdrs.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const verified = verifyToken<StaffSession>(authHeader.slice(7));
      if (verified) return verified;
    }
  } catch {
    // Fall through
  }

  // 3. Check HTTP cookie
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(STAFF_COOKIE_NAME)?.value;
    return verifyToken<StaffSession>(token);
  } catch {
    return null;
  }
}

export async function createCustomerSessionCookie(
  session: Omit<CustomerSession, "exp">
): Promise<string> {
  const fullSession: CustomerSession = {
    ...session,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days
  };
  const token = signPayload(fullSession);
  try {
    const https = await isHttpsRequest();
    const cookieStore = await cookies();
    cookieStore.set(CUSTOMER_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: https ? "none" : "lax",
      secure: https,
      ...(https ? { partitioned: true } : {}),
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch {
    // Signed token returned to client guarantees auth
  }
  return token;
}

export async function clearCustomerSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(CUSTOMER_COOKIE_NAME);
  } catch {
    // Ignore
  }
}

export async function getCustomerSession(
  request?: Request
): Promise<CustomerSession | null> {
  // 1. Check URL query parameter `?_ct=...`
  if (request) {
    try {
      const reqUrl = new URL(request.url);
      const queryToken = reqUrl.searchParams.get("_ct");
      if (queryToken) {
        const verified = verifyToken<CustomerSession>(queryToken);
        if (verified) return verified;
      }

      const reqHdrToken = request.headers.get("x-ayub-customer-token");
      if (reqHdrToken) {
        const verified = verifyToken<CustomerSession>(reqHdrToken);
        if (verified) return verified;
      }
    } catch {
      // Fall through
    }
  }

  // 2. Check Next.js headers()
  try {
    const hdrs = await headers();
    const customHeaderToken = hdrs.get("x-ayub-customer-token");
    if (customHeaderToken) {
      const verified = verifyToken<CustomerSession>(customHeaderToken);
      if (verified) return verified;
    }
  } catch {
    // Fall through
  }

  // 3. Check HTTP cookie
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(CUSTOMER_COOKIE_NAME)?.value;
    return verifyToken<CustomerSession>(token);
  } catch {
    return null;
  }
}

export type PermissionKey =
  | "view_dashboard"
  | "manage_qr"
  | "view_qr"
  | "manage_customers"
  | "register_customer"
  | "manage_bonuses"
  | "manage_discounts"
  | "manage_vip"
  | "manage_products"
  | "view_products"
  | "create_sale"
  | "manage_payments"
  | "manage_telegram"
  | "manage_employees"
  | "view_reports"
  | "manage_settings"
  | "change_admin_pin";

export const ROLE_PERMISSIONS: Record<StaffRole, PermissionKey[]> = {
  ADMIN: [
    "view_dashboard",
    "manage_qr",
    "view_qr",
    "manage_customers",
    "register_customer",
    "manage_bonuses",
    "manage_discounts",
    "manage_vip",
    "manage_products",
    "view_products",
    "create_sale",
    "manage_payments",
    "manage_telegram",
    "manage_employees",
    "view_reports",
    "manage_settings",
    "change_admin_pin",
  ],
  MANAGER: [
    "view_dashboard",
    "view_qr",
    "manage_customers",
    "register_customer",
    "manage_bonuses",
    "manage_discounts",
    "manage_vip",
    "manage_products",
    "view_products",
    "create_sale",
    "manage_payments",
    "view_reports",
  ],
  CASHIER: [
    "view_qr",
    "register_customer",
    "view_products",
    "create_sale",
    "manage_payments",
  ],
};

export function hasPermission(
  role: StaffRole | undefined | null,
  permission: PermissionKey
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
