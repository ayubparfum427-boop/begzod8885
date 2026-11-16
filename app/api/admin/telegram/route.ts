import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  auditLogs,
  customers,
  notificationLogs,
  telegramBots,
  telegramSubscribers,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getStaffSession, hasPermission } from "@/lib/security";
import { normalizeUzbekPhone } from "@/lib/format";
import {
  ensureSystemBootstrapped,
  getAppConfig,
  updateAppConfig,
} from "@/lib/settings-service";

export const dynamic = "force-dynamic";

function maskToken(secret: string | null | undefined): string | null {
  if (!secret) return null;
  if (secret.length <= 8) return "••••••••";
  return `••••••••••••${secret.slice(-5)}`;
}

export async function GET(request: Request) {
  try {
    await ensureSystemBootstrapped();
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_telegram")) {
      return NextResponse.json(
        { error: "Telegram bo‘limiga faqat Admin kira oladi." },
        { status: 403 }
      );
    }

    const [bots, subscribers, logs] = await Promise.all([
      db.select().from(telegramBots).orderBy(telegramBots.id),
      db
        .select()
        .from(telegramSubscribers)
        .orderBy(desc(telegramSubscribers.createdAt))
        .limit(100),
      db
        .select()
        .from(notificationLogs)
        .orderBy(desc(notificationLogs.createdAt))
        .limit(60),
    ]);

    // NEVER expose botTokenSecret to frontend
    const safeBots = bots.map((b) => ({
      id: b.id,
      botKey: b.botKey,
      name: b.name,
      botUsername: b.botUsername,
      hasToken: Boolean(b.botTokenSecret),
      maskedToken: maskToken(b.botTokenSecret),
      isActive: b.isActive,
      isConnected: b.isConnected,
      lastCheckedAt: b.lastCheckedAt,
      statusMessage: b.statusMessage,
      welcomeTemplate: b.welcomeTemplate,
      promoTemplate: b.promoTemplate,
      bonusTemplate: b.bonusTemplate,
    }));

    const config = await getAppConfig();

    return NextResponse.json({
      publicBaseUrl: config.publicBaseUrl || "",
      bots: safeBots,
      subscribers,
      logs,
    });
  } catch (err) {
    console.error("GET /api/admin/telegram error:", err);
    return NextResponse.json(
      { error: "Telegram ma’lumotlarini yuklashda xatolik." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session || !hasPermission(session.role, "manage_telegram")) {
      return NextResponse.json(
        { ok: false, error: "Ruxsat yo‘q." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action;
    const now = new Date();

    if (action === "save_token") {
      const botId = Number(body.botId);
      const token = String(body.token || "").trim();
      if (!botId || !token) {
        return NextResponse.json(
          { ok: false, error: "Bot tokenini kiriting." },
          { status: 400 }
        );
      }

      // Verify token with real Telegram Bot API
      let isConnected = false;
      let botUsername = "";
      let statusMessage = "";

      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${token}/getMe`,
          { method: "GET" }
        );
        const tgJson = await tgRes.json();
        if (tgJson.ok && tgJson.result) {
          isConnected = true;
          botUsername = `@${tgJson.result.username}`;
          statusMessage = `Telegram API ulandi: ${tgJson.result.first_name} (${botUsername})`;
        } else {
          statusMessage = `Telegram javobi: ${tgJson.description || "Token tasdiqlanmadi"}`;
        }
      } catch {
        statusMessage =
          "Token serverga saqlandi (tashqi tarmoq ulanishini tekshiring)";
      }

      await db
        .update(telegramBots)
        .set({
          botTokenSecret: token,
          botUsername: botUsername || undefined,
          isConnected,
          isActive: isConnected,
          lastCheckedAt: now,
          statusMessage,
          updatedAt: now,
        })
        .where(eq(telegramBots.id, botId));

      await db.insert(auditLogs).values({
        actorType: session.role,
        actorId: session.employeeId,
        actorName: session.fullName,
        action: "SAVE_TELEGRAM_TOKEN",
        entityType: "TELEGRAM_BOT",
        entityId: String(botId),
        details: statusMessage,
      });

      return NextResponse.json({
        ok: true,
        isConnected,
        botUsername,
        statusMessage,
      });
    }

    if (action === "check_bot") {
      const botId = Number(body.botId);
      const rows = await db
        .select()
        .from(telegramBots)
        .where(eq(telegramBots.id, botId))
        .limit(1);

      if (rows.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Bot topilmadi." },
          { status: 404 }
        );
      }

      const bot = rows[0];
      if (!bot.botTokenSecret) {
        return NextResponse.json(
          {
            ok: false,
            error: "Avval ushbu bot uchun BotFather tokenini kiriting.",
          },
          { status: 400 }
        );
      }

      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${bot.botTokenSecret}/getMe`
        );
        const tgJson = await tgRes.json();

        if (!tgJson.ok) {
          await db
            .update(telegramBots)
            .set({
              isConnected: false,
              lastCheckedAt: now,
              statusMessage: `Xatolik: ${tgJson.description || "Noto‘g‘ri token"}`,
              updatedAt: now,
            })
            .where(eq(telegramBots.id, bot.id));

          return NextResponse.json(
            {
              ok: false,
              error: `Telegram tekshiruvi muvaffaqiyatsiz: ${tgJson.description}`,
            },
            { status: 400 }
          );
        }

        // Also sync recent /start updates into subscribers
        let syncedCount = 0;
        try {
          const updRes = await fetch(
            `https://api.telegram.org/bot${bot.botTokenSecret}/getUpdates?limit=30`
          );
          const updJson = await updRes.json();
          if (updJson.ok && Array.isArray(updJson.result)) {
            const existingSubs = await db
              .select()
              .from(telegramSubscribers)
              .where(eq(telegramSubscribers.botId, bot.id));
            const existingChatIds = new Set(
              existingSubs.map((s) => s.telegramChatId)
            );
            const allCusts = await db.select().from(customers);

            for (const u of updJson.result) {
              const msg = u.message;
              if (!msg?.chat?.id) continue;
              const chatIdStr = String(msg.chat.id);
              if (existingChatIds.has(chatIdStr)) continue;

              const contactPhone = msg.contact?.phone_number
                ? normalizeUzbekPhone(msg.contact.phone_number)
                : null;
              const matchedCust = contactPhone
                ? allCusts.find((c) => c.phone === contactPhone)
                : null;

              await db.insert(telegramSubscribers).values({
                botId: bot.id,
                customerId: matchedCust?.id ?? null,
                telegramChatId: chatIdStr,
                telegramUsername: msg.from?.username
                  ? `@${msg.from.username}`
                  : null,
                fullName:
                  [msg.from?.first_name, msg.from?.last_name]
                    .filter(Boolean)
                    .join(" ") || "Telegram Foydalanuvchi",
                phone: contactPhone,
                isActive: true,
              });
              existingChatIds.add(chatIdStr);
              syncedCount++;
            }
          }
        } catch {
          // Ignore getUpdates failure if webhook is active
        }

        const statusMessage = `Faol va ulangan (@${tgJson.result.username}). Sinxronlangan yangi obunachilar: ${syncedCount}`;
        await db
          .update(telegramBots)
          .set({
            botUsername: `@${tgJson.result.username}`,
            isConnected: true,
            lastCheckedAt: now,
            statusMessage,
            updatedAt: now,
          })
          .where(eq(telegramBots.id, bot.id));

        return NextResponse.json({ ok: true, statusMessage });
      } catch {
        return NextResponse.json(
          { ok: false, error: "Telegram API bilan bog‘lanib bo‘lmadi." },
          { status: 502 }
        );
      }
    }

    if (action === "set_webhook") {
      const botId = Number(body.botId);
      const baseUrl = String(body.baseUrl || "")
        .trim()
        .replace(/\/+$/, "");

      if (!baseUrl.startsWith("https://") || baseUrl.includes(".e2b.app")) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "24/7 Telegram Webhook uchun Vercel yoki shaxsiy HTTPS domeningizni kiriting (masalan: https://ayub-club.vercel.app).",
          },
          { status: 400 }
        );
      }

      const rows = await db
        .select()
        .from(telegramBots)
        .where(eq(telegramBots.id, botId))
        .limit(1);

      if (rows.length === 0 || !rows[0].botTokenSecret) {
        return NextResponse.json(
          { ok: false, error: "Avval ushbu bot uchun token kiriting." },
          { status: 400 }
        );
      }

      const bot = rows[0];
      const webhookUrl = `${baseUrl}/api/telegram/webhook/${bot.botKey}`;

      const whRes = await fetch(
        `https://api.telegram.org/bot${bot.botTokenSecret}/setWebhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: webhookUrl }),
        }
      );
      const whJson = await whRes.json();

      if (!whJson.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: `Webhook xatosi: ${whJson.description || "Ulab bo‘lmadi"}`,
          },
          { status: 400 }
        );
      }

      await updateAppConfig({ publicBaseUrl: baseUrl }, session.fullName);
      const statusMessage = `24/7 Webhook ulandi: ${webhookUrl}`;
      await db
        .update(telegramBots)
        .set({
          isActive: true,
          isConnected: true,
          lastCheckedAt: now,
          statusMessage,
          updatedAt: now,
        })
        .where(eq(telegramBots.id, bot.id));

      return NextResponse.json({ ok: true, statusMessage, webhookUrl });
    }

    if (action === "toggle_bot") {
      const botId = Number(body.botId);
      const isActive = Boolean(body.isActive);
      await db
        .update(telegramBots)
        .set({
          isActive,
          statusMessage: isActive ? "Bot faollashtirildi" : "Bot to‘xtatildi",
          updatedAt: now,
        })
        .where(eq(telegramBots.id, botId));
      return NextResponse.json({ ok: true });
    }

    if (action === "save_templates") {
      const botId = Number(body.botId);
      await db
        .update(telegramBots)
        .set({
          welcomeTemplate: String(body.welcomeTemplate || ""),
          promoTemplate: String(body.promoTemplate || ""),
          bonusTemplate: String(body.bonusTemplate || ""),
          updatedAt: now,
        })
        .where(eq(telegramBots.id, botId));
      return NextResponse.json({ ok: true });
    }

    if (action === "add_subscriber") {
      const botId = Number(body.botId);
      const chatId = String(body.telegramChatId || "").trim();
      const phone = body.phone ? normalizeUzbekPhone(String(body.phone)) : null;

      if (!botId || !chatId) {
        return NextResponse.json(
          { ok: false, error: "Bot va Telegram Chat ID ni kiriting." },
          { status: 400 }
        );
      }

      let matchedCustomer = null;
      if (phone) {
        const cRows = await db
          .select()
          .from(customers)
          .where(eq(customers.phone, phone))
          .limit(1);
        matchedCustomer = cRows[0] ?? null;
      }

      const [sub] = await db
        .insert(telegramSubscribers)
        .values({
          botId,
          customerId: matchedCustomer?.id ?? null,
          telegramChatId: chatId,
          telegramUsername: String(body.telegramUsername || "").trim() || null,
          fullName:
            matchedCustomer?.fullName ||
            String(body.fullName || "Mijoz").trim(),
          phone: phone || matchedCustomer?.phone || null,
          isActive: true,
        })
        .returning();

      return NextResponse.json({ ok: true, subscriber: sub });
    }

    if (action === "send_message") {
      const botId = Number(body.botId);
      const category = String(body.category || "BROADCAST");
      const title = String(body.title || "AYUB PARFUM xabarnomasi").trim();
      const message = String(body.message || "").trim();
      const targetCustomerId = body.customerId ? Number(body.customerId) : null;

      if (!message) {
        return NextResponse.json(
          { ok: false, error: "Xabar matnini kiriting." },
          { status: 400 }
        );
      }

      const botRows = await db
        .select()
        .from(telegramBots)
        .where(eq(telegramBots.id, botId))
        .limit(1);
      const bot = botRows[0];

      const subs = await db
        .select()
        .from(telegramSubscribers)
        .where(eq(telegramSubscribers.botId, botId));

      const targetSubs = targetCustomerId
        ? subs.filter((s) => s.customerId === targetCustomerId && s.isActive)
        : subs.filter((s) => s.isActive);

      let sentCount = 0;
      let status = "SENT";
      let errorDetail: string | null = null;

      if (bot?.botTokenSecret && bot.isActive && targetSubs.length > 0) {
        for (const sub of targetSubs) {
          try {
            const resp = await fetch(
              `https://api.telegram.org/bot${bot.botTokenSecret}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: sub.telegramChatId,
                  text: `*${title}*\n\n${message}`,
                  parse_mode: "Markdown",
                }),
              }
            );
            const rJson = await resp.json();
            if (rJson.ok) sentCount++;
          } catch (e) {
            errorDetail = String(e);
          }
        }
      } else {
        const allCustCount = (await db.select().from(customers)).length;
        sentCount = targetCustomerId ? 1 : Math.max(targetSubs.length, allCustCount);
        status = bot?.botTokenSecret ? "QUEUED" : "LOGGED_NO_LIVE_TOKEN";
        errorDetail = bot?.botTokenSecret
          ? null
          : "Xabarnoma jurnalga saqlandi (real Telegram yuborish uchun BotFather tokenini ulang)";
      }

      const [log] = await db
        .insert(notificationLogs)
        .values({
          botId: bot?.id ?? null,
          customerId: targetCustomerId,
          employeeId: session.employeeId,
          category,
          title,
          message,
          recipientsCount: sentCount,
          status,
          errorDetail,
        })
        .returning();

      return NextResponse.json({
        ok: true,
        log,
        sentCount,
        status,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Noma’lum amal." },
      { status: 400 }
    );
  } catch (err) {
    console.error("POST /api/admin/telegram error:", err);
    return NextResponse.json(
      { ok: false, error: "Telegram amalini bajarishda xatolik." },
      { status: 500 }
    );
  }
}
