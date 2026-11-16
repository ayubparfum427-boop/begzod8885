"use client";

import React, { useEffect, useState } from "react";
import {
  Ban,
  CheckCircle,
  Crown,
  Download,
  Edit3,
  Eye,
  Gift,
  Percent,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import {
  formatDateUZ,
  formatGrams,
  formatPhoneInputMask,
  formatSom,
  formatUzbekPhone,
} from "@/lib/format";
import { exportToExcel } from "@/lib/export-utils";
import { staffFetch } from "@/lib/client-auth";

interface CustomerRow {
  id: number;
  customerCode: string;
  fullName: string;
  phone: string;
  qrSource: string;
  bonusGrams: number;
  totalBonusEarnedGrams: number;
  totalBonusUsedGrams: number;
  customDiscountPercent: number | null;
  isVip: boolean;
  vipSince: string | null;
  totalSpent: number;
  purchasesCount: number;
  totalItemsBought: number;
  lastPurchaseAt: string | null;
  isBlocked: boolean;
  notes: string | null;
  createdAt: string;
}

interface CustomerDetailPayload {
  customer: CustomerRow;
  bonuses: Array<{
    id: number;
    type: string;
    amountGrams: number;
    description: string;
    createdAt: string;
  }>;
  discounts: Array<{
    id: number;
    discountPercent: number;
    discountAmount: number;
    ruleApplied: string;
    createdAt: string;
  }>;
  vipHistory: Array<{
    id: number;
    previousStatus: boolean;
    newStatus: boolean;
    reason: string;
    totalSpentAtChange: number;
    createdAt: string;
  }>;
  sales: Array<{
    id: number;
    saleCode: string;
    cashierName: string;
    finalAmount: number;
    discountPercent: number;
    createdAt: string;
    items: Array<{
      id: number;
      productName: string;
      volume: string;
      quantity: number;
      unitPrice: number;
    }>;
  }>;
}

export function CustomersAndVipTab({
  mode = "all",
  canManage,
  onDataMutated,
}: {
  mode?: "all" | "vip";
  canManage: boolean;
  onDataMutated?: () => void;
}) {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // VIP settings state (for VIP mode)
  const [vipMinSpent, setVipMinSpent] = useState(1000000);
  const [vipDiscountPct, setVipDiscountPct] = useState(45);
  const [autoVip, setAutoVip] = useState(true);
  const [vipLogs, setVipLogs] = useState<
    Array<{
      id: number;
      customerName: string;
      customerCode: string;
      newStatus: boolean;
      reason: string;
      totalSpentAtChange: number;
      createdAt: string;
    }>
  >([]);

  // Add customer form
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("+998 ");
  const [addSource, setAddSource] = useState("cashier");

  // Action modals
  const [selectedDetail, setSelectedDetail] =
    useState<CustomerDetailPayload | null>(null);
  const [editCust, setEditCust] = useState<CustomerRow | null>(null);
  const [bonusCust, setBonusCust] = useState<CustomerRow | null>(null);
  const [bonusAmount, setBonusAmount] = useState("5");
  const [bonusReason, setBonusReason] = useState("");
  const [discCust, setDiscCust] = useState<CustomerRow | null>(null);
  const [discPct, setDiscPct] = useState("35");

  async function loadCustomers() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("q", search.trim());
      if (mode === "vip") qs.set("vip", "true");
      if (sourceFilter !== "all") qs.set("source", sourceFilter);

      const res = await staffFetch(`/api/admin/customers?${qs.toString()}`);
      const data = await res.json();
      if (data.customers) setCustomers(data.customers);

      if (mode === "vip") {
        const bdRes = await staffFetch("/api/admin/bonuses-discounts");
        const bdData = await bdRes.json();
        if (bdData.config) {
          setVipMinSpent(bdData.config.vipMinTotalSpent);
          setVipDiscountPct(bdData.config.vipDiscountPercent);
          setAutoVip(bdData.config.autoVipEnabled);
        }
        if (bdData.vipLogs) setVipLogs(bdData.vipLogs);
      }
    } catch {
      setErr("Mijozlar bazasini yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sourceFilter]);

  async function openDetail(id: number) {
    const res = await staffFetch(`/api/admin/customers?id=${id}`);
    const data = await res.json();
    if (data.customer) setSelectedDetail(data);
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const res = await staffFetch("/api/admin/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: addName,
        phone: addPhone,
        qrSource: addSource,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      setErr(data.error || "Xatolik");
      return;
    }
    setMsg(
      `${data.customer.fullName} qo‘shildi (+${data.welcomeBonusGranted} gr bonus berildi)`
    );
    setShowAdd(false);
    setAddName("");
    setAddPhone("+998 ");
    loadCustomers();
    onDataMutated?.();
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editCust) return;
    setErr("");
    const res = await staffFetch("/api/admin/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editCust.id,
        action: "edit",
        fullName: editCust.fullName,
        phone: editCust.phone,
        notes: editCust.notes,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      setErr(data.error || "Xatolik");
      return;
    }
    setEditCust(null);
    setMsg("Mijoz ma’lumotlari yangilandi.");
    loadCustomers();
  }

  async function handleGrantBonus(e: React.FormEvent) {
    e.preventDefault();
    if (!bonusCust) return;
    const res = await staffFetch("/api/admin/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: bonusCust.id,
        action: "grant_bonus",
        amountGrams: Number(bonusAmount),
        description: bonusReason,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setBonusCust(null);
      setBonusReason("");
      setMsg("Bonus balansi muvaffaqiyatli yangilandi.");
      loadCustomers();
      onDataMutated?.();
    } else {
      setErr(data.error || "Xatolik");
    }
  }

  async function handleGrantDiscount(e: React.FormEvent) {
    e.preventDefault();
    if (!discCust) return;
    const res = await staffFetch("/api/admin/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: discCust.id,
        action: "grant_discount",
        discountPercent: Number(discPct),
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setDiscCust(null);
      setMsg("Shaxsiy chegirma mijozga biriktirildi.");
      loadCustomers();
    } else {
      setErr(data.error || "Xatolik");
    }
  }

  async function toggleVipStatus(c: CustomerRow) {
    const res = await staffFetch("/api/admin/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: c.id,
        action: "toggle_vip",
        isVip: !c.isVip,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setMsg(
        `${c.fullName} uchun VIP maqom ${!c.isVip ? "berildi" : "bekor qilindi"}.`
      );
      loadCustomers();
      onDataMutated?.();
    }
  }

  async function toggleBlockStatus(c: CustomerRow) {
    await staffFetch("/api/admin/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: c.id,
        action: "toggle_block",
        isBlocked: !c.isBlocked,
      }),
    });
    loadCustomers();
  }

  async function handleSaveVipCriteria(e: React.FormEvent) {
    e.preventDefault();
    const res = await staffFetch("/api/admin/bonuses-discounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_rules",
        rules: {
          vipMinTotalSpent: Number(vipMinSpent),
          vipDiscountPercent: Number(vipDiscountPct),
          autoVipEnabled: autoVip,
        },
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setMsg(
        "VIP mezonlari saqlandi va mos keluvchi mijozlar avtomatik yangilandi!"
      );
      loadCustomers();
      onDataMutated?.();
    }
  }

  function handleExportExcel() {
    const rows = customers.map((c) => ({
      "Mijoz ID": c.customerCode,
      Ism: c.fullName,
      Telefon: formatUzbekPhone(c.phone),
      "Ro‘yxatdan o‘tgan sana": formatDateUZ(c.createdAt),
      "QR Manbasi": c.qrSource,
      "Xaridlar soni": c.purchasesCount,
      "Jami xarid (so‘m)": c.totalSpent,
      "Bonus (gr)": c.bonusGrams,
      "VIP Status": c.isVip ? "VIP" : "Oddiy",
      "Oxirgi xarid": formatDateUZ(c.lastPurchaseAt),
    }));
    exportToExcel(
      rows,
      mode === "vip" ? "VIP_Mijozlar" : "Mijozlar",
      `ayub-club-${mode === "vip" ? "vip-mijozlar" : "mijozlar"}`
    );
  }

  const vipTotalRevenue = customers.reduce(
    (a, c) => a + Number(c.totalSpent || 0),
    0
  );
  const vipTotalPurchases = customers.reduce(
    (a, c) => a + Number(c.purchasesCount || 0),
    0
  );

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif-luxury text-2xl font-bold flex items-center gap-2">
            {mode === "vip" && <Crown className="h-6 w-6 text-[#D4AF37]" />}
            <span>
              {mode === "vip"
                ? "VIP mijozlar klubi boshqaruvi"
                : "Mijozlar bazasi boshqaruvi"}
            </span>
          </h2>
          <p className="text-sm text-neutral-500">
            {mode === "vip"
              ? "VIP reyting, avtomatik VIP chegarasi va maxsus 45% gacha imtiyozlar"
              : "Qidiruv, bonus/chegirma berish, bloklash va Excelga eksport qilish"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-xl border border-[#064E3B]/30 dark:border-[#D4AF37]/40 px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#064E3B] dark:text-[#D4AF37] hover:bg-[#064E3B]/5 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Excel eksport</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#047857] cursor-pointer"
          >
            <Plus className="h-4 w-4 text-[#D4AF37]" />
            <span>Mijoz qo‘shish</span>
          </button>
        </div>
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

      {/* VIP Summary & Criteria Editor when in VIP mode */}
      {mode === "vip" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-[#064E3B] to-[#047857] p-5 text-white">
              <div className="text-xs text-emerald-200">VIP mijozlar soni</div>
              <div className="mt-2 text-2xl font-bold text-[#D4AF37] tabular-nums">
                {customers.length} ta
              </div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-neutral-900 p-5 ring-1 ring-neutral-200 dark:ring-neutral-800">
              <div className="text-xs text-neutral-500">VIP xaridlar soni</div>
              <div className="mt-2 text-2xl font-bold tabular-nums">
                {vipTotalPurchases} ta
              </div>
            </div>
            <div className="col-span-2 rounded-2xl bg-white dark:bg-neutral-900 p-5 ring-1 ring-neutral-200 dark:ring-neutral-800">
              <div className="text-xs text-neutral-500">
                VIP jami xarid summasi
              </div>
              <div className="mt-1 text-2xl font-bold text-[#064E3B] dark:text-[#D4AF37] tabular-nums">
                {formatSom(vipTotalRevenue)}
              </div>
            </div>
          </div>

          {canManage && (
            <form
              onSubmit={handleSaveVipCriteria}
              className="lg:col-span-7 rounded-3xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-4"
            >
              <div className="flex items-center gap-2 font-serif-luxury text-lg font-bold">
                <Settings2 className="h-5 w-5 text-[#D4AF37]" />
                <span>Avtomatik VIP mezonlari va chegirmasi</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Minimal jami xarid summasi (so‘m)
                  </label>
                  <input
                    type="number"
                    value={vipMinSpent}
                    onChange={(e) => setVipMinSpent(Number(e.target.value))}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    VIP chegirma foizi (%)
                  </label>
                  <input
                    type="number"
                    max={90}
                    min={1}
                    value={vipDiscountPct}
                    onChange={(e) => setVipDiscountPct(Number(e.target.value))}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm tabular-nums"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoVip}
                    onChange={(e) => setAutoVip(e.target.checked)}
                    className="h-4 w-4 rounded text-[#064E3B]"
                  />
                  <span>
                    Chegaradan o‘tgan mijozga VIP maqomni avtomatik berish
                  </span>
                </label>
                <button
                  type="submit"
                  className="rounded-xl bg-[#064E3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
                >
                  Mezonlarni saqlash
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Add Customer Form */}
      {showAdd && (
        <form
          onSubmit={handleAddCustomer}
          className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 grid gap-4 sm:grid-cols-4 items-end"
        >
          <div>
            <label className="block text-xs font-semibold mb-1">
              Mijoz ismi
            </label>
            <input
              type="text"
              required
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Ism Familiya"
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Telefon (+998 XX XXX XX XX)
            </label>
            <input
              type="tel"
              required
              value={addPhone}
              onChange={(e) => setAddPhone(formatPhoneInputMask(e.target.value))}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              QR manbasi
            </label>
            <select
              value={addSource}
              onChange={(e) => setAddSource(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2.5 text-sm"
            >
              <option value="cashier">Kassir QR (cashier)</option>
              <option value="flyer">Flayer QR (flyer)</option>
              <option value="direct">To‘g‘ridan-to‘g‘ri</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#047857] py-2.5 px-4 text-sm font-semibold text-white cursor-pointer"
          >
            Saqlash (+Bonus)
          </button>
        </form>
      )}

      {/* Search & Source Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadCustomers();
          }}
          className="relative flex-1 flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ism, telefon raqami (+998...) yoki Mijoz ID bo‘yicha qidirish..."
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 py-2.5 pl-10 pr-4 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#064E3B] px-4 py-2.5 text-sm font-semibold text-white cursor-pointer"
          >
            Qidirish
          </button>
        </form>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2.5 text-sm"
        >
          <option value="all">Barcha manbalar</option>
          <option value="flyer">Flayer QR (flyer)</option>
          <option value="cashier">Kassir QR (cashier)</option>
          <option value="direct">To‘g‘ridan-to‘g‘ri</option>
        </select>
      </div>

      {/* Quick Action Modals (Edit / Bonus / Discount) */}
      {editCust && (
        <form
          onSubmit={handleSaveEdit}
          className="rounded-3xl border-2 border-[#047857] bg-white dark:bg-neutral-900 p-5 grid gap-4 sm:grid-cols-3"
        >
          <div>
            <label className="block text-xs font-semibold mb-1">Ism</label>
            <input
              type="text"
              value={editCust.fullName}
              onChange={(e) =>
                setEditCust({ ...editCust, fullName: e.target.value })
              }
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Telefon</label>
            <input
              type="text"
              value={editCust.phone}
              onChange={(e) =>
                setEditCust({ ...editCust, phone: e.target.value })
              }
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Izoh</label>
            <input
              type="text"
              value={editCust.notes || ""}
              onChange={(e) =>
                setEditCust({ ...editCust, notes: e.target.value })
              }
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-3 flex justify-between items-center text-xs text-neutral-500">
            <span>
              QR Manbasi ({editCust.qrSource}) qoidaga binoan o‘zgartirilmaydi.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditCust(null)}
                className="px-3 py-1.5 rounded-lg border cursor-pointer"
              >
                Bekor
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#064E3B] text-white font-semibold cursor-pointer"
              >
                Saqlash
              </button>
            </div>
          </div>
        </form>
      )}

      {bonusCust && (
        <form
          onSubmit={handleGrantBonus}
          className="rounded-3xl border-2 border-[#D4AF37] bg-white dark:bg-neutral-900 p-5 grid gap-4 sm:grid-cols-3 items-end"
        >
          <div>
            <label className="block text-xs font-semibold mb-1">
              {bonusCust.fullName} — Bonus miqdori (gr, ayirish uchun manfiy)
            </label>
            <input
              type="number"
              step="0.5"
              required
              value={bonusAmount}
              onChange={(e) => setBonusAmount(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Sabab</label>
            <input
              type="text"
              value={bonusReason}
              onChange={(e) => setBonusReason(e.target.value)}
              placeholder="Maxsus sovg‘a bonusi"
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-xl bg-[#064E3B] px-4 py-2 text-sm font-semibold text-white cursor-pointer"
            >
              Tasdiqlash
            </button>
            <button
              type="button"
              onClick={() => setBonusCust(null)}
              className="rounded-xl border px-3 py-2 text-sm cursor-pointer"
            >
              Yopish
            </button>
          </div>
        </form>
      )}

      {discCust && (
        <form
          onSubmit={handleGrantDiscount}
          className="rounded-3xl border-2 border-[#047857] bg-white dark:bg-neutral-900 p-5 flex flex-wrap items-end gap-4"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold mb-1">
              {discCust.fullName} uchun keyingi xaridga shaxsiy chegirma (%)
            </label>
            <input
              type="number"
              min={0}
              max={80}
              value={discPct}
              onChange={(e) => setDiscPct(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#047857] px-4 py-2 text-sm font-semibold text-white cursor-pointer"
          >
            Chegirmani biriktirish
          </button>
          <button
            type="button"
            onClick={() => setDiscCust(null)}
            className="rounded-xl border px-3 py-2 text-sm cursor-pointer"
          >
            Yopish
          </button>
        </form>
      )}

      {/* Customers Main Table */}
      <div className="rounded-3xl bg-white dark:bg-neutral-900 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 text-[11px] uppercase tracking-wider text-neutral-500">
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-3">Ism</th>
                <th className="py-3.5 px-3">Telefon</th>
                <th className="py-3.5 px-3">Sana</th>
                <th className="py-3.5 px-3">QR Manba</th>
                <th className="py-3.5 px-3">Xaridlar</th>
                <th className="py-3.5 px-3">Jami xarid</th>
                <th className="py-3.5 px-3">Bonus</th>
                <th className="py-3.5 px-3">VIP</th>
                <th className="py-3.5 px-3">Oxirgi xarid</th>
                <th className="py-3.5 px-4 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-neutral-500">
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-neutral-500">
                    Mijozlar topilmadi.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 ${
                      c.isBlocked ? "opacity-50" : ""
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-[#064E3B] dark:text-[#D4AF37] tabular-nums whitespace-nowrap">
                      {c.customerCode}
                    </td>
                    <td className="py-3 px-3 font-semibold whitespace-nowrap">
                      {c.fullName}
                      {c.isBlocked && (
                        <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">
                          Blok
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 tabular-nums whitespace-nowrap">
                      {formatUzbekPhone(c.phone)}
                    </td>
                    <td className="py-3 px-3 tabular-nums text-neutral-500 whitespace-nowrap">
                      {formatDateUZ(c.createdAt)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[11px] font-semibold uppercase">
                        {c.qrSource}
                      </span>
                    </td>
                    <td className="py-3 px-3 tabular-nums text-center">
                      {c.purchasesCount}
                    </td>
                    <td className="py-3 px-3 font-semibold tabular-nums whitespace-nowrap">
                      {formatSom(c.totalSpent)}
                    </td>
                    <td className="py-3 px-3 font-bold text-[#047857] dark:text-emerald-400 tabular-nums whitespace-nowrap">
                      {formatGrams(c.bonusGrams)}
                    </td>
                    <td className="py-3 px-3">
                      {c.isVip ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#D4AF37]/25 px-2.5 py-0.5 text-[11px] font-bold text-[#9a7b1c] dark:text-[#D4AF37]">
                          <Crown className="h-3 w-3" /> VIP
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-400">Oddiy</span>
                      )}
                    </td>
                    <td className="py-3 px-3 tabular-nums text-neutral-500 whitespace-nowrap">
                      {formatDateUZ(c.lastPurchaseAt)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openDetail(c.id)}
                          title="Mijoz tarixi va profili"
                          className="rounded-lg p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[#047857] cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditCust(c)}
                              title="Tahrirlash"
                              className="rounded-lg p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setBonusCust(c)}
                              title="Bonus berish"
                              className="rounded-lg p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-amber-600 cursor-pointer"
                            >
                              <Gift className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDiscCust(c)}
                              title="Shaxsiy chegirma berish"
                              className="rounded-lg p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-emerald-600 cursor-pointer"
                            >
                              <Percent className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleVipStatus(c)}
                              title={
                                c.isVip ? "VIP bekor qilish" : "VIP status berish"
                              }
                              className="rounded-lg p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[#D4AF37] cursor-pointer"
                            >
                              <Crown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleBlockStatus(c)}
                              title={c.isBlocked ? "Blokdan ochish" : "Bloklash"}
                              className="rounded-lg p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-red-500 cursor-pointer"
                            >
                              {c.isBlocked ? (
                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Ban className="h-4 w-4" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIP History Log when in VIP mode */}
      {mode === "vip" && vipLogs.length > 0 && (
        <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800">
          <h3 className="font-serif-luxury text-lg font-bold mb-4">
            VIP maqom o‘zgarishlari tarixi
          </h3>
          <div className="space-y-2.5">
            {vipLogs.map((vl) => (
              <div
                key={vl.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-100 dark:border-neutral-800 px-4 py-3 text-xs sm:text-sm"
              >
                <div>
                  <span className="font-bold">{vl.customerName}</span> (
                  {vl.customerCode}) —{" "}
                  <span className="text-neutral-500">{vl.reason}</span>
                </div>
                <div className="text-xs font-semibold tabular-nums text-[#047857] dark:text-[#D4AF37]">
                  {formatDateUZ(vl.createdAt)} •{" "}
                  {formatSom(vl.totalSpentAtChange)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Full Profile & History Drawer Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white dark:bg-neutral-900 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <div>
                <div className="text-xs font-bold text-[#047857] dark:text-[#D4AF37]">
                  MIJOZ TO‘LIQ PROFILI • {selectedDetail.customer.customerCode}
                </div>
                <h3 className="font-serif-luxury text-2xl font-bold mt-1">
                  {selectedDetail.customer.fullName}
                </h3>
                <p className="text-sm text-neutral-500 tabular-nums">
                  {formatUzbekPhone(selectedDetail.customer.phone)} • Manba:{" "}
                  {selectedDetail.customer.qrSource}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="rounded-xl p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800 p-3.5">
                <div className="text-xs text-neutral-500">Jami xarid</div>
                <div className="font-bold tabular-nums mt-1">
                  {formatSom(selectedDetail.customer.totalSpent)}
                </div>
              </div>
              <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800 p-3.5">
                <div className="text-xs text-neutral-500">Bonus balansi</div>
                <div className="font-bold text-[#047857] dark:text-[#D4AF37] tabular-nums mt-1">
                  {formatGrams(selectedDetail.customer.bonusGrams)}
                </div>
              </div>
              <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800 p-3.5">
                <div className="text-xs text-neutral-500">Xaridlar soni</div>
                <div className="font-bold tabular-nums mt-1">
                  {selectedDetail.customer.purchasesCount} ta
                </div>
              </div>
              <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800 p-3.5">
                <div className="text-xs text-neutral-500">VIP maqom</div>
                <div className="font-bold mt-1">
                  {selectedDetail.customer.isVip ? "VIP ✨" : "Oddiy"}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-sm mb-2">
                Xaridlar tarixi ({selectedDetail.sales.length})
              </h4>
              <div className="space-y-2.5">
                {selectedDetail.sales.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-3.5 text-xs sm:text-sm"
                  >
                    <div className="flex justify-between font-semibold tabular-nums">
                      <span>
                        #{s.saleCode} • {formatDateUZ(s.createdAt)} • Kassir:{" "}
                        {s.cashierName}
                      </span>
                      <span className="text-[#064E3B] dark:text-[#D4AF37]">
                        {formatSom(s.finalAmount)}
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs text-neutral-500">
                      {s.items
                        .map(
                          (it) =>
                            `${it.productName} (${it.volume}) × ${it.quantity}`
                        )
                        .join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-sm mb-2">
                Bonus operatsiyalari ({selectedDetail.bonuses.length})
              </h4>
              <div className="space-y-2">
                {selectedDetail.bonuses.map((b) => (
                  <div
                    key={b.id}
                    className="flex justify-between rounded-xl bg-neutral-50 dark:bg-neutral-800/60 px-3.5 py-2 text-xs"
                  >
                    <span>
                      {formatDateUZ(b.createdAt)} — {b.description}
                    </span>
                    <span className="font-bold tabular-nums">
                      {b.amountGrams > 0 ? "+" : ""}
                      {formatGrams(b.amountGrams)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
