import { db } from "@/db";
import {
  bonusTransactions,
  customers,
  discountTransactions,
  employees,
  products,
  qrSources,
  saleItems,
  sales,
} from "@/db/schema";
import { desc } from "drizzle-orm";
import { formatDateUZ, getTashkentDateKey } from "@/lib/format";
import {
  ensureSystemBootstrapped,
  getAppConfig,
} from "@/lib/settings-service";

export async function getAdminOverviewPayload(
  fromParam?: string | null,
  toParam?: string | null
) {
  await ensureSystemBootstrapped();

  const inRange = (d: Date | string | null | undefined) => {
    if (!d) return false;
    const key = getTashkentDateKey(d);
    if (!key) return false;
    if (fromParam && key < fromParam) return false;
    if (toParam && key > toParam) return false;
    return true;
  };

  const hasDateFilter = Boolean(fromParam || toParam);
  const config = await getAppConfig();

  const [
    allCustomers,
    allSales,
    allSaleItems,
    allBonuses,
    allDiscounts,
    allQrSources,
    allProducts,
    allEmployees,
  ] = await Promise.all([
    db.select().from(customers).orderBy(desc(customers.createdAt)),
    db.select().from(sales).orderBy(desc(sales.createdAt)),
    db.select().from(saleItems),
    db
      .select()
      .from(bonusTransactions)
      .orderBy(desc(bonusTransactions.createdAt)),
    db
      .select()
      .from(discountTransactions)
      .orderBy(desc(discountTransactions.createdAt)),
    db.select().from(qrSources),
    db.select().from(products),
    db.select().from(employees),
  ]);

  const filteredCustomers = hasDateFilter
    ? allCustomers.filter((c) => inRange(c.createdAt))
    : allCustomers;
  const filteredSales = hasDateFilter
    ? allSales.filter((s) => inRange(s.createdAt))
    : allSales;
  const filteredBonuses = hasDateFilter
    ? allBonuses.filter((b) => inRange(b.createdAt))
    : allBonuses;
  const filteredDiscounts = (
    hasDateFilter
      ? allDiscounts.filter((d) => inRange(d.createdAt))
      : allDiscounts
  ).filter((d) => Number(d.discountAmount) > 0);

  const now = new Date();
  const todayKey = getTashkentDateKey(now);
  const currentMonthPrefix = todayKey.slice(0, 7);
  const currentYearPrefix = todayKey.slice(0, 4);
  const weekAgoKey = getTashkentDateKey(
    new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
  );

  const todayNewCustomers = allCustomers.filter(
    (c) => getTashkentDateKey(c.createdAt) === todayKey
  ).length;
  const monthlyNewCustomers = allCustomers.filter((c) =>
    getTashkentDateKey(c.createdAt).startsWith(currentMonthPrefix)
  ).length;
  const vipCustomersCount = filteredCustomers.filter((c) => c.isVip).length;

  const todaySales = allSales
    .filter((s) => getTashkentDateKey(s.createdAt) === todayKey)
    .reduce((acc, s) => acc + Number(s.finalAmount || 0), 0);

  const weeklySales = allSales
    .filter((s) => getTashkentDateKey(s.createdAt) >= weekAgoKey)
    .reduce((acc, s) => acc + Number(s.finalAmount || 0), 0);

  const monthlySales = allSales
    .filter((s) =>
      getTashkentDateKey(s.createdAt).startsWith(currentMonthPrefix)
    )
    .reduce((acc, s) => acc + Number(s.finalAmount || 0), 0);

  const yearlySales = allSales
    .filter((s) =>
      getTashkentDateKey(s.createdAt).startsWith(currentYearPrefix)
    )
    .reduce((acc, s) => acc + Number(s.finalAmount || 0), 0);

  const totalSales = filteredSales.reduce(
    (acc, s) => acc + Number(s.finalAmount || 0),
    0
  );

  const grantedBonusesGrams = filteredBonuses
    .filter((b) => Number(b.amountGrams) > 0)
    .reduce((acc, b) => acc + Number(b.amountGrams), 0);

  const usedBonusesGrams = filteredBonuses
    .filter((b) => Number(b.amountGrams) < 0)
    .reduce((acc, b) => acc + Math.abs(Number(b.amountGrams)), 0);

  const remainingBonusesGrams = hasDateFilter
    ? Math.max(0, grantedBonusesGrams - usedBonusesGrams)
    : allCustomers.reduce(
        (acc, c) => acc + Math.max(0, Number(c.bonusGrams || 0)),
        0
      );

  const flyerCustomersCount = filteredCustomers.filter(
    (c) => c.qrSource === "flyer"
  ).length;
  const cashierCustomersCount = filteredCustomers.filter(
    (c) => c.qrSource === "cashier"
  ).length;
  const otherSourceCustomersCount = filteredCustomers.filter(
    (c) => c.qrSource !== "flyer" && c.qrSource !== "cashier"
  ).length;

  const discount30Rows = filteredDiscounts.filter(
    (d) => d.discountPercent === 30
  );
  const discount30Count = discount30Rows.length;
  const discount30Sum = discount30Rows.reduce(
    (acc, d) => acc + Number(d.discountAmount || 0),
    0
  );

  const discount45Rows = filteredDiscounts.filter(
    (d) => d.discountPercent === 45
  );
  const discount45Count = discount45Rows.length;
  const discount45Sum = discount45Rows.reduce(
    (acc, d) => acc + Number(d.discountAmount || 0),
    0
  );

  const otherDiscountRows = filteredDiscounts.filter(
    (d) => d.discountPercent !== 30 && d.discountPercent !== 45
  );
  const otherDiscountCount = otherDiscountRows.length;
  const otherDiscountSum = otherDiscountRows.reduce(
    (acc, d) => acc + Number(d.discountAmount || 0),
    0
  );

  const totalDiscountSum = filteredDiscounts.reduce(
    (acc, d) => acc + Number(d.discountAmount || 0),
    0
  );

  const dailySeries = [];
  for (let i = 6; i >= 0; i--) {
    const target = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayKey = getTashkentDateKey(target);
    const fullDate = formatDateUZ(dayKey);
    const label = fullDate.slice(0, 5);

    const custCount = allCustomers.filter(
      (c) => getTashkentDateKey(c.createdAt) === dayKey
    ).length;
    const salesSum = allSales
      .filter((s) => getTashkentDateKey(s.createdAt) === dayKey)
      .reduce((acc, s) => acc + Number(s.finalAmount || 0), 0);

    dailySeries.push({
      label,
      fullDate,
      customers: custCount,
      sales: salesSum,
    });
  }

  const weeklySeries = [];
  for (let w = 3; w >= 0; w--) {
    const wEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
    const wStart = new Date(wEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startKey = getTashkentDateKey(
      new Date(wStart.getTime() + 24 * 60 * 60 * 1000)
    );
    const endKey = getTashkentDateKey(wEnd);

    const custCount = allCustomers.filter((c) => {
      const k = getTashkentDateKey(c.createdAt);
      return k >= startKey && k <= endKey;
    }).length;
    const salesSum = allSales
      .filter((s) => {
        const k = getTashkentDateKey(s.createdAt);
        return k >= startKey && k <= endKey;
      })
      .reduce((acc, s) => acc + Number(s.finalAmount || 0), 0);

    weeklySeries.push({
      label: `${4 - w}-hafta`,
      fullDate: `${formatDateUZ(startKey)} - ${formatDateUZ(endKey)}`,
      customers: custCount,
      sales: salesSum,
    });
  }

  const monthNames = [
    "Yan",
    "Fev",
    "Mar",
    "Apr",
    "May",
    "Iyun",
    "Iyul",
    "Avg",
    "Sen",
    "Okt",
    "Noy",
    "Dek",
  ];
  const [curYearStr, curMonthStr] = todayKey.split("-");
  const curYear = Number(curYearStr);
  const curMonthIdx = Number(curMonthStr) - 1;

  const monthlySeries = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(Date.UTC(curYear, curMonthIdx - m, 1));
    const y = d.getUTCFullYear();
    const mIdx = d.getUTCMonth();
    const prefix = `${y}-${String(mIdx + 1).padStart(2, "0")}`;

    const custCount = allCustomers.filter((c) =>
      getTashkentDateKey(c.createdAt).startsWith(prefix)
    ).length;
    const salesSum = allSales
      .filter((s) => getTashkentDateKey(s.createdAt).startsWith(prefix))
      .reduce((acc, s) => acc + Number(s.finalAmount || 0), 0);

    monthlySeries.push({
      label: `${monthNames[mIdx]} ${String(y).slice(2)}`,
      customers: custCount,
      sales: salesSum,
    });
  }

  const filteredSaleIds = new Set(filteredSales.map((s) => s.id));
  const filteredSalesByCustomer = new Map<
    number,
    { spent: number; count: number; items: number }
  >();

  for (const s of filteredSales) {
    const prev = filteredSalesByCustomer.get(s.customerId) || {
      spent: 0,
      count: 0,
      items: 0,
    };
    const itemsQty = allSaleItems
      .filter((it) => it.saleId === s.id)
      .reduce((a, i) => a + Number(i.quantity || 0), 0);
    filteredSalesByCustomer.set(s.customerId, {
      spent: prev.spent + Number(s.finalAmount || 0),
      count: prev.count + 1,
      items: prev.items + itemsQty,
    });
  }

  const knownCodes = new Set(allQrSources.map((q) => q.code));
  const qrComparison = allQrSources.map((q) => {
    const matchedCusts = filteredCustomers.filter((c) => c.qrSource === q.code);
    const revenue = allCustomers
      .filter((c) => c.qrSource === q.code)
      .reduce(
        (acc, c) => acc + (filteredSalesByCustomer.get(c.id)?.spent ?? 0),
        0
      );
    return {
      id: q.id,
      code: q.code,
      name: q.name,
      scansCount: Math.max(q.scansCount, matchedCusts.length),
      registrationsCount: matchedCusts.length,
      revenue,
      isActive: q.isActive,
    };
  });

  const directCusts = filteredCustomers.filter(
    (c) => !knownCodes.has(c.qrSource)
  );
  if (directCusts.length > 0) {
    const directRevenue = allCustomers
      .filter((c) => !knownCodes.has(c.qrSource))
      .reduce(
        (acc, c) => acc + (filteredSalesByCustomer.get(c.id)?.spent ?? 0),
        0
      );
    qrComparison.push({
      id: 9999,
      code: "direct",
      name: "TO‘G‘RIDAN-TO‘G‘RI KIRISH",
      scansCount: directCusts.length,
      registrationsCount: directCusts.length,
      revenue: directRevenue,
      isActive: true,
    });
  }

  const bonusBreakdown = [
    {
      label: "Yangi mijoz (Welcome)",
      grams: filteredBonuses
        .filter((b) => b.type === "WELCOME" && Number(b.amountGrams) > 0)
        .reduce((a, b) => a + Number(b.amountGrams), 0),
    },
    {
      label: "Qayta xarid",
      grams: filteredBonuses
        .filter(
          (b) => b.type === "REPEAT_PURCHASE" && Number(b.amountGrams) > 0
        )
        .reduce((a, b) => a + Number(b.amountGrams), 0),
    },
    {
      label: "Qo‘lda berilgan",
      grams: filteredBonuses
        .filter((b) => b.type === "MANUAL_GRANT" && Number(b.amountGrams) > 0)
        .reduce((a, b) => a + Number(b.amountGrams), 0),
    },
    {
      label: "Ishlatilgan",
      grams: usedBonusesGrams,
    },
  ];

  const customersForRanking = allCustomers.map((c) => {
    if (!hasDateFilter) return c;
    const fs = filteredSalesByCustomer.get(c.id) || {
      spent: 0,
      count: 0,
      items: 0,
    };
    return {
      ...c,
      totalSpent: fs.spent,
      purchasesCount: fs.count,
      totalItemsBought: fs.items,
    };
  });

  const topBySpent = [...customersForRanking]
    .sort((a, b) => Number(b.totalSpent) - Number(a.totalSpent))
    .slice(0, 8);

  const topByPurchases = [...customersForRanking]
    .sort(
      (a, b) =>
        Number(b.purchasesCount) - Number(a.purchasesCount) ||
        Number(b.totalSpent) - Number(a.totalSpent)
    )
    .slice(0, 8);

  const topByItems = [...customersForRanking]
    .sort(
      (a, b) =>
        Number(b.totalItemsBought) - Number(a.totalItemsBought) ||
        Number(b.totalSpent) - Number(a.totalSpent)
    )
    .slice(0, 8);

  const topVip = customersForRanking
    .filter((c) => c.isVip)
    .sort((a, b) => Number(b.totalSpent) - Number(a.totalSpent))
    .slice(0, 10);

  const productStats = allProducts
    .map((p) => {
      const pItems = allSaleItems.filter(
        (it) => it.productId === p.id && filteredSaleIds.has(it.saleId)
      );
      const unitsSold = pItems.reduce((a, i) => a + Number(i.quantity), 0);
      const ordersCount = pItems.length;
      const revenue = pItems.reduce(
        (a, i) => a + Number(i.lineFinalAmount),
        0
      );
      return {
        id: p.id,
        productCode: p.productCode,
        name: p.name,
        brand: p.brand,
        category: p.category,
        volume: p.volume,
        price: p.price,
        unitsSold,
        ordersCount,
        revenue,
      };
    })
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue);

  const employeeStats = allEmployees
    .map((e) => {
      const empCusts = filteredCustomers.filter(
        (c) => c.registeredByEmployeeId === e.id
      ).length;
      const empSales = filteredSales.filter((s) => s.employeeId === e.id);
      const empSalesSum = empSales.reduce(
        (a, s) => a + Number(s.finalAmount || 0),
        0
      );
      return {
        id: e.id,
        fullName: e.fullName,
        phone: e.phone,
        login: e.login,
        role: e.role,
        isActive: e.isActive,
        isBlocked: e.isBlocked,
        registeredCustomersCount: empCusts,
        salesCount: empSales.length,
        totalSalesAmount: empSalesSum,
      };
    })
    .sort((a, b) => b.totalSalesAmount - a.totalSalesAmount);

  return {
    kpis: {
      totalCustomers: filteredCustomers.length,
      todayNewCustomers,
      monthlyNewCustomers,
      vipCustomersCount,
      todaySales,
      weeklySales,
      monthlySales,
      yearlySales,
      totalSales,
      grantedBonusesGrams,
      usedBonusesGrams,
      remainingBonusesGrams,
      bonusEstimatedCostSom: Math.round(
        grantedBonusesGrams * Number(config.gramValueInSom || 15000)
      ),
      flyerCustomersCount,
      cashierCustomersCount,
      otherSourceCustomersCount,
      discount30Count,
      discount30Sum,
      discount45Count,
      discount45Sum,
      otherDiscountCount,
      otherDiscountSum,
      totalDiscountSum,
    },
    charts: {
      dailySeries,
      weeklySeries,
      monthlySeries,
      qrComparison,
      bonusBreakdown,
    },
    rankings: {
      topBySpent,
      topByPurchases,
      topByItems,
      topVip,
      topProducts: productStats,
      employeeStats,
    },
  };
}
