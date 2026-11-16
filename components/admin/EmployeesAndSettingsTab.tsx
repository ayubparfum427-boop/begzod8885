"use client";

import React, { useEffect, useState } from "react";
import {
  Ban,
  CheckCircle,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Lock,
  Plus,
  Save,
  Shield,
  Trash2,
} from "lucide-react";
import {
  formatDateTimeUZ,
  formatDateUZ,
  formatGrams,
  formatPhoneInputMask,
  formatSom,
  formatUzbekPhone,
} from "@/lib/format";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/export-utils";
import { staffFetch } from "@/lib/client-auth";
import type { AppConfig } from "@/lib/settings-service";
import type { OverviewPayload } from "./DashboardTab";

interface EmployeeRow {
  id: number;
  fullName: string;
  phone: string;
  login: string;
  role: "ADMIN" | "MANAGER" | "CASHIER";
  isActive: boolean;
  isBlocked: boolean;
  registeredCustomersCount: number;
  salesCount: number;
  totalSalesAmount: number;
  lastLoginAt: string | null;
}

interface AuditLogRow {
  id: number;
  actorType: string;
  actorName: string;
  action: string;
  entityType: string;
  details: string | null;
  createdAt: string;
}

export function EmployeesAndSettingsTab({
  mode,
  onDataMutated,
}: {
  mode: "employees" | "reports" | "settings";
  onDataMutated?: () => void;
}) {
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // EMPLOYEES STATE
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [editEmp, setEditEmp] = useState<EmployeeRow | null>(null);
  const [empName, setEmpName] = useState("");
  const [empPhone, setEmpPhone] = useState("+998 ");
  const [empLogin, setEmpLogin] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [empRole, setEmpRole] = useState<"ADMIN" | "MANAGER" | "CASHIER">(
    "CASHIER"
  );
  const [resetEmpId, setResetEmpId] = useState<number | null>(null);
  const [resetNewPass, setResetNewPass] = useState("");

  // REPORTS STATE
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reportData, setReportData] = useState<OverviewPayload | null>(null);

  // SETTINGS STATE
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [demoCount, setDemoCount] = useState(0);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");

  async function loadEmployees() {
    const res = await staffFetch("/api/admin/employees");
    const data = await res.json();
    if (data.employees) setEmployees(data.employees);
    if (data.auditLogs) setAuditLogs(data.auditLogs);
  }

  async function loadReport() {
    const qs = new URLSearchParams();
    if (fromDate) qs.set("from", fromDate);
    if (toDate) qs.set("to", toDate);
    const res = await staffFetch(`/api/admin/overview?${qs.toString()}`);
    const data = await res.json();
    if (data.kpis) setReportData(data);
  }

  async function loadSettings() {
    const res = await staffFetch("/api/admin/settings");
    const data = await res.json();
    if (data.config) setConfig(data.config);
    if (typeof data.demoCustomersCount === "number") {
      setDemoCount(data.demoCustomersCount);
    }
  }

  useEffect(() => {
    setMsg("");
    setErr("");
    if (mode === "employees") loadEmployees();
    if (mode === "reports") loadReport();
    if (mode === "settings") loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // EMPLOYEE HANDLERS
  async function handleSaveEmployee(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (editEmp) {
      const res = await staffFetch("/api/admin/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editEmp.id,
          action: "edit",
          fullName: empName,
          phone: empPhone,
          login: empLogin,
          role: empRole,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.error || "Xatolik");
        return;
      }
      setMsg("Xodim ma’lumotlari yangilandi.");
    } else {
      const res = await staffFetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: empName,
          phone: empPhone,
          login: empLogin,
          password: empPassword,
          role: empRole,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.error || "Xatolik");
        return;
      }
      setMsg("Yangi xodim yaratildi!");
    }

    setShowEmpForm(false);
    setEditEmp(null);
    setEmpName("");
    setEmpPhone("+998 ");
    setEmpLogin("");
    setEmpPassword("");
    loadEmployees();
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmpId) return;
    const res = await staffFetch("/api/admin/employees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: resetEmpId,
        action: "reset_password",
        newPassword: resetNewPass,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setMsg("Xodim paroli muvaffaqiyatli tiklandi.");
      setResetEmpId(null);
      setResetNewPass("");
    } else {
      setErr(data.error || "Xatolik");
    }
  }

  async function toggleEmployeeBlock(emp: EmployeeRow) {
    await staffFetch("/api/admin/employees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: emp.id,
        action: "toggle_block",
        isBlocked: !emp.isBlocked,
      }),
    });
    loadEmployees();
  }

  async function deleteEmployee(id: number) {
    const res = await staffFetch(`/api/admin/employees?id=${id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!data.ok) {
      setErr(data.error || "O‘chirib bo‘lmadi");
    } else {
      loadEmployees();
    }
  }

  // REPORT EXPORT HANDLERS
  function buildReportSummaryRows() {
    if (!reportData) return [];
    const k = reportData.kpis;
    return [
      { "Bo‘lim": "MIJOZLAR", "Ko‘rsatkich": "Jami mijozlar", Qiymat: `${k.totalCustomers} ta` },
      { "Bo‘lim": "MIJOZLAR", "Ko‘rsatkich": "Bugungi yangi mijozlar", Qiymat: `${k.todayNewCustomers} ta` },
      { "Bo‘lim": "MIJOZLAR", "Ko‘rsatkich": "Flayer QR mijozlari", Qiymat: `${k.flyerCustomersCount} ta` },
      { "Bo‘lim": "MIJOZLAR", "Ko‘rsatkich": "Kassir QR mijozlari", Qiymat: `${k.cashierCustomersCount} ta` },
      { "Bo‘lim": "MIJOZLAR", "Ko‘rsatkich": "To‘g‘ridan-to‘g‘ri / Boshqa manba", Qiymat: `${k.otherSourceCustomersCount ?? 0} ta` },
      { "Bo‘lim": "MIJOZLAR", "Ko‘rsatkich": "VIP mijozlar", Qiymat: `${k.vipCustomersCount} ta` },
      { "Bo‘lim": "SAVDO", "Ko‘rsatkich": "Kunlik savdo", Qiymat: formatSom(k.todaySales) },
      { "Bo‘lim": "SAVDO", "Ko‘rsatkich": "Haftalik savdo", Qiymat: formatSom(k.weeklySales) },
      { "Bo‘lim": "SAVDO", "Ko‘rsatkich": "Oylik savdo", Qiymat: formatSom(k.monthlySales) },
      { "Bo‘lim": "SAVDO", "Ko‘rsatkich": "Yillik savdo", Qiymat: formatSom(k.yearlySales) },
      { "Bo‘lim": "SAVDO", "Ko‘rsatkich": "Jami savdo", Qiymat: formatSom(k.totalSales) },
      { "Bo‘lim": "BONUS", "Ko‘rsatkich": "Berilgan bonuslar", Qiymat: formatGrams(k.grantedBonusesGrams) },
      { "Bo‘lim": "BONUS", "Ko‘rsatkich": "Ishlatilgan bonuslar", Qiymat: formatGrams(k.usedBonusesGrams) },
      { "Bo‘lim": "BONUS", "Ko‘rsatkich": "Qolgan bonuslar", Qiymat: formatGrams(k.remainingBonusesGrams) },
      { "Bo‘lim": "BONUS", "Ko‘rsatkich": "Bonus xarajatlari", Qiymat: formatSom(k.bonusEstimatedCostSom) },
      { "Bo‘lim": "CHEGIRMA", "Ko‘rsatkich": "30% chegirmalar summasi", Qiymat: formatSom(k.discount30Sum) },
      { "Bo‘lim": "CHEGIRMA", "Ko‘rsatkich": "45% VIP chegirmalar summasi", Qiymat: formatSom(k.discount45Sum) },
      ...(k.otherDiscountSum
        ? [{ "Bo‘lim": "CHEGIRMA", "Ko‘rsatkich": "Shaxsiy chegirmalar summasi", Qiymat: formatSom(k.otherDiscountSum) }]
        : []),
      { "Bo‘lim": "CHEGIRMA", "Ko‘rsatkich": "Jami chegirma summasi", Qiymat: formatSom(k.totalDiscountSum) },
    ];
  }

  function handleExportReportExcel() {
    const rows = buildReportSummaryRows();
    exportToExcel(rows, "Umumiy_Hisobot", "ayub-club-pro-hisobot");
  }

  function handleExportReportCSV() {
    const rows = buildReportSummaryRows();
    exportToCSV(rows, "ayub-club-pro-hisobot");
  }

  function handleExportReportPDF() {
    const rows = buildReportSummaryRows();
    const rangeLabel =
      fromDate || toDate
        ? `Davr: ${fromDate ? formatDateUZ(fromDate) : "boshidan"} - ${
            toDate ? formatDateUZ(toDate) : "hozirgacha"
          }`
        : `Sana: ${formatDateUZ(new Date())}`;

    exportToPDF({
      title: "UMUMIY ANALITIK HISOBOT",
      subtitle: rangeLabel,
      headers: ["Bo'lim", "Ko'rsatkich", "Qiymat"],
      body: rows.map((r) => [r["Bo‘lim"], r["Ko‘rsatkich"], r.Qiymat]),
      fileName: "ayub-club-pro-hisobot",
    });
  }

  // SETTINGS HANDLERS
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setErr("");
    setMsg("");
    const res = await staffFetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_config", config }),
    });
    const data = await res.json();
    if (data.ok) {
      setMsg("Barcha tizim sozlamalari ma’lumotlar bazasiga saqlandi!");
      onDataMutated?.();
    } else {
      setErr(data.error || "Xatolik");
    }
  }

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const res = await staffFetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "change_pin",
        currentPin,
        newPin,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setMsg(data.message || "Admin PIN-kodi o‘zgartirildi!");
      setCurrentPin("");
      setNewPin("");
    } else {
      setErr(data.error || "PIN o‘zgartirishda xatolik");
    }
  }

  async function handleClearDemo() {
    const res = await staffFetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear_demo" }),
    });
    const data = await res.json();
    if (data.ok) {
      setMsg(
        `${data.deletedCustomers} ta namuna [DEMO] yozuvlari tozalandi. Tizimda faqat real ma’lumotlar qoldi!`
      );
      loadSettings();
      onDataMutated?.();
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
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

      {/* ================= MODE 1: EMPLOYEES ================= */}
      {mode === "employees" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-serif-luxury text-2xl font-bold">
                Xodimlar va Rol ruxsatlari boshqaruvi
              </h2>
              <p className="text-sm text-neutral-500">
                Xodimlar Admin PIN-kodini ko‘ra olmaydi va faqat o‘z roliga
                tegishli ruxsatda ishlaydi.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditEmp(null);
                setEmpName("");
                setEmpPhone("+998 ");
                setEmpLogin("");
                setEmpPassword("");
                setEmpRole("CASHIER");
                setShowEmpForm(!showEmpForm);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-4 py-2.5 text-sm font-semibold text-white cursor-pointer self-start"
            >
              <Plus className="h-4 w-4 text-[#D4AF37]" />
              <span>Xodim qo‘shish</span>
            </button>
          </div>

          {showEmpForm && (
            <form
              onSubmit={handleSaveEmployee}
              className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 grid gap-4 sm:grid-cols-3"
            >
              <div>
                <label className="block text-xs font-semibold mb-1">Ism</label>
                <input
                  type="text"
                  required
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Telefon
                </label>
                <input
                  type="tel"
                  required
                  value={empPhone}
                  onChange={(e) =>
                    setEmpPhone(formatPhoneInputMask(e.target.value))
                  }
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Login</label>
                <input
                  type="text"
                  required
                  value={empLogin}
                  onChange={(e) => setEmpLogin(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm font-mono"
                />
              </div>
              {!editEmp && (
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Parol
                  </label>
                  <input
                    type="password"
                    required
                    value={empPassword}
                    onChange={(e) => setEmpPassword(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1">Rol</label>
                <select
                  value={empRole}
                  onChange={(e) =>
                    setEmpRole(
                      e.target.value as "ADMIN" | "MANAGER" | "CASHIER"
                    )
                  }
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
                >
                  <option value="ADMIN">ADMIN — Barcha huquqlar</option>
                  <option value="MANAGER">
                    MANAGER — Mijozlar, savdo va hisobotlar
                  </option>
                  <option value="CASHIER">
                    CASHIER — Mijoz ro‘yxatga olish va savdo kiritish
                  </option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-[#047857] px-5 py-2 text-sm font-semibold text-white cursor-pointer"
                >
                  Saqlash
                </button>
              </div>
            </form>
          )}

          {resetEmpId && (
            <form
              onSubmit={handleResetPassword}
              className="rounded-2xl border-2 border-[#D4AF37] bg-white dark:bg-neutral-900 p-4 flex flex-wrap items-center gap-3"
            >
              <KeyRound className="h-5 w-5 text-[#D4AF37]" />
              <input
                type="password"
                required
                value={resetNewPass}
                onChange={(e) => setResetNewPass(e.target.value)}
                placeholder="Yangi parol (kamida 4 ta belgi)"
                className="flex-1 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#064E3B] px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                Parolni yangilash
              </button>
              <button
                type="button"
                onClick={() => setResetEmpId(null)}
                className="text-xs text-neutral-500 px-2 cursor-pointer"
              >
                Bekor
              </button>
            </form>
          )}

          {/* Employees Table */}
          <div className="rounded-3xl bg-white dark:bg-neutral-900 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-[11px] uppercase text-neutral-500">
                    <th className="py-3.5 px-4">Ism</th>
                    <th className="py-3.5 px-3">Telefon</th>
                    <th className="py-3.5 px-3">Login</th>
                    <th className="py-3.5 px-3">Rol</th>
                    <th className="py-3.5 px-3">Holat</th>
                    <th className="py-3.5 px-3">Mijozlar</th>
                    <th className="py-3.5 px-3">Savdolar</th>
                    <th className="py-3.5 px-3">Jami savdo summasi</th>
                    <th className="py-3.5 px-4 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {employees.map((e) => (
                    <tr key={e.id}>
                      <td className="py-3 px-4 font-semibold">{e.fullName}</td>
                      <td className="py-3 px-3 tabular-nums">
                        {formatUzbekPhone(e.phone)}
                      </td>
                      <td className="py-3 px-3 font-mono">{e.login}</td>
                      <td className="py-3 px-3">
                        <span className="rounded-full bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 text-xs font-bold text-[#047857] dark:text-[#D4AF37]">
                          {e.role}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {e.isBlocked ? (
                          <span className="text-xs font-bold text-red-600">
                            Bloklangan
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-emerald-600">
                            Faol
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 tabular-nums">
                        {e.registeredCustomersCount} ta
                      </td>
                      <td className="py-3 px-3 tabular-nums">
                        {e.salesCount} ta
                      </td>
                      <td className="py-3 px-3 font-bold tabular-nums">
                        {formatSom(e.totalSalesAmount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditEmp(e);
                              setEmpName(e.fullName);
                              setEmpPhone(e.phone);
                              setEmpLogin(e.login);
                              setEmpRole(e.role);
                              setShowEmpForm(true);
                            }}
                            title="Tahrirlash"
                            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setResetEmpId(e.id)}
                            title="Parolni tiklash"
                            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[#D4AF37] cursor-pointer"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleEmployeeBlock(e)}
                            title={e.isBlocked ? "Blokdan ochish" : "Bloklash"}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-amber-600 cursor-pointer"
                          >
                            {e.isBlocked ? (
                              <CheckCircle className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Ban className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEmployee(e.id)}
                            title="O‘chirish"
                            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-red-500 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Activity Logs */}
          <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800">
            <h3 className="font-serif-luxury text-lg font-bold mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#047857]" />
              <span>Xodimlar va tizim faoliyati jurnali (Audit Logs)</span>
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap justify-between gap-2 rounded-xl border border-neutral-100 dark:border-neutral-800 px-3.5 py-2 text-xs"
                >
                  <div>
                    <span className="font-bold">
                      [{log.actorType}] {log.actorName}
                    </span>{" "}
                    — <span className="text-neutral-600 dark:text-neutral-300">{log.details || log.action}</span>
                  </div>
                  <span className="text-neutral-400 tabular-nums">
                    {formatDateTimeUZ(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODE 2: REPORTS ================= */}
      {mode === "reports" && (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="font-serif-luxury text-2xl font-bold">
                Umumiy Analitik Hisobotlar
              </h2>
              <p className="text-sm text-neutral-500">
                Sana oralig‘ini tanlang va Excel, PDF yoki CSV formatida yuklab
                oling.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportReportExcel}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#064E3B] px-4 py-2.5 text-xs font-bold text-white cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-[#D4AF37]" />
                <span>Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={handleExportReportPDF}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-bold text-white ring-1 ring-[#D4AF37]/40 cursor-pointer"
              >
                <FileText className="h-4 w-4 text-[#D4AF37]" />
                <span>PDF (.pdf)</span>
              </button>
              <button
                type="button"
                onClick={handleExportReportCSV}
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 px-4 py-2.5 text-xs font-bold cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>CSV (.csv)</span>
              </button>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="rounded-3xl bg-white dark:bg-neutral-900 p-5 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Boshlanish sanasi
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Tugash sanasi
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={loadReport}
              className="rounded-xl bg-[#047857] px-5 py-2 text-sm font-semibold text-white cursor-pointer"
            >
              Hisobotni shakllantirish
            </button>
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                  setTimeout(loadReport, 50);
                }}
                className="text-xs text-neutral-500 underline cursor-pointer"
              >
                Filtrni tozalash
              </button>
            )}
          </div>

          {reportData && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* 1. MIJOZLAR */}
              <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-2.5 text-sm">
                <h3 className="font-serif-luxury text-lg font-bold text-[#064E3B] dark:text-[#D4AF37]">
                  1. Mijozlar hisoboti
                </h3>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Jami mijozlar:</span>
                  <strong className="tabular-nums">{reportData.kpis.totalCustomers} ta</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Bugungi yangi:</span>
                  <strong className="tabular-nums">{reportData.kpis.todayNewCustomers} ta</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Flayer mijozlari:</span>
                  <strong className="tabular-nums">{reportData.kpis.flyerCustomersCount} ta</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Kassir mijozlari:</span>
                  <strong className="tabular-nums">{reportData.kpis.cashierCustomersCount} ta</strong>
                </div>
                {(reportData.kpis.otherSourceCustomersCount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Boshqa / To‘g‘ridan-to‘g‘ri:</span>
                    <strong className="tabular-nums">{reportData.kpis.otherSourceCustomersCount} ta</strong>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-500">VIP mijozlar:</span>
                  <strong className="tabular-nums">{reportData.kpis.vipCustomersCount} ta</strong>
                </div>
              </div>

              {/* 2. SAVDO */}
              <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-2.5 text-sm">
                <h3 className="font-serif-luxury text-lg font-bold text-[#064E3B] dark:text-[#D4AF37]">
                  2. Savdo hisoboti
                </h3>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Kunlik savdo:</span>
                  <strong className="tabular-nums">{formatSom(reportData.kpis.todaySales)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Haftalik savdo:</span>
                  <strong className="tabular-nums">{formatSom(reportData.kpis.weeklySales)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Oylik savdo:</span>
                  <strong className="tabular-nums">{formatSom(reportData.kpis.monthlySales)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Yillik savdo:</span>
                  <strong className="tabular-nums">{formatSom(reportData.kpis.yearlySales)}</strong>
                </div>
                <div className="flex justify-between border-t pt-2 border-neutral-100 dark:border-neutral-800">
                  <span className="font-semibold">Jami savdo:</span>
                  <strong className="tabular-nums text-[#047857] dark:text-[#D4AF37]">
                    {formatSom(reportData.kpis.totalSales)}
                  </strong>
                </div>
              </div>

              {/* 3. BONUS */}
              <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-2.5 text-sm">
                <h3 className="font-serif-luxury text-lg font-bold text-[#064E3B] dark:text-[#D4AF37]">
                  3. Bonuslar hisoboti
                </h3>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Berilgan bonuslar:</span>
                  <strong className="tabular-nums">{formatGrams(reportData.kpis.grantedBonusesGrams)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Ishlatilgan bonuslar:</span>
                  <strong className="tabular-nums">{formatGrams(reportData.kpis.usedBonusesGrams)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Qolgan bonuslar:</span>
                  <strong className="tabular-nums">{formatGrams(reportData.kpis.remainingBonusesGrams)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Bonus xarajatlari:</span>
                  <strong className="tabular-nums">{formatSom(reportData.kpis.bonusEstimatedCostSom)}</strong>
                </div>
              </div>

              {/* 4. CHEGIRMA */}
              <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-2.5 text-sm">
                <h3 className="font-serif-luxury text-lg font-bold text-[#064E3B] dark:text-[#D4AF37]">
                  4. Chegirmalar hisoboti
                </h3>
                <div className="flex justify-between">
                  <span className="text-neutral-500">
                    30% chegirmalar ({reportData.kpis.discount30Count} ta):
                  </span>
                  <strong className="tabular-nums">{formatSom(reportData.kpis.discount30Sum)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">
                    45% chegirmalar ({reportData.kpis.discount45Count} ta):
                  </span>
                  <strong className="tabular-nums">{formatSom(reportData.kpis.discount45Sum)}</strong>
                </div>
                {(reportData.kpis.otherDiscountCount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">
                      Shaxsiy chegirmalar ({reportData.kpis.otherDiscountCount} ta):
                    </span>
                    <strong className="tabular-nums">{formatSom(reportData.kpis.otherDiscountSum)}</strong>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 border-neutral-100 dark:border-neutral-800">
                  <span className="font-semibold">Jami chegirma summasi:</span>
                  <strong className="tabular-nums text-[#047857] dark:text-[#D4AF37]">
                    {formatSom(reportData.kpis.totalDiscountSum)}
                  </strong>
                </div>
              </div>

              {/* 5. XODIMLAR */}
              <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-2.5 text-sm">
                <h3 className="font-serif-luxury text-lg font-bold text-[#064E3B] dark:text-[#D4AF37]">
                  5. Xodimlar reytingi
                </h3>
                {reportData.rankings.employeeStats.map((emp) => (
                  <div key={emp.id} className="flex justify-between text-xs">
                    <span>
                      {emp.fullName} ({emp.registeredCustomersCount} mijoz)
                    </span>
                    <strong className="tabular-nums">
                      {formatSom(emp.totalSalesAmount)}
                    </strong>
                  </div>
                ))}
              </div>

              {/* 6. MAHSULOTLAR */}
              <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-2.5 text-sm">
                <h3 className="font-serif-luxury text-lg font-bold text-[#064E3B] dark:text-[#D4AF37]">
                  6. Mahsulotlar bo‘yicha savdo
                </h3>
                {reportData.rankings.topProducts.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="truncate pr-2">
                      {p.name} ({p.unitsSold} dona)
                    </span>
                    <strong className="tabular-nums shrink-0">
                      {formatSom(p.revenue)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= MODE 3: SETTINGS ================= */}
      {mode === "settings" && config && (
        <div className="space-y-6">
          <div>
            <h2 className="font-serif-luxury text-2xl font-bold">
              Tizim va Do‘kon Sozlamalari
            </h2>
            <p className="text-sm text-neutral-500">
              Barcha sozlamalar real vaqtda PostgreSQL ma’lumotlar bazasi orqali
              boshqariladi.
            </p>
          </div>

          <form
            onSubmit={handleSaveSettings}
            className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 grid gap-4 sm:grid-cols-3"
          >
            <div>
              <label className="block text-xs font-semibold mb-1">
                Do‘kon nomi
              </label>
              <input
                type="text"
                value={config.storeName}
                onChange={(e) =>
                  setConfig({ ...config, storeName: e.target.value })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Klub nomi
              </label>
              <input
                type="text"
                value={config.clubName}
                onChange={(e) =>
                  setConfig({ ...config, clubName: e.target.value })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Do‘kon telefoni
              </label>
              <input
                type="text"
                value={config.storePhone}
                onChange={(e) =>
                  setConfig({ ...config, storePhone: e.target.value })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Telegram havolasi
              </label>
              <input
                type="text"
                value={config.telegramChannelUrl}
                onChange={(e) =>
                  setConfig({ ...config, telegramChannelUrl: e.target.value })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Instagram havolasi
              </label>
              <input
                type="text"
                value={config.instagramUrl}
                onChange={(e) =>
                  setConfig({ ...config, instagramUrl: e.target.value })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Valyuta va Sana formati
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.currency}
                  onChange={(e) =>
                    setConfig({ ...config, currency: e.target.value })
                  }
                  className="w-1/2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  readOnly
                  value={config.dateFormat}
                  className="w-1/2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Emerald rang (#064E3B)
              </label>
              <input
                type="text"
                value={config.emeraldColor}
                onChange={(e) =>
                  setConfig({ ...config, emeraldColor: e.target.value })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Gold rang (#D4AF37)
              </label>
              <input
                type="text"
                value={config.goldColor}
                onChange={(e) =>
                  setConfig({ ...config, goldColor: e.target.value })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                1 gr bonus shartli qiymati (so‘m)
              </label>
              <input
                type="number"
                value={config.gramValueInSom}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    gramValueInSom: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm tabular-nums"
              />
            </div>

            <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex flex-wrap gap-4 text-xs font-medium">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.requireConsent}
                    onChange={(e) =>
                      setConfig({ ...config, requireConsent: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span>Ro‘yxatdan o‘tishda rozilik talab qilish</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoNotifySale}
                    onChange={(e) =>
                      setConfig({ ...config, autoNotifySale: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span>Savdodan so‘ng avtomatik Telegram xabarnoma</span>
                </label>
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#047857] cursor-pointer"
              >
                <Save className="h-4 w-4 text-[#D4AF37]" />
                <span>Sozlamalarni saqlash</span>
              </button>
            </div>
          </form>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Secure Admin PIN Changer */}
            <form
              onSubmit={handleChangePin}
              className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-4"
            >
              <div className="flex items-center gap-2 font-serif-luxury text-lg font-bold">
                <Lock className="h-5 w-5 text-[#D4AF37]" />
                <span>Admin PIN-kodini o‘zgartirish (Server-side)</span>
              </div>
              <p className="text-xs text-neutral-500">
                Admin PIN-kodi frontendda saqlanmaydi — kriptografik xesh
                sifatida server bazasida saqlanadi.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Joriy PIN-kod
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    placeholder="••••"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Yangi PIN-kod
                  </label>
                  <input
                    type="password"
                    required
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="Yangi PIN (kamida 4 belgi)"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="rounded-xl bg-[#111827] px-5 py-2.5 text-xs font-bold text-[#D4AF37] ring-1 ring-[#D4AF37]/40 cursor-pointer"
              >
                PIN-kodni yangilash
              </button>
            </form>

            {/* Demo vs Production Data Separation Control */}
            <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-serif-luxury text-lg font-bold">
                  Demo va Real ma’lumotlar ajratmasi
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Hozirgi vaqtda bazada{" "}
                  <strong className="text-[#064E3B] dark:text-[#D4AF37]">
                    {demoCount} ta
                  </strong>{" "}
                  test uchun teglangan [DEMO] mijoz yozuvi mavjud. Do‘konda real
                  ish boshlashdan avval ularni 1 tugma orqali tozalashingiz
                  mumkin (real mijozlar va katalog saqlanib qoladi).
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleClearDemo}
                  disabled={demoCount === 0}
                  className="rounded-xl border border-red-300 text-red-600 px-4 py-2 text-xs font-bold hover:bg-red-50 disabled:opacity-40 cursor-pointer"
                >
                  Demo yozuvlarni tozalash ({demoCount} ta)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
