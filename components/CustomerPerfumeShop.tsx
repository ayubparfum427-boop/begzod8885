"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Compass,
  CreditCard,
  Droplets,
  ExternalLink,
  Flame,
  Heart,
  ImagePlus,
  Package,
  QrCode,
  Search,
  ShoppingBag,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { formatDateTimeUZ, formatSom } from "@/lib/format";
import { customerFetch } from "@/lib/client-auth";

export interface CatalogProduct {
  id: number;
  productCode: string;
  name: string;
  brand: string;
  category: string;
  volume: string;
  bottleVolumeMl: number;
  stockMl: number;
  price: number;
  razlivPricePerGram: number;
  razlivSizes: string;
  allowBottleSale: boolean;
  allowRazlivSale: boolean;
  imageUrl: string;
  description: string | null;
}

export interface CustomerOrderItem {
  id: number;
  orderCode: string;
  productName: string;
  brand: string;
  saleMode: string;
  selectedGramsOrQty: number;
  deductedMl: number;
  finalAmount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export function CustomerPerfumeShop({
  products,
  orders = [],
  isAuthenticated,
  isVip,
  customDiscountPercent,
  discountThresholdAmount = 250000,
  regularDiscountPercent = 30,
  vipDiscountPercent = 45,
  paynetQrPng,
  paynetPaymentUrl,
  paynetMerchantTitle,
  paynetInstructions,
  cashInstructions,
  onRequireAuth,
  onOrderSuccess,
}: {
  products: CatalogProduct[];
  orders?: CustomerOrderItem[];
  isAuthenticated: boolean;
  isVip?: boolean;
  customDiscountPercent?: number | null;
  discountThresholdAmount?: number;
  regularDiscountPercent?: number;
  vipDiscountPercent?: number;
  paynetQrPng?: string;
  paynetPaymentUrl?: string;
  paynetMerchantTitle?: string;
  paynetInstructions?: string;
  cashInstructions?: string;
  onRequireAuth: () => void;
  onOrderSuccess: (payload: {
    message: string;
    featuredProducts?: CatalogProduct[];
    portalData?: unknown;
  }) => void;
}) {
  const [selectedProd, setSelectedProd] = useState<CatalogProduct | null>(null);
  const [saleMode, setSaleMode] = useState<"BOTTLE" | "RAZLIV">("BOTTLE");
  const [bottleQty, setBottleQty] = useState(1);
  const [selectedGrams, setSelectedGrams] = useState<number>(10);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "PAYNET">("CASH");
  const [receiptDataUrl, setReceiptDataUrl] = useState<string>("");
  const [receiptNote, setReceiptNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalErr, setModalErr] = useState("");

  // Catalog discovery, search, category filter, favorites & Smart Scent Finder
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Barchasi");
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [showScentQuiz, setShowScentQuiz] = useState(false);
  const [quizMood, setQuizMood] = useState<
    "oud" | "fresh" | "floral" | "woody"
  >("oud");
  const [quizFormat, setQuizFormat] = useState<"ANY" | "RAZLIV" | "BOTTLE">(
    "ANY"
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("ayub_fav_perfumes");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setFavoriteIds(parsed);
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  function toggleFavorite(id: number) {
    setFavoriteIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      try {
        window.localStorage.setItem("ayub_fav_perfumes", JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }

  // Smart Scent Advisor matching against live warehouse inventory
  const recommendedPerfume = React.useMemo(() => {
    const available = products.filter((p) => Number(p.stockMl || 0) > 0);
    if (available.length === 0) return null;

    const keywords: Record<typeof quizMood, string[]> = {
      oud: ["oud", "ud", "amber", "qahrabo", "za’faron", "niche", "baccarat"],
      fresh: ["musk", "mushk", "blue", "bergamot", "aventus", "toza"],
      floral: ["rose", "atirgul", "vanil", "velvet", "ayollar"],
      woody: ["santal", "sandal", "kedr", "charm", "erkaklar", "gold"],
    };
    const words = keywords[quizMood];

    const scored = available.map((p) => {
      const hay = `${p.name} ${p.brand} ${p.category} ${
        p.description || ""
      }`.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (hay.includes(w)) score += 3;
      }
      if (
        quizFormat === "BOTTLE" &&
        Number(p.stockMl) >= Number(p.bottleVolumeMl || 100)
      ) {
        score += 2;
      }
      if (quizFormat === "RAZLIV" && p.allowRazlivSale) {
        score += 2;
      }
      return { p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.p || available[0];
  }, [products, quizMood, quizFormat]);

  const categories = [
    "Barchasi",
    "Niche",
    "Erkaklar",
    "Ayollar",
    "Uniseks",
    "Yog‘li atir",
    "Sevimlilar",
  ];

  const filteredProducts = products.filter((p) => {
    if (activeCategory === "Sevimlilar" && !favoriteIds.includes(p.id)) {
      return false;
    }
    if (
      activeCategory !== "Barchasi" &&
      activeCategory !== "Sevimlilar" &&
      p.category.toLowerCase() !== activeCategory.toLowerCase()
    ) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const hay = `${p.name} ${p.brand} ${p.category} ${
        p.description || ""
      }`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  function openProductModal(p: CatalogProduct) {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }

    const bottleMl = Math.max(1, Number(p.bottleVolumeMl || 100));
    const stockMl = Math.max(0, Number(p.stockMl || 0));
    const canBuyBottle = p.allowBottleSale && stockMl >= bottleMl;

    const sizes = (p.razlivSizes || "5,10,20,30,50")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => n > 0);
    const firstAvailableGram =
      sizes.find((g) => g <= stockMl) || Math.min(5, Math.max(1, stockMl));

    setSelectedProd(p);
    setSaleMode(canBuyBottle ? "BOTTLE" : "RAZLIV");
    setBottleQty(1);
    setSelectedGrams(firstAvailableGram);
    setPaymentMethod("CASH");
    setReceiptDataUrl("");
    setReceiptNote("");
    setModalErr("");
  }

  function handleReceiptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 900;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, w, h);
        setReceiptDataUrl(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  // Live price & loyalty discount preview inside customer modal
  const bottleMl = Math.max(1, Number(selectedProd?.bottleVolumeMl || 100));
  const stockMl = Math.max(0, Number(selectedProd?.stockMl || 0));
  const maxBottles = Math.floor(stockMl / bottleMl);
  const isBottleDepleted = stockMl < bottleMl;

  const subtotal = selectedProd
    ? saleMode === "BOTTLE"
      ? Number(selectedProd.price) * bottleQty
      : Math.round(
          selectedGrams * Number(selectedProd.razlivPricePerGram || 0)
        )
    : 0;

  let discountPct = 0;
  if (subtotal > discountThresholdAmount) {
    discountPct = isVip ? vipDiscountPercent : regularDiscountPercent;
  }
  if (customDiscountPercent && customDiscountPercent > discountPct && subtotal >= discountThresholdAmount) {
    discountPct = customDiscountPercent;
  }
  const discountAmt = Math.round((subtotal * discountPct) / 100);
  const finalAmount = Math.max(0, subtotal - discountAmt);

  const parsedSizes = selectedProd
    ? (selectedProd.razlivSizes || "5,10,20,30,50")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => n > 0)
    : [5, 10, 20, 30, 50];

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProd) return;
    setModalErr("");

    if (paymentMethod === "PAYNET" && !receiptDataUrl) {
      setModalErr(
        "Paynet QR orqali to‘lov tanlanganda to‘lov chekini (rasm / skrinshotni) yuklash shart!"
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await customerFetch("/api/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_order",
          productId: selectedProd.id,
          saleMode,
          quantity: bottleQty,
          grams: selectedGrams,
          paymentMethod,
          receiptImageData: receiptDataUrl || null,
          receiptNote,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setModalErr(data.error || "Buyurtma berishda xatolik yuz berdi.");
        return;
      }

      setSelectedProd(null);
      onOrderSuccess({
        message: data.message,
        featuredProducts: data.featuredProducts,
        portalData: data.portalData,
      });
    } catch {
      setModalErr("Server bilan bog‘lanishda xatolik yuz berdi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header + Smart Scent Finder Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif-luxury text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#D4AF37]" />
            <span>Atirlar vitrinasi (Butun flakon va Razliv)</span>
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500">
            Istalgan atirni tanlang — butun flakon yoki razliv (gr) hajmda naqd
            yoki Paynet QR skaner orqali xarid qiling.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowScentQuiz(!showScentQuiz)}
          className="inline-flex items-center gap-2 self-start rounded-2xl bg-gradient-to-r from-[#064E3B] to-[#047857] px-4 py-2.5 text-xs font-bold text-white shadow-md ring-1 ring-[#D4AF37]/50 hover:opacity-95 transition cursor-pointer"
        >
          <Wand2 className="h-4 w-4 text-[#D4AF37]" />
          <span>
            {showScentQuiz
              ? "Ifor tanlash testini yopish"
              : "✨ Menga mos iforni topish"}
          </span>
        </button>
      </div>

      {/* Interactive Smart Scent Advisor Panel */}
      {showScentQuiz && (
        <div className="rounded-3xl bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#111827] p-6 text-white shadow-xl ring-1 ring-[#D4AF37]/50 space-y-5 animate-fade-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
              <Compass className="h-4 w-4" />
              <span>AYUB PARFUM — Shaxsiy Parfyumer Tavsiyasi</span>
            </div>
            <button
              type="button"
              onClick={() => setShowScentQuiz(false)}
              className="text-xs text-emerald-200 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-12 items-center">
            <div className="md:col-span-7 space-y-3">
              <div className="text-sm font-bold">
                1. Qanday kayfiyat va ifor notalarini yoqtirasiz?
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "oud", label: "👑 Qirollik Ud va Qahrabo" },
                  { id: "fresh", label: "🌊 Toza Mushk va Svezhiy" },
                  { id: "floral", label: "🌹 Atirgul va Shirin Vanil" },
                  { id: "woody", label: "🌲 Sandal va Klassik Charm" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setQuizMood(
                        m.id as "oud" | "fresh" | "floral" | "woody"
                      )
                    }
                    className={`rounded-xl px-3 py-2.5 text-left text-xs font-bold transition cursor-pointer ${
                      quizMood === m.id
                        ? "bg-[#D4AF37] text-[#111827] shadow-md"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { id: "ANY", label: "Barcha format" },
                  { id: "RAZLIV", label: "💧 Razliv sinab ko‘rish" },
                  { id: "BOTTLE", label: "🍾 Sovg‘abop butun flakon" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() =>
                      setQuizFormat(f.id as "ANY" | "RAZLIV" | "BOTTLE")
                    }
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold cursor-pointer ${
                      quizFormat === f.id
                        ? "bg-white text-[#064E3B]"
                        : "bg-black/25 text-emerald-100"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {recommendedPerfume && (
              <div className="md:col-span-5 rounded-2xl bg-white/10 backdrop-blur-md p-4 ring-1 ring-[#D4AF37]/40 flex items-center gap-3.5">
                <img
                  src={recommendedPerfume.imageUrl}
                  alt={recommendedPerfume.name}
                  className="h-20 w-20 rounded-2xl object-cover shrink-0 ring-1 ring-[#D4AF37]"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
                    Siz uchun ideal tanlov
                  </div>
                  <div className="font-serif-luxury text-base font-bold truncate">
                    {recommendedPerfume.name}
                  </div>
                  <div className="text-xs text-emerald-100 tabular-nums">
                    Flakon: {formatSom(recommendedPerfume.price)} • Razliv:{" "}
                    {formatSom(recommendedPerfume.razlivPricePerGram)}/gr
                  </div>
                  <button
                    type="button"
                    onClick={() => openProductModal(recommendedPerfume)}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-[#D4AF37] px-3.5 py-1.5 text-xs font-bold text-[#111827] cursor-pointer"
                  >
                    <span>Tanlash →</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                  active
                    ? "bg-[#064E3B] text-white shadow-xs"
                    : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 ring-1 ring-neutral-200 dark:ring-neutral-800 hover:ring-[#D4AF37]"
                }`}
              >
                {cat === "Sevimlilar" && (
                  <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
                )}
                <span>
                  {cat}
                  {cat === "Sevimlilar" && favoriteIds.length > 0
                    ? ` (${favoriteIds.length})`
                    : ""}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[230px]">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Atir yoki ifor izlash..."
            className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 py-2 pl-9 pr-3.5 text-xs focus:border-[#047857] focus:outline-none"
          />
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-neutral-900 p-10 text-center text-sm text-neutral-500 ring-1 ring-neutral-200 dark:ring-neutral-800">
          Tanlangan filtr bo‘yicha atirlar topilmadi.
        </div>
      ) : (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredProducts.map((p, idx) => {
          const pBottleMl = Math.max(1, Number(p.bottleVolumeMl || 100));
          const pStockMl = Math.max(0, Number(p.stockMl || 0));
          const bottleFinished = pStockMl < pBottleMl;
          const totallyOut = pStockMl <= 0;
          const isFav = favoriteIds.includes(p.id);
          const liquidPct = Math.min(
            100,
            Math.max(5, Math.round((pStockMl / (pBottleMl * 2)) * 100))
          );

          return (
            <div
              key={p.id}
              className="group overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800 hover:ring-[#D4AF37] transition flex flex-col justify-between"
            >
              <div>
                <div className="relative h-48 w-full overflow-hidden">
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute left-3 top-3 flex items-center gap-1.5">
                    <span className="rounded-lg bg-black/75 px-2.5 py-1 text-[11px] font-bold text-[#D4AF37]">
                      {p.category}
                    </span>
                    {idx < 2 && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-[#D4AF37] px-2 py-1 text-[10px] font-bold text-[#111827]">
                        <Flame className="h-3 w-3" /> XIT
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleFavorite(p.id)}
                    aria-label="Sevimlilarga qo‘shish"
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-neutral-600 shadow-sm hover:scale-110 transition cursor-pointer"
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        isFav ? "fill-rose-500 text-rose-500" : ""
                      }`}
                    />
                  </button>

                  <span className="absolute right-3 bottom-3 rounded-lg bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white tabular-nums backdrop-blur-xs">
                    Ombor: {pStockMl} ml
                  </span>
                </div>

                <div className="p-5 space-y-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                      {p.brand}
                    </div>
                    <h3 className="font-serif-luxury text-lg font-bold">
                      {p.name}
                    </h3>
                    {p.description && (
                      <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">
                        {p.description}
                      </p>
                    )}
                  </div>

                  {/* Two Separate Prices Preview */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div
                      className={`rounded-xl p-2.5 ${
                        bottleFinished
                          ? "bg-neutral-100 dark:bg-neutral-800 opacity-65"
                          : "bg-emerald-50/80 dark:bg-emerald-950/40"
                      }`}
                    >
                      <div className="text-[10px] font-semibold text-neutral-500">
                        🍾 Butun flakon ({pBottleMl} ml)
                      </div>
                      <div className="mt-0.5 text-sm font-bold text-[#064E3B] dark:text-emerald-300 tabular-nums">
                        {bottleFinished ? "Tugadi" : formatSom(p.price)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/40 p-2.5">
                      <div className="text-[10px] font-semibold text-neutral-500">
                        💧 Razliv (1 gr)
                      </div>
                      <div className="mt-0.5 text-sm font-bold text-amber-800 dark:text-[#D4AF37] tabular-nums">
                        {totallyOut
                          ? "Tugadi"
                          : formatSom(p.razlivPricePerGram)}
                      </div>
                    </div>
                  </div>

                  {totallyOut ? (
                    <div className="rounded-xl bg-red-50 dark:bg-red-950/50 px-3 py-2 text-xs font-bold text-red-600">
                      Omborda atir to‘liq tugadi
                    </div>
                  ) : bottleFinished ? (
                    <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 px-3 py-2 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Omborda butun flakon atir tugadi (Razliv: {pStockMl} gr
                        bor)
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="px-5 pb-5">
                {/* Visual Liquid Saturation Meter */}
                <div className="mb-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      style={{ width: `${totallyOut ? 0 : liquidPct}%` }}
                      className={`h-full rounded-full transition-all ${
                        bottleFinished
                          ? "bg-amber-500"
                          : "bg-gradient-to-r from-[#064E3B] to-[#D4AF37]"
                      }`}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={totallyOut}
                  onClick={() => openProductModal(p)}
                  className="w-full rounded-xl bg-gradient-to-r from-[#064E3B] to-[#047857] py-3 text-xs sm:text-sm font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-40 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingBag className="h-4 w-4 text-[#D4AF37]" />
                  <span>
                    {totallyOut
                      ? "Tugagan"
                      : isAuthenticated
                      ? "Tanlash va To‘lov qilish"
                      : "Xarid uchun ro‘yxatdan o‘tish"}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Customer's Own Recent Orders & Payment Receipts */}
      {isAuthenticated && orders.length > 0 && (
        <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-3">
          <h3 className="font-serif-luxury text-lg font-bold">
            Mening buyurtmalarim va to‘lovlarim holati
          </h3>
          <div className="space-y-2.5">
            {orders.map((ord) => (
              <div
                key={ord.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-3.5 text-xs sm:text-sm"
              >
                <div>
                  <span className="font-bold text-[#064E3B] dark:text-[#D4AF37] tabular-nums">
                    #{ord.orderCode}
                  </span>{" "}
                  — <span className="font-semibold">{ord.productName}</span> (
                  {ord.saleMode === "RAZLIV"
                    ? `Razliv ${ord.selectedGramsOrQty} gr`
                    : `Butun flakon × ${ord.selectedGramsOrQty}`}
                  )
                  <div className="text-[11px] text-neutral-500 mt-0.5 tabular-nums">
                    {formatDateTimeUZ(ord.createdAt)} • To‘lov:{" "}
                    {ord.paymentMethod === "PAYNET"
                      ? "Paynet QR (Chek yuborildi)"
                      : "Naqd (Joyida)"}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-bold tabular-nums">
                    {formatSom(ord.finalAmount)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      ord.status === "APPROVED"
                        ? "bg-emerald-100 text-[#064E3B]"
                        : ord.status === "REJECTED"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {ord.status === "APPROVED"
                      ? "Tasdiqlandi ✓"
                      : ord.status === "REJECTED"
                      ? "Bekor qilindi"
                      : "Tekshirilmoqda..."}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= PRODUCT SELECTION & PAYMENT MODAL ================= */}
      {selectedProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSubmitOrder}
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white dark:bg-neutral-900 p-6 sm:p-7 shadow-2xl ring-1 ring-[#D4AF37]/40 space-y-5"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={selectedProd.imageUrl}
                  alt={selectedProd.name}
                  className="h-16 w-16 rounded-2xl object-cover ring-1 ring-[#D4AF37]/40 shrink-0"
                />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#047857] dark:text-[#D4AF37]">
                    {selectedProd.brand} • Ombor qoldig‘i: {stockMl} ml
                  </div>
                  <h3 className="font-serif-luxury text-xl font-bold">
                    {selectedProd.name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProd(null)}
                className="rounded-xl p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalErr && (
              <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">
                {modalErr}
              </div>
            )}

            {/* STEP 1: CHOOSE BUTUN FLAKON OR RAZLIV */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                1. Xarid turini tanlang: Butun flakon yoki Razliv
              </label>

              {isBottleDepleted && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-3.5 py-2.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Omborda butun flakon atir tugadi! ({bottleMl} ml kerak,
                    omborda {stockMl} ml razliv qoldi).
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!selectedProd.allowBottleSale || isBottleDepleted}
                  onClick={() => setSaleMode("BOTTLE")}
                  className={`rounded-2xl border-2 p-3.5 text-left transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                    saleMode === "BOTTLE"
                      ? "border-[#064E3B] bg-emerald-50/70 dark:border-[#D4AF37] dark:bg-emerald-950/40"
                      : "border-neutral-200 dark:border-neutral-800"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <Package className="h-4 w-4 text-[#047857]" />
                    <span>Butun flakon ({bottleMl} ml)</span>
                  </div>
                  <div className="mt-1 text-base font-bold text-[#064E3B] dark:text-[#D4AF37] tabular-nums">
                    {isBottleDepleted
                      ? "Tugadi!"
                      : formatSom(selectedProd.price)}
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!selectedProd.allowRazlivSale || stockMl < 1}
                  onClick={() => setSaleMode("RAZLIV")}
                  className={`rounded-2xl border-2 p-3.5 text-left transition cursor-pointer disabled:opacity-45 ${
                    saleMode === "RAZLIV"
                      ? "border-[#064E3B] bg-emerald-50/70 dark:border-[#D4AF37] dark:bg-emerald-950/40"
                      : "border-neutral-200 dark:border-neutral-800"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <Droplets className="h-4 w-4 text-[#D4AF37]" />
                    <span>Razliv (gramm / ml)</span>
                  </div>
                  <div className="mt-1 text-base font-bold text-[#064E3B] dark:text-[#D4AF37] tabular-nums">
                    1 gr = {formatSom(selectedProd.razlivPricePerGram)}
                  </div>
                </button>
              </div>

              {/* Quantity or Grams Selector */}
              {saleMode === "BOTTLE" ? (
                <div className="flex items-center justify-between rounded-2xl bg-neutral-50 dark:bg-neutral-800/70 px-4 py-3">
                  <span className="text-xs font-semibold">
                    Butun flakon soni (mavjud: {maxBottles} dona):
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBottleQty(Math.max(1, bottleQty - 1))}
                      className="h-8 w-8 rounded-lg border border-neutral-300 dark:border-neutral-600 font-bold cursor-pointer"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-bold tabular-nums">
                      {bottleQty}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setBottleQty(Math.min(maxBottles, bottleQty + 1))
                      }
                      className="h-8 w-8 rounded-lg border border-neutral-300 dark:border-neutral-600 font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800/70 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>Razliv hajmini tanlang (gr / ml):</span>
                    <span className="text-[#047857] dark:text-[#D4AF37] tabular-nums">
                      Maksimal: {stockMl} gr
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {parsedSizes.map((g) => {
                      const disabled = g > stockMl;
                      const active = selectedGrams === g;
                      return (
                        <button
                          key={g}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSelectedGrams(g)}
                          className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer disabled:opacity-35 ${
                            active
                              ? "bg-[#064E3B] text-white ring-2 ring-[#D4AF37]"
                              : "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
                          }`}
                        >
                          {g} gr —{" "}
                          {formatSom(
                            Math.round(
                              g * Number(selectedProd.razlivPricePerGram || 0)
                            )
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-neutral-500">
                      Boshqa gramm kiritish:
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={stockMl}
                      value={selectedGrams}
                      onChange={(e) =>
                        setSelectedGrams(
                          Math.min(
                            stockMl,
                            Math.max(1, Number(e.target.value || 1))
                          )
                        )
                      }
                      className="w-24 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs font-bold tabular-nums"
                    />
                    <span className="text-xs font-semibold">gr</span>
                  </div>
                </div>
              )}
            </div>

            {/* Price Summary Strip */}
            <div className="rounded-2xl bg-gradient-to-r from-[#064E3B] to-[#047857] p-4 text-white space-y-1.5">
              <div className="flex justify-between text-xs text-emerald-100">
                <span>Hisoblangan narx:</span>
                <span className="tabular-nums">{formatSom(subtotal)}</span>
              </div>
              {discountPct > 0 && (
                <div className="flex justify-between text-xs text-[#D4AF37] font-semibold">
                  <span>Klub chegirmangiz (-{discountPct}%):</span>
                  <span className="tabular-nums">-{formatSom(discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-1 border-t border-white/15">
                <span>To‘lanadigan yakuniy summa:</span>
                <span className="text-[#D4AF37] tabular-nums">
                  {formatSom(finalAmount)}
                </span>
              </div>
            </div>

            {/* STEP 2: PAYMENT METHOD (CASH vs PAYNET QR + RECEIPT) */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                2. To‘lov usulini tanlang
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  className={`rounded-2xl border-2 p-3.5 text-left transition cursor-pointer ${
                    paymentMethod === "CASH"
                      ? "border-[#064E3B] bg-emerald-50/70 dark:border-[#D4AF37] dark:bg-emerald-950/40"
                      : "border-neutral-200 dark:border-neutral-800"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <Banknote className="h-4 w-4 text-[#047857]" />
                    <span>Naqd (Joyida to‘lash)</span>
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Do‘konda qabul qilayotganda to‘lash
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("PAYNET")}
                  className={`rounded-2xl border-2 p-3.5 text-left transition cursor-pointer ${
                    paymentMethod === "PAYNET"
                      ? "border-[#064E3B] bg-emerald-50/70 dark:border-[#D4AF37] dark:bg-emerald-950/40"
                      : "border-neutral-200 dark:border-neutral-800"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <CreditCard className="h-4 w-4 text-[#D4AF37]" />
                    <span>Paynet orqali (QR)</span>
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    QR skaner qilib chekni yuborish
                  </p>
                </button>
              </div>

              {paymentMethod === "CASH" ? (
                <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50 p-3.5 text-xs text-neutral-600 dark:text-neutral-300">
                  {cashInstructions ||
                    "Buyurtmangiz band qilinadi — atirni do‘kondan olayotganda kassaga naqd to‘lashingiz mumkin."}
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-[#D4AF37]/60 bg-neutral-50 dark:bg-neutral-950/70 p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {paynetQrPng ? (
                      <div className="rounded-2xl bg-white p-2.5 shadow-md shrink-0">
                        <img
                          src={paynetQrPng}
                          alt="Paynet QR"
                          className="h-36 w-36"
                        />
                      </div>
                    ) : (
                      <div className="flex h-36 w-36 items-center justify-center rounded-2xl bg-neutral-200 dark:bg-neutral-800 text-xs">
                        <QrCode className="h-8 w-8 text-neutral-400" />
                      </div>
                    )}

                    <div className="space-y-2 text-center sm:text-left">
                      <div className="text-xs font-bold text-[#064E3B] dark:text-[#D4AF37]">
                        {paynetMerchantTitle ||
                          "AYUB PARFUM — Rasmiy Paynet To‘lov"}
                      </div>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                        {paynetInstructions ||
                          "Paynet ilovasi yoki kamera orqali QR-kodni skanerlab to‘lov qiling va to‘lov chekini pastga yuklang."}
                      </p>
                      {paynetPaymentUrl && (
                        <a
                          href={paynetPaymentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#047857] dark:text-[#D4AF37] underline"
                        >
                          <span>Paynet havolasini ochish</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Receipt Upload */}
                  <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3 space-y-2.5">
                    <label className="block text-xs font-bold">
                      To‘lov cheki (skrinshot / rasm) ni yuklang:
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#047857] cursor-pointer">
                        <ImagePlus className="h-4 w-4 text-[#D4AF37]" />
                        <span>
                          {receiptDataUrl
                            ? "Boshqa chek tanlash"
                            : "Chek rasmini tanlash"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptFile}
                          className="hidden"
                        />
                      </label>

                      {receiptDataUrl && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#047857] dark:text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" /> Chek biriktirildi!
                        </span>
                      )}
                    </div>

                    {receiptDataUrl && (
                      <img
                        src={receiptDataUrl}
                        alt="Yuklangan chek"
                        className="max-h-36 rounded-xl border border-neutral-200 object-contain"
                      />
                    )}

                    <input
                      type="text"
                      value={receiptNote}
                      onChange={(e) => setReceiptNote(e.target.value)}
                      placeholder="Ixtiyoriy izoh (masalan: to‘lovchi ismi yoki yetkazish)"
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-[#064E3B] to-[#047857] py-3.5 text-sm font-bold text-white shadow-lg hover:opacity-95 disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
              <span>
                {submitting
                  ? "Yuborilmoqda..."
                  : paymentMethod === "PAYNET"
                  ? `Paynet chekini yuborish (${formatSom(finalAmount)})`
                  : `Naqd to‘lov bilan buyurtma berish (${formatSom(finalAmount)})`}
              </span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
