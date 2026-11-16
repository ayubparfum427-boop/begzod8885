"use client";

import React, { useState } from "react";
import { formatGrams, formatSom } from "@/lib/format";

export interface SeriesPoint {
  label: string;
  fullDate?: string;
  customers: number;
  sales: number;
}

export function TrendAnalyticsChart({
  daily,
  weekly,
  monthly,
}: {
  daily: SeriesPoint[];
  weekly: SeriesPoint[];
  monthly: SeriesPoint[];
}) {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [metric, setMetric] = useState<"sales" | "customers">("sales");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const activeData =
    period === "daily" ? daily : period === "weekly" ? weekly : monthly;

  const maxVal = Math.max(
    1,
    ...activeData.map((d) => (metric === "sales" ? d.sales : d.customers))
  );

  return (
    <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="font-serif-luxury text-lg font-bold">
            {metric === "sales"
              ? "Savdo dinamikasi grafigi"
              : "Mijozlar o‘sish grafigi"}
          </h3>
          <p className="text-xs text-neutral-500">
            Real ma’lumotlar bazasi bo‘yicha ko‘rsatkichlar
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMetric("sales")}
              className={`rounded-lg px-2.5 py-1.5 transition cursor-pointer ${
                metric === "sales"
                  ? "bg-[#064E3B] text-white"
                  : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              Savdo (so‘m)
            </button>
            <button
              type="button"
              onClick={() => setMetric("customers")}
              className={`rounded-lg px-2.5 py-1.5 transition cursor-pointer ${
                metric === "customers"
                  ? "bg-[#064E3B] text-white"
                  : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              Mijozlar
            </button>
          </div>

          <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 text-xs font-semibold">
            {[
              { id: "daily", label: "Kunlik" },
              { id: "weekly", label: "Haftalik" },
              { id: "monthly", label: "Oylik" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  setPeriod(p.id as "daily" | "weekly" | "monthly")
                }
                className={`rounded-lg px-2.5 py-1.5 transition cursor-pointer ${
                  period === p.id
                    ? "bg-[#D4AF37] text-[#111827]"
                    : "text-neutral-600 dark:text-neutral-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative h-56 flex items-end gap-2 sm:gap-4 pt-8 pb-2 px-2">
        {activeData.map((pt, idx) => {
          const val = metric === "sales" ? pt.sales : pt.customers;
          const heightPct = Math.max(6, Math.round((val / maxVal) * 100));
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={pt.label + idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="relative flex-1 flex flex-col items-center h-full justify-end group"
            >
              {isHovered && (
                <div className="absolute -top-2 z-20 whitespace-nowrap rounded-xl bg-[#111827] px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg ring-1 ring-[#D4AF37]/40 tabular-nums">
                  <div>{pt.fullDate || pt.label}</div>
                  <div className="text-[#D4AF37]">
                    {metric === "sales"
                      ? formatSom(pt.sales)
                      : `${pt.customers} ta mijoz`}
                  </div>
                </div>
              )}

              <div className="w-full max-w-[44px] h-full flex items-end">
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`w-full rounded-t-xl transition-all duration-300 ${
                    metric === "sales"
                      ? "bg-gradient-to-t from-[#064E3B] to-[#047857] group-hover:from-[#047857] group-hover:to-[#D4AF37]"
                      : "bg-gradient-to-t from-[#b59024] to-[#D4AF37] group-hover:from-[#064E3B] group-hover:to-[#047857]"
                  }`}
                />
              </div>

              <span className="mt-2 text-[11px] font-medium text-neutral-500 tabular-nums">
                {pt.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function QrSourcesComparisonCard({
  sources,
}: {
  sources: Array<{
    id: number;
    code: string;
    name: string;
    scansCount: number;
    registrationsCount: number;
    revenue: number;
    isActive: boolean;
  }>;
}) {
  const maxRegs = Math.max(1, ...sources.map((s) => s.registrationsCount));

  return (
    <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
      <h3 className="font-serif-luxury text-lg font-bold">
        QR manbalari taqqoslash
      </h3>
      <p className="text-xs text-neutral-500 mb-5">
        Flayer QR, Kassir QR va boshqa manbalar samaradorligi
      </p>

      <div className="space-y-4">
        {sources.map((s) => {
          const widthPct = Math.max(
            8,
            Math.round((s.registrationsCount / maxRegs) * 100)
          );
          const conv =
            s.scansCount > 0
              ? Math.min(
                  100,
                  Math.round((s.registrationsCount / s.scansCount) * 100)
                )
              : 0;
          return (
            <div key={s.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div className="font-semibold flex items-center gap-2">
                  <span>{s.name}</span>
                  <span className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[11px] font-mono text-neutral-500">
                    source={s.code}
                  </span>
                </div>
                <div className="font-bold tabular-nums text-[#064E3B] dark:text-[#D4AF37]">
                  {s.registrationsCount} mijoz • {formatSom(s.revenue)}
                </div>
              </div>
              <div className="h-2.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#064E3B] to-[#D4AF37]"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-neutral-400 tabular-nums">
                <span>Skanerlar: {s.scansCount} marta</span>
                <span>Konversiya: {conv}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BonusBreakdownCard({
  items,
}: {
  items: Array<{ label: string; grams: number }>;
}) {
  const maxGrams = Math.max(1, ...items.map((i) => i.grams));
  return (
    <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
      <h3 className="font-serif-luxury text-lg font-bold">
        Bonuslar statistikasi
      </h3>
      <p className="text-xs text-neutral-500 mb-5">
        Turlar bo‘yicha berilgan va ishlatilgan atir bonuslari (grammda)
      </p>

      <div className="space-y-3.5">
        {items.map((item, idx) => {
          const pct = Math.max(6, Math.round((item.grams / maxGrams) * 100));
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span>{item.label}</span>
                <span className="tabular-nums text-[#047857] dark:text-[#D4AF37]">
                  {formatGrams(item.grams)}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div
                  style={{ width: `${pct}%` }}
                  className={`h-full rounded-full ${
                    idx === 3
                      ? "bg-amber-500"
                      : "bg-gradient-to-r from-[#064E3B] to-[#047857]"
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
