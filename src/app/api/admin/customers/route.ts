import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  auditLogs,
  bonusTransactions,
  customers,
  customerVipHistory,
  discountTransactions,
  saleItems,
  sales,
} from "@/db/schema";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { getStaffSession, hasPermission } from "@/lib/security";
import { normalizeUzbekPhone } from "@/lib/format";
import { registerCustomerOnServer } from "@/lib/loyalty-engine";
import {
  ensureSystemBootstrapped,
  getAppConfig,
  reconcileDatabaseIntegrity,
} from "@/lib/settings-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureSystemBootstrapped();
    const session = await getStaffSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Avtorizatsiya talab qilinadi." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");

    if (idParam) {
      const cid = Number(idParam);
      const custRows = await db
        .select()
        .from(customers)
        .where(eq(customers.id, cid))
        .limit(1);

      if (custRows.length === 0) {
        return NextResponse.json(
          { error: "Mijoz topilmadi." },
          { status: 404 }
        );
      }

      const [bonuses, discounts, vipHistory, custSales] = await Promise.all([
        db
          .select()
          .from(bonusTransactions)
          .where(eq(bonusTransactions.customerId, cid))
          .orderBy(desc(bonusTransactions.createdAt)),
        db
          .select()
          .from(discountTransactions)
          .where(eq(discountTransactions.customerId, cid))
          .orderBy(desc(discountTransactions.createdAt)),
        db
          .select()
          .from(customerVipHistory)
          .where(eq(customerVipHistory.customerId, cid))
          .orderBy(desc(customerVipHistory.createdAt)),
        db
          .select()
          .from(sales)
          .where(eq(sales.customerId, cid))
          .orderBy(desc(sales.createdAt)),
      ]);

      const saleIds = custSales.map((s) => s.id);
      const items =
        saleIds.length > 0
          ? await db
              .select()
              .from(saleItems)
              .where(inArray(saleItems.saleId, saleIds))
          : [];

      return NextResponse.json({
        customer: custRows[0],
        bonuses,
        discounts,
        vipHistory,
        sales: custSales.map((s) => ({
          ...s,
          items: items.filter((it) => it.saleId === s.id),
        })),
      });
    }

    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const vipOnly = searchParams.get("vip") === "true";
    const sourceFilter = (searchParams.get("source") || "").trim();

    let rows = await db
      .select()
      .from(customers)
      .orderBy(desc(customers.createdAt));

    if (q) {
      const qDigits = q.replace(/\D/g, "");
      rows = rows.filter((c) => {
        const matchName = c.fullName.toLowerCase().includes(q);
        const matchCode = c.customerCode.toLowerCase().includes(q);
        const matchPhone =
          c.phone.toLowerCase().includes(q) ||
          (qDigits.length >= 2 && c.phone.replace(/\D/g, "").includes(qDigits));
        return matchName || matchCode || matchPhone;
      });
    }

    if (vipOnly) {
      rows = rows.filter((c) => c.isVip);
    }

    if (sourceFilter && sourceFilter !== "all") {
      rows = rows.filter((c) => c.qrSource === sourceFilter);
    }

    return NextResponse.json({ customers: rows });
  } catch (err) {
    console.error("GET /api/admin/customers error:", err);
    return NextResponse.json(
      { error: "Mijozlar ro‘yxatini yuklashda xatolik." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "register_customer")) {
      return NextResponse.json(
        { ok: false, error: "Mijoz qo‘shish ruxsati yo‘q." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const result = await registerCustomerOnServer({
      fullName: body.fullName,
      phone: body.phone,
      consentAccepted: true,
      qrSource: body.qrSource || "cashier",
      registeredByEmployeeId: session.employeeId,
      actorName: session.fullName,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      customer: result.customer,
      welcomeBonusGranted: result.welcomeBonusGranted,
    });
  } catch (err) {
    console.error("POST /api/admin/customers error:", err);
    return NextResponse.json(
      { ok: false, error: "Mijoz qo‘shishda xatolik yuz berdi." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_customers")) {
      return NextResponse.json(
        { ok: false, error: "Mijozni tahrirlash uchun ruxsat yetarli emas." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const id = Number(body.id);
    const action = body.action || "edit";

    const existingRows = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);

    if (existingRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Mijoz topilmadi." },
        { status: 404 }
      );
    }

    const cust = existingRows[0];
    const now = new Date();
    const config = await getAppConfig();

    if (action === "edit") {
      const fullName = String(body.fullName || cust.fullName).trim();
      const normalizedPhone = normalizeUzbekPhone(
        String(body.phone || cust.phone)
      );
      if (!normalizedPhone) {
        return NextResponse.json(
          {
            ok: false,
            error: "Telefon raqami +998 XX XXX XX XX formatida bo‘lishi kerak.",
          },
          { status: 400 }
        );
      }

      const dup = await db
        .select()
        .from(customers)
        .where(
          and(eq(customers.phone, normalizedPhone), ne(customers.id, cust.id))
        )
        .limit(1);

      if (dup.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "Ushbu telefon raqami boshqa mijozga biriktirilgan!",
          },
          { status: 400 }
        );
      }

      // Note: qrSource is intentionally NEVER modified after registration
      const [updated] = await db
        .update(customers)
        .set({
          fullName,
          phone: normalizedPhone,
          notes: body.notes !== undefined ? String(body.notes) : cust.notes,
          updatedAt: now,
        })
        .where(eq(customers.id, cust.id))
        .returning();

      return NextResponse.json({ ok: true, customer: updated });
    }

    if (action === "toggle_block") {
      const nextBlocked = Boolean(body.isBlocked);
      const [updated] = await db
        .update(customers)
        .set({ isBlocked: nextBlocked, updatedAt: now })
        .where(eq(customers.id, cust.id))
        .returning();

      await db.insert(auditLogs).values({
        actorType: session.role,
        actorId: session.employeeId,
        actorName: session.fullName,
        action: nextBlocked ? "BLOCK_CUSTOMER" : "UNBLOCK_CUSTOMER",
        entityType: "CUSTOMER",
        entityId: String(cust.id),
        details: `${cust.fullName} holati o‘zgartirildi`,
      });

      return NextResponse.json({ ok: true, customer: updated });
    }

    if (action === "grant_bonus") {
      if (!hasPermission(session.role, "manage_bonuses")) {
        return NextResponse.json(
          { ok: false, error: "Bonus berish ruxsati yo‘q." },
          { status: 403 }
        );
      }
      const rawDelta = Number(body.amountGrams || 0);
      if (!rawDelta || Number.isNaN(rawDelta)) {
        return NextResponse.json(
          { ok: false, error: "Bonus miqdorini (grammda) kiriting." },
          { status: 400 }
        );
      }

      const currentBal = Math.max(0, Number(cust.bonusGrams || 0));
      if (rawDelta < 0 && currentBal <= 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "Mijoz balansida ayirish uchun bonus mavjud emas (0 gr).",
          },
          { status: 400 }
        );
      }

      const deltaGrams =
        rawDelta < 0 ? -Math.min(currentBal, Math.abs(rawDelta)) : rawDelta;
      const newBalance = Math.max(0, currentBal + deltaGrams);
      const expiresAt =
        deltaGrams > 0 && config.bonusExpiryDays > 0
          ? new Date(
              now.getTime() + config.bonusExpiryDays * 24 * 60 * 60 * 1000
            )
          : null;

      await db.insert(bonusTransactions).values({
        customerId: cust.id,
        employeeId: session.employeeId,
        type: deltaGrams > 0 ? "MANUAL_GRANT" : "REDEEMED",
        amountGrams: deltaGrams,
        balanceAfterGrams: newBalance,
        description:
          String(body.description || "").trim() ||
          (deltaGrams > 0
            ? `Admin tomonidan qo‘lda bonus berildi (+${deltaGrams} gr)`
            : `Bonus ishlatilgan deb belgilandi (${deltaGrams} gr)`),
        expiresAt,
        isUsed: deltaGrams < 0,
      });

      await reconcileDatabaseIntegrity();

      const [updated] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, cust.id))
        .limit(1);

      return NextResponse.json({ ok: true, customer: updated });
    }

    if (action === "toggle_vip") {
      if (!hasPermission(session.role, "manage_vip")) {
        return NextResponse.json(
          { ok: false, error: "VIP maqomni o‘zgartirish ruxsati yo‘q." },
          { status: 403 }
        );
      }
      const nextVip = Boolean(body.isVip);
      const reason =
        String(body.reason || "").trim() ||
        (nextVip
          ? "Admin tomonidan VIP maqomi berildi"
          : "Admin tomonidan VIP maqomi bekor qilindi");

      await db.insert(customerVipHistory).values({
        customerId: cust.id,
        previousStatus: cust.isVip,
        newStatus: nextVip,
        reason,
        totalSpentAtChange: cust.totalSpent,
        changedByEmployeeId: session.employeeId,
      });

      const [updated] = await db
        .update(customers)
        .set({
          isVip: nextVip,
          vipSince: nextVip ? now : null,
          updatedAt: now,
        })
        .where(eq(customers.id, cust.id))
        .returning();

      return NextResponse.json({ ok: true, customer: updated });
    }

    if (action === "grant_discount") {
      if (!hasPermission(session.role, "manage_discounts")) {
        return NextResponse.json(
          { ok: false, error: "Chegirma berish ruxsati yo‘q." },
          { status: 403 }
        );
      }
      const pct = Math.min(90, Math.max(0, Math.round(Number(body.discountPercent || 0))));

      const [updated] = await db
        .update(customers)
        .set({
          customDiscountPercent: pct > 0 ? pct : null,
          updatedAt: now,
        })
        .where(eq(customers.id, cust.id))
        .returning();

      if (pct > 0) {
        const exp =
          config.discountExpiryDays > 0
            ? new Date(
                now.getTime() + config.discountExpiryDays * 24 * 60 * 60 * 1000
              )
            : null;
        await db.insert(discountTransactions).values({
          customerId: cust.id,
          employeeId: session.employeeId,
          discountPercent: pct,
          originalAmount: 0,
          discountAmount: 0,
          finalAmount: 0,
          ruleApplied: `PERSONAL_${pct}`,
          expiresAt: exp,
          isActive: true,
          notes:
            String(body.notes || "").trim() ||
            `Mijozga shaxsiy ${pct}% chegirma kuponi biriktirildi`,
        });
      }

      return NextResponse.json({ ok: true, customer: updated });
    }

    return NextResponse.json(
      { ok: false, error: "Noma’lum amal." },
      { status: 400 }
    );
  } catch (err) {
    console.error("PATCH /api/admin/customers error:", err);
    return NextResponse.json(
      { ok: false, error: "Amalni bajarishda xatolik yuz berdi." },
      { status: 500 }
    );
  }
}
