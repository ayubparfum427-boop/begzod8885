"use client";

import React, { useEffect, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  QrCode,
  Save,
  X,
  XCircle,
} from "lucide-react";
import { formatDateTimeUZ, formatSom, formatUzbekPhone } from "@/lib/format";
import { staffFetch } from "@/lib/client-auth";

interface CustomerOrderRow {
  id: number;
  orderCode: string;
  customerId: number;
  productId: number;
  productName: string;
  brand: string;
  saleMode: "BOTTLE" | "RAZLIV";
  selectedGramsOrQty: number;
  deductedMl: number;
  unitPrice: number;
  subtotalAmount: number;
  discountPercent: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethod: "CASH" | "PAYNET";
  receiptImageData: string | null;
  receiptNote: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerCode: string;
  customerIsVip: boolean;
}

export function PaymentsManagementTab({
  canConfigureQr,
  onDataMutated,
}: {
  canConfigureQr: boolean;
  onDataMutated?: () => void;
}) {
  const [paynetUrl, setPaynetUrl] = useState("");
  const [merchantTitle, setMerchantTitle] = useState("");
  const [paynetInstructions, setPaynetInstructions] = useState("");
  const [cashInstructions, setCashInstructions] = useState("");
  const [paynetQrPng, setPaynetQrPng] = useState("");
  const [paynetQrSvg, setPaynetQrSvg] = useState("");
  const [orders, setOrders] = useState<CustomerOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [previewReceipt, setPreviewReceipt] = useState<CustomerOrderRow | null>(
    null
  );

  async function loadPayments() {
    setLoading(true);
    try {
      const res = await staffFetch("/api/admin/payments");
      const data = await res.json();
      if (data.paymentConfig) {
        setPaynetUrl(data.paymentConfig.paynetPaymentUrl || "");
        setMerchantTitle(data.paymentConfig.paynetMerchantTitle || "");
        setPaynetInstructions(data.paymentConfig.paynetInstructions || "");
        setCashInstructions(data.paymentConfig.cashInstructions || "");
        setPaynetQrPng(data.paymentConfig.paynetQrPng || "");
        setPaynetQrSvg(data.paymentConfig.paynetQrSvg || "");
      }
      if (data.orders) {
        setOrders(data.orders);
      }
    } catch {
      setErr("To‘lov ma’lumotlarini yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayments();
  }, []);

  async function handleSavePaynetQr(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await staffFetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_paynet",
          paynetPaymentUrl: paynetUrl,
          paynetMerchantTitle: merchantTitle,
          paynetInstructions,
          cashInstructions,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.error || "Saqlashda xatolik");
        return;
      }
      if (data.paynetQrPng) setPaynetQrPng(data.paynetQrPng);
      setMsg(
        "Paynet to‘lov havolasi va QR-kodi saqlandi! Endi Mijoz panelida to‘lov paytida avtomatik shu QR-kod chiqadi."
      );
      loadPayments();
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveOrder(orderId: number) {
    setMsg("");
    setErr("");
    const res = await staffFetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_order", orderId }),
    });
    const data = await res.json();
    if (!data.ok) {
      setErr(data.error || "Tasdiqlashda xatolik");
      return;
    }
    setMsg(
      `To‘lov tasdiqlandi va rasmiy savdo (#${data.saleCode}) sifatida mijoz tarixiga qo‘shildi!`
    );
    loadPayments();
    onDataMutated?.();
  }

  async function handleRejectOrder(orderId: number) {
    setMsg("");
    setErr("");
    const res = await staffFetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject_order", orderId }),
    });
    const data = await res.json();
    if (!data.ok) {
      setErr(data.error || "Bekor qilishda xatolik");
      return;
    }
    setMsg("Buyurtma bekor qilindi va band qilingan ml/gr omborga qaytarildi.");
    loadPayments();
    onDataMutated?.();
  }

  function downloadQrPng() {
    if (!paynetQrPng) return;
    const a = document.createElement("a");
    a.href = paynetQrPng;
    a.download = "ayub-parfum-paynet-qr.png";
    a.click();
  }

  function downloadQrSvg() {
    if (!paynetQrSvg) return;
    const blob = new Blob([paynetQrSvg], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ayub-parfum-paynet-qr.svg";
    a.click();
    URL.revokeObjectURL(url);
  }

  const pendingCount = orders.filter((o) => o.status === "PENDING").length;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif-luxury text-2xl font-bold">
            To‘lov tizimi va Paynet QR boshqaruvi
          </h2>
          <p className="text-sm text-neutral-500">
            Paynet havolasidan QR-kod yarating — u mijozlar bo‘limida to‘lov
            vaqtida avtomatik chiqadi, yuborilgan cheklar esa shu yerga tushadi.
          </p>
        </div>

        <span className="self-start rounded-2xl bg-[#064E3B] px-4 py-2 text-xs font-bold text-[#D4AF37] tabular-nums">
          Tasdiqlash kutmoqda: {pendingCount} ta
        </span>
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

      {/* Paynet QR Generator & Config */}
      <div className="grid gap-6 lg:grid-cols-12 rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800">
        <form
          onSubmit={handleSavePaynetQr}
          className="lg:col-span-8 space-y-4"
        >
          <div className="flex items-center gap-2 font-serif-luxury text-lg font-bold">
            <QrCode className="h-5 w-5 text-[#047857]" />
            <span>Paynet To‘lov Havolasi orqali QR-kod Chiqarish</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">
                Paynet (yoki to‘lov) havolasi
              </label>
              <input
                type="text"
                required
                disabled={!canConfigureQr}
                value={paynetUrl}
                onChange={(e) => setPaynetUrl(e.target.value)}
                placeholder="Masalan: https://app.paynet.uz/qr-online/..."
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-xs sm:text-sm font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">
                To‘lov oynasi sarlavhasi
              </label>
              <input
                type="text"
                disabled={!canConfigureQr}
                value={merchantTitle}
                onChange={(e) => setMerchantTitle(e.target.value)}
                placeholder="AYUB PARFUM — Rasmiy Paynet To‘lov"
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Paynet to‘lov ko‘rsatmasi (mijoz uchun)
              </label>
              <textarea
                rows={2}
                disabled={!canConfigureQr}
                value={paynetInstructions}
                onChange={(e) => setPaynetInstructions(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent p-2.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Naqd to‘lov ko‘rsatmasi (mijoz uchun)
              </label>
              <textarea
                rows={2}
                disabled={!canConfigureQr}
                value={cashInstructions}
                onChange={(e) => setCashInstructions(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent p-2.5 text-xs"
              />
            </div>
          </div>

          {canConfigureQr && (
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#047857] cursor-pointer"
            >
              <Save className="h-4 w-4 text-[#D4AF37]" />
              <span>
                {saving
                  ? "QR yaratilmoqda..."
                  : "Havoladan QR-kod chiqarish va Mijoz paneliga ulash"}
              </span>
            </button>
          )}
        </form>

        {/* Live Generated Paynet QR Card */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#064E3B] to-[#111827] p-5 text-white text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] mb-3">
            Mijozga ko‘rinadigan Paynet QR
          </div>
          {paynetQrPng ? (
            <div className="rounded-2xl bg-white p-3 shadow-lg">
              <img
                src={paynetQrPng}
                alt="Paynet QR"
                className="h-44 w-44 rounded-lg"
              />
            </div>
          ) : (
            <div className="h-44 w-44 rounded-2xl bg-white/10 flex items-center justify-center text-xs">
              Havola kiriting
            </div>
          )}
          <div className="mt-3 text-xs text-emerald-100 truncate max-w-full px-2 font-mono">
            {paynetUrl}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={downloadQrPng}
              className="inline-flex items-center gap-1 rounded-xl bg-[#D4AF37] px-3 py-1.5 text-xs font-bold text-[#111827] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>PNG</span>
            </button>
            <button
              type="button"
              onClick={downloadQrSvg}
              className="inline-flex items-center gap-1 rounded-xl border border-white/30 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>SVG</span>
            </button>
          </div>
        </div>
      </div>

      {/* Customer Orders & Paynet Receipts Table */}
      <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800">
        <h3 className="font-serif-luxury text-lg font-bold mb-4">
          Mijoz buyurtmalari va yuborilgan to‘lov cheklari
        </h3>

        {loading ? (
          <div className="py-12 text-center text-sm text-neutral-500">
            Yuklanmoqda...
          </div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-500">
            Hozircha mijozlardan yangi to‘lov va buyurtmalar kelib tushmagan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] uppercase text-neutral-500">
                  <th className="py-3 pr-3">Buyurtma</th>
                  <th className="py-3 pr-3">Mijoz</th>
                  <th className="py-3 pr-3">Atir va Turi</th>
                  <th className="py-3 pr-3">Summa</th>
                  <th className="py-3 pr-3">To‘lov usuli</th>
                  <th className="py-3 pr-3">Chek</th>
                  <th className="py-3 pr-3">Holat</th>
                  <th className="py-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {orders.map((ord) => (
                  <tr key={ord.id}>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      <div className="font-bold text-[#064E3B] dark:text-[#D4AF37] tabular-nums">
                        #{ord.orderCode}
                      </div>
                      <div className="text-[11px] text-neutral-400 tabular-nums">
                        {formatDateTimeUZ(ord.createdAt)}
                      </div>
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      <div className="font-semibold">{ord.customerName}</div>
                      <div className="text-[11px] text-neutral-500 tabular-nums">
                        {formatUzbekPhone(ord.customerPhone)}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-semibold">{ord.productName}</div>
                      <div className="text-xs text-neutral-500">
                        {ord.saleMode === "RAZLIV"
                          ? `💧 Razliv: ${ord.selectedGramsOrQty} gr (-${ord.deductedMl} ml)`
                          : `🍾 Butun flakon × ${ord.selectedGramsOrQty} (-${ord.deductedMl} ml)`}
                      </div>
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap tabular-nums">
                      <div className="font-bold">
                        {formatSom(ord.finalAmount)}
                      </div>
                      {ord.discountPercent > 0 && (
                        <div className="text-[11px] text-[#047857]">
                          -{ord.discountPercent}% chegirma
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      {ord.paymentMethod === "PAYNET" ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                          <CreditCard className="h-3.5 w-3.5" /> Paynet QR
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                          <Banknote className="h-3.5 w-3.5" /> Naqd joyida
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      {ord.receiptImageData ? (
                        <button
                          type="button"
                          onClick={() => setPreviewReceipt(ord)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#064E3B]/10 dark:bg-[#D4AF37]/20 px-2.5 py-1 text-xs font-bold text-[#064E3B] dark:text-[#D4AF37] cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Chekni ko‘rish</span>
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      {ord.status === "PENDING" ? (
                        <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[11px] font-bold">
                          Kutilmoqda
                        </span>
                      ) : ord.status === "APPROVED" ? (
                        <span className="rounded-full bg-emerald-100 text-[#064E3B] px-2.5 py-0.5 text-[11px] font-bold">
                          Tasdiqlandi
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-[11px] font-bold">
                          Bekor qilindi
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {ord.status === "PENDING" && (
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleApproveOrder(ord.id)}
                            className="inline-flex items-center gap-1 rounded-xl bg-[#047857] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#064E3B] cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Tasdiqlash</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectOrder(ord.id)}
                            className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt Image Lightbox Modal */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <div>
                <div className="text-xs font-bold text-[#047857] dark:text-[#D4AF37]">
                  PAYNET TO‘LOV CHEKI • #{previewReceipt.orderCode}
                </div>
                <div className="font-bold text-base">
                  {previewReceipt.customerName} —{" "}
                  {formatSom(previewReceipt.finalAmount)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceipt(null)}
                className="rounded-xl p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {previewReceipt.receiptImageData && (
              <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
                <img
                  src={previewReceipt.receiptImageData}
                  alt="To‘lov cheki"
                  className="max-h-[55vh] w-full object-contain"
                />
              </div>
            )}

            {previewReceipt.receiptNote && (
              <div className="rounded-xl bg-neutral-100 dark:bg-neutral-800 p-3 text-xs">
                Izoh: {previewReceipt.receiptNote}
              </div>
            )}

            {previewReceipt.status === "PENDING" && (
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const id = previewReceipt.id;
                    setPreviewReceipt(null);
                    handleRejectOrder(id);
                  }}
                  className="rounded-xl border border-red-300 px-4 py-2 text-xs font-bold text-red-600 cursor-pointer"
                >
                  Rad etish (Omborga qaytarish)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = previewReceipt.id;
                    setPreviewReceipt(null);
                    handleApproveOrder(id);
                  }}
                  className="rounded-xl bg-[#064E3B] px-5 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  Chekni tasdiqlash
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
