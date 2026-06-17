'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Hotel, LapsedUser, Period, ColumnMapping } from './lib/types';
import {
  DEMO,
  FOOD_VENDORS,
  parseCsvRows,
  runAnalysis,
  fmt$,
  fmtPct,
  mC,
  dC,
  tierLbl,
  tierOf,
} from './lib/analysis';

type Tier = 'red' | 'amber' | 'green';
type Tab = 'dash' | 'lapsed' | 'settings';
type LapsedSortKey = 'user' | 'prop' | 'company' | 'lastDate' | 'priorCount' | 'priorSpend';

const CSM_OPTIONS = ['Federico Campos', 'Michelle Castro'];

interface FieldDef {
  id: keyof ColumnMapping;
  label: string;
  kw: string[];
}

const FIELDS: FieldDef[] = [
  { id: 'mProp', label: 'Property / hotel name', kw: ['property', 'hotel', 'name', 'client'] },
  { id: 'mSpend', label: 'Order spend / amount', kw: ['spend', 'amount', 'total', 'value', 'price'] },
  { id: 'mDate', label: 'Order date', kw: ['date', 'placed', 'created', 'time'] },
  { id: 'mUser', label: 'User / contact', kw: ['user', 'contact', 'email', 'buyer', 'person'] },
  { id: 'mVendor', label: 'Vendor (for food/supplies split)', kw: ['vendor', 'supplier', 'provider'] },
  { id: 'mCompany', label: 'Company name', kw: ['company', 'group', 'chain', 'org'] },
  { id: 'mStatus', label: 'Status (to exclude cancelled/declined)', kw: ['status', 'state'] },
  { id: 'mCsm', label: 'CSM Owner', kw: ['csm', 'csm owner', 'account manager', 'owner'] },
];

function autoCol(cols: string[], kws: string[]): string {
  return cols.find((c) => kws.some((k) => c.toLowerCase().includes(k))) || '';
}

function buildInitialMapping(cols: string[]): ColumnMapping {
  const m: ColumnMapping = {
    mProp: null,
    mSpend: null,
    mDate: null,
    mUser: null,
    mVendor: null,
    mCompany: null,
    mStatus: null,
    mCsm: null,
  };
  FIELDS.forEach((f) => {
    const found = autoCol(cols, f.kw);
    m[f.id] = found || null;
  });
  return m;
}

