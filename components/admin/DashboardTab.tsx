"use client";

import React from "react";
import {
  Award,
  Crown,
  Gift,
  QrCode,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { formatGrams, formatSom, formatUzbekPhone } from "@/lib/format";
import {
  BonusBreakdownCard,
  QrSourcesComparisonCard,
  SeriesPoint,
  TrendAnalyticsChart,
} from "@/components/LuxuryCharts";

export interface OverviewPayload {
  kpis: {
    totalCustomers: number;
    todayNewCustomers: number;
    monthlyNewCustomers: number;
    vipCustomersCount: number;
    todaySales: number;
    weeklySales: number;
    monthlySales: number;
    yearlySales: number;
    totalSales: number;
    grantedBonusesGrams: number;
    usedBonusesGrams: number;
    remainingBonusesGrams: number;
    bonusEstimatedCostSom: number;
    flyerCustomersCount: number;
    cashierCustomersCount: number;
    otherSourceCustomersCount?: number;
    discount30Count: number;
    discount30Sum: number;
    discount45Count: number;
    discount45Sum: number;
    otherDiscountCount?: number;
    otherDiscountSum?: number;
    totalDiscountSum: number;
  };
  charts: {
    dailySeries: SeriesPoint[];
    weeklySeries: SeriesPoint[];
    monthlySeries: SeriesPoint[];
    qrComparison: Array<{
      id: number;
      code: string;
      name: string;
      scansCount: number;
      registrationsCount: number;
      revenue: number;
      isActive: boolean;
    }>;
    bonusBreakdown: Array<{ label: string; grams: number }>;
  };
  rankings: {
    topBySpent: Array<{
      id: number;
      customerCode: string;
      fullName: string;
      phone: string;
      totalSpent: number;
      purchasesCount: number;
      totalItemsBought: number;
      isVip: boolean;
    }>;
    topByPurchases: Array<{
      id: number;
      customerCode: string;
      fullName: string;
      phone: string;
      totalSpent: number;
      purchasesCount: number;
      totalItemsBought: number;
      isVip: boolean;
    }>;
    topByItems: Array<{
      id: number;
      customerCode: string;
      fullName: string;
      phone: string;
      totalSpent: number;
      purchasesCount: number;
      totalItemsBought: number;
      isVip: boolean;
    }>;
    topVip: Array<{
      id: number;
      customerCode: string;
      fullName: string;
      phone: string;
      totalSpent: number;
      purchasesCount: number;
      bonusGrams: number;
      isVip: boolean;
    }>;
    topProducts: Array<{
      id: number;
      productCode: string;
      name: string;
      brand: string;
      category: string;
      volume: string;
      price: number;
      unitsSold: number;
      ordersCount: number;
      revenue: number;
    }>;
    employeeStats: Array<{
      id: number;
      fullName: string;
      phone: string;
      login: string;
      role: string;
      isActive: boolean;
      registeredCustomersCount: number;
      salesCount: number;
      totalSalesAmount: number;
    }>;
  };
}

export function DashboardTab({
  data,
  loading,
  error,
  onRetry,
  onNavigate,
}: {
  data: OverviewPayload | null;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onNavigate: (tab: string) => void;
}) {
  if (!data) {
    if (error && !loading) {
      return (
        <div className="rounded-3xl bg-white dark:bg-neutral-900 p-10 text-center shadow-sm ring-1 ring-red-200 dark:ring-red-900/50 space-y-4">
          <div className="text-sm font-semibold text-red-600 dark:text-red-400">
            {error}
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-xl bg-[#064E3B] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#047857] cursor-pointer"
            >
              Qayta yuklash
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-[#064E3B] border-t-[#D4AF37]" />
        <p className="mt-3 text-sm text-neutral-500">
          Dashboard ma’lumotlari yuklanmoqda...
        </p>
      </div>
    );
  }

  const { kpis, charts, rankings } = data;

  const statCards = [
    {
      label: "Jami mijozlar",
      value: `${kpis.totalCustomers} ta`,
      sub: `Bugun: +${kpis.todayNewCustomers} • Shu oy: +${kpis.monthlyNewCustomers}`,
      icon: Users,
      accent: "from-[#064E3B] to-[#047857]",
    },
    {
      label: "Bugungi savdo",
      value: formatSom(kpis.todaySales),
      sub: `Oylik: ${formatSom(kpis.monthlySales)} • Jami: ${formatSom(kpis.totalSales)}`,
      icon: TrendingUp,
      accent: "from-[#047857] to-[#065f46]",
    },
    {
      label: "VIP mijozlar",
      value: `${kpis.vipCustomersCount} ta`,
      sub: "45% gacha imtiyozli a’zolar",
      icon: Crown,
      accent: "from-[#b59024] to-[#D4AF37]",
    },
    {
      label: "Berilgan bonuslar",
      value: formatGrams(kpis.grantedBonusesGrams),
      sub: `Ishlatildi: ${formatGrams(kpis.usedBonusesGrams)} • Qoldiq: ${formatGrams(kpis.remainingBonusesGrams)}`,
      icon: Gift,
      accent: "from-[#111827] to-[#1f2937]",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Primary Hero KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="relative overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 p-5 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    {c.label}
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums text-[#111827] dark:text-white">
                    {c.value}
                  </div>
                  <div className="mt-1.5 text-xs text-neutral-500 tabular-nums">
                    {c.sub}
                  </div>
                </div>
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${c.accent} text-white shadow-sm`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Secondary Granular Strip (QR, New Customers, Sales, Bonus Detail) */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            label: "Bugungi yangi",
            val: `${kpis.todayNewCustomers} ta`,
            icon: UserPlus,
          },
          {
            label: "Oylik yangi",
            val: `${kpis.monthlyNewCustomers} ta`,
            icon: Users,
          },
          {
            label: "Flayer QR",
            val: `${kpis.flyerCustomersCount} ta`,
            icon: QrCode,
          },
          {
            label: "Kassir QR",
            val: `${kpis.cashierCustomersCount} ta`,
            icon: QrCode,
          },
          {
            label: "Oylik savdo",
            val: formatSom(kpis.monthlySales),
            icon: ShoppingBag,
          },
          {
            label: "Ishlatilgan bonus",
            val: formatGrams(kpis.usedBonusesGrams),
            icon: Sparkles,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-2xl bg-white dark:bg-neutral-900 px-4 py-3.5 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                <Icon className="h-3.5 w-3.5 text-[#047857] dark:text-[#D4AF37]" />
                <span>{item.label}</span>
              </div>
              <div className="mt-1 text-sm font-bold tabular-nums">
                {item.val}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Analytics Charts */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <TrendAnalyticsChart
            daily={charts.dailySeries}
            weekly={charts.weeklySeries}
            monthly={charts.monthlySeries}
          />
        </div>
        <div className="lg:col-span-5 space-y-6">
          <QrSourcesComparisonCard sources={charts.qrComparison} />
          <BonusBreakdownCard items={charts.bonusBreakdown} />
        </div>
      </div>

      {/* Leaderboards: Top Customers, Top Perfumes, Staff Performance */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Customers */}
        <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif-luxury text-lg font-bold flex items-center gap-2">
              <Award className="h-5 w-5 text-[#D4AF37]" />
              <span>Eng ko‘p xarid qilganlar</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate("customers")}
              className="text-xs font-semibold text-[#047857] dark:text-[#D4AF37] hover:underline cursor-pointer"
            >
              Barchasi →
            </button>
          </div>
          <div className="space-y-3">
            {rankings.topBySpent.slice(0, 5).map((c, idx) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-neutral-100 dark:border-neutral-800 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#D4AF37] tabular-nums">
                      #{idx + 1}
                    </span>
                    <span className="truncate text-sm font-semibold">
                      {c.fullName}
                    </span>
                    {c.isVip && (
                      <span className="rounded bg-[#D4AF37]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#b59024] dark:text-[#D4AF37]">
                        VIP
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-500 tabular-nums">
                    {formatUzbekPhone(c.phone)} • {c.purchasesCount} xarid
                  </div>
                </div>
                <div className="text-right text-xs font-bold text-[#064E3B] dark:text-emerald-400 tabular-nums shrink-0">
                  {formatSom(c.totalSpent)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Sold Perfumes */}
        <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif-luxury text-lg font-bold">
              Eng ko‘p sotilgan atirlar
            </h3>
            <button
              type="button"
              onClick={() => onNavigate("products")}
              className="text-xs font-semibold text-[#047857] dark:text-[#D4AF37] hover:underline cursor-pointer"
            >
              Katalog →
            </button>
          </div>
          <div className="space-y-3">
            {rankings.topProducts.slice(0, 5).map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-neutral-100 dark:border-neutral-800 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    #{idx + 1} {p.name}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {p.brand} • {p.volume} •{" "}
                    <strong className="tabular-nums">{p.unitsSold} dona</strong>
                  </div>
                </div>
                <div className="text-xs font-bold text-[#064E3B] dark:text-[#D4AF37] tabular-nums shrink-0">
                  {formatSom(p.revenue)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Staff Performance */}
        <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif-luxury text-lg font-bold">
              Xodimlar statistikasi
            </h3>
            <button
              type="button"
              onClick={() => onNavigate("employees")}
              className="text-xs font-semibold text-[#047857] dark:text-[#D4AF37] hover:underline cursor-pointer"
            >
              Boshqarish →
            </button>
          </div>
          <div className="space-y-3">
            {rankings.employeeStats.map((emp) => (
              <div
                key={emp.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-neutral-100 dark:border-neutral-800 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">
                      {emp.fullName}
                    </span>
                    <span className="rounded bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 text-[10px] font-bold text-[#047857] dark:text-emerald-300">
                      {emp.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500 tabular-nums">
                    Mijozlar: {emp.registeredCustomersCount} ta • Savdo:{" "}
                    {emp.salesCount} ta
                  </div>
                </div>
                <div className="text-xs font-bold tabular-nums shrink-0">
                  {formatSom(emp.totalSalesAmount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
