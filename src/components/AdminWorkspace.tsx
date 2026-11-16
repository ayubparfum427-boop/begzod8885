"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Bot,
  CreditCard,
  Crown,
  Eye,
  EyeOff,
  ExternalLink,
  Gift,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Moon,
  Package,
  QrCode,
  Settings,
  ShoppingBag,
  Sun,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { AyubLogo } from "./AyubLogo";
import { useTheme } from "./ThemeProvider";
import {
  clearStoredStaffToken,
  getStoredStaffToken,
  setStoredStaffToken,
  staffFetch,
} from "@/lib/client-auth";
import { DashboardTab, OverviewPayload } from "./admin/DashboardTab";
import { QrManagementTab } from "./admin/QrManagementTab";
import { CustomersAndVipTab } from "./admin/CustomersAndVipTab";
import { BonusAndDiscountTab } from "./admin/BonusAndDiscountTab";
import { ProductsAndSalesTab } from "./admin/ProductsAndSalesTab";
import { PaymentsManagementTab } from "./admin/PaymentsManagementTab";
import { TelegramBotsTab } from "./admin/TelegramBotsTab";
import { EmployeesAndSettingsTab } from "./admin/EmployeesAndSettingsTab";

interface StaffSessionClient {
  staffType: "MASTER_ADMIN" | "EMPLOYEE";
  employeeId: number | null;
  role: "ADMIN" | "MANAGER" | "CASHIER";
  fullName: string;
  login: string;
}

const FORM_ERROR_MESSAGES: Record<string, string> = {
  empty_pin: "Iltimos, Admin PIN-kodni kiriting.",
  wrong_pin: "Admin PIN-kodi noto‘g‘ri!",
  empty_creds: "Login va parolni to‘liq kiriting.",
  no_user: "Bunday loginli xodim topilmadi.",
  blocked: "Ushbu xodim hisobi faolsizlantirilgan yoki bloklangan.",
  wrong_pass: "Parol noto‘g‘ri kiritildi.",
  db_error:
    "Ma’lumotlar bazasiga ulanishda xatolik (DATABASE_URL sozlamasini tekshiring).",
};

