export interface Period {
  p1start: Date;
  p1end: Date;
  p2start: Date;
  p2end: Date;
  p3start: Date;
  p3end: Date;
}

export interface PeriodStats {
  spend: number;
  orders: number;
  users: number;
}

export interface SetAnalysis {
  p1: PeriodStats;
  p2: PeriodStats;
  p3: PeriodStats;
  spendP1P2: number | null;
  spendP1P3: number | null;
  usersP1P2: number | null;
  ordersP1P2: number | null;
  flags: Flag[];
  score: number;
  tier: Tier;
}

export interface Flag {
  t: FlagType;
  l: string;
}

export type FlagType = 'crit' | 'warn' | 'info' | 'good' | 'foodtag' | 'supptag';
export type Tier = 'red' | 'amber' | 'green';

export interface Hotel {
  prop: string;
  company: string;
  split: boolean;
  food: SetAnalysis | null;
  supplies: SetAnalysis | null;
  single: SetAnalysis | null;
  overall: { spend: number; users: number; orders: number };
  overallSpendP1P2: number | null;
  overallUsersP1P2: number | null;
  sortScore: number;
  tier: Tier;
  mtd1: number;
  mtd2: number;
  mtd3: number;
  lastOrder: Date | null;
  csm: string;
  firstOrder: Date | null;
  goLiveDate?: string;
  totalSpend90d: number;
  isNewOnboarding: boolean;
  lowSpend: 'crit' | 'warn' | null;
}

export interface LapsedUser {
  user: string;
  prop: string;
  company: string;
  p1count: number;
  priorCount: number;
  priorSpend: number;
  lastDate: Date | null;
  daysSince: number;
}

export interface RawOrder {
  prop: string;
  spend: number;
  date: Date;
  user: string;
  vendor: string;
  company: string;
  status: string;
  csm: string;
}

export interface AnalysisResult {
  hotels: Hotel[];
  lapsed: LapsedUser[];
  periods: Period;
  excludedCount: number;
  minDate: Date | null;
  maxDate: Date;
  propertyFoodSpend: Record<string, number>;
}

export interface ColumnMapping {
  mProp: string | null;
  mSpend: string | null;
  mDate: string | null;
  mUser: string | null;
  mVendor: string | null;
  mCompany: string | null;
  mStatus: string | null;
  mCsm: string | null;
  mGoLive?: string | null;
}
