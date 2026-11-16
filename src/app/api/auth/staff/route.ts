import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  clearStaffSessionCookie,
  createStaffSessionCookie,
  getStaffSession,
  hasPermission,
  ROLE_PERMISSIONS,
  StaffRole,
  verifySecret,
} from "@/lib/security";
import { getAdminOverviewPayload } from "@/lib/overview-service";
import {
  ensureSystemBootstrapped,
  getAppConfig,
  verifyAdminPin,
} from "@/lib/settings-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureSystemBootstrapped();
    const session = await getStaffSession(request);
    const config = await getAppConfig();

    const overview =
      session && hasPermission(session.role, "view_dashboard")
        ? await getAdminOverviewPayload()
        : null;

    return NextResponse.json({
      authenticated: Boolean(session),
      session,
      permissions: session ? ROLE_PERMISSIONS[session.role] : [],
      overview,
      branding: {
        storeName: config.storeName,
        clubName: config.clubName,
        storePhone: config.storePhone,
        emeraldColor: config.emeraldColor,
        goldColor: config.goldColor,
      },
    });
  } catch (err) {
    console.error("GET /api/auth/staff error:", err);
    return NextResponse.json(
      { authenticated: false, error: "Server xatosi yuz berdi" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureSystemBootstrapped();
    const body = await request.json();
    const mode = body.mode || "pin";

    if (mode === "pin") {
      const pin = String(body.pin || "").trim();
      if (!pin) {
        return NextResponse.json(
          { ok: false, error: "Iltimos, Admin PIN-kodni kiriting." },
          { status: 400 }
        );
      }

      const isValid = await verifyAdminPin(pin);
      if (!isValid) {
        return NextResponse.json(
          { ok: false, error: "Admin PIN-kodi noto‘g‘ri!" },
          { status: 401 }
        );
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
        details: "Admin PIN-kod orqali tizimga kirdi",
      });

      const overview = await getAdminOverviewPayload();

      return NextResponse.json({
        ok: true,
        staffToken,
        overview,
        session: {
          staffType: "MASTER_ADMIN",
          employeeId: empId,
          role: "ADMIN" as StaffRole,
          fullName,
          login: "master_pin",
        },
        permissions: ROLE_PERMISSIONS.ADMIN,
      });
    }

    const login = String(body.login || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!login || !password) {
      return NextResponse.json(
        { ok: false, error: "Login va parolni to‘liq kiriting." },
        { status: 400 }
      );
    }

    const rows = await db
      .select()
      .from(employees)
      .where(eq(employees.login, login))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Bunday loginli xodim topilmadi." },
        { status: 401 }
      );
    }

    const emp = rows[0];
    if (emp.isBlocked || !emp.isActive) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ushbu xodim hisobi faolsizlantirilgan yoki bloklangan.",
        },
        { status: 403 }
      );
    }

    const passValid = verifySecret(password, emp.passwordHash);
    if (!passValid) {
      return NextResponse.json(
        { ok: false, error: "Parol noto‘g‘ri kiritildi." },
        { status: 401 }
      );
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
      details: `${emp.fullName} (${role}) tizimga kirdi`,
    });

    const overview = hasPermission(role, "view_dashboard")
      ? await getAdminOverviewPayload()
      : null;

    return NextResponse.json({
      ok: true,
      staffToken,
      overview,
      session: {
        staffType: "EMPLOYEE",
        employeeId: emp.id,
        role,
        fullName: emp.fullName,
        login: emp.login,
      },
      permissions: ROLE_PERMISSIONS[role],
    });
  } catch (err) {
    console.error("POST /api/auth/staff error:", err);
    const errMsg = err instanceof Error ? err.message : String(err);
    let detail = "Avtorizatsiyada xatolik yuz berdi.";
    if (errMsg.includes("ENETUNREACH") || errMsg.includes("ENOTFOUND")) {
      detail =
        "Ma’lumotlar bazasiga ulanib bo‘lmadi: DATABASE_URL da Direct connection emas, Supabase Session/Transaction Pooler (pooler.supabase.com) havolasini kiriting.";
    } else if (
      errMsg.includes("password authentication failed") ||
      errMsg.includes("28P01")
    ) {
      detail =
        "DATABASE_URL ichidagi Supabase baza paroli noto‘g‘ri kiritilgan.";
    } else if (errMsg.includes("Tenant or user not found")) {
      detail =
        "DATABASE_URL dagi Supabase foydalanuvchi nomi yoki region noto‘g‘ri (Connect -> Session pooler dan nusxalang).";
    }
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }
}

export async function DELETE() {
  await clearStaffSessionCookie();
  return NextResponse.json({ ok: true });
}
