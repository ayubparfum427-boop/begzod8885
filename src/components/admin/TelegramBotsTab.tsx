"use client";

import React, { useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Globe,
  Power,
  RefreshCw,
  Save,
  Send,
  Terminal,
} from "lucide-react";
import { formatDateTimeUZ } from "@/lib/format";
import { staffFetch } from "@/lib/client-auth";

interface SafeBot {
  id: number;
  botKey: string;
  name: string;
  botUsername: string | null;
  hasToken: boolean;
  maskedToken: string | null;
  isActive: boolean;
  isConnected: boolean;
  lastCheckedAt: string | null;
  statusMessage: string | null;
  welcomeTemplate: string;
  promoTemplate: string;
  bonusTemplate: string;
}

interface NotifLog {
  id: number;
  category: string;
  title: string;
  message: string;
  recipientsCount: number;
  status: string;
  errorDetail: string | null;
  createdAt: string;
}

export function TelegramBotsTab() {
  const [bots, setBots] = useState<SafeBot[]>([]);
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [tokenInputs, setTokenInputs] = useState<Record<number, string>>({});
  const [webhookBaseUrl, setWebhookBaseUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Broadcast / Notification composer
  const [selectedBotId, setSelectedBotId] = useState<number>(0);
  const [category, setCategory] = useState("NEW_PERFUME");
  const [notifTitle, setNotifTitle] = useState("Yangi eksklyuziv atirlar keldi!");
  const [notifBody, setNotifBody] = useState(
    "Hurmatli AYUB CLUB a’zosi! Do‘konimizga yangi Oud Imperial va Velvet Rose kolleksiyasi keldi. Bonus va 45% gacha VIP chegirmalaringizdan foydalaning!"
  );
  const [sending, setSending] = useState(false);

  // Interactive Bot Webhook Tester
  const [simPhone, setSimPhone] = useState("+998901234567");
  const [simCommand, setSimCommand] = useState("/bonus");
  const [simReply, setSimReply] = useState("");

  async function loadTelegram() {
    const res = await staffFetch("/api/admin/telegram");
    const data = await res.json();
    if (typeof data.publicBaseUrl === "string" && data.publicBaseUrl) {
      setWebhookBaseUrl(data.publicBaseUrl);
    } else if (
      typeof window !== "undefined" &&
      !window.location.origin.includes(".e2b.app")
    ) {
      setWebhookBaseUrl(window.location.origin);
    }
    if (data.bots) {
      setBots(data.bots);
      if (!selectedBotId && data.bots[1]) {
        setSelectedBotId(data.bots[1].id);
      } else if (!selectedBotId && data.bots[0]) {
        setSelectedBotId(data.bots[0].id);
      }
    }
    if (data.logs) setLogs(data.logs);
  }

  useEffect(() => {
    loadTelegram();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveBotToken(botId: number) {
    setErr("");
    setMsg("");
    const tok = (tokenInputs[botId] || "").trim();
    if (!tok) {
      setErr("BotFather dan olingan tokenni kiriting.");
      return;
    }
    const res = await staffFetch("/api/admin/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_token", botId, token: tok }),
    });
    const data = await res.json();
    if (data.ok) {
      setTokenInputs({ ...tokenInputs, [botId]: "" });
      setMsg(data.statusMessage || "Token serverda xavfsiz saqlandi.");
      loadTelegram();
    } else {
      setErr(data.error || "Tokenni saqlashda xatolik");
    }
  }

  async function checkBot(botId: number) {
    setErr("");
    setMsg("");
    const res = await staffFetch("/api/admin/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check_bot", botId }),
    });
    const data = await res.json();
    if (data.ok) {
      setMsg(data.statusMessage);
      loadTelegram();
    } else {
      setErr(data.error || "Tekshirishda xatolik");
    }
  }

  async function connectWebhook(botId: number) {
    setErr("");
    setMsg("");
    const res = await staffFetch("/api/admin/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_webhook",
        botId,
        baseUrl: webhookBaseUrl,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setMsg(data.statusMessage);
      loadTelegram();
    } else {
      setErr(data.error || "Webhook ulashda xatolik");
    }
  }

  async function toggleBot(bot: SafeBot) {
    await staffFetch("/api/admin/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_bot",
        botId: bot.id,
        isActive: !bot.isActive,
      }),
    });
    loadTelegram();
  }

  async function saveTemplates(bot: SafeBot) {
    const res = await staffFetch("/api/admin/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_templates",
        botId: bot.id,
        welcomeTemplate: bot.welcomeTemplate,
        promoTemplate: bot.promoTemplate,
        bonusTemplate: bot.bonusTemplate,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setMsg(`${bot.name} xabar shablonlari saqlandi.`);
    }
  }

  async function handleSendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setErr("");
    setMsg("");
    try {
      const res = await staffFetch("/api/admin/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_message",
          botId: selectedBotId,
          category,
          title: notifTitle,
          message: notifBody,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg(
          `Xabar qayta ishlandi (${data.sentCount} qabul qiluvchi, holat: ${data.status}).`
        );
        loadTelegram();
      } else {
        setErr(data.error || "Yuborishda xatolik");
      }
    } finally {
      setSending(false);
    }
  }

  async function runBotCommandTest(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/telegram/webhook/ayub_club", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: "test_admin_preview",
        phone: simPhone,
        command: simCommand,
        fullName: "Mijoz Test",
      }),
    });
    const data = await res.json();
    if (data.replyText) setSimReply(data.replyText);
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="font-serif-luxury text-2xl font-bold">
          Telegram Botlar va Xabarnomalar markazi
        </h2>
        <p className="text-sm text-neutral-500">
          Bot tokenlari faqat himoyalangan serverda saqlanadi (frontendda hech
          qachon ko‘rsatilmaydi).
        </p>
      </div>

      {msg && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {err}
        </div>
      )}

      {/* 2 BOTS CARDS: AYUB CLUB & AYUB INFO */}
      <div className="grid gap-6 lg:grid-cols-2">
        {bots.map((bot) => (
          <div
            key={bot.id}
            className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#064E3B] text-[#D4AF37]">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-serif-luxury text-lg font-bold">
                    {bot.name}
                  </h3>
                  <div className="text-xs text-neutral-500">
                    {bot.botUsername || "Username aniqlanmagan"} •{" "}
                    {bot.hasToken
                      ? `Token: ${bot.maskedToken}`
                      : "Token kiritilmagan"}
                  </div>
                </div>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  bot.isActive
                    ? "bg-emerald-100 text-[#064E3B]"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                }`}
              >
                {bot.isActive ? "Faol" : "Nofaol"}
              </span>
            </div>

            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/60 px-3.5 py-2.5 text-xs text-neutral-600 dark:text-neutral-300">
              Holat: <strong>{bot.statusMessage || "Tayyor"}</strong>
            </div>

            {/* Server-side Token Input */}
            <div className="flex gap-2">
              <input
                type="password"
                value={tokenInputs[bot.id] || ""}
                onChange={(e) =>
                  setTokenInputs({ ...tokenInputs, [bot.id]: e.target.value })
                }
                placeholder="Yangi BotFather API tokenini kiriting..."
                className="flex-1 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => saveBotToken(bot.id)}
                className="rounded-xl bg-[#064E3B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
              >
                Ulash
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => checkBot(bot.id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 text-xs font-semibold hover:border-[#047857] cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Botni tekshirish</span>
              </button>

              <button
                type="button"
                onClick={() => toggleBot(bot)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 text-xs font-semibold hover:border-amber-500 cursor-pointer"
              >
                <Power className="h-3.5 w-3.5" />
                <span>{bot.isActive ? "O‘chirish" : "Faollashtirish"}</span>
              </button>
            </div>

            {bot.hasToken && (
              <div className="flex gap-2 pt-1">
                <input
                  type="url"
                  value={webhookBaseUrl}
                  onChange={(e) => setWebhookBaseUrl(e.target.value)}
                  placeholder="Vercel HTTPS havolangiz (masalan: https://ayub-club.vercel.app)"
                  className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-transparent px-3 py-1.5 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => connectWebhook(bot.id)}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#047857] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#064E3B] cursor-pointer shrink-0"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>24/7 Webhook</span>
                </button>
              </div>
            )}

            {/* Editable Templates */}
            <div className="space-y-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                  Salomlashish (/start) shabloni
                </label>
                <textarea
                  rows={2}
                  value={bot.welcomeTemplate}
                  onChange={(e) =>
                    setBots(
                      bots.map((b) =>
                        b.id === bot.id
                          ? { ...b, welcomeTemplate: e.target.value }
                          : b
                      )
                    )
                  }
                  className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-transparent p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                  Aksiya va ma’lumot shabloni
                </label>
                <textarea
                  rows={2}
                  value={bot.promoTemplate}
                  onChange={(e) =>
                    setBots(
                      bots.map((b) =>
                        b.id === bot.id
                          ? { ...b, promoTemplate: e.target.value }
                          : b
                      )
                    )
                  }
                  className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-transparent p-2.5 text-xs"
                />
              </div>

              <button
                type="button"
                onClick={() => saveTemplates(bot)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#047857] px-3.5 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Shablonlarni saqlash</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Broadcast & Interactive Bot Command Simulator */}
      <div className="grid gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSendBroadcast}
          className="lg:col-span-7 rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-4"
        >
          <h3 className="font-serif-luxury text-lg font-bold">
            Ommaviy va Maqsadli Xabar Yuborish
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Qaysi bot orqali
              </label>
              <select
                value={selectedBotId}
                onChange={(e) => setSelectedBotId(Number(e.target.value))}
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
              >
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Xabar turi
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
              >
                <option value="NEW_PERFUME">Yangi atirlar haqida xabar</option>
                <option value="PROMO">Aksiya haqida xabar</option>
                <option value="DISCOUNT">Chegirmalar haqida xabar</option>
                <option value="BONUS_REMINDER">Bonus eslatmasi</option>
                <option value="NEWS">Yangiliklar / Ommaviy xabar</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Sarlavha</label>
            <input
              type="text"
              required
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              Xabar matni
            </label>
            <textarea
              rows={3}
              required
              value={notifBody}
              onChange={(e) => setNotifBody(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent p-3 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#047857] cursor-pointer"
          >
            <Send className="h-4 w-4 text-[#D4AF37]" />
            <span>{sending ? "Yuborilmoqda..." : "Xabarni yuborish"}</span>
          </button>
        </form>

        {/* Live AYUB CLUB Bot Command Tester */}
        <form
          onSubmit={runBotCommandTest}
          className="lg:col-span-5 rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-4"
        >
          <h3 className="font-serif-luxury text-lg font-bold flex items-center gap-2">
            <Terminal className="h-5 w-5 text-[#047857]" />
            <span>AYUB CLUB Bot buyruqlarini sinash</span>
          </h3>
          <p className="text-xs text-neutral-500">
            Webhook endpoint orqali real mijoz bazasidan qaytadigan javobni
            tekshiring:
          </p>

          <div>
            <label className="block text-xs font-semibold mb-1">
              Mijoz telefoni
            </label>
            <input
              type="text"
              value={simPhone}
              onChange={(e) => setSimPhone(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Buyruq</label>
            <select
              value={simCommand}
              onChange={(e) => setSimCommand(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
            >
              <option value="/start">/start — Profil bog‘lash / Ro‘yxatdan o‘tish</option>
              <option value="/bonus">/bonus — Bonuslarni ko‘rish</option>
              <option value="/vip">/vip — VIP statusni ko‘rish</option>
              <option value="/tarix">/tarix — Xaridlar tarixini ko‘rish</option>
              <option value="/chegirma">/chegirma — Chegirmalarni ko‘rish</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-[#047857] py-2.5 text-xs font-bold text-white cursor-pointer"
          >
            Buyruqni tekshirish
          </button>

          {simReply && (
            <pre className="whitespace-pre-wrap rounded-2xl bg-[#111827] p-4 text-xs text-emerald-200 font-sans">
              {simReply}
            </pre>
          )}
        </form>
      </div>

      {/* Notification Logs */}
      <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800">
        <h3 className="font-serif-luxury text-lg font-bold mb-4">
          Yuborilgan xabarnomalar jurnali
        </h3>
        <div className="space-y-2.5">
          {logs.map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-3.5 text-xs"
            >
              <div>
                <div className="font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#047857]" />
                  <span>
                    [{l.category}] {l.title}
                  </span>
                </div>
                <div className="text-neutral-500 mt-1">{l.message}</div>
              </div>
              <div className="text-right tabular-nums text-neutral-500">
                <div>{formatDateTimeUZ(l.createdAt)}</div>
                <div className="font-semibold text-[#064E3B] dark:text-[#D4AF37]">
                  Qabul qiluvchilar: {l.recipientsCount} • {l.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
