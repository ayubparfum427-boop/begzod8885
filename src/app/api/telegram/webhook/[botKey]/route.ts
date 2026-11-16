import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  customers,
  sales,
  telegramBots,
  telegramSubscribers,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  formatDateUZ,
  formatGrams,
  formatSom,
  formatUzbekPhone,
  normalizeUzbekPhone,
} from "@/lib/format";
import { registerCustomerOnServer } from "@/lib/loyalty-engine";
import { ensureSystemBootstrapped, getAppConfig } from "@/lib/settings-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ botKey: string }> }
) {
  try {
    await ensureSystemBootstrapped();
    const { botKey } = await context.params;
    const payload = await request.json();

    const botRows = await db
      .select()
      .from(telegramBots)
      .where(eq(telegramBots.botKey, botKey))
      .limit(1);

    if (botRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Bot topilmadi" },
        { status: 404 }
      );
    }
    const bot = botRows[0];
    const config = await getAppConfig();

    const msg = payload.message || payload;
    const chatId = String(msg?.chat?.id || payload.chatId || "demo_chat");
    const text = String(msg?.text || payload.command || "/start").trim();
    const lowerText = text.toLowerCase();
    const fromName =
      [msg?.from?.first_name, msg?.from?.last_name].filter(Boolean).join(" ") ||
      String(payload.fullName || "Mijoz");

    // Check if phone number sent via Telegram contact button or text
    const rawPhone =
      msg?.contact?.phone_number ||
      (text.replace(/\D/g, "").length >= 9 ? text : null) ||
      payload.phone ||
      null;
    const normalizedPhone = rawPhone
      ? normalizeUzbekPhone(String(rawPhone))
      : null;

    // Lookup subscriber
    let subRows = await db
      .select()
      .from(telegramSubscribers)
      .where(eq(telegramSubscribers.telegramChatId, chatId))
      .limit(1);

    let linkedCustomer: typeof customers.$inferSelect | null = null;

    if (normalizedPhone) {
      const custRows = await db
        .select()
        .from(customers)
        .where(eq(customers.phone, normalizedPhone))
        .limit(1);

      if (custRows.length > 0) {
        linkedCustomer = custRows[0];
      } else if (botKey === "ayub_club") {
        const reg = await registerCustomerOnServer({
          fullName: fromName,
          phone: normalizedPhone,
          consentAccepted: true,
          qrSource: "telegram",
        });
        if (reg.ok) {
          linkedCustomer = reg.customer;
        }
      }

      if (subRows.length === 0) {
        const [createdSub] = await db
          .insert(telegramSubscribers)
          .values({
            botId: bot.id,
            customerId: linkedCustomer?.id ?? null,
            telegramChatId: chatId,
            telegramUsername: msg?.from?.username
              ? `@${msg.from.username}`
              : null,
            fullName: linkedCustomer?.fullName || fromName,
            phone: normalizedPhone,
            isActive: true,
          })
          .returning();
        subRows = [createdSub];
      } else if (linkedCustomer) {
        await db
          .update(telegramSubscribers)
          .set({
            customerId: linkedCustomer.id,
            phone: normalizedPhone,
            updatedAt: new Date(),
          })
          .where(eq(telegramSubscribers.id, subRows[0].id));
      }
    } else if (subRows.length > 0 && subRows[0].customerId) {
      const custRows = await db
        .select()
        .from(customers)
        .where(eq(customers.id, subRows[0].customerId))
        .limit(1);
      linkedCustomer = custRows[0] ?? null;
    }

    let replyText = "";

    if (botKey === "ayub_info") {
      replyText = `${bot.welcomeTemplate}\n\n${bot.promoTemplate}`;
    } else if (!linkedCustomer) {
      replyText =
        `✨ *${config.clubName}* — *${config.storeName}* rasmiy botiga xush kelibsiz!\n\n` +
        `Profilingizni ulash yoki ro‘yxatdan o‘tib *+${config.welcomeBonusGrams} gr* atir bonusini olish uchun pastdagi *«📱 Telefon raqamni ulash»* tugmasini bosing yoki raqamingizni *+998 XX XXX XX XX* ko‘rinishida yozib yuboring.`;
    } else if (
      lowerText.startsWith("/bonus") ||
      lowerText.includes("bonuslarim")
    ) {
      replyText =
        `🎁 *Bonus balansingiz (${linkedCustomer.customerCode}):*\n` +
        `• Joriy bonus: *${formatGrams(linkedCustomer.bonusGrams)}*\n` +
        `• Jami olingan: *${formatGrams(linkedCustomer.totalBonusEarnedGrams)}*\n` +
        `• Ishlatilgan: *${formatGrams(linkedCustomer.totalBonusUsedGrams)}*`;
    } else if (lowerText.startsWith("/vip") || lowerText.includes("vip")) {
      replyText =
        `👑 *VIP Maqomingiz:*\n` +
        `• Holat: *${linkedCustomer.isVip ? "VIP MIJOZ ✨" : "Standart a’zo"}*\n` +
        `• Jami xaridingiz: *${formatSom(linkedCustomer.totalSpent)}*\n` +
        `• VIP mezon: *${formatSom(config.vipMinTotalSpent)}*`;
    } else if (
      lowerText.startsWith("/tarix") ||
      lowerText.includes("xaridlar")
    ) {
      const recentSales = await db
        .select()
        .from(sales)
        .where(eq(sales.customerId, linkedCustomer.id))
        .orderBy(desc(sales.createdAt))
        .limit(5);

      if (recentSales.length === 0) {
        replyText = `🛍 Sizda hozircha xaridlar qayd etilmagan.`;
      } else {
        replyText =
          `🛍 *Oxirgi xaridlaringiz:*\n` +
          recentSales
            .map(
              (s) =>
                `• ${formatDateUZ(s.createdAt)} — *${formatSom(s.finalAmount)}* (${s.saleCode})`
            )
            .join("\n");
      }
    } else if (
      lowerText.startsWith("/chegirma") ||
      lowerText.includes("chegirma")
    ) {
      const pct = linkedCustomer.isVip
        ? config.vipDiscountPercent
        : config.regularDiscountPercent;
      replyText =
        `🏷 *Chegirma imkoniyatlaringiz:*\n` +
        `• ${formatSom(config.discountThresholdAmount)} dan yuqori xarid uchun: *${pct}% gacha chegirma*\n` +
        (linkedCustomer.customDiscountPercent
          ? `• Shaxsiy kuponingiz: *${linkedCustomer.customDiscountPercent}%*`
          : "");
    } else if (
      lowerText.startsWith("/profil") ||
      lowerText.includes("profil")
    ) {
      replyText =
        `👤 *Mening profilim:*\n` +
        `• Ism: *${linkedCustomer.fullName}*\n` +
        `• Mijoz ID: *${linkedCustomer.customerCode}*\n` +
        `• Telefon: *${formatUzbekPhone(linkedCustomer.phone)}*\n` +
        `• Bonus: *${formatGrams(linkedCustomer.bonusGrams)}*\n` +
        `• Maqom: *${linkedCustomer.isVip ? "VIP 👑" : "Standart"}*\n` +
        `• Jami xarid: *${formatSom(linkedCustomer.totalSpent)}*`;
    } else {
      replyText = bot.welcomeTemplate
        .replace("{ism}", linkedCustomer.fullName)
        .replace("{bonus}", String(linkedCustomer.bonusGrams))
        .replace("{id}", linkedCustomer.customerCode);
    }

    const replyMarkup =
      botKey === "ayub_club"
        ? !linkedCustomer
          ? {
              keyboard: [
                [
                  {
                    text: "📱 Telefon raqamni ulash",
                    request_contact: true,
                  },
                ],
              ],
              resize_keyboard: true,
            }
          : {
              keyboard: [
                [{ text: "🎁 Bonuslarim" }, { text: "👑 VIP maqomim" }],
                [{ text: "🛍 Xaridlar tarixim" }, { text: "🏷 Chegirmalarim" }],
                [{ text: "👤 Mening profilim" }],
              ],
              resize_keyboard: true,
            }
        : undefined;

    if (msg?.chat?.id && bot.botTokenSecret && bot.isActive) {
      try {
        await fetch(
          `https://api.telegram.org/bot${bot.botTokenSecret}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: msg.chat.id,
              text: replyText,
              parse_mode: "Markdown",
              ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
            }),
          }
        );
      } catch {
        // Ignore network errors in sandbox
      }
    }

    return NextResponse.json({
      ok: true,
      replyText,
      linkedCustomer: linkedCustomer
        ? {
            id: linkedCustomer.id,
            customerCode: linkedCustomer.customerCode,
            fullName: linkedCustomer.fullName,
            bonusGrams: linkedCustomer.bonusGrams,
            isVip: linkedCustomer.isVip,
          }
        : null,
    });
  } catch (err) {
    console.error("POST /api/telegram/webhook error:", err);
    return NextResponse.json(
      { ok: false, error: "Webhook xatosi" },
      { status: 500 }
    );
  }
}
