import type {
  Period,
  PeriodStats,
  SetAnalysis,
  Hotel,
  LapsedUser,
  RawOrder,
  AnalysisResult,
  ColumnMapping,
  Tier,
} from './types';

export const FOOD_VENDORS = [
  'sysco',
  'us foods',
  'ben e keith',
  'gordon food service',
  'shamrock foods',
  'nicholas and company',
  'nicholas company',
  'cheney brothers',
  'cheney borthers',
  'keany produce',
];

export const BAD_STATUS = ['cancelled', 'canceled', 'declined'];

export const DEMO = `OrderID,Property,Spend,OrderDate,Company,Vendor,User,Status
O001,Grand Palace Hotel,1250,2026-05-20,Marriott Group,Sysco,alice@marriott.com,Completed
O002,Grand Palace Hotel,1400,2026-05-10,Marriott Group,US Foods,bob@marriott.com,Completed
O003,Grand Palace Hotel,1100,2026-05-02,Marriott Group,Sysco,alice@marriott.com,Completed
O004,Grand Palace Hotel,890,2026-05-18,Marriott Group,CleanPro,bob@marriott.com,Completed
O005,Grand Palace Hotel,750,2026-04-28,Marriott Group,TechSupply,carol@marriott.com,Completed
O006,Grand Palace Hotel,1600,2026-04-20,Marriott Group,Sysco,carol@marriott.com,Completed
O007,Grand Palace Hotel,1100,2026-04-08,Marriott Group,US Foods,alice@marriott.com,Completed
O008,Grand Palace Hotel,2200,2026-04-15,Marriott Group,TechSupply,bob@marriott.com,Completed
O009,Grand Palace Hotel,870,2026-03-28,Marriott Group,CleanPro,carol@marriott.com,Completed
O010,Grand Palace Hotel,1950,2026-03-20,Marriott Group,Sysco,alice@marriott.com,Completed
O011,Grand Palace Hotel,1300,2026-03-12,Marriott Group,US Foods,bob@marriott.com,Completed
O012,Grand Palace Hotel,900,2026-03-05,Marriott Group,CleanPro,carol@marriott.com,Completed
O013,Sunset Beach Resort,380,2026-05-22,Marriott Group,Shamrock Foods,dave@marriott.com,Completed
O014,Sunset Beach Resort,510,2026-05-14,Marriott Group,LinenMaster,eve@marriott.com,Completed
O015,Sunset Beach Resort,480,2026-05-05,Marriott Group,CleanPro,dave@marriott.com,Completed
O016,Sunset Beach Resort,640,2026-04-18,Marriott Group,Shamrock Foods,dave@marriott.com,Completed
O017,Sunset Beach Resort,720,2026-04-10,Marriott Group,Sysco,frank@marriott.com,Completed
O018,Sunset Beach Resort,560,2026-04-02,Marriott Group,LinenMaster,eve@marriott.com,Completed
O019,Sunset Beach Resort,810,2026-03-30,Marriott Group,Shamrock Foods,frank@marriott.com,Completed
O020,Sunset Beach Resort,700,2026-03-14,Marriott Group,Sysco,dave@marriott.com,Completed
O021,Sunset Beach Resort,590,2026-03-08,Marriott Group,CleanPro,eve@marriott.com,Completed
O022,City Center Inn,3200,2026-05-21,UrbanStay,TechSupply,grace@urban.com,Completed
O023,City Center Inn,1900,2026-05-11,UrbanStay,HD Supply,henry@urban.com,Completed
O024,City Center Inn,4100,2026-05-06,UrbanStay,CleanPro,irene@urban.com,Completed
O025,City Center Inn,2200,2026-04-22,UrbanStay,TechSupply,henry@urban.com,Completed
O026,City Center Inn,5100,2026-04-14,UrbanStay,HD Supply,irene@urban.com,Completed
O027,City Center Inn,3800,2026-04-07,UrbanStay,CleanPro,grace@urban.com,Completed
O028,City Center Inn,4400,2026-03-21,UrbanStay,TechSupply,irene@urban.com,Completed
O029,City Center Inn,3100,2026-03-13,UrbanStay,HD Supply,grace@urban.com,Completed
O030,Harbor Lights Hotel,95,2026-05-09,CoastalHotels,Sysco,jack@coastal.com,Completed
O031,Harbor Lights Hotel,180,2026-05-02,CoastalHotels,CleanPro,jack@coastal.com,Completed
O032,Harbor Lights Hotel,740,2026-04-19,CoastalHotels,Sysco,kate@coastal.com,Completed
O033,Harbor Lights Hotel,690,2026-04-11,CoastalHotels,CleanPro,jack@coastal.com,Completed
O034,Harbor Lights Hotel,1050,2026-03-26,CoastalHotels,Sysco,jack@coastal.com,Completed
O035,Harbor Lights Hotel,880,2026-03-18,CoastalHotels,CleanPro,kate@coastal.com,Completed
O036,The Continental,4200,2026-05-24,LuxGroup,US Foods,quinn@lux.com,Completed
O037,The Continental,5100,2026-05-15,LuxGroup,Sysco,quinn@lux.com,Completed
O038,The Continental,4600,2026-05-10,LuxGroup,TechSupply,sam@lux.com,Completed
O039,The Continental,3900,2026-05-04,LuxGroup,CleanPro,rose@lux.com,Completed
O040,The Continental,4100,2026-04-21,LuxGroup,Sysco,quinn@lux.com,Completed
O041,The Continental,4800,2026-04-14,LuxGroup,TechSupply,rose@lux.com,Completed
O042,The Continental,4300,2026-03-22,LuxGroup,US Foods,rose@lux.com,Completed
O043,The Continental,4900,2026-03-14,LuxGroup,CleanPro,quinn@lux.com,Completed
O044,Riverside Suites,440,2026-05-21,RiverStay,CleanPro,tina@river.com,Completed
O045,Riverside Suites,310,2026-05-13,RiverStay,TechSupply,tina@river.com,Completed
O046,Riverside Suites,2000,2026-05-15,RiverStay,CleanPro,tina@river.com,Cancelled
O047,Riverside Suites,980,2026-04-18,RiverStay,CleanPro,uma@river.com,Completed
O048,Riverside Suites,1100,2026-04-10,RiverStay,TechSupply,tina@river.com,Completed
O049,Riverside Suites,800,2026-04-05,RiverStay,TechSupply,uma@river.com,Declined
O050,Riverside Suites,1180,2026-03-18,RiverStay,CleanPro,uma@river.com,Completed
O051,Riverside Suites,920,2026-03-10,RiverStay,TechSupply,tina@river.com,Completed`;

