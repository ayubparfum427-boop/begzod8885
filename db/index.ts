import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function sanitizeDatabaseUrl(raw: string): string {
  let clean = (raw || "").trim().replace(/^["']|["']$/g, "");
  if (!clean) return "";

  // Remove sslmode=... query param because pg@8.20 treats sslmode=require as verify-full
  // and overrides explicit ssl: { rejectUnauthorized: false } on Supabase Pooler
  clean = clean.replace(/([?&])sslmode=[^&]*(&|$)/gi, (_m, p1, p2) => {
    if (p1 === "?" && p2 === "&") return "?";
    if (p1 === "?" && !p2) return "";
    return p2 ? "&" : "";
  });

  // Safely encode special characters in password if unencoded (between ://user: and last @host)
  const protoIdx = clean.indexOf("://");
  const lastAtIdx = clean.lastIndexOf("@");
  if (protoIdx !== -1 && lastAtIdx > protoIdx + 3) {
    const credsPart = clean.slice(protoIdx + 3, lastAtIdx);
    const colonIdx = credsPart.indexOf(":");
    if (colonIdx !== -1) {
      const user = credsPart.slice(0, colonIdx);
      const rawPass = credsPart.slice(colonIdx + 1);
      // Remove accidental square brackets if user left [password] around their password
      const strippedBrackets =
        rawPass.startsWith("[") && rawPass.endsWith("]")
          ? rawPass.slice(1, -1)
          : rawPass;
      let decodedPass = strippedBrackets;
      try {
        decodedPass = decodeURIComponent(strippedBrackets);
      } catch {
        decodedPass = strippedBrackets;
      }
      const safePass = encodeURIComponent(decodedPass);
      clean = `${clean.slice(0, protoIdx + 3)}${user}:${safePass}${clean.slice(
        lastAtIdx
      )}`;
    }
  }

  return clean;
}

const databaseUrl = sanitizeDatabaseUrl(process.env.DATABASE_URL || "");

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const isLocalDb =
  databaseUrl.includes("127.0.0.1") || databaseUrl.includes("localhost");

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    max: isLocalDb ? 10 : 4,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 12000,
    ...(isLocalDb ? {} : { ssl: { rejectUnauthorized: false } }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };
