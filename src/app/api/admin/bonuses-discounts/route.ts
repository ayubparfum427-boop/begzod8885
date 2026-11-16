import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  auditLogs,
  bonusTransactions,
  customers,
  customerVipHistory,
  discountTransactions,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getStaffSession, hasPermission } from "@/lib/security";
import {
  ensureSystemBootstrapped,
  getAppConfig,
  updateAppConfig,
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

    const config = await getAppConfig();

    const [bonuses, discounts, vipLogs, allCusts] = await Promise.all([
      db
        .select({
          id: bonusTransactions.id,
          customerId: bonusTransactions.customerId,
          saleId: bonusTransactions.saleId,
          type: bonusTransactions.type,
          amountGrams: bonusTransactions.amountGrams,
          balanceAfterGrams: bonusTransactions.balanceAfterGrams,
          description: bonusTransactions.description,
          expiresAt: bonusTransactions.expiresAt,
          isUsed: bonusTransactions.isUsed,
          createdAt: bonusTransactions.createdAt,
          customerName: customers.fullName,
          customerPhone: customers.phone,
          customerCode: customers.customerCode,
        })
        .from(bonusTransactions)
        .innerJoin(customers, eq(bonusTransactions.customerId, customers.id))
        .orderBy(desc(bonusTransactions.createdAt))
        .limit(100),
      db
        .select({
          id: discountTransactions.id,
          customerId: discountTransactions.customerId,
          saleId: discountTransactions.saleId,
          discountPercent: discountTransactions.discountPercent,
          originalAmount: discountTransactions.originalAmount,
          discountAmount: discountTransactions.discountAmount,
          finalAmount: discountTransactions.finalAmount,
          ruleApplied: discountTransactions.ruleApplied,
          expiresAt: discountTransactions.expiresAt,
          isActive: discountTransactions.isActive,
          notes: discountTransactions.notes,
          createdAt: discountTransactions.createdAt,
          customerName: customers.fullName,
          customerPhone: customers.phone,
          customerCode: customers.customerCode,
        })
        .from(discountTransactions)
        .innerJoin(customers, eq(discountTransactions.customerId, customers.id))
        .orderBy(desc(discountTransactions.createdAt))
        .limit(100),
      db
        .select({
          id: customerVipHistory.id,
          customerId: customerVipHistory.customerId,
          previousStatus: customerVipHistory.previousStatus,
          newStatus: customerVipHistory.newStatus,
          reason: customerVipHistory.reason,
          totalSpentAtChange: customerVipHistory.totalSpentAtChange,
          createdAt: customerVipHistory.createdAt,
          customerName: customers.fullName,
          customerPhone: customers.phone,
          customerCode: customers.customerCode,
        })
        .from(customerVipHistory)
        .innerJoin(customers, eq(customerVipHistory.customerId, customers.id))
        .orderBy(desc(customerVipHistory.createdAt))
        .limit(100),
      db.select().from(customers).orderBy(desc(customers.totalSpent)),
    ]);

    return NextResponse.json({
      config,
      bonuses,
      discounts,
      vipLogs,
      vipCustomers: allCusts.filter((c) => c.isVip),
    });
  } catch (err) {
    console.error("GET /api/admin/bonuses-discounts error:", err);
    return NextResponse.json(
      { error: "Ma’lumotlarni yuklashda xatolik." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_bonuses")) {
      return NextResponse.json(
        { ok: false, error: "Ushbu bo‘limni boshqarish uchun ruxsat yo‘q." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action || "update_rules";

    if (action === "mark_bonus_used") {
      const txId = Number(body.transactionId);
      const txRows = await db
        .select()
        .from(bonusTransactions)
        .where(eq(bonusTransactions.id, txId))
        .limit(1);

      if (txRows.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Bonus operatsiyasi topilmadi." },
          { status: 404 }
        );
      }

      const tx = txRows[0];
      if (tx.isUsed) {
        return NextResponse.json(
          { ok: false, error: "Bu bonus allaqachon ishlatilgan deb belgilangan." },
          { status: 400 }
        );
      }

      const custRows = await db
        .select()
        .from(customers)
        .where(eq(customers.id, tx.customerId))
        .limit(1);

      if (custRows.length > 0 && tx.amountGrams > 0) {
        const cust = custRows[0];
        const deduct = Math.min(Number(cust.bonusGrams || 0), tx.amountGrams);
        const newBal = Math.max(0, Number(cust.bonusGrams || 0) - deduct);

        await db
          .update(bonusTransactions)
          .set({ isUsed: true, updatedAt: new Date() })
          .where(eq(bonusTransactions.id, tx.id));

        if (deduct > 0) {
          await db.insert(bonusTransactions).values({
            customerId: cust.id,
            employeeId: session.employeeId,
            type: "REDEEMED",
            amountGrams: -deduct,
            balanceAfterGrams: newBal,
            description: `Bonus (#${tx.id}) ishlatilgan deb belgilandi (-${deduct} gr)`,
            isUsed: true,
          });

          await db
            .update(customers)
            .set({
              bonusGrams: newBal,
              totalBonusUsedGrams:
                Number(cust.totalBonusUsedGrams || 0) + deduct,
              updatedAt: new Date(),
            })
            .where(eq(customers.id, cust.id));
        }
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "update_rules") {
      const updated = await updateAppConfig(body.rules || {}, session.fullName);

      // If autoVipEnabled is active, synchronize customers meeting the new threshold
      if (updated.autoVipEnabled && updated.vipMinTotalSpent > 0) {
        const allCusts = await db.select().from(customers);
        for (const c of allCusts) {
          if (!c.isVip && Number(c.totalSpent) >= updated.vipMinTotalSpent) {
            await db
              .update(customers)
              .set({
                isVip: true,
                vipSince: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(customers.id, c.id));

            await db.insert(customerVipHistory).values({
              customerId: c.id,
              previousStatus: false,
              newStatus: true,
              reason: `VIP mezoni yangilandi (${updated.vipMinTotalSpent.toLocaleString("ru-RU")} so‘m)`,
              totalSpentAtChange: c.totalSpent,
              changedByEmployeeId: session.employeeId,
            });
          }
        }
      }

      await db.insert(auditLogs).values({
        actorType: session.role,
        actorId: session.employeeId,
        actorName: session.fullName,
        action: "UPDATE_LOYALTY_RULES",
        entityType: "SETTINGS",
        details: "Bonus, chegirma va VIP mezonlari yangilandi",
      });

      return NextResponse.json({ ok: true, config: updated });
    }

    return NextResponse.json(
      { ok: false, error: "Noma’lum amal." },
      { status: 400 }
    );
  } catch (err) {
    console.error("POST /api/admin/bonuses-discounts error:", err);
    return NextResponse.json(
      { ok: false, error: "Saqlashda xatolik yuz berdi." },
      { status: 500 }
    );
  }
}