export function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const p = s.split(/[\/\-\.]/);
  if (p.length === 3) {
    const [a, b, c] = p;
    if (a.length === 4) return new Date(+a, +b - 1, +c);
    return new Date(+c < 100 ? 2000 + +c : +c, +a - 1, +b);
  }
  return null;
}

export function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isFood(vendor: string, foodVendors: string[] = FOOD_VENDORS): boolean {
  const n = normalize(vendor);
  return foodVendors.some((fv) => n.includes(fv));
}

export function isValidStatus(st: string): boolean {
  if (!st) return true;
  const n = normalize(st);
  return !BAD_STATUS.some((b) => n === b || n.includes(b));
}

export function fmt$(v: number): string {
  return v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + Math.round(v);
}

export function fmtPct(v: number | null): string {
  if (v === null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
}

export function pct(c: number, p: number): number | null {
  if (!p) return c > 0 ? 100 : null;
  return ((c - p) / p) * 100;
}

export function tierOf(score: number): Tier {
  return score >= 75 ? 'green' : score >= 40 ? 'amber' : 'red';
}

export function tierLbl(t: Tier): string {
  return t === 'green' ? 'Healthy' : t === 'amber' ? 'Watch' : 'At risk';
}

export function dC(v: number | null): string {
  if (v === null) return 'delta-flat';
  return v > 0 ? 'delta-pos' : 'delta-neg';
}

export function mC(v: number | null): string {
  if (v === null) return 'flat';
  return v > 0 ? 'pos' : 'neg';
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function scoreFromDeltas(
  p1: PeriodStats,
  p2: PeriodStats,
  p3: PeriodStats,
  mtd1: number,
  mtd2: number,
  mtd3: number
): number {
  let score = 100;

  if (p1.spend === 0 && p1.orders === 0) return 0;

  // Metric 1: Total Spend P1 vs Prior60Avg (avg of P2+P3), weight 50%
  const prior60Avg = (p2.spend + p3.spend) / 2;
  if (prior60Avg > 0) {
    const delta = ((p1.spend - prior60Avg) / prior60Avg) * 100;
    score += clamp(delta * 0.5, -45, 20);
  }

  // Metric 2: MTD1 vs AVG(MTD2+MTD3), weight 30%
  const mtdAvg = (mtd2 + mtd3) / 2;
  if (mtdAvg > 0) {
    const delta = ((mtd1 - mtdAvg) / mtdAvg) * 100;
    score += clamp(delta * 0.3, -25, 15);
  }

  // Metric 3: Users P1 vs P2, weight 20%
  if (p2.users > 0) {
    const delta = ((p1.users - p2.users) / p2.users) * 100;
    score += clamp(delta * 0.2, -20, 8);
  }

  // Penalty: no users
  if (p1.users === 0) score -= 25;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function analyzeSet(
  orders: RawOrder[],
  P: Period,
  label: string,
  mtd1: number,
  mtd2: number,
  mtd3: number
): SetAnalysis {
  function agg(s: Date, e: Date): PeriodStats {
    const sub = orders.filter((o) => o.date >= s && o.date <= e);
    return {
      spend: sub.reduce((a, o) => a + o.spend, 0),
      orders: sub.length,
      users: new Set(sub.map((o) => o.user).filter(Boolean)).size,
    };
  }
  const p1 = agg(P.p1start, P.p1end);
  const p2 = agg(P.p2start, P.p2end);
  const p3 = agg(P.p3start, P.p3end);
  const spendP1P2 = pct(p1.spend, p2.spend);
  const spendP1P3 = pct(p1.spend, p3.spend);
  const usersP1P2 = pct(p1.users, p2.users);
  const ordersP1P2 = pct(p1.orders, p2.orders);
  const flags: SetAnalysis['flags'] = [];

  // Prior60Avg for flag computations
  const prior60Avg = (p2.spend + p3.spend) / 2;
  const spendVsPrior60Avg = prior60Avg > 0 ? ((p1.spend - prior60Avg) / prior60Avg) * 100 : null;
  const mtdAvg = (mtd2 + mtd3) / 2;
  const mtd1VsMtdAvg = mtdAvg > 0 ? ((mtd1 - mtdAvg) / mtdAvg) * 100 : null;

  // Flags (new logic)
  if (p1.orders === 0 && (p2.orders > 0 || p3.orders > 0)) {
    flags.push({ t: 'crit', l: 'No orders in last 30d' });
  }

  if (spendVsPrior60Avg !== null && spendVsPrior60Avg <= -40) {
    flags.push({ t: 'crit', l: `Spend ▼${Math.abs(spendVsPrior60Avg).toFixed(0)}% vs prior avg` });
  }

  if (mtd1VsMtdAvg !== null && mtd1VsMtdAvg <= -40) {
    flags.push({ t: 'crit', l: `MTD ▼${Math.abs(mtd1VsMtdAvg).toFixed(0)}% vs prior months` });
  }

  if (usersP1P2 !== null && usersP1P2 <= -30) {
    flags.push({ t: 'warn', l: `Users ▼${Math.abs(usersP1P2).toFixed(0)}% vs P2` });
  }

  if (ordersP1P2 !== null && ordersP1P2 <= -40) {
    flags.push({ t: 'warn', l: `Orders ▼${Math.abs(ordersP1P2).toFixed(0)}% vs P2` });
  }

  if (spendVsPrior60Avg !== null && spendVsPrior60Avg >= 15 && p1.orders > 0) {
    flags.push({ t: 'good', l: `Growing ▲${spendVsPrior60Avg.toFixed(0)}%` });
  }

  if (mtd1VsMtdAvg !== null && Math.abs(mtd1VsMtdAvg) < 20) {
    flags.push({ t: 'good', l: 'MTD Stable' });
  }

  const score = scoreFromDeltas(p1, p2, p3, mtd1, mtd2, mtd3);
  return { p1, p2, p3, spendP1P2, spendP1P3, usersP1P2, ordersP1P2, flags, score, tier: tierOf(score) };
}

export function parseCsvRows(text: string): { cols: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  const cols = lines[0].split(',').map((c) => c.trim().replace(/"/g, ''));
  const rows = lines
    .slice(1)
    .map((l) => {
      const v = l.split(',').map((x) => x.trim().replace(/"/g, ''));
      const o: Record<string, string> = {};
      cols.forEach((c, i) => (o[c] = v[i] || ''));
      return o;
    })
    .filter((r) => Object.values(r).some((v) => v));
  return { cols, rows };
}

/** Compute MTD spend for a property's orders given a reference end date (inclusive)
 *  and "day-of-month cutoff" for prior months. */
function computeMtd(
  orders: RawOrder[],
  monthsBack: number,
  refEndDate: Date,
  cutoffDay: number
): number {
  const year = refEndDate.getFullYear();
  const month = refEndDate.getMonth(); // 0-indexed
  const targetMonth = month - monthsBack;
  // Resolve month overflow
  const d = new Date(year, targetMonth, 1);
  const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
  const mEnd = new Date(d.getFullYear(), d.getMonth(), cutoffDay, 23, 59, 59, 999);
  return orders
    .filter((o) => o.date >= mStart && o.date <= mEnd)
    .reduce((s, o) => s + o.spend, 0);
}

export interface RunAnalysisOptions {
  excludedCompanies?: Set<string>;
  foodVendors?: string[];
  foodProperties?: Record<string, boolean>;
  excludedProperties?: Record<string, boolean>;
}

export function runAnalysis(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  options: RunAnalysisOptions = {}
): AnalysisResult {
  const { mProp, mSpend, mDate, mUser, mVendor, mCompany, mStatus, mCsm } = mapping;
  const { excludedCompanies = new Set<string>(), foodVendors, foodProperties = {}, excludedProperties = {} } = options;
  const effectiveFoodVendors = (foodVendors && foodVendors.length > 0) ? foodVendors : FOOD_VENDORS;

  const allOrders: RawOrder[] = rows
    .map((r) => ({
      prop: (mProp ? r[mProp] : '') || 'Unknown',
      spend: parseFloat(mSpend ? r[mSpend] : '0') || 0,
      date: parseDate(mDate ? r[mDate] : '') as Date,
      user: mUser ? r[mUser] : '',
      vendor: mVendor ? r[mVendor] : '',
      company: (mCompany ? r[mCompany] : '') || 'Unknown',
      status: mStatus ? r[mStatus] : '',
      csm: mCsm ? r[mCsm] : '',
    }))
    .filter((o) => o.date && !isNaN(o.date.getTime()));

  const excludedCount = allOrders.filter((o) => !isValidStatus(o.status)).length;
  const validOrders = allOrders.filter((o) => isValidStatus(o.status));

  // Filter out excluded companies and excluded properties
  const orders = validOrders.filter(
    (o) =>
      !excludedCompanies.has(o.company) &&
      excludedProperties[o.prop] !== false
  );

  const minDate = orders.length
    ? new Date(Math.min(...orders.map((o) => o.date.getTime())))
    : null;
  const maxDate = new Date(Math.max(...orders.map((o) => o.date.getTime())));

  const P: Period = {
    p1end: maxDate,
    p1start: new Date(maxDate),
    p2end: new Date(),
    p2start: new Date(),
    p3end: new Date(),
    p3start: new Date(),
  };
  P.p1start.setDate(P.p1start.getDate() - 29);
  P.p2end = new Date(P.p1start);
  P.p2end.setDate(P.p2end.getDate() - 1);
  P.p2start = new Date(P.p2end);
  P.p2start.setDate(P.p2start.getDate() - 29);
  P.p3end = new Date(P.p2start);
  P.p3end.setDate(P.p3end.getDate() - 1);
  P.p3start = new Date(P.p3end);
  P.p3start.setDate(P.p3start.getDate() - 29);

  // MTD cutoff: day-of-month of maxDate
  const mtdCutoffDay = maxDate.getDate();

  const haveVendor = !!mVendor;
  const propNames = [...new Set(orders.map((o) => o.prop))];

  const hotels: Hotel[] = propNames.map((prop) => {
    const all = orders.filter((o) => o.prop === prop);
    const company = all.find((o) => o.company)?.company || 'Unknown';

    // CSM: use the first non-empty CSM value found, fallback to "Federico Campos"
    const csmValue = all.find((o) => o.csm && o.csm.trim())?.csm?.trim() || 'Federico Campos';

    const overallP1 = all.filter((o) => o.date >= P.p1start && o.date <= P.p1end);
    const overall = {
      spend: overallP1.reduce((a, o) => a + o.spend, 0),
      users: new Set(overallP1.map((o) => o.user).filter(Boolean)).size,
      orders: overallP1.length,
    };
    const p2Orders = all.filter((o) => o.date >= P.p2start && o.date <= P.p2end);
    const overallSpendP1P2 = pct(
      overall.spend,
      p2Orders.reduce((a, o) => a + o.spend, 0)
    );
    const overallUsersP1P2 = pct(
      overall.users,
      new Set(p2Orders.map((o) => o.user).filter(Boolean)).size
    );

    // MTD values
    const mtd1 = computeMtd(all, 0, maxDate, mtdCutoffDay);
    const mtd2 = computeMtd(all, 1, maxDate, mtdCutoffDay);
    const mtd3 = computeMtd(all, 2, maxDate, mtdCutoffDay);

    // Last order date
    const lastOrder = all.reduce<Date | null>((best, o) => {
      if (!best || o.date > best) return o.date;
      return best;
    }, null);

    // First order date
    const firstOrder = all.reduce<Date | null>((oldest, o) => {
      if (!oldest || o.date < oldest) return o.date;
      return oldest;
    }, null);

    const foodOrders = haveVendor ? all.filter((o) => isFood(o.vendor, effectiveFoodVendors)) : [];
    const suppliesOrders = haveVendor ? all.filter((o) => !isFood(o.vendor, effectiveFoodVendors)) : all;
    const totalFoodSpend = foodOrders.reduce((a, o) => a + o.spend, 0);

    // MTD split: food-only and supplies-only
    const mtd1Food = computeMtd(foodOrders, 0, maxDate, mtdCutoffDay);
    const mtd2Food = computeMtd(foodOrders, 1, maxDate, mtdCutoffDay);
    const mtd3Food = computeMtd(foodOrders, 2, maxDate, mtdCutoffDay);
    const mtd1Supplies = computeMtd(suppliesOrders, 0, maxDate, mtdCutoffDay);
    const mtd2Supplies = computeMtd(suppliesOrders, 1, maxDate, mtdCutoffDay);
    const mtd3Supplies = computeMtd(suppliesOrders, 2, maxDate, mtdCutoffDay);

    const userWantsFood = foodProperties[prop] !== undefined
      ? foodProperties[prop] === true
      : (totalFoodSpend >= 300 && foodOrders.length > 0);
    let split = false;
    let food: ReturnType<typeof analyzeSet> | null = null;
    let supplies: ReturnType<typeof analyzeSet> | null = null;
    let single: ReturnType<typeof analyzeSet> | null = null;

    if (userWantsFood) {
      split = true;
      if (totalFoodSpend >= 300 && foodOrders.length > 0) {
        food = analyzeSet(foodOrders, P, 'food', mtd1Food, mtd2Food, mtd3Food);
        supplies = analyzeSet(suppliesOrders, P, 'supplies', mtd1Supplies, mtd2Supplies, mtd3Supplies);
      } else {
        // Property expected to order food but hasn't (or < $300): zero food + critical flag
        food = {
          p1: { spend: 0, orders: 0, users: 0 },
          p2: { spend: 0, orders: 0, users: 0 },
          p3: { spend: 0, orders: 0, users: 0 },
          spendP1P2: null,
          spendP1P3: null,
          usersP1P2: null,
          ordersP1P2: null,
          flags: [{ t: 'crit' as const, l: 'No food orders' }],
          score: 0,
          tier: 'red' as const,
        };
        supplies = analyzeSet(all, P, 'supplies', mtd1, mtd2, mtd3);
      }
    } else {
      split = false;
      single = analyzeSet(all, P, 'order', mtd1, mtd2, mtd3);
    }

    const sortScore = split ? Math.round((food!.score + supplies!.score) / 2) : single!.score;
    const tier = tierOf(sortScore);
    return {
      prop,
      company,
      split,
      food,
      supplies,
      single,
      overall,
      overallSpendP1P2,
      overallUsersP1P2,
      sortScore,
      tier,
      mtd1,
      mtd2,
      mtd3,
      lastOrder,
      csm: csmValue,
      firstOrder,
    };
  });

  // Lapsed users
  const prior60start = P.p3start;
  const prior60end = P.p2end;
  const byKey: Record<
    string,
    {
      user: string;
      prop: string;
      company: string;
      p1count: number;
      priorCount: number;
      priorSpend: number;
      lastDate: Date | null;
    }
  > = {};

  orders.forEach((o) => {
    if (!o.user) return;
    const key = o.user + '||' + o.prop;
    if (!byKey[key])
      byKey[key] = {
        user: o.user,
        prop: o.prop,
        company: o.company,
        p1count: 0,
        priorCount: 0,
        priorSpend: 0,
        lastDate: null,
      };
    const rec = byKey[key];
    if (o.date >= P.p1start && o.date <= P.p1end) rec.p1count++;
    if (o.date >= prior60start && o.date <= prior60end) {
      rec.priorCount++;
      rec.priorSpend += o.spend;
      if (!rec.lastDate || o.date > rec.lastDate) rec.lastDate = o.date;
    }
  });

  const lapsed: LapsedUser[] = Object.values(byKey)
    .filter((r) => r.p1count === 0 && r.priorCount > 0)
    .map((r) => ({
      ...r,
      daysSince: Math.round((maxDate.getTime() - (r.lastDate?.getTime() ?? 0)) / 86400000),
    }));

  // Compute total food spend per property across all orders (for initializing foodProperties)
  const propertyFoodSpend: Record<string, number> = {};
  propNames.forEach((prop) => {
    const all = orders.filter((o) => o.prop === prop);
    const fOrders = haveVendor ? all.filter((o) => isFood(o.vendor, effectiveFoodVendors)) : [];
    propertyFoodSpend[prop] = fOrders.reduce((a, o) => a + o.spend, 0);
  });

  return { hotels, lapsed, periods: P, excludedCount, minDate, maxDate, propertyFoodSpend };
}
