import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, customers } from "@/db/schema";
import { like } from "drizzle-orm";
import { getStaffSession, hasPermission } from "@/lib/security";
import {
  clearDemoData,
  ensureSystemBootstrapped,
  getAppConfig,
  seedDemoDatasetIfEmpty,
  updateAdminPin,
  updateAppConfig,
} from "@/lib/settings-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureSystemBootstrapped();
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_settings")) {
      return NextResponse.json(
        { error: "Sozlamalar bo‘limiga faqat Admin kira oladi." },
        { status: 403 }
      );
    }

    const config = await getAppConfig();
    const demoCusts = await db
      .select({ id: customers.id })
      .from(customers)
      .where(like(customers.notes, "%[DEMO]%"));

    return NextResponse.json({
      config,
      demoCustomersCount: demoCusts.length,
    });
  } catch (err) {
    console.error("GET /api/admin/settings error:", err);
    return NextResponse.json(
      { error: "Sozlamalarni yuklashda xatolik." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_settings")) {
      return NextResponse.json(
        { ok: false, error: "Sozlamalarni o‘zgartirish uchun Admin huquqi kerak." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action || "update_config";

    if (action === "change_pin") {
      if (!hasPermission(session.role, "change_admin_pin")) {
        return NextResponse.json(
          { ok: false, error: "PIN-kodni faqat Bosh Admin o‘zgartira oladi." },
          { status: 403 }
        );
      }

      const res = await updateAdminPin(
        String(body.currentPin || ""),
        String(body.newPin || ""),
        session.fullName
      );
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: res.error },
          { status: 400 }
        );
      }
      return NextResponse.json({
        ok: true,
        message: "Admin PIN-kodi muvaffaqiyatli yangilandi!",
      });
    }

    if (action === "clear_demo") {
      const res = await clearDemoData();
      await db.insert(auditLogs).values({
        actorType: session.role,
        actorId: session.employeeId,
        actorName: session.fullName,
        action: "CLEAR_DEMO_DATA",
        entityType: "SYSTEM",
        details: `${res.deletedCustomers} ta namuna [DEMO] mijoz yozuvlari tozalandi`,
      });
      return NextResponse.json({
        ok: true,
        deletedCustomers: res.deletedCustomers,
      });
    }

    if (action === "seed_demo") {
      await seedDemoDatasetIfEmpty(session.employeeId);
      return NextResponse.json({ ok: true });
    }

    const updated = await updateAppConfig(body.config || {}, session.fullName);
    await db.insert(auditLogs).values({
      actorType: session.role,
      actorId: session.employeeId,
      actorName: session.fullName,
      action: "UPDATE_SYSTEM_SETTINGS",
      entityType: "SETTINGS",
      details: "Do‘kon va tizim sozlamalari yangilandi",
    });

    return NextResponse.json({ ok: true, config: updated });
  } catch (err) {
    console.error("PATCH /api/admin/settings error:", err);
    return NextResponse.json(
      { ok: false, error: "Sozlamalarni saqlashda xatolik." },
      { status: 500 }
    );
  }
}
