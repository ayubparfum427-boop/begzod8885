import { db } from "@/db";
import { auditLogs, employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createStaffSessionCookie,
  StaffRole,
  verifySecret,
} from "@/lib/security";
import {
  ensureSystemBootstrapped,
  verifyAdminPin,
} from "@/lib/settings-service";

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
    const mode = String(formData.get("mode") || "pin");

    if (mode === "pin") {
      const pin = String(formData.get("pin") || "").trim();
      if (!pin) {
        return redirectRelative("/admin?err=empty_pin");
      }

      const valid = await verifyAdminPin(pin);
      if (!valid) {
        return redirectRelative("/admin?err=wrong_pin");
      }

      const adminEmps = await db
        .select()
        .from(employees)
        .where(eq(employees.role, "ADMIN"))
        .limit(1);

      const empId = adminEmps[0]?.id ?? null;
      const fullName = adminEmps[0]?.fullName || "Bosh Admin";

      const staffToken = await createStaffSessionCookie({
        staffType: "MASTER_ADMIN",
        employeeId: empId,
        role: "ADMIN",
        fullName,
        login: "master_pin",
      });

      await db.insert(auditLogs).values({
        actorType: "ADMIN",
        actorId: empId,
        actorName: fullName,
        action: "ADMIN_PIN_LOGIN",
        entityType: "AUTH",
        details: "Admin PIN-kod orqali tizimga kirdi (Form)",
      });

      return redirectRelative(
        `/admin?_st=${encodeURIComponent(staffToken)}`
      );
    }

    const login = String(formData.get("login") || "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") || "");

    if (!login || !password) {
      return redirectRelative("/admin?mode=employee&err=empty_creds");
    }

    const rows = await db
      .select()
      .from(employees)
      .where(eq(employees.login, login))
      .limit(1);

    if (rows.length === 0) {
      return redirectRelative("/admin?mode=employee&err=no_user");
    }

    const emp = rows[0];
    if (emp.isBlocked || !emp.isActive) {
      return redirectRelative("/admin?mode=employee&err=blocked");
    }

    if (!verifySecret(password, emp.passwordHash)) {
      return redirectRelative("/admin?mode=employee&err=wrong_pass");
    }

    const role = (emp.role as StaffRole) || "CASHIER";
    await db
      .update(employees)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(employees.id, emp.id));

    const staffToken = await createStaffSessionCookie({
      staffType: "EMPLOYEE",
      employeeId: emp.id,
      role,
      fullName: emp.fullName,
      login: emp.login,
    });

    await db.insert(auditLogs).values({
      actorType: role,
      actorId: emp.id,
      actorName: emp.fullName,
      action: "EMPLOYEE_LOGIN",
      entityType: "AUTH",
      details: `${emp.fullName} (${role}) tizimga kirdi (Form)`,
    });

    return redirectRelative(`/admin?_st=${encodeURIComponent(staffToken)}`);
  } catch (err) {
    console.error("POST /api/auth/staff-form error:", err);
    return redirectRelative("/admin?err=db_error");
  }
}