function fmtDDMMMYYYY(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDDMMM(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ---- Sub-components ----

function ScoreRing({ hotel }: { hotel: Hotel }) {
  if (!hotel.split) {
    return <div className={`score-ring ${hotel.single!.tier}`}>{hotel.single!.score}</div>;
  }
  return (
    <div className="score-split-avg">
      <div className={`score-ring ${hotel.tier}`}>{hotel.sortScore}</div>
      <div className="score-sub-row">
        <div className={`score-mini ${hotel.food!.tier}`}>
          <span className="cat">F</span>
          <span className="num">{hotel.food!.score}</span>
        </div>
        <div className={`score-mini ${hotel.supplies!.tier}`}>
          <span className="cat">S</span>
          <span className="num">{hotel.supplies!.score}</span>
        </div>
      </div>
    </div>
  );
}

function HealthBar({ hotel }: { hotel: Hotel }) {
  if (!hotel.split) {
    return (
      <>
        <div className="bar-row">
          <div className="bar-bg">
            <div className={`bar-fill ${hotel.single!.tier}`} style={{ width: `${hotel.single!.score}%` }} />
          </div>
        </div>
        <div className="bar-lbl">{tierLbl(hotel.single!.tier)}</div>
      </>
    );
  }
  return (
    <>
      <div className="bar-row">
        <span className="bar-cat">F</span>
        <div className="bar-bg">
          <div className={`bar-fill ${hotel.food!.tier}`} style={{ width: `${hotel.food!.score}%` }} />
        </div>
      </div>
      <div className="bar-row">
        <span className="bar-cat">S</span>
        <div className="bar-bg">
          <div className={`bar-fill ${hotel.supplies!.tier}`} style={{ width: `${hotel.supplies!.score}%` }} />
        </div>
      </div>
    </>
  );
}

function HotelFlags({ hotel }: { hotel: Hotel }) {
  if (hotel.split) {
    const foodFlags = hotel.food!.flags.map((f, i) => (
      <span key={`f${i}`} className={`flag ${f.t === 'good' || f.t === 'info' ? f.t : 'foodtag'}`}>
        Food {f.l}
      </span>
    ));
    const suppFlags = hotel.supplies!.flags.map((f, i) => (
      <span key={`s${i}`} className={`flag ${f.t === 'good' || f.t === 'info' ? f.t : 'supptag'}`}>
        Supplies {f.l}
      </span>
    ));
    const allFlags = [...foodFlags, ...suppFlags];
    if (!allFlags.length) {
      return <span className="flag good">Stable (food &amp; supplies)</span>;
    }
    return <>{allFlags}</>;
  }
  const flags = hotel.single!.flags.map((f, i) => (
    <span key={i} className={`flag ${f.t}`}>{f.l}</span>
  ));
  return (
    <>
      {flags.length ? flags : hotel.single!.tier === 'green' ? <span className="flag good">Stable</span> : null}
      {' '}
      <span className="flag info">Supplies only</span>
    </>
  );
}

interface PeriodTableProps {
  a: NonNullable<Hotel['food'] | Hotel['single']>;
  label: string;
}
function PeriodTable({ a, label }: PeriodTableProps) {
  return (
    <table className="period-table">
      <thead>
        <tr>
          <th>{label}</th>
          <th>P3 (oldest)</th>
          <th>P2</th>
          <th>P1 (latest)</th>
          <th>P1 vs P2</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Total spend</td>
          <td>{fmt$(a.p3.spend)}</td>
          <td>{fmt$(a.p2.spend)}</td>
          <td>{fmt$(a.p1.spend)}</td>
          <td className={dC(a.spendP1P2)}>{fmtPct(a.spendP1P2)}</td>
        </tr>
        <tr>
          <td>Orders placed</td>
          <td>{a.p3.orders}</td>
          <td>{a.p2.orders}</td>
          <td>{a.p1.orders}</td>
          <td className={dC(a.ordersP1P2)}>{fmtPct(a.ordersP1P2)}</td>
        </tr>
        <tr>
          <td>Unique users</td>
          <td>{a.p3.users}</td>
          <td>{a.p2.users}</td>
          <td>{a.p1.users}</td>
          <td className={dC(a.usersP1P2)}>{fmtPct(a.usersP1P2)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function MiniChart({ a }: { a: NonNullable<Hotel['food'] | Hotel['single']> }) {
  const mx = Math.max(a.p3.spend, a.p2.spend, a.p1.spend) || 1;
  const bars = [
    { v: a.p3.spend, l: 'P3' },
    { v: a.p2.spend, l: 'P2' },
    { v: a.p1.spend, l: 'P1' },
  ];
  return (
    <div className="mini-chart">
      <div className="bars3">
        {bars.map((b) => {
          const ht = Math.max(4, (b.v / mx) * 100);
          const c = b.v >= mx * 0.8 ? 'var(--green)' : b.v >= mx * 0.5 ? 'var(--amber)' : 'var(--red)';
          return (
            <div key={b.l} className="b3-wrap">
              <div className="b3-inner">
                <div className="b3-bar" style={{ height: `${ht}%`, background: c }}>
                  <div className="b3-val">{fmt$(b.v)}</div>
                </div>
              </div>
              <div className="b3-lbl">{b.l}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface HotelDetailProps {
  hotel: Hotel;
  onCollapse: () => void;
  onCopyPrompt: () => void;
}
function HotelDetail({ hotel, onCollapse, onCopyPrompt }: HotelDetailProps) {
  return (
    <div className="detail">
      {hotel.split ? (
        <>
          <div className="detail-section">
            <div className="ds-head food">
              <span className="pill">Food</span> Health {hotel.food!.score}/100 · {tierLbl(hotel.food!.tier)}
            </div>
            <PeriodTable a={hotel.food!} label="Food" />
            <MiniChart a={hotel.food!} />
          </div>
          <div className="detail-section">
            <div className="ds-head supp">
              <span className="pill">Supplies</span> Health {hotel.supplies!.score}/100 · {tierLbl(hotel.supplies!.tier)}
            </div>
            <PeriodTable a={hotel.supplies!} label="Supplies" />
            <MiniChart a={hotel.supplies!} />
          </div>
        </>
      ) : (
        <div className="detail-section">
          <PeriodTable a={hotel.single!} label="Metric" />
          <MiniChart a={hotel.single!} />
        </div>
      )}
      <div className="action-row">
        <button className="act-btn primary" onClick={onCopyPrompt}>
          <i className="ti ti-clipboard" style={{ verticalAlign: '-2px', marginRight: 4 }} />
          Copy action prompt
        </button>
        <button className="act-btn" onClick={onCollapse}>
          Collapse
        </button>
      </div>
    </div>
  );
}

// ---- Settings tab sub-components ----

interface CompanyRow {
  name: string;
  enabled: boolean;
  reason: string;
}

interface VendorRow {
  name: string;
  isFood: boolean;
}

interface SettingsTabProps {
  companies: CompanyRow[];
  vendors: VendorRow[];
  foodProperties: Record<string, boolean>;
  onCompanyChange: (name: string, field: 'enabled' | 'reason', value: boolean | string) => void;
  onVendorChange: (name: string, isFood: boolean) => void;
  onSelectAllCompanies: (val: boolean) => void;
  onSelectAllVendors: (val: boolean) => void;
  onFoodPropertyChange: (name: string, value: boolean) => void;
  onSelectAllFoodProperties: (val: boolean) => void;
}

const SETTINGS_PAGE_SIZE = 10;

function SettingsTab({
  companies,
  vendors,
  foodProperties,
  onCompanyChange,
  onVendorChange,
  onSelectAllCompanies,
  onSelectAllVendors,
  onFoodPropertyChange,
  onSelectAllFoodProperties,
}: SettingsTabProps) {
  const [companySearch, setCompanySearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [foodSearch, setFoodSearch] = useState('');

  const [showAllCompanies, setShowAllCompanies] = useState(false);
  const [showAllVendors, setShowAllVendors] = useState(false);
  const [showAllFood, setShowAllFood] = useState(false);

  const foodPropEntries = Object.entries(foodProperties).sort(([a], [b]) => a.localeCompare(b));
  const filteredFoodProps = foodPropEntries.filter(([name]) =>
    name.toLowerCase().includes(foodSearch.toLowerCase())
  );

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );
  const filteredVendors = vendors.filter((v) =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  // Apply 10-item limit only when search box is empty
  const visibleCompanies =
    companySearch || showAllCompanies
      ? filteredCompanies
      : filteredCompanies.slice(0, SETTINGS_PAGE_SIZE);
  const hiddenCompanyCount =
    !companySearch && !showAllCompanies
      ? Math.max(0, filteredCompanies.length - SETTINGS_PAGE_SIZE)
      : 0;

  const visibleVendors =
    vendorSearch || showAllVendors
      ? filteredVendors
      : filteredVendors.slice(0, SETTINGS_PAGE_SIZE);
  const hiddenVendorCount =
    !vendorSearch && !showAllVendors
      ? Math.max(0, filteredVendors.length - SETTINGS_PAGE_SIZE)
      : 0;

  const visibleFoodProps =
    foodSearch || showAllFood
      ? filteredFoodProps
      : filteredFoodProps.slice(0, SETTINGS_PAGE_SIZE);
  const hiddenFoodCount =
    !foodSearch && !showAllFood
      ? Math.max(0, filteredFoodProps.length - SETTINGS_PAGE_SIZE)
      : 0;

  return (
    <div className="settings-tab">
      {/* Companies section */}
      <div className="settings-section">
        <div className="settings-section-header">
          <h3>Companies</h3>
          <p className="settings-desc">
            Uncheck a company to exclude it from the analysis entirely.
          </p>
        </div>
        <div className="settings-toolbar">
          <input
            className="srch"
            placeholder="Search companies…"
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
          />
          <button className="act-btn" onClick={() => onSelectAllCompanies(true)}>Select All</button>
          <button className="act-btn" onClick={() => onSelectAllCompanies(false)}>Deselect All</button>
        </div>
        <div className="settings-list">
          {visibleCompanies.map((c) => (
            <div key={c.name} className={`settings-row${!c.enabled ? ' disabled' : ''}`}>
              <input
                type="checkbox"
                checked={c.enabled}
                onChange={(e) => onCompanyChange(c.name, 'enabled', e.target.checked)}
              />
              <span className="settings-name">{c.name}</span>
              <input
                type="text"
                className="settings-reason"
                placeholder="e.g. Churned, Demo account"
                value={c.reason}
                onChange={(e) => onCompanyChange(c.name, 'reason', e.target.value)}
              />
            </div>
          ))}
          {filteredCompanies.length === 0 && (
            <div className="settings-empty">No companies match your search.</div>
          )}
          {hiddenCompanyCount > 0 && (
            <button className="act-btn settings-show-more" onClick={() => setShowAllCompanies(true)}>
              Show {hiddenCompanyCount} more
            </button>
          )}
        </div>
      </div>

      {/* Vendors section */}
      <div className="settings-section">
        <div className="settings-section-header">
          <h3>Vendors</h3>
          <p className="settings-desc">
            Checked vendors are treated as Food vendors for the food/supplies split.
          </p>
        </div>
        <div className="settings-toolbar">
          <input
            className="srch"
            placeholder="Search vendors…"
            value={vendorSearch}
            onChange={(e) => setVendorSearch(e.target.value)}
          />
          <button className="act-btn" onClick={() => onSelectAllVendors(true)}>Select All</button>
          <button className="act-btn" onClick={() => onSelectAllVendors(false)}>Deselect All</button>
        </div>
        <div className="settings-list">
          {visibleVendors.map((v) => (
            <div key={v.name} className="settings-row">
              <input
                type="checkbox"
                checked={v.isFood}
                onChange={(e) => onVendorChange(v.name, e.target.checked)}
              />
              <span className="settings-name">{v.name}</span>
              {v.isFood && <span className="settings-food-tag">Food</span>}
            </div>
          ))}
          {filteredVendors.length === 0 && (
            <div className="settings-empty">No vendors match your search.</div>
          )}
          {hiddenVendorCount > 0 && (
            <button className="act-btn settings-show-more" onClick={() => setShowAllVendors(true)}>
              Show {hiddenVendorCount} more
            </button>
          )}
        </div>
      </div>

      {/* Food Analysis section */}
      <div className="settings-section">
        <div className="settings-section-header">
          <h3>Food Analysis</h3>
          <p className="settings-desc">
            Checked properties will have food and supplies analyzed separately. Unchecked properties are treated as supplies-only.
          </p>
        </div>
        {foodPropEntries.length === 0 ? (
          <div className="settings-empty">Run an analysis first to see properties here.</div>
        ) : (
          <>
            <div className="settings-toolbar">
              <input
                className="srch"
                placeholder="Search properties…"
                value={foodSearch}
                onChange={(e) => setFoodSearch(e.target.value)}
              />
              <button className="act-btn" onClick={() => onSelectAllFoodProperties(true)}>Select All</button>
              <button className="act-btn" onClick={() => onSelectAllFoodProperties(false)}>Deselect All</button>
            </div>
            <div className="settings-list">
              {visibleFoodProps.map(([name, enabled]) => (
                <div key={name} className="settings-row">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => onFoodPropertyChange(name, e.target.checked)}
                  />
                  <span className="settings-name">{name}</span>
                  {enabled && <span className="settings-food-tag">Food</span>}
                </div>
              ))}
              {filteredFoodProps.length === 0 && (
                <div className="settings-empty">No properties match your search.</div>
              )}
              {hiddenFoodCount > 0 && (
                <button className="act-btn settings-show-more" onClick={() => setShowAllFood(true)}>
                  Show {hiddenFoodCount} more
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- Main page ----

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV state
  const [csvCols, setCsvCols] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [uploadLabel, setUploadLabel] = useState<{ name: string; count: number } | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Analysis results
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [lapsed, setLapsed] = useState<LapsedUser[]>([]);
  const [periods, setPeriods] = useState<Period | null>(null);
  const [excludedCount, setExcludedCount] = useState(0);
  const [analyzed, setAnalyzed] = useState(false);
  const [dataMinDate, setDataMinDate] = useState<Date | null>(null);
  const [dataMaxDate, setDataMaxDate] = useState<Date | null>(null);

  // Settings state
  const [companyRows, setCompanyRows] = useState<CompanyRow[]>([]);
  const [vendorRows, setVendorRows] = useState<VendorRow[]>([]);
  const [foodProperties, setFoodProperties] = useState<Record<string, boolean>>({});

  // CSM overrides per company (editable in the dashboard)
  const [csmOverrides, setCsmOverrides] = useState<Record<string, string>>({});

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>('dash');
  const [filter, setFilter] = useState<Tier | 'all'>('all');
  const [search, setSearch] = useState('');
  const [lapsedSearch, setLapsedSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lapsedSort, setLapsedSort] = useState<{ key: LapsedSortKey; dir: 'asc' | 'desc' }>({
    key: 'prop',
    dir: 'asc',
  });
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const handleCsv = useCallback((text: string, fname: string) => {
    const { cols, rows } = parseCsvRows(text);
    setCsvCols(cols);
    setCsvRows(rows);
    setUploadLabel({ name: fname, count: rows.length });
    setMapping(buildInitialMapping(cols));
    setAnalyzed(false);
    setHotels([]);
    setLapsed([]);
    setCompanyRows([]);
    setVendorRows([]);
    setFoodProperties({});
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => handleCsv(ev.target!.result as string, f.name);
      r.readAsText(f);
    },
    [handleCsv]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => handleCsv(ev.target!.result as string, f.name);
      r.readAsText(f);
    },
    [handleCsv]
  );

  const loadDemo = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleCsv(DEMO, 'demo_orders.csv');
    },
    [handleCsv]
  );

  const handleRunAnalysis = useCallback(() => {
    if (!mapping || !csvRows.length) return;
    if (!mapping.mProp || !mapping.mSpend || !mapping.mDate) {
      alert('Please map Property, Spend, and Date columns.');
      return;
    }

    // Compute excluded companies from settings
    const excludedCompanies = new Set(
      companyRows.filter((c) => !c.enabled).map((c) => c.name)
    );

    // Compute food vendors from settings (or fallback to FOOD_VENDORS)
    const activeFoodVendors =
      vendorRows.length > 0
        ? vendorRows.filter((v) => v.isFood).map((v) => v.name.toLowerCase())
        : FOOD_VENDORS;

    const result = runAnalysis(csvRows, mapping, {
      excludedCompanies,
      foodVendors: activeFoodVendors,
      foodProperties,
    });

    if (!result.hotels.length) {
      alert('No valid orders found after filtering. Check date/status columns.');
      return;
    }

    // Initialize settings state from result (only on first run or when no settings yet)
    if (companyRows.length === 0) {
      const uniqueCompanies = [...new Set(result.hotels.map((h) => h.company))].sort();
      setCompanyRows(uniqueCompanies.map((name) => ({ name, enabled: true, reason: '' })));
    }

    if (vendorRows.length === 0 && mapping.mVendor) {
      // Extract unique vendors from raw rows
      const rawVendors = [
        ...new Set(
          csvRows
            .map((r) => (mapping.mVendor ? r[mapping.mVendor] : ''))
            .filter(Boolean)
        ),
      ].sort();
      const normalized = FOOD_VENDORS;
      setVendorRows(
        rawVendors.map((name) => ({
          name,
          isFood: normalized.some((fv) => name.toLowerCase().includes(fv)),
        }))
      );
    }

    // Initialize foodProperties for any property not already in state
    // (preserves manual overrides on re-runs)
    setFoodProperties((prev) => {
      const next = { ...prev };
      Object.entries(result.propertyFoodSpend).forEach(([prop, spend]) => {
        if (!(prop in next)) {
          next[prop] = spend >= 300;
        }
      });
      return next;
    });

    setHotels(result.hotels);
    setLapsed(result.lapsed);
    setPeriods(result.periods);
    setExcludedCount(result.excludedCount);
    setDataMinDate(result.minDate);
    setDataMaxDate(result.maxDate);
    setAnalyzed(true);
    setActiveTab('dash');
    setFilter('all');
    setSearch('');
    setExpanded(null);
    showToast(`${result.hotels.length} properties · ${result.lapsed.length} lapsed users`);
  }, [mapping, csvRows, companyRows, vendorRows, showToast]);

  const toggleExpanded = useCallback((prop: string) => {
    setExpanded((prev) => (prev === prop ? null : prop));
  }, []);

  const copyPrompt = useCallback(
    (prop: string) => {
      const h = hotels.find((x) => x.prop === prop);
      if (!h) return;
      let ctx: string;
      if (h.split) {
        const ff = h.food!.flags.map((f) => f.l).join(', ') || 'none';
        const sf = h.supplies!.flags.map((f) => f.l).join(', ') || 'none';
        ctx = `Property "${h.prop}" (${h.company}). This account orders both FOOD and SUPPLIES, scored separately.\nFOOD — health ${h.food!.score}/100, last 30d ${fmt$(h.food!.p1.spend)} spend / ${h.food!.p1.orders} orders / ${h.food!.p1.users} users, spend ${fmtPct(h.food!.spendP1P2)} vs prior 30d, ${fmtPct(h.food!.spendP1P3)} over 60d. Flags: ${ff}.\nSUPPLIES — health ${h.supplies!.score}/100, last 30d ${fmt$(h.supplies!.p1.spend)} spend / ${h.supplies!.p1.orders} orders / ${h.supplies!.p1.users} users, spend ${fmtPct(h.supplies!.spendP1P2)} vs prior 30d. Flags: ${sf}.`;
      } else {
        const fl = h.single!.flags.map((f) => f.l).join(', ') || 'none';
        ctx = `Property "${h.prop}" (${h.company}), supplies only. Health ${h.single!.score}/100, last 30d ${fmt$(h.single!.p1.spend)} spend / ${h.single!.p1.orders} orders / ${h.single!.p1.users} users, spend ${fmtPct(h.single!.spendP1P2)} vs prior 30d, ${fmtPct(h.single!.spendP1P3)} over 60d. Flags: ${fl}.`;
      }
      const prompt =
        ctx +
        '\n\nWhat are the 3 most impactful actions I should take this week to re-engage this account? Be specific about which category needs attention.';
      navigator.clipboard.writeText(prompt).then(() => showToast('Prompt copied — paste into Claude'));
    },
    [hotels, showToast]
  );

  const handleLapsedSort = useCallback((key: LapsedSortKey) => {
    setLapsedSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' };
      }
      return { key, dir: key === 'user' || key === 'prop' || key === 'company' ? 'asc' : 'desc' };
    });
  }, []);

  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtPeriodDate = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

  // Filtered hotel list
  const filteredHotels = hotels.filter((h) => {
    if (filter !== 'all' && h.tier !== filter) return false;
    const q = search.toLowerCase();
    if (q && !h.prop.toLowerCase().includes(q) && !h.company.toLowerCase().includes(q)) return false;
    return true;
  });

  const byCompany: Record<string, Hotel[]> = {};
  filteredHotels.forEach((h) => {
    (byCompany[h.company] = byCompany[h.company] || []).push(h);
  });
  const sortedCompanies = Object.keys(byCompany).sort((a, b) => a.localeCompare(b));
  sortedCompanies.forEach((c) => byCompany[c].sort((a, b) => b.sortScore - a.sortScore));

  // Compute "New Onboarding" per company: all hotels have firstOrder within 30 days of dataMaxDate
  const isNewOnboarding = useCallback(
    (companyHotels: Hotel[]): boolean => {
      if (!dataMaxDate || companyHotels.length === 0) return false;
      return companyHotels.every((h) => {
        if (!h.firstOrder) return false;
        const daysDiff = Math.round(
          (dataMaxDate.getTime() - h.firstOrder.getTime()) / 86400000
        );
        return daysDiff <= 30;
      });
    },
    [dataMaxDate]
  );

  // Compute company average health score
  const companyAvgScore = useCallback((companyHotels: Hotel[]): number => {
    if (!companyHotels.length) return 0;
    const sum = companyHotels.reduce((a, h) => a + h.sortScore, 0);
    return Math.round(sum / companyHotels.length);
  }, []);

  // Filtered lapsed list
  const filteredLapsed = lapsed
    .filter((l) => {
      const q = lapsedSearch.toLowerCase();
      if (!q) return true;
      return (
        l.user.toLowerCase().includes(q) ||
        l.prop.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const k = lapsedSort.key;
      const dir = lapsedSort.dir === 'asc' ? 1 : -1;
      const va = a[k] as string | number | Date | null;
      const vb = b[k] as string | number | Date | null;
      let primary: number;
      if (k === 'lastDate') {
        primary = ((a.lastDate?.getTime() ?? 0) - (b.lastDate?.getTime() ?? 0)) * dir;
      } else if (typeof va === 'string' && typeof vb === 'string') {
        primary = va.localeCompare(vb) * dir;
      } else {
        primary = (((va as number) ?? 0) - ((vb as number) ?? 0)) * dir;
      }
      if (primary !== 0) return primary;
      // Secondary sort: by lastDate descending (most recent first)
      return (b.lastDate?.getTime() ?? 0) - (a.lastDate?.getTime() ?? 0);
    });

  const lapsedTotalAtRisk = lapsed.reduce((a, l) => a + l.priorSpend, 0);
  const totalSpend = hotels.reduce((a, h) => a + h.overall.spend, 0);
  const dangerCount = hotels.filter((h) => h.tier === 'red').length;
  const warnCount = hotels.filter((h) => h.tier === 'amber').length;

  const arrow = (key: LapsedSortKey) =>
    lapsedSort.key === key ? (lapsedSort.dir === 'desc' ? ' ↓' : ' ↑') : '';

  // Settings handlers
  const handleCompanyChange = useCallback(
    (name: string, field: 'enabled' | 'reason', value: boolean | string) => {
      setCompanyRows((prev) =>
        prev.map((c) => (c.name === name ? { ...c, [field]: value } : c))
      );
    },
    []
  );

  const handleVendorChange = useCallback((name: string, isFood: boolean) => {
    setVendorRows((prev) =>
      prev.map((v) => (v.name === name ? { ...v, isFood } : v))
    );
  }, []);

  const handleSelectAllCompanies = useCallback((val: boolean) => {
    setCompanyRows((prev) => prev.map((c) => ({ ...c, enabled: val })));
  }, []);

  const handleSelectAllVendors = useCallback((val: boolean) => {
    setVendorRows((prev) => prev.map((v) => ({ ...v, isFood: val })));
  }, []);

  const handleFoodPropertyChange = useCallback((name: string, value: boolean) => {
    setFoodProperties((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSelectAllFoodProperties = useCallback((val: boolean) => {
    setFoodProperties((prev) => {
      const next: Record<string, boolean> = {};
      Object.keys(prev).forEach((k) => { next[k] = val; });
      return next;
    });
  }, []);

  return (
    <div className="page">
      <div className="header">
        <h1>
          <i className="ti ti-building" /> Hotel health monitor
        </h1>
        <p>One row per order · 3 × 30-day periods · food vs supplies split · grouped by company</p>
      </div>

      {/* Upload zone */}
      <div
        className={`upload-zone${dragOver ? ' drag' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {uploadLabel ? (
          <>
            <i className="ti ti-circle-check" style={{ color: 'var(--green)' }} />
            <div className="lbl" style={{ color: 'var(--green-text)' }}>
              {uploadLabel.name} — {uploadLabel.count} orders loaded
            </div>
            <div className="sub">Confirm column mapping below then Analyze</div>
          </>
        ) : (
          <>
            <i className="ti ti-cloud-upload" />
            <div className="lbl">Drop your orders CSV here or click to browse</div>
            <div className="sub">
              Needs: property, spend, date, user, vendor · company &amp; status optional
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* Column mapping */}
      {mapping && csvCols.length > 0 && (
        <div className="card">
          <h3>
            <i className="ti ti-columns" /> Map your columns
          </h3>
          <div className="map-grid">
            {FIELDS.map((f) => (
              <div key={f.id} className="map-item">
                <label>{f.label}</label>
                <select
                  value={mapping[f.id] ?? '— skip —'}
                  onChange={(e) =>
                    setMapping((prev) => ({
                      ...prev!,
                      [f.id]: e.target.value === '— skip —' ? null : e.target.value,
                    }))
                  }
                >
                  <option value="— skip —">— skip —</option>
                  {csvCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button className="run-btn" onClick={handleRunAnalysis}>
            <i className="ti ti-analyze" style={{ verticalAlign: '-2px', marginRight: 5 }} />
            Analyze 90 days
          </button>
        </div>
      )}

      {/* Tabs */}
      {analyzed && (
        <div className="tabs">
          <button
            className={`tab${activeTab === 'dash' ? ' on' : ''}`}
            onClick={() => setActiveTab('dash')}
          >
            Dashboard
          </button>
          <button
            className={`tab${activeTab === 'lapsed' ? ' on' : ''}`}
            onClick={() => setActiveTab('lapsed')}
          >
            Lapsed users
            {lapsed.length > 0 && <span className="badge">{lapsed.length}</span>}
          </button>
          <button
            className={`tab${activeTab === 'settings' ? ' on' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>
      )}

      {/* Dashboard tab */}
      {analyzed && activeTab === 'dash' && (
        <div>
          {/* Date range banner */}
          {dataMinDate && dataMaxDate && (
            <div className="date-range-banner">
              Analyzing orders from{' '}
              <strong>{fmtDDMMMYYYY(dataMinDate)}</strong>
              {' '}to{' '}
              <strong>{fmtDDMMMYYYY(dataMaxDate)}</strong>
            </div>
          )}

          {/* Period bar */}
          {periods && (
            <div className="period-bar">
              <span style={{ fontSize: 12, color: 'var(--text2)', marginRight: 4 }}>
                Periods analyzed:
              </span>
              <span className="period-tag p3">
                P3: {fmtPeriodDate(periods.p3start)}–{fmtPeriodDate(periods.p3end)}
              </span>
              <span style={{ color: 'var(--text3)' }}>→</span>
              <span className="period-tag p2">
                P2: {fmtPeriodDate(periods.p2start)}–{fmtPeriodDate(periods.p2end)}
              </span>
              <span style={{ color: 'var(--text3)' }}>→</span>
              <span className="period-tag p1">
                P1 (latest): {fmtPeriodDate(periods.p1start)}–{fmtPeriodDate(periods.p1end)}
              </span>
              {excludedCount > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 11 }}>
                  {excludedCount} cancelled/declined excluded
                </span>
              )}
            </div>
          )}

          {/* Summary row */}
          <div className="summary-row">
            <div className="s-card">
              <div className="val">{hotels.length}</div>
              <div className="lbl">Properties tracked</div>
            </div>
            <div className="s-card red">
              <div className="val">{dangerCount}</div>
              <div className="lbl">At risk</div>
            </div>
            <div className="s-card amber">
              <div className="val">{warnCount}</div>
              <div className="lbl">Watch list</div>
            </div>
            <div className="s-card green">
              <div className="val">${(totalSpend / 1000).toFixed(1)}k</div>
              <div className="lbl">Total spend last 30d</div>
            </div>
          </div>

          {/* Filters */}
          <div className="filters">
            {(['all', 'red', 'amber', 'green'] as const).map((f) => (
              <button
                key={f}
                className={`fb${filter === f ? ' on' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'red' ? '🔴 At risk' : f === 'amber' ? '🟡 Watch' : '🟢 Healthy'}
              </button>
            ))}
            <input
              className="srch"
              placeholder="Search property or company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Hotel list */}
          {filteredHotels.length === 0 ? (
            <div className="empty">
              <i className="ti ti-search-off" />
              <p>No properties match this filter.</p>
            </div>
          ) : (
            sortedCompanies.map((company) => {
              const g = byCompany[company];
              const newOnboarding = isNewOnboarding(g);
              const avgScore = companyAvgScore(g);
              const avgTier = tierOf(avgScore);
              const companyCsm =
                csmOverrides[company] ?? (g[0]?.csm || 'Federico Campos');

              return (
                <div key={company} className="company-group">
                  <div className="company-header">
                    <div className="company-name">{company}</div>
                    {newOnboarding && (
                      <span className="new-onboarding-badge">New Onboarding</span>
                    )}
                    <div className={`company-score ${avgTier}`}>{avgScore}</div>
                    <div className="company-csm">
                      <select
                        value={companyCsm}
                        onChange={(e) =>
                          setCsmOverrides((prev) => ({ ...prev, [company]: e.target.value }))
                        }
                        onClick={(e) => e.stopPropagation()}
                      >
                        {CSM_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="company-count">
                      {g.length} propert{g.length === 1 ? 'y' : 'ies'}
                    </div>
                  </div>
                  <div className="col-headers">
                    <div />
                    <div className="col-hdr" style={{ textAlign: 'left' }}>Property</div>
                    <div className="col-hdr">Total spend</div>
                    <div className="col-hdr">MTD1</div>
                    <div className="col-hdr">MTD2</div>
                    <div className="col-hdr">MTD3</div>
                    <div className="col-hdr">Last order</div>
                    <div className="col-hdr">Users</div>
                    <div className="col-hdr">Health</div>
                  </div>
                  <div className="hotel-list">
                    {g.map((h) => {
                      const isExp = expanded === h.prop;
                      return (
                        <div key={h.prop} className="hcard">
                          <div className="hcard-top" onClick={() => toggleExpanded(h.prop)}>
                            <ScoreRing hotel={h} />
                            <div className="hinfo">
                              <div className="hname">{h.prop}</div>
                              <div className="flags">
                                <HotelFlags hotel={h} />
                              </div>
                            </div>
                            <div className="metric-col">
                              <div className="metric-val">{fmt$(h.overall.spend)}</div>
                              <div className="metric-lbl">last 30d</div>
                              <div className={`metric-delta ${mC(h.overallSpendP1P2)}`}>
                                {fmtPct(h.overallSpendP1P2)} vs P2
                              </div>
                            </div>
                            <div className="metric-col">
                              <div className="metric-val">{fmt$(h.mtd1)}</div>
                              <div className="metric-lbl">MTD1</div>
                            </div>
                            <div className="metric-col">
                              <div className="metric-val">{fmt$(h.mtd2)}</div>
                              <div className="metric-lbl">MTD2</div>
                            </div>
                            <div className="metric-col">
                              <div className="metric-val">{fmt$(h.mtd3)}</div>
                              <div className="metric-lbl">MTD3</div>
                            </div>
                            <div className="metric-col">
                              <div className="metric-val last-order-val">
                                {h.lastOrder ? fmtDDMMM(h.lastOrder) : '—'}
                              </div>
                            </div>
                            <div className="metric-col">
                              <div className="metric-val">{h.overall.users}</div>
                              <div className="metric-lbl">users last 30d</div>
                              <div className={`metric-delta ${mC(h.overallUsersP1P2)}`}>
                                {fmtPct(h.overallUsersP1P2)} vs P2
                              </div>
                            </div>
                            <div className="bar-col">
                              <HealthBar hotel={h} />
                            </div>
                          </div>
                          {isExp && (
                            <HotelDetail
                              hotel={h}
                              onCollapse={() => toggleExpanded(h.prop)}
                              onCopyPrompt={() => copyPrompt(h.prop)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Lapsed users tab */}
      {analyzed && activeTab === 'lapsed' && (
        <div>
          <div className="note">
            {lapsed.length === 0 ? (
              'No lapsed users — every user who ordered in the prior 60 days has also ordered in the last 30 days.'
            ) : (
              <>
                <strong>{lapsed.length}</strong> user{lapsed.length === 1 ? '' : 's'} placed orders
                in the prior 60 days (days 31–90) but{' '}
                <strong>none in the last 30 days</strong>. Combined prior-period spend at risk:{' '}
                <strong>{fmt$(lapsedTotalAtRisk)}</strong>.
              </>
            )}
          </div>
          {lapsed.length > 0 && (
            <>
              <div className="filters">
                <input
                  className="srch"
                  placeholder="Search user, hotel or company…"
                  value={lapsedSearch}
                  onChange={(e) => setLapsedSearch(e.target.value)}
                />
              </div>
              <table className="lapsed-table">
                <thead>
                  <tr>
                    <th onClick={() => handleLapsedSort('user')}>User{arrow('user')}</th>
                    <th onClick={() => handleLapsedSort('prop')}>Hotel{arrow('prop')}</th>
                    <th onClick={() => handleLapsedSort('company')}>Company{arrow('company')}</th>
                    <th onClick={() => handleLapsedSort('lastDate')}>Last order{arrow('lastDate')}</th>
                    <th className="num" onClick={() => handleLapsedSort('priorCount')}>
                      Orders (31–90d){arrow('priorCount')}
                    </th>
                    <th className="num" onClick={() => handleLapsedSort('priorSpend')}>
                      Spend (31–90d){arrow('priorSpend')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLapsed.map((l, i) => (
                    <tr key={i}>
                      <td className="lapsed-user">{l.user}</td>
                      <td>{l.prop}</td>
                      <td className="lapsed-sub">{l.company}</td>
                      <td>
                        {fmtDate(l.lastDate)}{' '}
                        <span className="lapsed-days">{l.daysSince}d ago</span>
                      </td>
                      <td className="num">{l.priorCount}</td>
                      <td className="num">{fmt$(l.priorSpend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Settings tab */}
      {analyzed && activeTab === 'settings' && (
        <SettingsTab
          companies={companyRows}
          vendors={vendorRows}
          foodProperties={foodProperties}
          onCompanyChange={handleCompanyChange}
          onVendorChange={handleVendorChange}
          onSelectAllCompanies={handleSelectAllCompanies}
          onSelectAllVendors={handleSelectAllVendors}
          onFoodPropertyChange={handleFoodPropertyChange}
          onSelectAllFoodProperties={handleSelectAllFoodProperties}
        />
      )}

      {/* Empty state */}
      {!uploadLabel && !analyzed && (
        <div className="empty">
          <i className="ti ti-table-import" />
          <p>
            Upload your orders CSV to begin.
            <br />
            <span style={{ fontSize: 12 }}>
              <a href="#" onClick={loadDemo}>
                Load demo data
              </a>{' '}
              to see how it works.
            </span>
          </p>
        </div>
      )}

      {/* Toast */}
      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  );
}
