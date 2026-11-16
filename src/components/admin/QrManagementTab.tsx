"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Globe,
  Plus,
  Power,
  QrCode,
  Trash2,
} from "lucide-react";
import { formatDateUZ, formatSom, formatUzbekPhone } from "@/lib/format";
import { staffFetch } from "@/lib/client-auth";

interface QrSourceItem {
  id: number;
  code: string;
  name: string;
  customPath: string;
  description: string | null;
  isActive: boolean;
  scansCount: number;
  registrationsCount: number;
  actualRegistrations: number;
  totalRevenue: number;
  fullUrl: string;
  pngDataUrl: string;
  svgString: string;
}

interface QrRegLog {
  id: number;
  sourceCode: string;
  referralUrl: string;
  createdAt: string;
  customerId: number;
  customerCode: string;
  customerName: string;
  customerPhone: string;
}

export function QrManagementTab({ canManage }: { canManage: boolean }) {
  const [sources, setSources] = useState<QrSourceItem[]>([]);
  const [recentRegs, setRecentRegs] = useState<QrRegLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [publicBaseUrl, setPublicBaseUrl] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newPath, setNewPath] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Edit modal state
  const [editing, setEditing] = useState<QrSourceItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editPath, setEditPath] = useState("");
  const [editDesc, setEditDesc] = useState("");

  async function loadQrData() {
    setLoading(true);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const res = await staffFetch(
        `/api/admin/qr?origin=${encodeURIComponent(origin)}`
      );
      const data = await res.json();
      if (typeof data.publicBaseUrl === "string") {
        setPublicBaseUrl(data.publicBaseUrl);
      }
      if (data.sources) setSources(data.sources);
      if (data.recentRegistrations) setRecentRegs(data.recentRegistrations);
    } catch {
      setFeedback("QR ma’lumotlarini yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveBaseUrl(e: React.FormEvent) {
    e.preventDefault();
    setSavingDomain(true);
    setFeedback("");
    try {
      const res = await staffFetch("/api/admin/qr", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_base_url",
          publicBaseUrl,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback(
          data.publicBaseUrl
            ? `QR-kodlar uchun doimiy domen saqlandi: ${data.publicBaseUrl}`
            : "QR-kodlar joriy server manziliga qaytarildi."
        );
        loadQrData();
      }
    } finally {
      setSavingDomain(false);
    }
  }

  useEffect(() => {
    loadQrData();
  }, []);

  function downloadPng(item: QrSourceItem) {
    const a = document.createElement("a");
    a.href = item.pngDataUrl;
    a.download = `ayub-club-qr-${item.code}.png`;
    a.click();
  }

  function downloadSvg(item: QrSourceItem) {
    const blob = new Blob([item.svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ayub-club-qr-${item.code}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyLink(item: QrSourceItem) {
    navigator.clipboard.writeText(item.fullUrl);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFeedback("");
    const codeClean = newCode
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    const res = await staffFetch("/api/admin/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        code: codeClean,
        customPath: newPath || `/register?source=${codeClean}`,
        description: newDesc,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      setFeedback(data.error || "Xatolik yuz berdi");
      return;
    }
    setShowCreate(false);
    setNewName("");
    setNewCode("");
    setNewPath("");
    setNewDesc("");
    loadQrData();
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const res = await staffFetch("/api/admin/qr", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        name: editName,
        customPath: editPath,
        description: editDesc,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setEditing(null);
      loadQrData();
    } else {
      setFeedback(data.error || "Tahrirlashda xatolik");
    }
  }

  async function handleToggleActive(item: QrSourceItem) {
    await staffFetch("/api/admin/qr", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
    });
    loadQrData();
  }

  async function handleDelete(item: QrSourceItem) {
    if (item.code === "flyer" || item.code === "cashier") {
      setFeedback(
        "Asosiy FLAYER QR va KASSIR QR manbalarini o‘chirish o‘rniga faolsizlantirish tavsiya etiladi."
      );
      return;
    }
    await staffFetch(`/api/admin/qr?id=${item.id}`, { method: "DELETE" });
    loadQrData();
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif-luxury text-2xl font-bold">
            QR-kod boshqaruvi va tracking
          </h2>
          <p className="text-sm text-neutral-500">
            Dinamik QR havolalar serverda saqlanadi. Mijoz ro‘yxatdan o‘tgach QR
            manbasi o‘zgarmas bo‘lib muhrlanadi.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#047857] transition cursor-pointer self-start"
          >
            <Plus className="h-4 w-4 text-[#D4AF37]" />
            <span>Yangi QR manbasi yaratish</span>
          </button>
        )}
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {feedback}
        </div>
      )}

      {canManage && (
        <form
          onSubmit={handleSaveBaseUrl}
          className="rounded-3xl bg-white dark:bg-neutral-900 p-5 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 flex flex-col sm:flex-row sm:items-end gap-3"
        >
          <div className="flex-1">
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#064E3B] dark:text-[#D4AF37] mb-1">
              <Globe className="h-3.5 w-3.5" />
              <span>Doimiy Ochiq Domen (Production URL — ixtiyoriy)</span>
            </label>
            <input
              type="url"
              value={publicBaseUrl}
              onChange={(e) => setPublicBaseUrl(e.target.value)}
              placeholder="Masalan: https://ayubparfum.uz yoki https://ayub-club.vercel.app"
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-xs sm:text-sm font-mono"
            />
            <p className="mt-1 text-[11px] text-neutral-500">
              Ilovani Vercel / VPS domeniga joylaganingizda shu yerga kiritsangiz, barcha bosma QR-kodlar doimiy ochiq domeningizga ulanadi.
            </p>
          </div>
          <button
            type="submit"
            disabled={savingDomain}
            className="rounded-xl bg-[#047857] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#064E3B] cursor-pointer shrink-0"
          >
            {savingDomain ? "Saqlanmoqda..." : "Domenni saqlash"}
          </button>
        </form>
      )}

      {showCreate && canManage && (
        <form
          onSubmit={handleCreate}
          className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 grid gap-4 sm:grid-cols-2"
        >
          <div>
            <label className="block text-xs font-semibold mb-1">
              QR-kod nomi
            </label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Masalan: INSTAGRAM BIO QR"
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Tracking manba kodi (source)
            </label>
            <input
              type="text"
              required
              value={newCode}
              onChange={(e) => {
                const c = e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9_-]/g, "");
                setNewCode(c);
                setNewPath(`/register?source=${c}`);
              }}
              placeholder="instagram"
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Dinamik havola (mustaqil tahrirlash mumkin)
            </label>
            <input
              type="text"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="/register?source=instagram"
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Izoh</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Instagram sahifa va stories uchun"
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-xl px-4 py-2 text-sm text-neutral-500 cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#064E3B] px-5 py-2 text-sm font-semibold text-white cursor-pointer"
            >
              QR-kod yaratish
            </button>
          </div>
        </form>
      )}

      {/* Edit Modal */}
      {editing && (
        <form
          onSubmit={handleSaveEdit}
          className="rounded-3xl border-2 border-[#D4AF37] bg-white dark:bg-neutral-900 p-6 shadow-md grid gap-4 sm:grid-cols-3"
        >
          <div>
            <label className="block text-xs font-semibold mb-1">
              QR-kod nomi
            </label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              QR Havolasi (Link)
            </label>
            <input
              type="text"
              required
              value={editPath}
              onChange={(e) => setEditPath(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Izoh</label>
            <input
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-sm"
            />
          </div>
          <div className="sm:col-span-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-xl px-4 py-2 text-sm text-neutral-500 cursor-pointer"
            >
              Yopish
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#047857] px-5 py-2 text-sm font-semibold text-white cursor-pointer"
            >
              Yangilash va yangi QR yaratish
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-neutral-500">
          QR-kodlar tayyorlanmoqda...
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {sources.map((src) => (
            <div
              key={src.id}
              className={`rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 transition ${
                src.isActive
                  ? "ring-neutral-200/80 dark:ring-neutral-800"
                  : "opacity-70 ring-red-300 dark:ring-red-900"
              }`}
            >
              <div className="flex flex-col sm:flex-row gap-5">
                {/* Real QR Code Preview */}
                <div className="flex flex-col items-center rounded-2xl bg-[#F3F4F6] dark:bg-white p-3 shrink-0 self-center sm:self-start">
                  <img
                    src={src.pngDataUrl}
                    alt={src.name}
                    className="h-40 w-40 rounded-lg"
                  />
                  <span className="mt-2 text-[11px] font-mono font-bold text-[#064E3B]">
                    source={src.code}
                  </span>
                </div>

                {/* Details & Controls */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-[#047857]" />
                        <h3 className="font-serif-luxury text-xl font-bold">
                          {src.name}
                        </h3>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {src.description || "Dinamik QR ro‘yxatdan o‘tish kodi"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        src.isActive
                          ? "bg-emerald-100 text-[#064E3B]"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {src.isActive ? "Faol" : "O‘chirilgan"}
                    </span>
                  </div>

                  {/* Link Box */}
                  <div className="flex items-center gap-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-xs font-mono">
                    <span className="truncate flex-1">{src.fullUrl}</span>
                    <button
                      type="button"
                      onClick={() => copyLink(src)}
                      title="Havolani nusxalash"
                      className="text-[#047857] dark:text-[#D4AF37] hover:opacity-80 cursor-pointer"
                    >
                      {copiedId === src.id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <Link
                      href={
                        src.customPath.startsWith("/")
                          ? src.customPath
                          : `/${src.customPath}`
                      }
                      title="Shu oynada sinab ko‘rish"
                      className="text-neutral-500 hover:text-[#047857]"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/60 p-2">
                      <div className="text-[10px] text-neutral-500">
                        Skanerlar
                      </div>
                      <div className="text-sm font-bold tabular-nums">
                        {src.scansCount}
                      </div>
                    </div>
                    <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/60 p-2">
                      <div className="text-[10px] text-neutral-500">
                        Ro‘yxatdan o‘tdi
                      </div>
                      <div className="text-sm font-bold text-[#047857] dark:text-[#D4AF37] tabular-nums">
                        {src.actualRegistrations}
                      </div>
                    </div>
                    <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/60 p-2">
                      <div className="text-[10px] text-neutral-500">Savdo</div>
                      <div className="text-xs font-bold tabular-nums truncate">
                        {formatSom(src.totalRevenue)}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => downloadPng(src)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#064E3B] px-3 py-2 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5 text-[#D4AF37]" />
                      <span>PNG yuklab olish</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadSvg(src)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#064E3B]/30 dark:border-[#D4AF37]/40 px-3 py-2 text-xs font-semibold text-[#064E3B] dark:text-[#D4AF37] hover:bg-[#064E3B]/5 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>SVG yuklab olish</span>
                    </button>

                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(src);
                            setEditName(src.name);
                            setEditPath(src.customPath);
                            setEditDesc(src.description || "");
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 dark:border-neutral-700 px-2.5 py-2 text-xs font-medium hover:border-[#D4AF37] cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Tahrirlash</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleActive(src)}
                          className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 dark:border-neutral-700 px-2.5 py-2 text-xs font-medium hover:border-amber-500 cursor-pointer"
                        >
                          <Power className="h-3.5 w-3.5" />
                          <span>
                            {src.isActive ? "Faolsizlantirish" : "Faollashtirish"}
                          </span>
                        </button>

                        {src.code !== "flyer" && src.code !== "cashier" && (
                          <button
                            type="button"
                            onClick={() => handleDelete(src)}
                            className="inline-flex items-center gap-1 rounded-xl border border-red-200 text-red-600 px-2.5 py-2 text-xs font-medium hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Registrations Log */}
      <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
        <h3 className="font-serif-luxury text-lg font-bold mb-4">
          QR orqali ro‘yxatdan o‘tgan mijozlar jurnali
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-xs uppercase text-neutral-500">
                <th className="py-3 pr-4">Mijoz ID</th>
                <th className="py-3 pr-4">Ism</th>
                <th className="py-3 pr-4">Telefon</th>
                <th className="py-3 pr-4">QR Manbasi</th>
                <th className="py-3 pr-4">Havola</th>
                <th className="py-3">Sana</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {recentRegs.map((r) => (
                <tr key={r.id}>
                  <td className="py-3 pr-4 font-bold text-[#064E3B] dark:text-[#D4AF37] tabular-nums">
                    {r.customerCode}
                  </td>
                  <td className="py-3 pr-4 font-medium">{r.customerName}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    {formatUzbekPhone(r.customerPhone)}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="rounded-md bg-emerald-50 dark:bg-emerald-950 px-2 py-1 text-xs font-bold uppercase text-[#047857] dark:text-emerald-300">
                      {r.sourceCode}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-neutral-500">
                    {r.referralUrl}
                  </td>
                  <td className="py-3 tabular-nums text-neutral-500">
                    {formatDateUZ(r.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