export function AdminWorkspace({
  initialTab,
  initialBranding,
  initialSession,
  initialPermissions,
  initialOverview,
  initialStaffToken,
  initialErrorCode,
  initialLoginMode,
}: {
  initialTab?: string;
  initialBranding?: { storeName: string; clubName: string };
  initialSession?: StaffSessionClient | null;
  initialPermissions?: string[];
  initialOverview?: OverviewPayload | null;
  initialStaffToken?: string | null;
  initialErrorCode?: string;
  initialLoginMode?: "pin" | "employee";
}) {
  const { theme, toggleTheme } = useTheme();
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [session, setSession] = useState<StaffSessionClient | null>(
    initialSession ?? null
  );
  const [permissions, setPermissions] = useState<string[]>(
    initialPermissions ?? []
  );
  const [branding, setBranding] = useState<{
    storeName: string;
    clubName: string;
  }>(
    initialBranding ?? { storeName: "AYUB PARFUM", clubName: "AYUB CLUB PRO" }
  );

  // Login form state
  const [loginMode, setLoginMode] = useState<"pin" | "employee">(
    initialLoginMode || "pin"
  );
  const [pinInput, setPinInput] = useState("");
  const [empLogin, setEmpLogin] = useState("");
  const [empPass, setEmpPass] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loginErr, setLoginErr] = useState(
    initialErrorCode ? FORM_ERROR_MESSAGES[initialErrorCode] || "" : ""
  );
  const [loggingIn, setLoggingIn] = useState(false);

  // Active Admin Module Tab
  const [activeTab, setActiveTab] = useState<string>(
    initialTab ||
      (initialSession?.role === "CASHIER" ? "sales" : "dashboard")
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Shared Dashboard/Overview Data
  const [overview, setOverview] = useState<OverviewPayload | null>(
    initialOverview ?? null
  );
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");

  async function checkSession() {
    // Only show spinner if there's a stored token in browser storage to restore
    const hasLocalToken = Boolean(getStoredStaffToken());
    if (!session && hasLocalToken) {
      setCheckingAuth(true);
    }
    try {
      const res = await staffFetch("/api/auth/staff");
      const data = await res.json();
      if (data.branding) setBranding(data.branding);
      if (data.authenticated && data.session) {
        if (data.overview) {
          setOverview(data.overview);
        }
        setPermissions(data.permissions || []);
        setSession(data.session);
        if (data.session.role === "CASHIER" && !initialTab) {
          setActiveTab("sales");
        }
      } else if (!initialSession) {
        clearStoredStaffToken();
        setSession(null);
      }
    } catch {
      // Keep Login UI interactive even if background check fails
    } finally {
      setCheckingAuth(false);
    }
  }

  async function refreshOverview(explicitToken?: string | null) {
    const safeToken =
      typeof explicitToken === "string" && explicitToken ? explicitToken : null;
    setOverviewLoading(true);
    setOverviewError("");
    try {
      const res = await staffFetch("/api/admin/overview", {}, safeToken);
      if (res.status === 401) {
        clearStoredStaffToken();
        setSession(null);
        setPermissions([]);
        setLoginErr("Sessiya muddati tugadi. Iltimos, qayta kiring.");
        return;
      }
      const data = await res.json();
      if (res.ok && data.kpis) {
        setOverview(data);
      } else {
        setOverviewError(
          data.error || "Dashboard ma’lumotlarini yuklashda xatolik yuz berdi."
        );
      }
    } catch {
      setOverviewError("Server bilan bog‘lanishda xatolik yuz berdi.");
    } finally {
      setOverviewLoading(false);
    }
  }

  useEffect(() => {
    if (initialStaffToken) {
      setStoredStaffToken(initialStaffToken);
    }
    if (!initialSession) {
      void checkSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr("");
    setLoggingIn(true);
    try {
      const payload =
        loginMode === "pin"
          ? { mode: "pin", pin: pinInput.trim() }
          : { mode: "employee", login: empLogin.trim(), password: empPass };

      const res = await staffFetch("/api/auth/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setLoginErr(data.error || "Kirishda xatolik yuz berdi.");
        return;
      }

      if (data.staffToken) {
        setStoredStaffToken(data.staffToken);
        try {
          window.history.replaceState(
            null,
            "",
            `/admin?_st=${encodeURIComponent(data.staffToken)}`
          );
        } catch {
          // Ignore
        }
      }
      if (data.overview) {
        setOverview(data.overview);
      }
      setPermissions(data.permissions || []);
      setPinInput("");
      setEmpPass("");
      if (data.session.role === "CASHIER") {
        setActiveTab("sales");
      } else {
        setActiveTab("dashboard");
      }
      setSession(data.session);
      if (!data.overview && data.session.role !== "CASHIER") {
        await refreshOverview(data.staffToken);
      }
    } catch {
      setLoginErr("Server bilan bog‘lanishda xatolik.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await staffFetch("/api/auth/staff", { method: "DELETE" });
    } catch {
      // Ignore
    }
    clearStoredStaffToken();
    try {
      window.history.replaceState(null, "", "/admin");
    } catch {
      // Ignore
    }
    setSession(null);
    setPermissions([]);
    setOverview(null);
  }

  const can = (perm: string) => permissions.includes(perm);

  // 6 Main Menu Groups + Sub-items mapped cleanly with permissions
  const menuGroups = [
    {
      groupTitle: "1. Bosh Boshqaruv",
      items: [
        {
          id: "dashboard",
          label: "Bosh Dashboard",
          icon: LayoutDashboard,
          visible: can("view_dashboard"),
        },
        {
          id: "qr",
          label: "QR-kod boshqaruvi",
          icon: QrCode,
          visible: can("view_qr"),
        },
      ],
    },
    {
      groupTitle: "2. Mijozlar va VIP",
      items: [
        {
          id: "customers",
          label: "Mijozlar bo‘limi",
          icon: Users,
          visible: can("register_customer") || can("manage_customers"),
        },
        {
          id: "vip",
          label: "VIP mijozlar",
          icon: Crown,
          visible: can("manage_vip"),
        },
      ],
    },
    {
      groupTitle: "3. Sodiqlik va Bonuslar",
      items: [
        {
          id: "bonuses",
          label: "Bonus va Chegirmalar",
          icon: Gift,
          visible: can("manage_bonuses") || can("manage_discounts"),
        },
      ],
    },
    {
      groupTitle: "4. Ombor, Savdo va To‘lov",
      items: [
        {
          id: "products",
          label: "Ombor bo‘limi",
          icon: Package,
          visible: can("view_products"),
        },
        {
          id: "sales",
          label: "Savdo kiritish (POS)",
          icon: ShoppingBag,
          visible: can("create_sale"),
        },
        {
          id: "payments",
          label: "To‘lov bo‘limi (Paynet QR)",
          icon: CreditCard,
          visible: can("manage_payments"),
        },
      ],
    },
    {
      groupTitle: "5. Aloqa va Analitika",
      items: [
        {
          id: "telegram",
          label: "Telegram Botlar",
          icon: Bot,
          visible: can("manage_telegram"),
        },
        {
          id: "reports",
          label: "Umumiy Hisobotlar",
          icon: BarChart3,
          visible: can("view_reports"),
        },
      ],
    },
    {
      groupTitle: "6. Xodimlar va Tizim",
      items: [
        {
          id: "employees",
          label: "Xodimlar bo‘limi",
          icon: UserCog,
          visible: can("manage_employees"),
        },
        {
          id: "settings",
          label: "Sozlamalar va PIN",
          icon: Settings,
          visible: can("manage_settings"),
        },
      ],
    },
  ];

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6] dark:bg-[#111827]">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#064E3B] border-t-[#D4AF37]" />
      </div>
    );
  }

  /* ================= ADMIN & STAFF SECURE LOGIN PAGE ================= */
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#064E3B] via-[#111827] to-[#022c22] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 p-7 sm:p-9 shadow-2xl ring-1 ring-[#D4AF37]/40 animate-fade-up">
          <div className="flex items-center justify-between mb-6">
            <AyubLogo
              clubName={branding.clubName}
              storeName={branding.storeName}
            />
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg p-2 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-[#D4AF37]"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>

          <h1 className="font-serif-luxury text-2xl font-bold text-[#111827] dark:text-white">
            Boshqaruv paneliga kirish
          </h1>
          <p className="mt-1 text-xs text-neutral-500">
            Server tomonidan himoyalangan avtorizatsiya
          </p>

          <div className="mt-5 flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">
            <button
              type="button"
              onClick={() => {
                setLoginMode("pin");
                setLoginErr("");
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
                loginMode === "pin"
                  ? "bg-[#064E3B] text-white"
                  : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              Admin PIN-kod
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode("employee");
                setLoginErr("");
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
                loginMode === "employee"
                  ? "bg-[#064E3B] text-white"
                  : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              Xodim Login
            </button>
          </div>

          {loginErr && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-300">
              {loginErr}
            </div>
          )}

          <form
            action="/api/auth/staff-form"
            method="POST"
            onSubmit={handleLoginSubmit}
            className="mt-5 space-y-4"
          >
            <input type="hidden" name="mode" value={loginMode} />
            {loginMode === "pin" ? (
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  Maxfiy Admin PIN-kod
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
                  <input
                    name="pin"
                    type={showSecret ? "text" : "password"}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="PIN-kodni kiriting"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent py-2.5 pl-10 pr-10 text-center text-lg tracking-[0.25em] font-bold focus:border-[#047857] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                  >
                    {showSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Xodim logini
                  </label>
                  <input
                    name="login"
                    type="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    required
                    value={empLogin}
                    onChange={(e) => setEmpLogin(e.target.value)}
                    placeholder="admin, menejer yoki kassir"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-sm font-mono focus:border-[#047857] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Parol
                  </label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showSecret ? "text" : "password"}
                      required
                      value={empPass}
                      onChange={(e) => setEmpPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 pr-10 text-sm focus:border-[#047857] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showSecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full rounded-xl bg-gradient-to-r from-[#064E3B] to-[#047857] py-3 text-sm font-bold text-white shadow-md hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="h-4 w-4 text-[#D4AF37]" />
              <span>{loggingIn ? "Tekshirilmoqda..." : "Tizimga kirish"}</span>
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/"
              className="text-xs font-semibold text-[#047857] dark:text-[#D4AF37] hover:underline"
            >
              ← Mijoz paneliga qaytish
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ================= AUTHENTICATED ADMIN CRM SHELL ================= */
  return (
    <div className="min-h-screen flex bg-[#F3F4F6] dark:bg-[#111827] text-[#111827] dark:text-white">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="p-5 border-b border-neutral-100 dark:border-neutral-800">
          <AyubLogo
            clubName={branding.clubName}
            storeName={branding.storeName}
          />
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-5">
          {menuGroups.map((grp) => {
            const visibleItems = grp.items.filter((i) => i.visible);
            if (visibleItems.length === 0) return null;
            return (
              <div key={grp.groupTitle}>
                <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  {grp.groupTitle}
                </div>
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition cursor-pointer ${
                          active
                            ? "bg-[#064E3B] text-white shadow-sm"
                            : "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 ${
                            active ? "text-[#D4AF37]" : "text-neutral-400"
                          }`}
                        />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
          <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800 px-3.5 py-2.5 text-xs">
            <div className="font-bold truncate">{session.fullName}</div>
            <div className="text-[11px] text-[#047857] dark:text-[#D4AF37] font-semibold">
              Rol: {session.role}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-900/50 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Tizimdan chiqish</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-white dark:bg-neutral-900 h-full flex flex-col p-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
              <AyubLogo
                clubName={branding.clubName}
                storeName={branding.storeName}
                compact
              />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 py-4 space-y-4">
              {menuGroups.map((grp) => {
                const visibleItems = grp.items.filter((i) => i.visible);
                if (visibleItems.length === 0) return null;
                return (
                  <div key={grp.groupTitle}>
                    <div className="px-2 mb-1 text-[10px] font-bold uppercase text-neutral-400">
                      {grp.groupTitle}
                    </div>
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                            activeTab === item.id
                              ? "bg-[#064E3B] text-white"
                              : "text-neutral-700 dark:text-neutral-300"
                          }`}
                        >
                          <Icon className="h-4 w-4 text-[#D4AF37]" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white"
            >
              Chiqish
            </button>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md px-4 sm:px-8 py-3.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-xl border border-neutral-200 dark:border-neutral-700 p-2"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-sm sm:text-base font-bold text-[#064E3B] dark:text-[#D4AF37]">
              {branding.clubName} CRM
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/register?source=cashier"
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-xs font-semibold hover:border-[#047857] transition"
            >
              <span>Mijoz paneli</span>
              <ExternalLink className="h-3.5 w-3.5 text-[#047857]" />
            </Link>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Dark yoki Light rejim"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-[#D4AF37] cursor-pointer"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {activeTab === "dashboard" && can("view_dashboard") && (
            <DashboardTab
              data={overview}
              loading={overviewLoading}
              error={overviewError}
              onRetry={() => {
                void refreshOverview();
              }}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === "qr" && can("view_qr") && (
            <QrManagementTab canManage={can("manage_qr")} />
          )}

          {activeTab === "customers" && (
            <CustomersAndVipTab
              mode="all"
              canManage={can("manage_customers")}
              onDataMutated={refreshOverview}
            />
          )}

          {activeTab === "vip" && can("manage_vip") && (
            <CustomersAndVipTab
              mode="vip"
              canManage={can("manage_vip")}
              onDataMutated={refreshOverview}
            />
          )}

          {activeTab === "bonuses" && can("manage_bonuses") && (
            <BonusAndDiscountTab onDataMutated={refreshOverview} />
          )}

          {activeTab === "sales" && can("create_sale") && (
            <ProductsAndSalesTab
              initialSubTab="sales"
              canManageProducts={can("manage_products")}
              rankings={overview?.rankings}
              onDataMutated={refreshOverview}
            />
          )}

          {activeTab === "products" && can("view_products") && (
            <ProductsAndSalesTab
              initialSubTab="products"
              canManageProducts={can("manage_products")}
              rankings={overview?.rankings}
              onDataMutated={refreshOverview}
            />
          )}

          {activeTab === "payments" && can("manage_payments") && (
            <PaymentsManagementTab
              canConfigureQr={session.role === "ADMIN"}
              onDataMutated={refreshOverview}
            />
          )}

          {activeTab === "telegram" && can("manage_telegram") && (
            <TelegramBotsTab />
          )}

          {activeTab === "reports" && can("view_reports") && (
            <EmployeesAndSettingsTab
              mode="reports"
              onDataMutated={refreshOverview}
            />
          )}

          {activeTab === "employees" && can("manage_employees") && (
            <EmployeesAndSettingsTab
              mode="employees"
              onDataMutated={refreshOverview}
            />
          )}

          {activeTab === "settings" && can("manage_settings") && (
            <EmployeesAndSettingsTab
              mode="settings"
              onDataMutated={refreshOverview}
            />
          )}
        </main>
      </div>
    </div>
  );
}
