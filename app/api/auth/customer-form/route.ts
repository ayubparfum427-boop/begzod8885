import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createCustomerSessionCookie } from "@/lib/security";
import { normalizeUzbekPhone } from "@/lib/format";
import { registerCustomerOnServer } from "@/lib/loyalty-engine";
import { ensureSystemBootstrapped } from "@/lib/settings-service";

export const dynamic = "force-dynamic";

function redirectRelative(path: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: path,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  try {
    await ensureSystemBootstrapped();
    const formData = await request.formData();
    const action = String(formData.get("action") || "register");

    if (action === "register") {
      const fullName = String(formData.get("fullName") || "");
      const phone = String(formData.get("phone") || "");
      const qrSource = String(formData.get("qrSource") || "direct");
      const consent = formData.get("consentAccepted") !== null;

      const res = await registerCustomerOnServer({
        fullName,
        phone,
        consentAccepted: consent,
        qrSource,
        userAgent: request.headers.get("user-agent") || undefined,
      });

      if (!res.ok) {
        if (res.code === "DUPLICATE_PHONE") {
          const norm = normalizeUzbekPhone(phone);
          if (norm) {
            const existing = await db
              .select()
              .from(customers)
              .where(eq(customers.phone, norm))
              .limit(1);
            if (existing[0] && !existing[0].isBlocked) {
              const tok = await createCustomerSessionCookie({
                customerId: existing[0].id,
                customerCode: existing[0].customerCode,
                phone: existing[0].phone,
              });
              return redirectRelative(
                `/portal?_ct=${encodeURIComponent(tok)}`
              );
            }
          }
        }
        return redirectRelative("/?err=reg_failed");
      }

      const tok = await createCustomerSessionCookie({
        customerId: res.customer.id,
        customerCode: res.customer.customerCode,
        phone: res.customer.phone,
      });

      return redirectRelative(`/portal?_ct=${encodeURIComponent(tok)}`);
    }

    // Returning customer lookup by phone
    const phone = String(formData.get("phone") || "");
    const norm = normalizeUzbekPhone(phone);
    if (!norm) {
      return redirectRelative("/?mode=returning&err=bad_phone");
    }

    const rows = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, norm))
      .limit(1);

    if (rows.length === 0) {
      return redirectRelative("/?mode=returning&err=not_found");
    }

    if (rows[0].isBlocked) {
      return redirectRelative("/?mode=returning&err=blocked");
    }

    const tok = await createCustomerSessionCookie({
      customerId: rows[0].id,
      customerCode: rows[0].customerCode,
      phone: rows[0].phone,
    });

    return redirectRelative(`/portal?_ct=${encodeURIComponent(tok)}`);
  } catch (err) {
    console.error("POST /api/auth/customer-form error:", err);
    return redirectRelative("/?err=db_error");
  }
}
