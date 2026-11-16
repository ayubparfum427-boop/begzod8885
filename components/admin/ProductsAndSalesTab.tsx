"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Award,
  Crown,
  Droplets,
  Edit3,
  ImagePlus,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  formatDateUZ,
  formatGrams,
  formatSom,
  formatUzbekPhone,
} from "@/lib/format";
import { staffFetch } from "@/lib/client-auth";
import type { OverviewPayload } from "./DashboardTab";

export interface WarehouseProductItem {
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
  isActive: boolean;
  soldCount: number;
  totalRevenue: number;
}

interface CustomerOption {
  id: number;
  customerCode: string;
  fullName: string;
  phone: string;
  bonusGrams: number;
  isVip: boolean;
  customDiscountPercent: number | null;
}

interface SaleRecord {
  id: number;
  saleCode: string;
  customerId: number;
  customerName: string;
  customerCode: string;
  cashierName: string;
  subtotalAmount: number;
  discountPercent: number;
  discountAmount: number;
  finalAmount: number;
  bonusGramsUsed: number;
  bonusGramsEarned: number;
  isVipSale: boolean;
  createdAt: string;
  items: Array<{
    id: number;
    productName: string;
    volume: string;
    quantity: number;
    unitPrice: number;
    lineFinalAmount: number;
  }>;
}

