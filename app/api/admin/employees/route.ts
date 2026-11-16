import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, employees, profiles } from "@/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import {
  getStaffSession,
  hashSecret,
  hasPermission,
  ROLE_PERMISSIONS,
  StaffRole,
} from "@/lib/security";
import { normalizeUzbekPhone } from "@/lib/format";
import { ensureSystemBootstrapped } from "@/lib/settings-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureSystemBootstrapped();
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_employees")) {
      return NextResponse.json(
        { error: "Xodimlar bo‘limiga faqat Admin kira oladi." },
        { status: 403 }
      );
    }

    const [empRows, recentLogs] = await Promise.all([
      db.select().from(employees).orderBy(employees.id),
      db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(50),
    ]);

    const safeEmployees = empRows.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      phone: e.phone,
      login: e.login,
      role: e.role,
      isActive: e.isActive,
      isBlocked: e.isBlocked,
      registeredCustomersCount: e.registeredCustomersCount,
      salesCount: e.salesCount,
      totalSalesAmount: e.totalSalesAmount,
      lastLoginAt: e.lastLoginAt,
      createdAt: e.createdAt,
    }));

    return NextResponse.json({
      employees: safeEmployees,
      rolePermissions: ROLE_PERMISSIONS,
      auditLogs: recentLogs,
    });
  } catch (err) {
    console.error("GET /api/admin/employees error:", err);
    return NextResponse.json(
      { error: "Xodimlar ro‘yxatini yuklashda xatolik." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_employees")) {
      return NextResponse.json(
        { ok: false, error: "Xodim qo‘shish uchun Admin huquqi kerak." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const normalizedPhone = normalizeUzbekPhone(String(body.phone || ""));
    const login = String(body.login || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    const password = String(body.password || "");
    const role: StaffRole = ["ADMIN", "MANAGER", "CASHIER"].includes(body.role)
      ? body.role
      : "CASHIER";

    if (!fullName || !normalizedPhone || !login || password.length < 4) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ism, O‘zbekiston telefon raqami, login va kamida 4 belgili parolni kiriting.",
        },
        { status: 400 }
      );
    }

    const dupLogin = await db
      .select()
      .from(employees)
      .where(eq(employees.login, login))
      .limit(1);
    if (dupLogin.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Ushbu login boshqa xodimga tegishli." },
        { status: 400 }
      );
    }

    const dupPhone = await db
      .select()
      .from(employees)
      .where(eq(employees.phone, normalizedPhone))
      .limit(1);
    if (dupPhone.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Ushbu telefon raqami boshqa xodimga biriktirilgan." },
        { status: 400 }
      );
    }

    const [prof] = await db
      .insert(profiles)
      .values({
        role,
        fullName,
        phone: normalizedPhone,
        isActive: true,
      })
      .returning();

    const [created] = await db
      .insert(employees)
      .values({
        profileId: prof.id,
        fullName,
        phone: normalizedPhone,
        login,
        passwordHash: hashSecret(password),
        role,
        isActive: true,
        isBlocked: false,
      })
      .returning();

    await db.insert(auditLogs).values({
      actorType: session.role,
      actorId: session.employeeId,
      actorName: session.fullName,
      action: "CREATE_EMPLOYEE",
      entityType: "EMPLOYEE",
      entityId: String(created.id),
      details: `Xodim yaratildi: ${fullName} (${login} — ${role})`,
    });

    return NextResponse.json({
      ok: true,
      employee: {
        id: created.id,
        fullName: created.fullName,
        phone: created.phone,
        login: created.login,
        role: created.role,
        isActive: created.isActive,
        isBlocked: created.isBlocked,
      },
    });
  } catch (err) {
    console.error("POST /api/admin/employees error:", err);
    return NextResponse.json(
      { ok: false, error: "Xodim qo‘shishda xatolik." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_employees")) {
      return NextResponse.json(
        { ok: false, error: "Ruxsat yo‘q." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const id = Number(body.id);
    const action = body.action || "edit";

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Xodim ID ko‘rsatilmadi." },
        { status: 400 }
      );
    }

    const now = new Date();

    if (action === "reset_password") {
      const newPassword = String(body.newPassword || "");
      if (newPassword.length < 4) {
        return NextResponse.json(
          {
            ok: false,
            error: "Yangi parol kamida 4 ta belgidan iborat bo‘lsin.",
          },
          { status: 400 }
        );
      }

      await db
        .update(employees)
        .set({ passwordHash: hashSecret(newPassword), updatedAt: now })
        .where(eq(employees.id, id));

      await db.insert(auditLogs).values({
        actorType: session.role,
        actorId: session.employeeId,
        actorName: session.fullName,
        action: "RESET_EMPLOYEE_PASSWORD",
        entityType: "EMPLOYEE",
        entityId: String(id),
        details: `Xodim (#${id}) paroli Admin tomonidan tiklandi`,
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "toggle_block") {
      const isBlocked = Boolean(body.isBlocked);
      await db
        .update(employees)
        .set({
          isBlocked,
          isActive: !isBlocked,
          updatedAt: now,
        })
        .where(eq(employees.id, id));

      await db.insert(auditLogs).values({
        actorType: session.role,
        actorId: session.employeeId,
        actorName: session.fullName,
        action: isBlocked ? "BLOCK_EMPLOYEE" : "UNBLOCK_EMPLOYEE",
        entityType: "EMPLOYEE",
        entityId: String(id),
        details: `Xodim (#${id}) holati o‘zgartirildi`,
      });

      return NextResponse.json({ ok: true });
    }

    // Standard edit (fullName, phone, login, role)
    const updates: Partial<typeof employees.$inferInsert> = { updatedAt: now };

    if (body.fullName) updates.fullName = String(body.fullName).trim();
    if (body.role && ["ADMIN", "MANAGER", "CASHIER"].includes(body.role)) {
      updates.role = body.role;
    }
    if (body.phone) {
      const norm = normalizeUzbekPhone(String(body.phone));
      if (!norm) {
        return NextResponse.json(
          { ok: false, error: "Telefon formati noto‘g‘ri." },
          { status: 400 }
        );
      }
      const dup = await db
        .select()
        .from(employees)
        .where(and(eq(employees.phone, norm), ne(employees.id, id)))
        .limit(1);
      if (dup.length > 0) {
        return NextResponse.json(
          { ok: false, error: "Ushbu telefon band." },
          { status: 400 }
        );
      }
      updates.phone = norm;
    }
    if (body.login) {
      const login = String(body.login).trim().toLowerCase();
      const dup = await db
        .select()
        .from(employees)
        .where(and(eq(employees.login, login), ne(employees.id, id)))
        .limit(1);
      if (dup.length > 0) {
        return NextResponse.json(
          { ok: false, error: "Ushbu login band." },
          { status: 400 }
        );
      }
      updates.login = login;
    }

    await db.update(employees).set(updates).where(eq(employees.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/employees error:", err);
    return NextResponse.json(
      { ok: false, error: "Xodim ma’lumotini yangilashda xatolik." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_employees")) {
      return NextResponse.json(
        { ok: false, error: "Ruxsat yo‘q." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Xodim ID ko‘rsatilmadi." },
        { status: 400 }
      );
    }

    if (session.employeeId === id) {
      return NextResponse.json(
        { ok: false, error: "O‘zingizning joriy hisobingizni o‘chira olmaysiz." },
        { status: 400 }
      );
    }

    await db.delete(employees).where(eq(employees.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/employees error:", err);
    return NextResponse.json(
      { ok: false, error: "Xodimni o‘chirishda xatolik." },
      { status: 500 }
    );
  }
}
