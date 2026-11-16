"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Gift, Percent, Save } from "lucide-react";
import { formatDateUZ, formatGrams, formatSom } from "@/lib/format";
import { staffFetch } from "@/lib/client-auth";
import type { AppConfig } from "@/lib/settings-service";

interface BonusTxRow {
  id: number;
  customerId: number;
  type: string;
  amountGrams: number;
  balanceAfterGrams: number;
  description: string;
  expiresAt: string | null;
  isUsed: boolean;
  createdAt: string;
  customerName: string;
  customerCode: string;
}

interface DiscountTxRow {
  id: number;
  customerId: number;
  discountPercent: number;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  ruleApplied: string;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  customerName: string;
  customerCode: string;
}

export function BonusAndDiscountTab({
  onDataMutated,
}: {
  onDataMutated?: () => void;
}) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [bonuses, setBonuses] = useState<BonusTxRow[]>([]);
  const [discounts, setDiscounts] = useState<DiscountTxRow[]>([]);
  const [customers, setCustomers] = useState<
    Array<{ id: number; fullName: string; customerCode: string; bonusGrams: number }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [loadErr, setLoadErr] = useState("");

  // Manual bonus form
  const [selectedCustId, setSelectedCustId] = useState("");
  const [manualGrams, setManualGrams] = useState("5");
  const [manualNote, setManualNote] = useState("");

  async function loadAll() {
    setLoadErr("");
    try {
      const [bdRes, cRes] = await Promise.all([
        staffFetch("/api/admin/bonuses-discounts"),
        staffFetch("/api/admin/customers"),
      ]);
      const bdData = await bdRes.json();
      const cData = await cRes.json();
      if (bdData.config) {
        setConfig(bdData.config);
      } else if (bdData.error) {
        setLoadErr(bdData.error);
      }
      if (bdData.bonuses) setBonuses(bdData.bonuses);
      if (bdData.discounts) setDiscounts(bdData.discounts);
      if (cData.customers) {
        setCustomers(cData.customers);
        if (!selectedCustId && cData.customers[0]) {
          setSelectedCustId(String(cData.customers[0].id));
        }
      }
    } catch {
      setLoadErr("Ma’lumotlarni yuklashda xatolik yuz berdi.");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveRules(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await staffFetch("/api/admin/bonuses-discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_rules", rules: config }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg(
          "Bonus va chegirma qoidalari ma’lumotlar bazasiga saqlandi! Barcha yangi hisob-kitoblar shu asosda ishlaydi."
        );
        onDataMutated?.();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleManualBonus(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustId) return;
    const res = await staffFetch("/api/admin/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: Number(selectedCustId),
        action: "grant_bonus",
        amountGrams: Number(manualGrams),
        description: manualNote || "Admin tomonidan qo‘lda berilgan bonus",
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setManualNote("");
      setMsg("Qo‘lda bonus operatsiyasi bajarildi.");
      loadAll();
      onDataMutated?.();
    }
  }

  async function markBonusUsed(txId: number) {
    const res = await staffFetch("/api/admin/bonuses-discounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_bonus_used", transactionId: txId }),
    });
    const data = await res.json();
    if (data.ok) {
      setMsg("Bonus ishlatilgan deb belgilandi va balansdan chegirildi.");
      loadAll();
      onDataMutated?.();
    }
  }

  if (!config) {
    if (loadErr) {
      return (
        <div className="rounded-3xl bg-white dark:bg-neutral-900 p-8 text-center space-y-3">
          <div className="text-sm text-red-600">{loadErr}</div>
          <button
            type="button"
            onClick={loadAll}
            className="rounded-xl bg-[#064E3B] px-4 py-2 text-xs font-bold text-white cursor-pointer"
          >
            Qayta yuklash
          </button>
        </div>
      );
    }
    return (
      <div className="py-16 text-center text-sm text-neutral-500">
        Yuklanmoqda...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="font-serif-luxury text-2xl font-bold">
          Bonus va Chegirma tizimi boshqaruvi
        </h2>
        <p className="text-sm text-neutral-500">
          Barcha bonuslar va chegirmalar bir-biriga qo‘shilib ketmaydi hamda
          serverda tekshiriladi.
        </p>
      </div>

      {msg && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {msg}
        </div>
      )}

      <form onSubmit={handleSaveRules} className="grid gap-6 lg:grid-cols-2">
        {/* BONUS RULES CARD */}
        <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-luxury text-lg font-bold flex items-center gap-2">
              <Gift className="h-5 w-5 text-[#D4AF37]" />
              <span>Bonus tizimi qoidalari</span>
            </h3>
            <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={config.bonusEnabled}
                onChange={(e) =>
                  setConfig({ ...config, bonusEnabled: e.target.checked })
                }
                className="h-4 w-4 rounded text-[#064E3B]"
              />
              <span>{config.bonusEnabled ? "Faol" : "O‘chirilgan"}</span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Yangi mijoz birinchi bonusi (gr)
              </label>
              <input
                type="number"
                step="0.5"
                value={config.welcomeBonusGrams}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    welcomeBonusGrams: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Qayta xarid bonusi (gr)
              </label>
              <input
                type="number"
                step="0.5"
                value={config.repeatBonusGrams}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    repeatBonusGrams: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Qayta xarid bonus yuqori chegarasi (so‘m)
              </label>
              <input
                type="number"
                value={config.repeatBonusMaxAmount}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    repeatBonusMaxAmount: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Bonus amal qilish muddati (kun)
              </label>
              <input
                type="number"
                value={config.bonusExpiryDays}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    bonusExpiryDays: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* DISCOUNT RULES CARD */}
        <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-luxury text-lg font-bold flex items-center gap-2">
              <Percent className="h-5 w-5 text-[#047857]" />
              <span>Chegirma tizimi sozlamalari</span>
            </h3>
            <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={config.discountsEnabled}
                onChange={(e) =>
                  setConfig({ ...config, discountsEnabled: e.target.checked })
                }
                className="h-4 w-4 rounded text-[#064E3B]"
              />
              <span>{config.discountsEnabled ? "Faol" : "O‘chirilgan"}</span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Oddiy mijoz chegirmasi (%)
              </label>
              <input
                type="number"
                value={config.regularDiscountPercent}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    regularDiscountPercent: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                VIP mijoz chegirmasi (%)
              </label>
              <input
                type="number"
                value={config.vipDiscountPercent}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    vipDiscountPercent: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Chegirma uchun xarid chegarasi (so‘m)
              </label>
              <input
                type="number"
                value={config.discountThresholdAmount}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    discountThresholdAmount: Number(e.target.value),
                    minPurchaseForDiscount: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Chegirma maksimal summasi (so‘m)
              </label>
              <input
                type="number"
                value={config.maxDiscountAmount}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    maxDiscountAmount: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Tegishli mahsulot kategoriyalari
              </label>
              <input
                type="text"
                value={config.applicableCategories}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    applicableCategories: e.target.value,
                  })
                }
                placeholder="Barchasi yoki Niche, Erkaklar"
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Bonus va chegirma bir vaqtda kelsa
              </label>
              <select
                value={config.bonusDiscountRule}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    bonusDiscountRule: e.target
                      .value as AppConfig["bonusDiscountRule"],
                  })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-xs sm:text-sm"
              >
                <option value="DISCOUNT_PRIORITY">
                  Chegirma ustuvor (bonus keyinga qoladi)
                </option>
                <option value="ALLOW_BOTH">
                  Ikkalasini birga qo‘llashga ruxsat
                </option>
                <option value="BONUS_ONLY">
                  Bonus olinsa foizli chegirma berilmaydi
                </option>
              </select>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-[#047857] cursor-pointer"
          >
            <Save className="h-4 w-4 text-[#D4AF37]" />
            <span>
              {saving ? "Saqlanmoqda..." : "Bonus va chegirma qoidalarini saqlash"}
            </span>
          </button>
        </div>
      </form>

      {/* Manual Bonus Grant Card */}
      <form
        onSubmit={handleManualBonus}
        className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 grid gap-4 sm:grid-cols-4 items-end"
      >
        <div>
          <label className="block text-xs font-semibold mb-1">
            Mijozni tanlang (Balans bilan)
          </label>
          <select
            value={selectedCustId}
            onChange={(e) => setSelectedCustId(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} ({c.customerCode}) — {formatGrams(c.bonusGrams)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">
            Qo‘lda beriladigan bonus (gramm)
          </label>
          <input
            type="number"
            step="0.5"
            required
            value={manualGrams}
            onChange={(e) => setManualGrams(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-sm tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Izoh</label>
          <input
            type="text"
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            placeholder="Masalan: Tug‘ilgan kun sovg‘asi"
            className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-[#047857] py-2.5 px-4 text-sm font-semibold text-white hover:bg-[#064E3B] cursor-pointer"
        >
          Qo‘lda bonus berish
        </button>
      </form>

      {/* Histories Side by Side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800">
          <h3 className="font-serif-luxury text-lg font-bold mb-4">
            Bonus operatsiyalari tarixi
          </h3>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {bonuses.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-3.5 text-xs"
              >
                <div>
                  <div className="font-bold">
                    {b.customerName} ({b.customerCode})
                  </div>
                  <div className="text-neutral-500 mt-0.5">{b.description}</div>
                  <div className="text-[11px] text-neutral-400 tabular-nums mt-0.5">
                    {formatDateUZ(b.createdAt)} • Balans:{" "}
                    {formatGrams(b.balanceAfterGrams)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`font-bold text-sm tabular-nums ${
                      b.amountGrams >= 0 ? "text-[#047857]" : "text-amber-600"
                    }`}
                  >
                    {b.amountGrams > 0 ? "+" : ""}
                    {formatGrams(b.amountGrams)}
                  </span>
                  {b.amountGrams > 0 && !b.isUsed && (
                    <button
                      type="button"
                      onClick={() => markBonusUsed(b.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-700 px-2 py-1 text-[10px] font-semibold hover:border-[#047857] cursor-pointer"
                    >
                      <CheckCircle2 className="h-3 w-3 text-[#047857]" />
                      <span>Ishlatildi deb belgilash</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800">
          <h3 className="font-serif-luxury text-lg font-bold mb-4">
            Chegirmalar tarixi
          </h3>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {discounts.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-3.5 text-xs"
              >
                <div>
                  <div className="font-bold">
                    {d.customerName} ({d.customerCode}) — {d.discountPercent}%
                  </div>
                  <div className="text-neutral-500 mt-0.5">
                    Qoida: {d.ruleApplied} {d.notes ? `• ${d.notes}` : ""}
                  </div>
                  <div className="text-[11px] text-neutral-400 tabular-nums mt-0.5">
                    {formatDateUZ(d.createdAt)}
                  </div>
                </div>
                <div className="text-right font-bold text-[#064E3B] dark:text-[#D4AF37] tabular-nums shrink-0">
                  {d.discountAmount > 0
                    ? `-${formatSom(d.discountAmount)}`
                    : `${d.discountPercent}% kupon`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
