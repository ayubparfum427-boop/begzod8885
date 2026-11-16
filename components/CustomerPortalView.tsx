"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Award,
  CheckCircle2,
  Crown,
  Gift,
  History,
  LogOut,
  MessageCircle,
  Moon,
  Package,
  Percent,
  Phone,
  Share2,
  ShoppingBag,
  Sparkles,
  Sun,
  User,
  UserCheck,
} from "lucide-react";
import { AyubLogo } from "./AyubLogo";
import {
  CatalogProduct,
  CustomerOrderItem,
  CustomerPerfumeShop,
} from "./CustomerPerfumeShop";
import { useTheme } from "./ThemeProvider";
import {
  clearStoredCustomerToken,
  customerFetch,
  setStoredCustomerToken,
} from "@/lib/client-auth";
import {
  formatDateUZ,
  formatGrams,
  formatPhoneInputMask,
  formatSom,
  formatUzbekPhone,
  normalizeUzbekPhone,
} from "@/lib/format";

interface PortalCustomer {
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
  createdAt: string;
}

interface BonusTx {
  id: number;
  type: string;
  amountGrams: number;
  balanceAfterGrams: number;
  description: string;
  expiresAt: string | null;
  isUsed: boolean;
  createdAt: string;
}

interface DiscountTx {
  id: number;
  discountPercent: number;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  ruleApplied: string;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface PurchaseItem {
  id: number;
  productName: string;
  brand: string;
  volume: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  lineFinalAmount: number;
}

interface PurchaseRecord {
  id: number;
  saleCode: string;
  cashierName: string;
  subtotalAmount: number;
  discountPercent: number;
  discountAmount: number;
  finalAmount: number;
  bonusGramsUsed: number;
  bonusGramsEarned: number;
  createdAt: string;
  items: PurchaseItem[];
}

interface BrandingInfo {
  storeName: string;
  clubName: string;
  logoUrl: string;
  storePhone: string;
  telegramChannelUrl: string;
  instagramUrl: string;
  welcomeBonusGrams: number;
  repeatBonusGrams: number;
  repeatBonusMaxAmount: number;
  discountThresholdAmount: number;
  regularDiscountPercent: number;
  vipDiscountPercent: number;
  vipMinTotalSpent: number;
  requireConsent: boolean;
  paynetPaymentUrl?: string;
  paynetMerchantTitle?: string;
  paynetInstructions?: string;
  cashInstructions?: string;
  paynetQrPng?: string;
}

export function CustomerPortalView({
  initialSource,
  initialTab = "catalog",
  initialBranding,
  initialProducts,
  initialPortalData,
  initialCustomerToken,
}: {
  initialSource?: string;
  initialTab?:
    | "catalog"
    | "profile"
    | "bonuses"
    | "vip"
    | "discounts"
    | "purchases";
  initialBranding?: BrandingInfo | null;
  initialProducts?: CatalogProduct[];
  initialPortalData?: {
    customer: PortalCustomer;
    bonuses: BonusTx[];
    discounts: DiscountTx[];
    purchasesHistory: PurchaseRecord[];
    orders: CustomerOrderItem[];
  } | null;
  initialCustomerToken?: string | null;
}) {
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(!initialBranding);
  const [branding, setBranding] = useState<BrandingInfo | null>(
    initialBranding ?? null
  );
  const [featuredProducts, setFeaturedProducts] = useState<CatalogProduct[]>(
    initialProducts ?? []
  );
  const [customer, setCustomer] = useState<PortalCustomer | null>(
    initialPortalData?.customer ?? null
  );
  const [bonuses, setBonuses] = useState<BonusTx[]>(
    initialPortalData?.bonuses ?? []
  );
  const [discounts, setDiscounts] = useState<DiscountTx[]>(
    initialPortalData?.discounts ?? []
  );
  const [purchases, setPurchases] = useState<PurchaseRecord[]>(
    initialPortalData?.purchasesHistory ?? []
  );
  const [orders, setOrders] = useState<CustomerOrderItem[]>(
    initialPortalData?.orders ?? []
  );
  const [memberQrPng, setMemberQrPng] = useState<string>("");

  // Active portal navigation tab
  const [activeTab, setActiveTab] = useState<
    "catalog" | "profile" | "bonuses" | "vip" | "discounts" | "purchases"
  >(initialTab);

  // Registration vs Returning Customer mode
  const [authMode, setAuthMode] = useState<"register" | "returning">("register");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+998 ");
  const [consent, setConsent] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const qrSource = (initialSource || "direct").trim().toLowerCase();

  useEffect(() => {
    if (initialCustomerToken) {
      setStoredCustomerToken(initialCustomerToken);
    }
    let mounted = true;
    async function fetchPortal() {
      try {
        const qs =
          initialSource && initialSource !== "direct"
            ? `?trackSource=${encodeURIComponent(initialSource)}`
            : "";
        const res = await customerFetch(`/api/customer-portal${qs}`);
        const data = await res.json();
        if (!mounted) return;
        if (data.branding) setBranding(data.branding);
        if (data.featuredProducts) setFeaturedProducts(data.featuredProducts);
        if (data.authenticated && data.portalData?.customer) {
          setCustomer(data.portalData.customer);
          setBonuses(data.portalData.bonuses || []);
          setDiscounts(data.portalData.discounts || []);
          setPurchases(data.portalData.purchasesHistory || []);
          setOrders(data.portalData.orders || []);
        }
      } catch {
        // Ignore network error on initial load
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchPortal();
    return () => {
      mounted = false;
    };
  }, [initialSource]);

  useEffect(() => {
    if (customer?.customerCode) {
      QRCode.toDataURL(`AYUBCLUB:${customer.customerCode}:${customer.phone}`, {
        width: 240,
        margin: 1,
        color: { dark: "#064E3B", light: "#FFFFFF" },
      })
        .then(setMemberQrPng)
        .catch(() => {});
    }
  }, [customer]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (fullName.trim().length < 2) {
      setErrorMsg("Iltimos, ismingizni to‘liq kiriting.");
      return;
    }

    const norm = normalizeUzbekPhone(phone);
    if (!norm) {
      setErrorMsg(
        "Telefon raqami +998 XX XXX XX XX formatida bo‘lishi kerak (masalan: +998 90 123 45 67)."
      );
      return;
    }

    if (branding?.requireConsent && !consent) {
      setErrorMsg("Shaxsiy ma’lumotlarni qayta ishlashga rozilik belgilang.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await customerFetch("/api/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          fullName: fullName.trim(),
          phone: norm,
          consentAccepted: consent,
          qrSource,
          referralUrl: typeof window !== "undefined" ? window.location.href : "",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || "Ro‘yxatdan o‘tishda xatolik yuz berdi.");
        return;
      }

      if (data.customerToken) {
        setStoredCustomerToken(data.customerToken);
        try {
          window.history.replaceState(
            null,
            "",
            `/portal?_ct=${encodeURIComponent(data.customerToken)}`
          );
        } catch {
          // Ignore
        }
      }
      setSuccessMsg(
        data.message || "Muvaffaqiyatli ro‘yxatdan o‘tdingiz!"
      );
      if (data.portalData?.customer) {
        setCustomer(data.portalData.customer);
        setBonuses(data.portalData.bonuses || []);
        setDiscounts(data.portalData.discounts || []);
        setPurchases(data.portalData.purchasesHistory || []);
        setOrders(data.portalData.orders || []);
      }
    } catch {
      setErrorMsg("Tarmoq xatoligi yuz berdi. Qayta urinib ko‘ring.");
    } finally {
      setSubmitting(false);
    }
  }

  async function quickLoginByPhone(rawPhoneValue: string) {
    const norm = normalizeUzbekPhone(rawPhoneValue);
    if (!norm) {
      setErrorMsg("Telefon raqamingizni +998 XX XXX XX XX formatida kiriting.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await customerFetch("/api/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lookup_own",
          phone: norm,
          identifier: identifier.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || "Profil topilmadi.");
        return;
      }

      if (data.customerToken) {
        setStoredCustomerToken(data.customerToken);
        try {
          window.history.replaceState(
            null,
            "",
            `/portal?_ct=${encodeURIComponent(data.customerToken)}`
          );
        } catch {
          // Ignore
        }
      }
      if (data.portalData?.customer) {
        setCustomer(data.portalData.customer);
        setBonuses(data.portalData.bonuses || []);
        setDiscounts(data.portalData.discounts || []);
        setPurchases(data.portalData.purchasesHistory || []);
        setOrders(data.portalData.orders || []);
      }
    } catch {
      setErrorMsg("Tarmoq xatoligi yuz berdi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLookupOwn(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg("");
    await quickLoginByPhone(phone);
  }

  async function handleSignOutCustomer() {
    try {
      await customerFetch("/api/customer-portal", { method: "DELETE" });
    } catch {
      // Ignore
    }
    clearStoredCustomerToken();
    try {
      window.history.replaceState(null, "", "/");
    } catch {
      // Ignore
    }
    setCustomer(null);
    setBonuses([]);
    setDiscounts([]);
    setPurchases([]);
    setSuccessMsg("");
    setErrorMsg("");
  }

  const vipTarget = branding?.vipMinTotalSpent || 1000000;
  const vipProgress = customer
    ? Math.min(100, Math.round((Number(customer.totalSpent) / vipTarget) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#111827] text-[#111827] dark:text-white flex flex-col">
      {/* Top Luxury Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-900/10 dark:border-white/10 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <AyubLogo
            clubName={branding?.clubName || "AYUB CLUB PRO"}
            storeName={branding?.storeName || "AYUB PARFUM"}
            secretIconHref="/admin"
          />

          <div className="flex items-center gap-2 sm:gap-3">
            {branding?.storePhone && (
              <a
                href={`tel:${branding.storePhone.replace(/\s+/g, "")}`}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#064E3B]/20 dark:border-[#D4AF37]/30 bg-[#064E3B]/5 dark:bg-[#D4AF37]/10 px-3 py-2 text-xs font-semibold text-[#064E3B] dark:text-[#D4AF37] tabular-nums"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>{branding.storePhone}</span>
              </a>
            )}

            <button
              onClick={toggleTheme}
              type="button"
              aria-label="Mavzuni o‘zgartirish"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-[#D4AF37] hover:border-[#D4AF37] transition cursor-pointer"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#064E3B] border-t-[#D4AF37]" />
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
              AYUB CLUB yuklanmoqda...
            </p>
          </div>
        ) : !customer ? (
          /* ================= REGISTRATION & WELCOME VIEW ================= */
          <div className="grid gap-8 lg:grid-cols-12 items-start animate-fade-up">
            {/* Brand Hero Left Column */}
            <div className="lg:col-span-6 relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#022c22] p-7 sm:p-9 text-white shadow-xl ring-1 ring-[#D4AF37]/40">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37]/20 px-3.5 py-1 text-xs font-semibold tracking-wider uppercase text-[#D4AF37] ring-1 ring-[#D4AF37]/40">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Rasmiy Sodiqlik Klubi</span>
              </div>

              <h1 className="mt-5 font-serif-luxury text-3xl sm:text-4xl font-bold leading-tight">
                {branding?.storeName || "AYUB PARFUM"}{" "}
                <span className="block text-[#D4AF37]">
                  eksklyuziv imtiyozlar olami
                </span>
              </h1>

              <p className="mt-4 text-sm sm:text-base text-emerald-100/90 leading-relaxed">
                QR-kod orqali 15 soniyada a’zo bo‘ling, dastlabki bonus atiringizni
                qabul qiling va har bir xaridda shaxsiy chegirmalarga ega bo‘ling.
              </p>

              {initialSource && initialSource !== "direct" && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-medium text-emerald-100 backdrop-blur-sm">
                  <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
                  <span>
                    QR manbasi aniqlandi:{" "}
                    <strong className="uppercase text-[#D4AF37]">
                      {initialSource === "flyer"
                        ? "Flayer QR"
                        : initialSource === "cashier"
                        ? "Kassir QR"
                        : initialSource}
                    </strong>
                  </span>
                </div>
              )}

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
                  <Gift className="h-5 w-5 text-[#D4AF37]" />
                  <div className="mt-2 text-xl font-bold tabular-nums text-white">
                    +{branding?.welcomeBonusGrams ?? 5} gr
                  </div>
                  <div className="text-xs text-emerald-100/80">
                    Birinchi ro‘yxatdan o‘tish bonusi
                  </div>
                </div>

                <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
                  <Percent className="h-5 w-5 text-[#D4AF37]" />
                  <div className="mt-2 text-xl font-bold tabular-nums text-white">
                    {branding?.regularDiscountPercent ?? 30}% gacha
                  </div>
                  <div className="text-xs text-emerald-100/80">
                    Qayta xarid chegirmasi
                  </div>
                </div>

                <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
                  <Crown className="h-5 w-5 text-[#D4AF37]" />
                  <div className="mt-2 text-xl font-bold tabular-nums text-white">
                    {branding?.vipDiscountPercent ?? 45}% gacha
                  </div>
                  <div className="text-xs text-emerald-100/80">
                    VIP klub a’zolari uchun
                  </div>
                </div>
              </div>

              <div className="mt-7 overflow-hidden rounded-2xl ring-1 ring-[#D4AF37]/30">
                <img
                  src="/images/ayub-hero-perfume.jpg"
                  alt="Ayub Parfum Luxury Collection"
                  className="h-44 w-full object-cover"
                />
              </div>
            </div>

            {/* Registration Form Right Column (NO PIN REQUIRED!) */}
            <div className="lg:col-span-6 rounded-3xl bg-white dark:bg-neutral-900 p-6 sm:p-8 shadow-lg ring-1 ring-neutral-200/80 dark:ring-neutral-800">
              <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setErrorMsg("");
                  }}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                    authMode === "register"
                      ? "bg-[#064E3B] text-white shadow-sm"
                      : "text-neutral-600 dark:text-neutral-300"
                  }`}
                >
                  Ro‘yxatdan o‘tish
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("returning");
                    setErrorMsg("");
                  }}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                    authMode === "returning"
                      ? "bg-[#064E3B] text-white shadow-sm"
                      : "text-neutral-600 dark:text-neutral-300"
                  }`}
                >
                  Mening profilim
                </button>
              </div>

              {errorMsg && (
                <div className="mb-5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300 space-y-2">
                  <div>{errorMsg}</div>
                  {authMode === "register" &&
                    errorMsg.includes("avval ro‘yxatdan o‘tgan") && (
                      <button
                        type="button"
                        onClick={() => quickLoginByPhone(phone)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#064E3B] px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                      >
                        <span>Mening profilimga darhol kirish →</span>
                      </button>
                    )}
                </div>
              )}

              {authMode === "register" ? (
                <form
                  action="/api/auth/customer-form"
                  method="POST"
                  onSubmit={handleRegister}
                  className="space-y-5"
                >
                  <input type="hidden" name="action" value="register" />
                  <input type="hidden" name="qrSource" value={qrSource} />
                  <div>
                    <h2 className="font-serif-luxury text-2xl font-bold text-[#111827] dark:text-white">
                      Klubga a’zo bo‘lish
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      Ma’lumotlaringizni kiriting va darhol +
                      {branding?.welcomeBonusGrams ?? 5} gramm atir bonusiga ega bo‘ling.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-1.5">
                      1. Ismingiz
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-neutral-400" />
                      <input
                        name="fullName"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Masalan: Sardorbek Karimov"
                        className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 py-3 pl-10 pr-4 text-sm focus:border-[#047857] focus:outline-none focus:ring-2 focus:ring-[#047857]/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-1.5">
                      2. Telefon raqamingiz
                    </label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-neutral-400" />
                      <input
                        name="phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) =>
                          setPhone(formatPhoneInputMask(e.target.value))
                        }
                        placeholder="+998 90 123 45 67"
                        className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 py-3 pl-10 pr-4 text-sm font-medium tabular-nums focus:border-[#047857] focus:outline-none focus:ring-2 focus:ring-[#047857]/20"
                      />
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      Format: +998 XX XXX XX XX (bitta raqamga bitta profil ochiladi)
                    </p>
                  </div>

                  <label className="flex items-start gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 p-3.5 cursor-pointer">
                    <input
                      name="consentAccepted"
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-[#064E3B] focus:ring-[#047857]"
                    />
                    <span className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                      AYUB CLUB PRO sodiqlik dasturi qoidalariga hamda bonus va
                      chegirma xabarnomalarini olish uchun ma’lumotlarim qayta
                      ishlanishiga roziman.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-gradient-to-r from-[#064E3B] to-[#047857] py-3.5 px-5 text-sm font-bold text-white shadow-md hover:opacity-95 disabled:opacity-60 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4 text-[#D4AF37]" />
                    <span>
                      {submitting
                        ? "Saqlanmoqda..."
                        : "Ro‘yxatdan o‘tish va bonus olish"}
                    </span>
                  </button>
                </form>
              ) : (
                <form
                  action="/api/auth/customer-form"
                  method="POST"
                  onSubmit={handleLookupOwn}
                  className="space-y-5"
                >
                  <input type="hidden" name="action" value="lookup_own" />
                  <div>
                    <h2 className="font-serif-luxury text-2xl font-bold text-[#111827] dark:text-white">
                      Shaxsiy kartani ochish
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      PIN-kod talab qilinmaydi. Ro‘yxatdan o‘tgan telefon
                      raqamingizni kiriting.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-1.5">
                      Telefon raqamingiz
                    </label>
                    <input
                      name="phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) =>
                        setPhone(formatPhoneInputMask(e.target.value))
                      }
                      placeholder="+998 90 123 45 67"
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 py-3 px-4 text-sm font-medium tabular-nums focus:border-[#047857] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-1.5">
                      Ism yoki Mijoz ID (ixtiyoriy)
                    </label>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Ixtiyoriy: Ismingiz yoki AYB-10001"
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 py-3 px-4 text-sm focus:border-[#047857] focus:outline-none"
                    />
                  </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-xl bg-[#064E3B] py-3.5 px-5 text-sm font-bold text-white shadow-md hover:bg-[#047857] disabled:opacity-60 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserCheck className="h-4 w-4 text-[#D4AF37]" />
                      <span>
                        {submitting ? "Tekshirilmoqda..." : "Profilimga kirish"}
                      </span>
                    </button>
                  </form>
                )}
              </div>

              {/* Public Perfume Catalog Preview below Registration */}
              <div className="lg:col-span-12 pt-4">
                <CustomerPerfumeShop
                  products={featuredProducts}
                  isAuthenticated={false}
                  paynetQrPng={branding?.paynetQrPng}
                  paynetPaymentUrl={branding?.paynetPaymentUrl}
                  paynetMerchantTitle={branding?.paynetMerchantTitle}
                  paynetInstructions={branding?.paynetInstructions}
                  cashInstructions={branding?.cashInstructions}
                  onRequireAuth={() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    setErrorMsg(
                      "Atir tanlab xarid va to‘lov qilish uchun yuqorida 15 soniyada ro‘yxatdan o‘ting yoki «Mening profilim»ga kiring!"
                    );
                  }}
                  onOrderSuccess={() => {}}
                />
              </div>
            </div>
          ) : (
          /* ================= AUTHENTICATED CUSTOMER PORTAL ================= */
          <div className="space-y-6 animate-fade-up">
            {successMsg && (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 p-4 text-emerald-900 dark:text-emerald-200 shadow-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#047857] dark:text-[#D4AF37] mt-0.5" />
                <div className="text-sm font-medium">{successMsg}</div>
              </div>
            )}

            {/* Luxury Digital Loyalty Pass Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#111827] p-6 sm:p-8 text-white shadow-xl ring-1 ring-[#D4AF37]/50">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="rounded-full bg-[#D4AF37] px-3 py-1 text-xs font-bold tracking-wider uppercase text-[#111827]">
                      {customer.isVip ? "👑 VIP CLUB A’ZOSI" : "✨ CLUB A’ZOSI"}
                    </span>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tabular-nums text-emerald-100">
                      ID: {customer.customerCode}
                    </span>
                  </div>

                  <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold">
                    {customer.fullName}
                  </h1>
                  <p className="text-sm text-emerald-100/90 tabular-nums">
                    {formatUzbekPhone(customer.phone)} • A’zo bo‘lgan sana:{" "}
                    {formatDateUZ(customer.createdAt)}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                      <div className="text-[11px] uppercase tracking-wider text-emerald-200/80">
                        Bonuslarim
                      </div>
                      <div className="mt-1 text-xl font-bold text-[#D4AF37] tabular-nums">
                        {formatGrams(customer.bonusGrams)}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                      <div className="text-[11px] uppercase tracking-wider text-emerald-200/80">
                        Chegirma darajam
                      </div>
                      <div className="mt-1 text-xl font-bold text-white tabular-nums">
                        {customer.customDiscountPercent
                          ? `${customer.customDiscountPercent}%`
                          : customer.isVip
                          ? `${branding?.vipDiscountPercent ?? 45}%`
                          : `${branding?.regularDiscountPercent ?? 30}%`}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                      <div className="text-[11px] uppercase tracking-wider text-emerald-200/80">
                        Jami xaridim
                      </div>
                      <div className="mt-1 text-base sm:text-lg font-bold text-white tabular-nums">
                        {formatSom(customer.totalSpent)}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                      <div className="text-[11px] uppercase tracking-wider text-emerald-200/80">
                        Xaridlar soni
                      </div>
                      <div className="mt-1 text-xl font-bold text-white tabular-nums">
                        {customer.purchasesCount} ta
                      </div>
                    </div>
                  </div>

                  {/* Live VIP Progress + Viral Invite Friend Strip */}
                  <div className="pt-2 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-emerald-100/90 font-medium">
                        {customer.isVip
                          ? `👑 Siz maksimal ${branding?.vipDiscountPercent ?? 45}% VIP imtiyozdasiz!`
                          : `👑 VIP (${branding?.vipDiscountPercent ?? 45}% chegirma) gacha yana ${formatSom(
                              Math.max(0, vipTarget - Number(customer.totalSpent || 0))
                            )} qoldi`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const shareUrl =
                            typeof window !== "undefined"
                              ? `${window.location.origin}/register?source=flyer`
                              : "";
                          const shareText = `✨ AYUB PARFUM — Sodiqlik klubiga a’zo bo‘ling va dastlabki +${
                            branding?.welcomeBonusGrams ?? 5
                          } gr atir bonusini bepul oling!`;
                          window.open(
                            `https://t.me/share/url?url=${encodeURIComponent(
                              shareUrl
                            )}&text=${encodeURIComponent(shareText)}`,
                            "_blank"
                          );
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-3 py-1 text-[11px] font-bold text-[#111827] hover:opacity-95 transition cursor-pointer"
                      >
                        <Share2 className="h-3 w-3" />
                        <span>Do‘stlarga ulashish</span>
                      </button>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-black/30">
                      <div
                        style={{ width: `${vipProgress}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-[#D4AF37] transition-all duration-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Personal Member QR Pass */}
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-3.5 text-[#111827] shadow-lg shrink-0 self-start md:self-center">
                  {memberQrPng ? (
                    <img
                      src={memberQrPng}
                      alt={customer.customerCode}
                      className="h-28 w-28"
                    />
                  ) : (
                    <div className="h-28 w-28 bg-neutral-100 animate-pulse rounded" />
                  )}
                  <span className="mt-1.5 text-[11px] font-bold tracking-wider text-[#064E3B] tabular-nums">
                    {customer.customerCode}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Navigation Pills */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white dark:bg-neutral-900 p-2 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    id: "catalog",
                    label: "Atirlar katalogi",
                    icon: Package,
                  },
                  { id: "profile", label: "Mening profilim", icon: User },
                  { id: "bonuses", label: "Bonuslarim", icon: Gift },
                  { id: "vip", label: "VIP maqomim", icon: Crown },
                  { id: "discounts", label: "Chegirmalarim", icon: Percent },
                  {
                    id: "purchases",
                    label: "Xaridlar tarixim",
                    icon: ShoppingBag,
                  },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        setActiveTab(
                          tab.id as
                            | "catalog"
                            | "profile"
                            | "bonuses"
                            | "vip"
                            | "discounts"
                            | "purchases"
                        )
                      }
                      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
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
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleSignOutCustomer}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Chiqish</span>
              </button>
            </div>

            {/* TAB 0: ATIRLAR KATALOGI (BUTUN FLAKON & RAZLIV + NAQD & PAYNET QR) */}
            {activeTab === "catalog" && (
              <CustomerPerfumeShop
                products={featuredProducts}
                orders={orders}
                isAuthenticated={true}
                isVip={customer.isVip}
                customDiscountPercent={customer.customDiscountPercent}
                discountThresholdAmount={
                  branding?.discountThresholdAmount ?? 250000
                }
                regularDiscountPercent={
                  branding?.regularDiscountPercent ?? 30
                }
                vipDiscountPercent={branding?.vipDiscountPercent ?? 45}
                paynetQrPng={branding?.paynetQrPng}
                paynetPaymentUrl={branding?.paynetPaymentUrl}
                paynetMerchantTitle={branding?.paynetMerchantTitle}
                paynetInstructions={branding?.paynetInstructions}
                cashInstructions={branding?.cashInstructions}
                onRequireAuth={() => {}}
                onOrderSuccess={(payload) => {
                  setSuccessMsg(payload.message);
                  if (payload.featuredProducts) {
                    setFeaturedProducts(payload.featuredProducts);
                  }
                  const pd = payload.portalData as {
                    orders?: CustomerOrderItem[];
                  } | null;
                  if (pd?.orders) {
                    setOrders(pd.orders);
                  }
                }}
              />
            )}

            {/* TAB 1: MENING PROFILIM */}
            {activeTab === "profile" && (
              <div className="grid gap-6 md:grid-cols-12">
                <div className="md:col-span-5 rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800 space-y-4">
                  <h2 className="font-serif-luxury text-xl font-bold">
                    Shaxsiy ma’lumotlarim
                  </h2>
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-sm">
                    <div className="flex justify-between py-2.5">
                      <span className="text-neutral-500">Ism:</span>
                      <span className="font-semibold">{customer.fullName}</span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-neutral-500">Telefon:</span>
                      <span className="font-semibold tabular-nums">
                        {formatUzbekPhone(customer.phone)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-neutral-500">Mijoz ID:</span>
                      <span className="font-bold text-[#064E3B] dark:text-[#D4AF37] tabular-nums">
                        {customer.customerCode}
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-neutral-500">Bonuslar:</span>
                      <span className="font-bold text-[#047857] dark:text-emerald-400 tabular-nums">
                        {formatGrams(customer.bonusGrams)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-neutral-500">VIP maqom:</span>
                      <span className="font-semibold">
                        {customer.isVip ? "VIP Mijoz" : "Standart Mijoz"}
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-neutral-500">Jami xarid summasi:</span>
                      <span className="font-semibold tabular-nums">
                        {formatSom(customer.totalSpent)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-neutral-500">Xaridlar soni:</span>
                      <span className="font-semibold tabular-nums">
                        {customer.purchasesCount} marta
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-neutral-500">Oxirgi xarid:</span>
                      <span className="font-semibold tabular-nums">
                        {formatDateUZ(customer.lastPurchaseAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-7 rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-serif-luxury text-xl font-bold">
                      Ayub Parfum katalogi
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab("catalog")}
                      className="text-xs font-bold text-[#047857] dark:text-[#D4AF37] hover:underline cursor-pointer"
                    >
                      Katalog va Xaridga o‘tish →
                    </button>
                  </div>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    {featuredProducts.slice(0, 4).map((p) => (
                      <div
                        key={p.id}
                        className="flex gap-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-3 hover:border-[#D4AF37]/50 transition"
                      >
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="h-16 w-16 rounded-xl object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                            {p.brand} • {p.volume}
                          </div>
                          <div className="truncate text-sm font-bold">
                            {p.name}
                          </div>
                          <div className="mt-1 text-sm font-bold text-[#064E3B] dark:text-[#D4AF37] tabular-nums">
                            {formatSom(p.price)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Purchases & Discounts Summary inside Profile */}
                <div className="md:col-span-6 rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-serif-luxury text-lg font-bold">
                      Xaridlar tarixi
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("purchases")}
                      className="text-xs font-semibold text-[#047857] dark:text-[#D4AF37] hover:underline cursor-pointer"
                    >
                      Barchasi ({purchases.length}) →
                    </button>
                  </div>
                  {purchases.length === 0 ? (
                    <p className="text-xs text-neutral-500">
                      Hozircha xaridlar mavjud emas.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {purchases.slice(0, 3).map((s) => (
                        <div
                          key={s.id}
                          className="flex justify-between rounded-xl bg-neutral-50 dark:bg-neutral-800/60 px-3.5 py-2 text-xs"
                        >
                          <span className="tabular-nums">
                            #{s.saleCode} • {formatDateUZ(s.createdAt)}
                          </span>
                          <span className="font-bold tabular-nums text-[#064E3B] dark:text-[#D4AF37]">
                            {formatSom(s.finalAmount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="md:col-span-6 rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-serif-luxury text-lg font-bold">
                      Chegirmalar tarixi
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("discounts")}
                      className="text-xs font-semibold text-[#047857] dark:text-[#D4AF37] hover:underline cursor-pointer"
                    >
                      Barchasi ({discounts.length}) →
                    </button>
                  </div>
                  {discounts.length === 0 ? (
                    <p className="text-xs text-neutral-500">
                      Hozircha qo‘llanilgan chegirmalar yo‘q.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {discounts.slice(0, 3).map((d) => (
                        <div
                          key={d.id}
                          className="flex justify-between rounded-xl bg-neutral-50 dark:bg-neutral-800/60 px-3.5 py-2 text-xs"
                        >
                          <span className="tabular-nums">
                            {formatDateUZ(d.createdAt)} • {d.discountPercent}%
                          </span>
                          <span className="font-bold tabular-nums text-[#047857] dark:text-emerald-400">
                            {d.discountAmount > 0
                              ? `-${formatSom(d.discountAmount)}`
                              : `${d.discountPercent}% kupon`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: BONUSLARIM */}
            {activeTab === "bonuses" && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white dark:bg-neutral-900 p-5 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
                    <div className="text-xs text-neutral-500">
                      Mavjud bonus balansim
                    </div>
                    <div className="mt-1 text-2xl font-bold text-[#064E3B] dark:text-[#D4AF37] tabular-nums">
                      {formatGrams(customer.bonusGrams)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-neutral-900 p-5 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
                    <div className="text-xs text-neutral-500">
                      Jami olingan bonuslar
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">
                      {formatGrams(customer.totalBonusEarnedGrams)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-neutral-900 p-5 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
                    <div className="text-xs text-neutral-500">
                      Ishlatilgan bonuslar
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">
                      {formatGrams(customer.totalBonusUsedGrams)}
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
                  <h3 className="font-serif-luxury text-xl font-bold mb-4">
                    Bonus operatsiyalari tarixi
                  </h3>
                  {bonuses.length === 0 ? (
                    <p className="text-sm text-neutral-500 py-6 text-center">
                      Hozircha bonus operatsiyalari mavjud emas.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {bonuses.map((b) => (
                        <div
                          key={b.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-4"
                        >
                          <div>
                            <div className="text-sm font-semibold">
                              {b.description}
                            </div>
                            <div className="text-xs text-neutral-500 mt-0.5 tabular-nums">
                              Sana: {formatDateUZ(b.createdAt)}
                              {b.expiresAt
                                ? ` • Amal qilish muddati: ${formatDateUZ(b.expiresAt)}`
                                : ""}
                            </div>
                          </div>
                          <div
                            className={`text-base font-bold tabular-nums ${
                              b.amountGrams >= 0
                                ? "text-[#047857] dark:text-emerald-400"
                                : "text-amber-600"
                            }`}
                          >
                            {b.amountGrams > 0 ? "+" : ""}
                            {formatGrams(b.amountGrams)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: VIP MAQOMIM */}
            {activeTab === "vip" && (
              <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 sm:p-8 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                      <Crown className="h-4 w-4" />
                      <span>AYUB VIP PRIVILEGE</span>
                    </div>
                    <h3 className="mt-1 font-serif-luxury text-2xl font-bold">
                      {customer.isVip
                        ? "Siz rasmiy VIP Mijoz maqomidasiz!"
                        : "VIP maqom sari yo‘lingiz"}
                    </h3>
                  </div>
                  <span
                    className={`self-start rounded-xl px-4 py-2 text-xs font-bold ${
                      customer.isVip
                        ? "bg-[#D4AF37] text-[#111827]"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    {customer.isVip
                      ? `VIP sana: ${formatDateUZ(customer.vipSince)}`
                      : `Jarayon: ${vipProgress}%`}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-2 tabular-nums">
                    <span>Joriy xarid: {formatSom(customer.totalSpent)}</span>
                    <span>VIP chegara: {formatSom(vipTarget)}</span>
                  </div>
                  <div className="h-3.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#064E3B] via-[#047857] to-[#D4AF37] transition-all duration-500"
                      style={{ width: `${vipProgress}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
                    <Award className="h-5 w-5 text-[#D4AF37]" />
                    <div className="mt-2 font-bold">
                      {branding?.vipDiscountPercent ?? 45}% gacha maxsus chegirma
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {formatSom(branding?.discountThresholdAmount ?? 250000)} dan
                      yuqori barcha xaridlaringiz uchun amal qiladi.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
                    <Sparkles className="h-5 w-5 text-[#047857]" />
                    <div className="mt-2 font-bold">
                      Yopiq kolleksiya va ustuvor xabarnoma
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      Yangi Niche atirlar kelganda birinchilardan bo‘lib maxsus
                      taklif olasiz.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CHEGIRMALARIM */}
            {activeTab === "discounts" && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-gradient-to-br from-[#064E3B] to-[#047857] p-6 text-white shadow-md">
                    <div className="text-xs uppercase tracking-wider text-emerald-200">
                      Doimiy klub chegirmangiz
                    </div>
                    <div className="mt-2 text-3xl font-bold text-[#D4AF37] tabular-nums">
                      {customer.isVip
                        ? `${branding?.vipDiscountPercent ?? 45}%`
                        : `${branding?.regularDiscountPercent ?? 30}%`}{" "}
                      gacha
                    </div>
                    <p className="mt-2 text-xs text-emerald-100">
                      {formatSom(branding?.discountThresholdAmount ?? 250000)} dan
                      yuqori xaridda avtomatik hisoblanadi.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
                    <div className="text-xs uppercase tracking-wider text-neutral-500">
                      Shaxsiy kupon chegirma
                    </div>
                    <div className="mt-2 text-3xl font-bold tabular-nums">
                      {customer.customDiscountPercent
                        ? `${customer.customDiscountPercent}%`
                        : "Yo‘q"}
                    </div>
                    <p className="mt-2 text-xs text-neutral-500">
                      {customer.customDiscountPercent
                        ? "Keyingi xaridingizda kassada avtomatik qo‘llanadi!"
                        : "Maxsus aksiyalarda shaxsiy chegirma shu yerda ko‘rinadi."}
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
                  <h3 className="font-serif-luxury text-xl font-bold mb-4">
                    Qo‘llanilgan chegirmalar tarixi
                  </h3>
                  {discounts.length === 0 ? (
                    <p className="text-sm text-neutral-500 py-6 text-center">
                      Hozircha chegirmalar tarixi bo‘sh.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {discounts.map((d) => (
                        <div
                          key={d.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-4"
                        >
                          <div>
                            <div className="text-sm font-bold">
                              {d.discountPercent}% chegirma ({d.ruleApplied})
                            </div>
                            <div className="text-xs text-neutral-500 tabular-nums">
                              Sana: {formatDateUZ(d.createdAt)}
                              {d.notes ? ` • ${d.notes}` : ""}
                            </div>
                          </div>
                          {d.discountAmount > 0 && (
                            <div className="text-sm font-bold text-[#047857] dark:text-[#D4AF37] tabular-nums">
                              Tejaldi: {formatSom(d.discountAmount)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: XARIDLAR TARIXIM */}
            {activeTab === "purchases" && (
              <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-serif-luxury text-xl font-bold flex items-center gap-2">
                    <History className="h-5 w-5 text-[#047857]" />
                    <span>Mening xaridlarim tarixi</span>
                  </h3>
                  <span className="text-xs font-semibold text-neutral-500 tabular-nums">
                    Jami: {purchases.length} ta chek
                  </span>
                </div>

                {purchases.length === 0 ? (
                  <p className="text-sm text-neutral-500 py-8 text-center">
                    Hozircha xaridlar qayd etilmagan.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {purchases.map((sale) => (
                      <div
                        key={sale.id}
                        className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                          <div>
                            <span className="text-xs font-bold text-[#064E3B] dark:text-[#D4AF37] tabular-nums">
                              #{sale.saleCode}
                            </span>
                            <span className="mx-2 text-neutral-300">•</span>
                            <span className="text-xs text-neutral-500 tabular-nums">
                              Sana: {formatDateUZ(sale.createdAt)}
                            </span>
                            <span className="mx-2 text-neutral-300">•</span>
                            <span className="text-xs text-neutral-500">
                              Kassir: {sale.cashierName}
                            </span>
                          </div>
                          <div className="text-base font-bold text-[#111827] dark:text-white tabular-nums">
                            Yakuniy: {formatSom(sale.finalAmount)}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {sale.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-wrap items-center justify-between gap-2 text-sm"
                            >
                              <div>
                                <span className="font-semibold">
                                  {item.productName}
                                </span>{" "}
                                <span className="text-xs text-neutral-500">
                                  ({item.volume}) × {item.quantity} dona
                                </span>
                              </div>
                              <div className="text-xs sm:text-sm tabular-nums text-neutral-600 dark:text-neutral-300">
                                Narxi: {formatSom(item.unitPrice)}
                                {item.discountPercent > 0 && (
                                  <span className="ml-2 text-[#047857] dark:text-[#D4AF37] font-semibold">
                                    (-{item.discountPercent}%)
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {(sale.discountAmount > 0 ||
                          sale.bonusGramsEarned > 0 ||
                          sale.bonusGramsUsed > 0) && (
                          <div className="flex flex-wrap gap-3 pt-2 text-xs">
                            {sale.discountAmount > 0 && (
                              <span className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 font-semibold text-[#047857] dark:text-emerald-300 tabular-nums">
                                Chegirma: -{formatSom(sale.discountAmount)} (
                                {sale.discountPercent}%)
                              </span>
                            )}
                            {sale.bonusGramsEarned > 0 && (
                              <span className="rounded-lg bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 font-semibold text-amber-700 dark:text-[#D4AF37] tabular-nums">
                                Olingan bonus: +{formatGrams(sale.bonusGramsEarned)}
                              </span>
                            )}
                            {sale.bonusGramsUsed > 0 && (
                              <span className="rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">
                                Ishlatilgan bonus: -
                                {formatGrams(sale.bonusGramsUsed)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Luxury Store Quick Connect Strip */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-8">
        <div className="rounded-3xl bg-white dark:bg-neutral-900 p-5 sm:p-6 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#047857] dark:text-[#D4AF37]">
              Rasmiy Aloqa va Bot
            </div>
            <div className="font-serif-luxury text-lg font-bold">
              {branding?.storeName || "AYUB PARFUM"} bilan doimo aloqada bo‘ling
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <a
              href="https://t.me/ayub_club_uz_bot"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#064E3B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#047857] transition"
            >
              <MessageCircle className="h-4 w-4 text-[#D4AF37]" />
              <span>Telegram Bot (@ayub_club_uz_bot)</span>
            </a>

            {branding?.instagramUrl && (
              <a
                href={branding.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 px-4 py-2.5 text-xs font-bold hover:border-[#D4AF37] transition"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
                <span>Instagram</span>
              </a>
            )}

            {branding?.storePhone && (
              <a
                href={`tel:${branding.storePhone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 px-4 py-2.5 text-xs font-bold tabular-nums hover:border-[#047857] transition"
              >
                <Phone className="h-3.5 w-3.5 text-[#047857]" />
                <span>{branding.storePhone}</span>
              </a>
            )}
          </div>
        </div>
      </section>

      <footer
        suppressHydrationWarning
        className="border-t border-neutral-200 dark:border-neutral-800 py-5 text-center text-xs text-neutral-500"
      >
        © 2026 {branding?.clubName || "AYUB CLUB PRO"} —{" "}
        {branding?.storeName || "AYUB PARFUM"}. Barcha huquqlar himoyalangan.
      </footer>
    </div>
  );
}