export function ProductsAndSalesTab({
  initialSubTab = "sales",
  canManageProducts,
  rankings,
  onDataMutated,
}: {
  initialSubTab?: "sales" | "products" | "rankings";
  canManageProducts: boolean;
  rankings?: OverviewPayload["rankings"];
  onDataMutated?: () => void;
}) {
  const [subTab, setSubTab] = useState<"sales" | "products" | "rankings">(
    initialSubTab
  );

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const [products, setProducts] = useState<WarehouseProductItem[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // POS Sale Entry State (Supports Bottle & Razliv!)
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [posSaleMode, setPosSaleMode] = useState<"BOTTLE" | "RAZLIV">("BOTTLE");
  const [posRazlivGrams, setPosRazlivGrams] = useState<number>(10);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [redeemGrams, setRedeemGrams] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Naqd / Karta");
  const [saleNotes, setSaleNotes] = useState("");
  const [preview, setPreview] = useState<{
    subtotalAmount: number;
    discountPercent: number;
    discountAmount: number;
    finalAmount: number;
    bonusGramsUsed: number;
    bonusGramsEarned: number;
    willBecomeVip: boolean;
    explanation: string;
  } | null>(null);
  const [submittingSale, setSubmittingSale] = useState(false);

  // Warehouse Product Form State
  const [showProdForm, setShowProdForm] = useState(false);
  const [editingProd, setEditingProd] = useState<WarehouseProductItem | null>(
    null
  );
  const [pCode, setPCode] = useState("");
  const [pName, setPName] = useState("");
  const [pBrand, setPBrand] = useState("AYUB PRIVÉ");
  const [pCat, setPCat] = useState("Uniseks");
  const [pBottleMl, setPBottleMl] = useState("100");
  const [pStockMl, setPStockMl] = useState("110");
  const [pPrice, setPPrice] = useState("250000");
  const [pRazlivPrice, setPRazlivPrice] = useState("3500");
  const [pRazlivSizes, setPRazlivSizes] = useState("5,10,20,30,50");
  const [pAllowBottle, setPAllowBottle] = useState(true);
  const [pAllowRazliv, setPAllowRazliv] = useState(true);
  const [pImg, setPImg] = useState("/images/ayub-hero-perfume.jpg");
  const [pDesc, setPDesc] = useState("");
  const [pActive, setPActive] = useState(true);

  async function loadAll() {
    try {
      const [pRes, cRes, sRes] = await Promise.all([
        staffFetch("/api/admin/products"),
        staffFetch("/api/admin/customers"),
        staffFetch("/api/admin/sales"),
      ]);
      const pData = await pRes.json();
      const cData = await cRes.json();
      const sData = await sRes.json();

      if (pData.products) {
        setProducts(pData.products);
        const activeFirst = pData.products.find(
          (p: WarehouseProductItem) => p.isActive
        );
        if (!selectedProductId && activeFirst) {
          setSelectedProductId(String(activeFirst.id));
          setUnitPrice(activeFirst.price);
        }
      }
      if (cData.customers) {
        setCustomers(cData.customers);
        if (!selectedCustomerId && cData.customers[0]) {
          setSelectedCustomerId(String(cData.customers[0].id));
        }
      }
      if (sData.sales) setSalesHistory(sData.sales);
    } catch {
      setErr("Ombor ma’lumotlarini yuklashda xatolik yuz berdi.");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedPosProd = products.find(
    (p) => String(p.id) === selectedProductId
  );

  // Sync POS price automatically when mode/grams/product changes
  useEffect(() => {
    if (!selectedPosProd) return;
    if (posSaleMode === "BOTTLE") {
      setUnitPrice(selectedPosProd.price);
    } else {
      setUnitPrice(
        Math.round(posRazlivGrams * Number(selectedPosProd.razlivPricePerGram || 0))
      );
    }
  }, [selectedProductId, posSaleMode, posRazlivGrams, selectedPosProd]);

  // Live backend loyalty preview
  useEffect(() => {
    if (!selectedCustomerId || !selectedProductId || quantity < 1) {
      setPreview(null);
      return;
    }
    let active = true;
    staffFetch("/api/admin/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "preview",
        customerId: Number(selectedCustomerId),
        items: [
          {
            productId: Number(selectedProductId),
            quantity: posSaleMode === "RAZLIV" ? 1 : quantity,
            saleMode: posSaleMode,
            razlivGrams: posSaleMode === "RAZLIV" ? posRazlivGrams : undefined,
            customUnitPrice: unitPrice,
          },
        ],
        redeemBonusGrams: redeemGrams,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (active && d.ok) setPreview(d.preview);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [
    selectedCustomerId,
    selectedProductId,
    posSaleMode,
    posRazlivGrams,
    quantity,
    unitPrice,
    redeemGrams,
  ]);

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 680;
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
        const compressed = canvas.toDataURL("image/jpeg", 0.82);
        setPImg(compressed);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleCreateSale(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setSubmittingSale(true);
    try {
      const res = await staffFetch("/api/admin/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          customerId: Number(selectedCustomerId),
          items: [
            {
              productId: Number(selectedProductId),
              quantity: posSaleMode === "RAZLIV" ? 1 : quantity,
              saleMode: posSaleMode,
              razlivGrams:
                posSaleMode === "RAZLIV" ? posRazlivGrams : undefined,
              customUnitPrice: unitPrice,
            },
          ],
          redeemBonusGrams: redeemGrams,
          paymentMethod,
          notes: saleNotes,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.error || "Savdoni saqlashda xatolik");
        return;
      }

      setMsg(
        `Savdo (#${data.sale.saleCode}) saqlandi va ombor qoldig‘i yangilandi! Yakuniy: ${formatSom(
          data.sale.finalAmount
        )}${data.promotedToVip ? " • 👑 Mijoz avtomatik VIP maqomini oldi!" : ""}`
      );
      setRedeemGrams(0);
      setQuantity(1);
      setSaleNotes("");
      loadAll();
      onDataMutated?.();
    } finally {
      setSubmittingSale(false);
    }
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");

    const bMl = Math.max(1, Number(pBottleMl || 100));
    const payload = {
      id: editingProd?.id,
      productCode: pCode,
      name: pName,
      brand: pBrand,
      category: pCat,
      volume: `${bMl} ml`,
      bottleVolumeMl: bMl,
      stockMl: Math.max(0, Number(pStockMl || 0)),
      price: Number(pPrice),
      razlivPricePerGram: Number(pRazlivPrice),
      razlivSizes: pRazlivSizes,
      allowBottleSale: pAllowBottle,
      allowRazlivSale: pAllowRazliv,
      imageUrl: pImg,
      description: pDesc,
      isActive: pActive,
    };

    const res = await staffFetch("/api/admin/products", {
      method: editingProd ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) {
      setErr(data.error || "Xatolik");
      return;
    }

    setMsg(
      editingProd
        ? "Ombor atiri muvaffaqiyatli yangilandi!"
        : "Yangi atir omborga qo‘shildi!"
    );
    setShowProdForm(false);
    setEditingProd(null);
    loadAll();
    onDataMutated?.();
  }

  async function handleDeleteProduct(id: number) {
    const res = await staffFetch(`/api/admin/products?id=${id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.ok) {
      setMsg(data.message || "O‘chirildi.");
      loadAll();
    }
  }

  const currentCustomer = customers.find(
    (c) => String(c.id) === selectedCustomerId
  );

  const posRazlivOptions = (selectedPosProd?.razlivSizes || "5,10,20,30,50")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => n > 0);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 rounded-2xl bg-white dark:bg-neutral-900 p-1.5 ring-1 ring-neutral-200 dark:ring-neutral-800">
          {[
            { id: "products", label: "Ombor bo‘limi (Flakon va Razliv)", icon: Package },
            { id: "sales", label: "Kassa Savdo kiritish (POS)", icon: ShoppingBag },
            { id: "rankings", label: "Top mijozlar reytingi", icon: Award },
          ].map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setSubTab(t.id as "sales" | "products" | "rankings")
                }
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                  active
                    ? "bg-[#064E3B] text-white"
                    : "text-neutral-600 dark:text-neutral-300"
                }`}
              >
                <Icon className="h-4 w-4 text-[#D4AF37]" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {subTab === "products" && canManageProducts && (
          <button
            type="button"
            onClick={() => {
              setEditingProd(null);
              setPCode(`AYP-0${products.length + 1}`);
              setPName("");
              setPBrand("AYUB PRIVÉ");
              setPCat("Uniseks");
              setPBottleMl("100");
              setPStockMl("110");
              setPPrice("250000");
              setPRazlivPrice("3500");
              setPRazlivSizes("5,10,20,30,50");
              setPAllowBottle(true);
              setPAllowRazliv(true);
              setPImg("/images/ayub-hero-perfume.jpg");
              setPDesc("");
              setPActive(true);
              setShowProdForm(!showProdForm);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-4 py-2.5 text-sm font-semibold text-white cursor-pointer"
          >
            <Plus className="h-4 w-4 text-[#D4AF37]" />
            <span>Omborga yangi atir qo‘shish</span>
          </button>
        )}
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

      {/* ================= SUBTAB: OMBOR BO'LIMI (WAREHOUSE) ================= */}
      {subTab === "products" && (
        <div className="space-y-6">
          {showProdForm && canManageProducts && (
            <form
              onSubmit={handleSaveProduct}
              className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-md ring-2 ring-[#D4AF37]/60 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <h3 className="font-serif-luxury text-xl font-bold">
                  {editingProd
                    ? `Omborni tahrirlash: ${editingProd.name}`
                    : "Omborga yangi atir qo‘shish (Butun flakon + Razliv)"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowProdForm(false)}
                  className="text-xs text-neutral-500 hover:text-red-600 cursor-pointer"
                >
                  Yopish ✕
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Mahsulot kodi
                  </label>
                  <input
                    type="text"
                    required
                    value={pCode}
                    onChange={(e) => setPCode(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Atir nomi
                  </label>
                  <input
                    type="text"
                    required
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    placeholder="Masalan: Ayub Oud Imperial"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Brend
                  </label>
                  <input
                    type="text"
                    required
                    value={pBrand}
                    onChange={(e) => setPBrand(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Kategoriya
                  </label>
                  <select
                    value={pCat}
                    onChange={(e) => setPCat(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
                  >
                    <option value="Niche">Niche</option>
                    <option value="Erkaklar">Erkaklar</option>
                    <option value="Ayollar">Ayollar</option>
                    <option value="Uniseks">Uniseks</option>
                    <option value="Yog‘li atir">Yog‘li atir</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-[#064E3B] dark:text-[#D4AF37]">
                    1 ta Butun Flakon hajmi (ml)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={pBottleMl}
                    onChange={(e) => setPBottleMl(e.target.value)}
                    placeholder="100"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm font-bold tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-[#047857] dark:text-emerald-400">
                    Ombordagi jami qoldiq (ml / gr)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    required
                    value={pStockMl}
                    onChange={(e) => setPStockMl(e.target.value)}
                    placeholder="110"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm font-bold tabular-nums"
                  />
                  <span className="text-[10px] text-neutral-500">
                    Masalan: 110 ml qoldiqdan 20 ml razliv olinsa 90 ml qolib,
                    100 ml butun flakon avtomatik «Tugadi» bo‘ladi.
                  </span>
                </div>

                {/* DUAL PRICING: BOTTLE PRICE & RAZLIV PRICE */}
                <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 border border-emerald-200 dark:border-emerald-900">
                  <label className="block text-xs font-bold text-[#064E3B] dark:text-emerald-300 mb-1">
                    1-NARX: Butun flakon narxi (so‘m)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    placeholder="250000"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-bold tabular-nums"
                  />
                </div>

                <div className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 p-3.5 border border-amber-200 dark:border-amber-900">
                  <label className="block text-xs font-bold text-amber-900 dark:text-[#D4AF37] mb-1">
                    2-NARX: Razliv 1 gr / ml narxi (so‘m)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={pRazlivPrice}
                    onChange={(e) => setPRazlivPrice(e.target.value)}
                    placeholder="3500"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-bold tabular-nums"
                  />
                </div>

                <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 p-3.5 border border-neutral-200 dark:border-neutral-800">
                  <label className="block text-xs font-bold mb-1">
                    Razliv grammlari (vergul bilan)
                  </label>
                  <input
                    type="text"
                    required
                    value={pRazlivSizes}
                    onChange={(e) => setPRazlivSizes(e.target.value)}
                    placeholder="5,10,20,30,50"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-mono"
                  />
                </div>

                {/* IMAGE UPLOAD + PRESET + PREVIEW */}
                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-xs font-semibold">
                    Atir rasmini qo‘yish (Qurilmadan yuklash yoki tayyor rasm)
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#047857] cursor-pointer">
                      <ImagePlus className="h-4 w-4 text-[#D4AF37]" />
                      <span>Qurilmadan rasm tanlash</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>

                    <select
                      value={
                        pImg.startsWith("data:")
                          ? "custom"
                          : pImg
                      }
                      onChange={(e) => {
                        if (e.target.value !== "custom") {
                          setPImg(e.target.value);
                        }
                      }}
                      className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-xs"
                    >
                      {pImg.startsWith("data:") && (
                        <option value="custom">Yuklangan shaxsiy rasm</option>
                      )}
                      <option value="/images/ayub-hero-perfume.jpg">
                        Ayub Emerald Flacon
                      </option>
                      <option value="/images/oud-imperial.jpg">
                        Oud Imperial Gold
                      </option>
                      <option value="/images/velvet-rose.jpg">
                        Velvet Damask Rose
                      </option>
                      <option value="/images/emerald-musk.jpg">
                        Emerald Royal Musk
                      </option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={pDesc}
                    onChange={(e) => setPDesc(e.target.value)}
                    placeholder="Qisqacha atir ifori haqida izoh..."
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-xs"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <img
                    src={pImg}
                    alt="Preview"
                    className="h-20 w-20 rounded-2xl object-cover ring-1 ring-[#D4AF37]/40 shrink-0"
                  />
                  <div className="space-y-1.5 text-xs">
                    <label className="flex items-center gap-2 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pAllowBottle}
                        onChange={(e) => setPAllowBottle(e.target.checked)}
                      />
                      <span>Butun flakonda sotish</span>
                    </label>
                    <label className="flex items-center gap-2 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pAllowRazliv}
                        onChange={(e) => setPAllowRazliv(e.target.checked)}
                      />
                      <span>Razlivda (gr) sotish</span>
                    </label>
                    <label className="flex items-center gap-2 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pActive}
                        onChange={(e) => setPActive(e.target.checked)}
                      />
                      <span>Mijoz katalogida faol</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowProdForm(false)}
                  className="rounded-xl border px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#064E3B] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#047857] cursor-pointer"
                >
                  Omborga saqlash
                </button>
              </div>
            </form>
          )}

          {/* WAREHOUSE INVENTORY CARDS */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const bottleMl = Math.max(1, Number(p.bottleVolumeMl || 100));
              const stockMl = Math.max(0, Number(p.stockMl || 0));
              const fullBottlesAvailable = Math.floor(stockMl / bottleMl);
              const isBottleOutOfStock = stockMl < bottleMl;
              const isTotallyEmpty = stockMl <= 0;

              return (
                <div
                  key={p.id}
                  className={`overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-800 flex flex-col justify-between ${
                    !p.isActive ? "opacity-60" : ""
                  }`}
                >
                  <div>
                    <div className="relative h-48 w-full overflow-hidden">
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute left-3 top-3 rounded-lg bg-black/75 px-2.5 py-1 text-[11px] font-mono font-bold text-[#D4AF37]">
                        {p.productCode}
                      </span>
                      <span className="absolute right-3 top-3 rounded-lg bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#064E3B] tabular-nums">
                        Ombor: {stockMl} ml
                      </span>
                    </div>

                    <div className="p-5 space-y-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                          {p.brand} • {p.category}
                        </div>
                        <h4 className="font-serif-luxury text-lg font-bold">
                          {p.name}
                        </h4>
                      </div>

                      {/* Dual Price Box */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 p-2.5">
                          <div className="text-[10px] font-semibold text-neutral-500">
                            🍾 Butun flakon ({bottleMl} ml)
                          </div>
                          <div className="mt-0.5 text-sm font-bold text-[#064E3B] dark:text-emerald-300 tabular-nums">
                            {formatSom(p.price)}
                          </div>
                        </div>

                        <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/40 p-2.5">
                          <div className="text-[10px] font-semibold text-neutral-500">
                            💧 Razliv (1 gr narxi)
                          </div>
                          <div className="mt-0.5 text-sm font-bold text-amber-800 dark:text-[#D4AF37] tabular-nums">
                            {formatSom(p.razlivPricePerGram)}
                          </div>
                        </div>
                      </div>

                      {/* Smart Stock Status Banner */}
                      {isTotallyEmpty ? (
                        <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/50 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-300">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>Omborda atir to‘liq tugadi (0 ml)</span>
                        </div>
                      ) : isBottleOutOfStock ? (
                        <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>
                            Butun flakon atir tugadi! (Omborda {stockMl} ml
                            razliv qoldi)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between rounded-xl bg-neutral-50 dark:bg-neutral-800/70 px-3 py-2 text-xs">
                          <span className="font-semibold text-[#047857] dark:text-emerald-400">
                            Butun flakon: {fullBottlesAvailable} dona bor
                          </span>
                          <span className="text-neutral-500 tabular-nums">
                            Razliv: {stockMl} gr gacha
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {canManageProducts && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/30">
                      <span className="text-[11px] text-neutral-500 tabular-nums">
                        Razliv: {p.razlivSizes} gr
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProd(p);
                            setPCode(p.productCode);
                            setPName(p.name);
                            setPBrand(p.brand);
                            setPCat(p.category);
                            setPBottleMl(String(p.bottleVolumeMl || 100));
                            setPStockMl(String(p.stockMl ?? 100));
                            setPPrice(String(p.price));
                            setPRazlivPrice(
                              String(p.razlivPricePerGram || 3500)
                            );
                            setPRazlivSizes(p.razlivSizes || "5,10,20,30,50");
                            setPAllowBottle(p.allowBottleSale);
                            setPAllowRazliv(p.allowRazlivSale);
                            setPImg(p.imageUrl);
                            setPDesc(p.description || "");
                            setPActive(p.isActive);
                            setShowProdForm(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs font-semibold hover:border-[#047857] cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Tahrirlash</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 text-red-600 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= SUBTAB: POS SALE ENTRY + HISTORY ================= */}
      {subTab === "sales" && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateSale}
            className="grid gap-6 lg:grid-cols-12 rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800"
          >
            <div className="lg:col-span-7 space-y-4">
              <h3 className="font-serif-luxury text-xl font-bold">
                Yangi xarid kiritish (Butun flakon yoki Razliv)
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1">
                    1. Mijozni tanlang
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value);
                      setRedeemGrams(0);
                    }}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2.5 text-sm"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.customerCode}) •{" "}
                        {formatUzbekPhone(c.phone)} {c.isVip ? "👑 VIP" : ""} •
                        Bonus: {formatGrams(c.bonusGrams)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1">
                    2. Ombordan atirni tanlang
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2.5 text-sm"
                  >
                    {products
                      .filter((p) => p.isActive)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.productCode}] {p.name} — Qoldiq: {p.stockMl} ml (
                          Flakon: {formatSom(p.price)} | Razliv:{" "}
                          {formatSom(p.razlivPricePerGram)}/gr)
                        </option>
                      ))}
                  </select>
                </div>

                {/* Sale Mode Selector: Bottle vs Razliv */}
                <div className="sm:col-span-2 flex gap-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">
                  <button
                    type="button"
                    onClick={() => setPosSaleMode("BOTTLE")}
                    className={`flex-1 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
                      posSaleMode === "BOTTLE"
                        ? "bg-[#064E3B] text-white"
                        : "text-neutral-600 dark:text-neutral-300"
                    }`}
                  >
                    🍾 Butun flakon (
                    {selectedPosProd &&
                    selectedPosProd.stockMl < selectedPosProd.bottleVolumeMl
                      ? "Tugagan!"
                      : `${selectedPosProd?.bottleVolumeMl || 100} ml`}
                    )
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosSaleMode("RAZLIV")}
                    className={`flex-1 rounded-lg py-2 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      posSaleMode === "RAZLIV"
                        ? "bg-[#064E3B] text-white"
                        : "text-neutral-600 dark:text-neutral-300"
                    }`}
                  >
                    <Droplets className="h-3.5 w-3.5 text-[#D4AF37]" />
                    <span>Razliv (gramm / ml)</span>
                  </button>
                </div>

                {posSaleMode === "RAZLIV" ? (
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      3. Razliv grammini tanlang
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {posRazlivOptions.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setPosRazlivGrams(g)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer ${
                            posRazlivGrams === g
                              ? "bg-[#D4AF37] text-[#111827]"
                              : "bg-neutral-100 dark:bg-neutral-800"
                          }`}
                        >
                          {g} gr
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={selectedPosProd?.stockMl || 500}
                      value={posRazlivGrams}
                      onChange={(e) =>
                        setPosRazlivGrams(Math.max(1, Number(e.target.value)))
                      }
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm tabular-nums"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      3. Flakon soni (dona)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(Math.max(1, Number(e.target.value)))
                      }
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-sm tabular-nums"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    4. Narxi (so‘m)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-sm tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Bonus ishlatish (mavjud:{" "}
                    {formatGrams(currentCustomer?.bonusGrams || 0)})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={currentCustomer?.bonusGrams || 0}
                    step="0.5"
                    value={redeemGrams}
                    onChange={(e) => setRedeemGrams(Number(e.target.value))}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2.5 text-sm tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    To‘lov turi
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2.5 text-sm"
                  >
                    <option value="Naqd">Naqd (Joyida)</option>
                    <option value="Paynet QR">Paynet QR</option>
                    <option value="Uzcard / Humo">Uzcard / Humo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Live Server Receipt Preview */}
            <div className="lg:col-span-5 rounded-2xl bg-gradient-to-br from-[#064E3B] to-[#111827] p-6 text-white flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                    Avtomatik Hisob-kitob (Server)
                  </span>
                  {currentCustomer?.isVip && (
                    <span className="rounded bg-[#D4AF37] px-2 py-0.5 text-[10px] font-bold text-[#111827]">
                      VIP MIJOZ
                    </span>
                  )}
                </div>

                <div className="divide-y divide-white/10 text-sm pt-2">
                  <div className="flex justify-between py-2">
                    <span className="text-emerald-100/80">Boshlang‘ich summa:</span>
                    <span className="font-semibold tabular-nums">
                      {formatSom(preview?.subtotalAmount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-emerald-100/80">
                      Chegirma ({preview?.discountPercent || 0}%):
                    </span>
                    <span className="font-semibold text-[#D4AF37] tabular-nums">
                      -{formatSom(preview?.discountAmount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-emerald-100/80">
                      Yangi yoziladigan bonus:
                    </span>
                    <span className="font-semibold text-emerald-300 tabular-nums">
                      +{formatGrams(preview?.bonusGramsEarned || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 text-lg font-bold">
                    <span>Yakuniy to‘lov:</span>
                    <span className="text-[#D4AF37] tabular-nums">
                      {formatSom(preview?.finalAmount || 0)}
                    </span>
                  </div>
                </div>

                {preview?.explanation && (
                  <p className="rounded-xl bg-white/10 p-3 text-xs text-emerald-100 leading-relaxed">
                    {preview.explanation}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submittingSale}
                className="mt-5 w-full rounded-xl bg-[#D4AF37] py-3.5 text-sm font-bold text-[#111827] shadow-lg hover:opacity-95 disabled:opacity-60 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {submittingSale
                    ? "Saqlanmoqda..."
                    : "Xaridni tasdiqlash va ombordan chiqarish"}
                </span>
              </button>
            </div>
          </form>

          {/* Sales History Table */}
          <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-800">
            <h3 className="font-serif-luxury text-lg font-bold mb-4">
              Barcha kiritilgan xaridlar tarixi
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] uppercase text-neutral-500">
                    <th className="py-3 pr-3">Chek ID</th>
                    <th className="py-3 pr-3">Sana</th>
                    <th className="py-3 pr-3">Mijoz</th>
                    <th className="py-3 pr-3">Atirlar</th>
                    <th className="py-3 pr-3">Chegirma</th>
                    <th className="py-3 pr-3">Bonus</th>
                    <th className="py-3 pr-3">Yakuniy summa</th>
                    <th className="py-3">Kassir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {salesHistory.map((s) => (
                    <tr key={s.id}>
                      <td className="py-3 pr-3 font-bold text-[#064E3B] dark:text-[#D4AF37] tabular-nums whitespace-nowrap">
                        {s.saleCode}
                      </td>
                      <td className="py-3 pr-3 tabular-nums whitespace-nowrap">
                        {formatDateUZ(s.createdAt)}
                      </td>
                      <td className="py-3 pr-3 font-medium whitespace-nowrap">
                        {s.customerName} ({s.customerCode})
                      </td>
                      <td className="py-3 pr-3">
                        {s.items
                          .map(
                            (it) =>
                              `${it.productName} (${it.volume}) × ${it.quantity}`
                          )
                          .join(", ")}
                      </td>
                      <td className="py-3 pr-3 tabular-nums whitespace-nowrap">
                        {s.discountPercent > 0
                          ? `${s.discountPercent}% (-${formatSom(s.discountAmount)})`
                          : "—"}
                      </td>
                      <td className="py-3 pr-3 tabular-nums whitespace-nowrap">
                        {s.bonusGramsEarned > 0
                          ? `+${formatGrams(s.bonusGramsEarned)}`
                          : s.bonusGramsUsed > 0
                          ? `-${formatGrams(s.bonusGramsUsed)}`
                          : "—"}
                      </td>
                      <td className="py-3 pr-3 font-bold tabular-nums whitespace-nowrap">
                        {formatSom(s.finalAmount)}
                      </td>
                      <td className="py-3 text-neutral-500 whitespace-nowrap">
                        {s.cashierName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: TOP CUSTOMERS LEADERBOARD */}
      {subTab === "rankings" && rankings && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800">
            <h3 className="font-serif-luxury text-lg font-bold mb-4">
              1. Eng ko‘p pul sarflagan mijozlar
            </h3>
            <div className="space-y-2.5">
              {rankings.topBySpent.map((c, idx) => (
                <div
                  key={c.id}
                  className="flex justify-between rounded-xl bg-neutral-50 dark:bg-neutral-800/60 px-3.5 py-2.5 text-xs sm:text-sm"
                >
                  <span className="font-semibold">
                    #{idx + 1} {c.fullName} ({c.customerCode})
                  </span>
                  <span className="font-bold text-[#047857] dark:text-[#D4AF37] tabular-nums">
                    {formatSom(c.totalSpent)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800">
            <h3 className="font-serif-luxury text-lg font-bold mb-4">
              2. Eng ko‘p xarid qilgan mijozlar
            </h3>
            <div className="space-y-2.5">
              {rankings.topByPurchases.map((c, idx) => (
                <div
                  key={c.id}
                  className="flex justify-between rounded-xl bg-neutral-50 dark:bg-neutral-800/60 px-3.5 py-2.5 text-xs sm:text-sm"
                >
                  <span className="font-semibold">
                    #{idx + 1} {c.fullName} ({c.customerCode})
                  </span>
                  <span className="font-bold tabular-nums">
                    {c.purchasesCount} marta
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800">
            <h3 className="font-serif-luxury text-lg font-bold mb-4">
              3. Eng ko‘p atir olgan mijozlar
            </h3>
            <div className="space-y-2.5">
              {rankings.topByItems.map((c, idx) => (
                <div
                  key={c.id}
                  className="flex justify-between rounded-xl bg-neutral-50 dark:bg-neutral-800/60 px-3.5 py-2.5 text-xs sm:text-sm"
                >
                  <span className="font-semibold">
                    #{idx + 1} {c.fullName} ({c.customerCode})
                  </span>
                  <span className="font-bold tabular-nums">
                    {c.totalItemsBought} marta
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800">
            <h3 className="font-serif-luxury text-lg font-bold mb-4 flex items-center gap-2">
              <Crown className="h-5 w-5 text-[#D4AF37]" />
              <span>4. VIP mijozlar reytingi</span>
            </h3>
            <div className="space-y-2.5">
              {rankings.topVip.map((c, idx) => (
                <div
                  key={c.id}
                  className="flex justify-between rounded-xl bg-amber-50/70 dark:bg-amber-950/30 px-3.5 py-2.5 text-xs sm:text-sm"
                >
                  <span className="font-semibold">
                    #{idx + 1} {c.fullName} ({c.customerCode})
                  </span>
                  <span className="font-bold text-[#9a7b1c] dark:text-[#D4AF37] tabular-nums">
                    {formatSom(c.totalSpent)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
