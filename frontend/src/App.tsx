import { useState } from 'react';
import { usePortfolio } from './hooks/usePortfolio';
import { AddHoldingPage } from './pages/AddHolding';
import { StorageLocationsPage } from './pages/StorageLocations';
import { PortfolioPage } from './pages/Portfolio';
import { HoldingDetailPage } from './pages/HoldingDetail';
import type { MetalBreakdown, PortfolioSummary, SpotPriceMeta } from './lib/api';

type Tab = 'dashboard' | 'portfolio' | 'add' | 'vaults' | 'settings';

const NAV_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'portfolio', label: 'Portfolio', icon: '🏦' },
  { id: 'add', label: 'Add Item', icon: '➕' },
  { id: 'vaults', label: 'Vaults', icon: '🔒' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

// ─── Metal color map for charts & accents ───────────────────────
const METAL_COLORS: Record<string, string> = {
  gold: '#d4a843',
  silver: '#c0c0c0',
  platinum: '#e5e4e2',
  palladium: '#a9a9a9',
  copper: '#b87333',
};

const METAL_LABELS: Record<string, string> = {
  gold: 'Gold',
  silver: 'Silver',
  platinum: 'Platinum',
  palladium: 'Palladium',
  copper: 'Copper',
};

const METAL_SORT = ['gold', 'silver', 'platinum', 'palladium', 'copper'];

// ─── Formatting helpers ──────────────────────────────────────────
const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

const fmtOz = (n: number) => n.toFixed(2) + ' oz';

// ─── App ─────────────────────────────────────────────────────────
export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedHoldingId, setSelectedHoldingId] = useState<string | null>(null);

  // Handle navigating to holding detail
  const handleSelectHolding = (id: string) => {
    setSelectedHoldingId(id);
  };

  const handleBackToPortfolio = () => {
    setSelectedHoldingId(null);
  };

  // Handle tab navigation — clear detail view when switching tabs
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSelectedHoldingId(null);
  };

  return (
    <div className="flex h-screen bg-black">
      {/* ─── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-64 flex flex-col border-r border-charcoal-light bg-charcoal">
        <div className="px-5 py-6 border-b border-charcoal-light">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-gold">Precious Metals</span>
            <br />
            <span className="text-platinum">Vault AI</span>
          </h1>
        </div>

        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={
                'w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors ' +
                (activeTab === item.id
                  ? 'bg-gold/10 text-gold border-r-2 border-gold'
                  : 'text-silver hover:text-platinum hover:bg-surface-hover')
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-charcoal-light">
          <p className="text-xs text-silver-dark">v0.1.0 — Free Tier</p>
        </div>
      </aside>

      {/* ─── Main Content ────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {/* Show holding detail when an ID is selected */}
        {selectedHoldingId ? (
          <HoldingDetailPage
            holdingId={selectedHoldingId}
            onBack={handleBackToPortfolio}
          />
        ) : (
          <TabContent
            tab={activeTab}
            onNavigate={handleTabChange}
            onSelectHolding={handleSelectHolding}
          />
        )}
      </main>
    </div>
  );
}

function TabContent({
  tab,
  onNavigate,
  onSelectHolding,
}: {
  tab: Tab;
  onNavigate: (tab: Tab) => void;
  onSelectHolding: (id: string) => void;
}) {
  switch (tab) {
    case 'dashboard':
      return <DashboardPage />;
    case 'portfolio':
      return <PortfolioPage onNavigate={onNavigate} onSelectHolding={onSelectHolding} />;
    case 'add':
      return <AddHoldingPage onSuccess={() => onNavigate('portfolio')} />;
    case 'vaults':
      return <StorageLocationsPage />;
    case 'settings':
      return <PlaceholderPage title="Settings" description="Account preferences and subscription management." />;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Dashboard Page
// ═══════════════════════════════════════════════════════════════════
function DashboardPage() {
  const { data, loading, error, refetch } = usePortfolio(60_000);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold text-platinum mb-2">Dashboard</h2>
      <p className="text-silver-dark mb-8">Portfolio overview and market insights</p>

      {/* ─── Loading State ───────────────────────────────────── */}
      {loading && <DashboardSkeleton />}

      {/* ─── Error State ─────────────────────────────────────── */}
      {error && !loading && <DashboardError message={error} onRetry={refetch} />}

      {/* ─── Loaded State ────────────────────────────────────── */}
      {data && !loading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Value" value={fmtUSD(data.totalValueUsd)} change={fmtPct(data.profitLossPercent)} positive={data.profitLossUsd >= 0} />
            <StatCard
              label="Cost Basis"
              value={fmtUSD(data.costBasisUsd)}
              change={fmtUSD(data.profitLossUsd)}
              positive={data.profitLossUsd >= 0}
              changeLabel="P&L"
            />
            <StatCard label="Holdings" value={String(data.totalHoldings)} change={fmtOz(data.totalOunces)} positive changeLabel="Total Oz" />
            <StatCard label="Gold Allocation" value={fmtPct(data.breakdown.byMetal.gold?.pctOfPortfolio ?? 0)} change={fmtUSD(data.breakdown.byMetal.gold?.valueUsd ?? 0)} positive changeLabel="" />
          </div>

          {/* Metal Allocation Chart + Spot Prices row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <MetalAllocationChart metals={data.breakdown.byMetal} />
            <SpotPricesPanel spotPrices={data.spotPrices} spotMeta={data.spotMeta} />
          </div>

          {/* Location & Category Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BreakdownList title="By Location" items={data.breakdown.byLocation} valueKey="valueUsd" countKey="count" />
            <BreakdownList title="By Category" items={data.breakdown.byCategory} valueKey="valueUsd" countKey="count" />
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Stat Card
// ═══════════════════════════════════════════════════════════════════
function StatCard({
  label,
  value,
  change,
  positive,
  changeLabel,
}: {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  changeLabel?: string;
}) {
  return (
    <div className="bg-charcoal border border-charcoal-light rounded-lg p-5 hover:border-gold/30 transition-colors">
      <p className="text-xs text-silver-dark uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold text-platinum mb-1">{value}</p>
      <p className={'text-sm ' + (positive ? 'text-green-400' : 'text-red-400')}>
        {changeLabel ? changeLabel + ': ' : ''}{change}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Metal Allocation Chart (CSS-based horizontal bars)
// ═══════════════════════════════════════════════════════════════════
function MetalAllocationChart({ metals }: { metals: Record<string, MetalBreakdown> }) {
  const entries = METAL_SORT.filter((m) => metals[m] && metals[m].pctOfPortfolio > 0).map((m) => ({
    key: m,
    ...metals[m],
  }));

  if (entries.length === 0) {
    return (
      <div className="bg-charcoal border border-charcoal-light rounded-lg p-6">
        <h3 className="text-lg font-medium text-platinum mb-4">Metal Allocation</h3>
        <p className="text-silver-dark text-sm">No holdings yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-charcoal border border-charcoal-light rounded-lg p-6">
      <h3 className="text-lg font-medium text-platinum mb-4">Metal Allocation</h3>
      <div className="space-y-3">
        {entries.map((entry) => (
          <div key={entry.key}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-silver">{METAL_LABELS[entry.key] ?? entry.key}</span>
              <span className="text-silver-dark">
                {entry.pctOfPortfolio.toFixed(1)}% — {fmtUSD(entry.valueUsd)}
              </span>
            </div>
            <div className="w-full h-3 bg-black/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: Math.max(entry.pctOfPortfolio, 0.5) + '%',
                  backgroundColor: METAL_COLORS[entry.key] ?? '#555',
                }}
              />
            </div>
            <p className="text-xs text-silver-dark mt-0.5">{entry.holdings} holding{entry.holdings !== 1 ? 's' : ''} — {fmtOz(entry.ounces)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Spot Prices Panel — with live timestamp and staleness indicators
// ═══════════════════════════════════════════════════════════════════
function SpotPricesPanel({
  spotPrices,
  spotMeta,
}: {
  spotPrices: Record<string, number>;
  spotMeta?: SpotPriceMeta;
}) {
  const entries = METAL_SORT.filter((m) => spotPrices[m] !== undefined);

  if (entries.length === 0) return null;

  // Calculate staleness
  const lastFetch = spotMeta?.lastFetchTimestamp;
  const minutesAgo = lastFetch
    ? Math.round((Date.now() - new Date(lastFetch).getTime()) / 60_000)
    : null;
  const isStale = minutesAgo !== null && minutesAgo > 15;
  const isApiConfigured = spotMeta?.apiConfigured ?? false;

  return (
    <div className="bg-charcoal border border-charcoal-light rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-platinum">Live Spot Prices</h3>
        {!isApiConfigured && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-900/30 text-yellow-400 border border-yellow-700/40">
            Offline mode
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {entries.map((metal) => (
          <div
            key={metal}
            className="text-center p-3 rounded border border-charcoal-light bg-black/30 hover:border-gold/30 transition-colors"
          >
            <p
              className="text-xs uppercase tracking-wider mb-1 font-medium"
              style={{ color: METAL_COLORS[metal] ?? '#888' }}
            >
              {METAL_LABELS[metal] ?? metal}
            </p>
            <p className="text-xl font-semibold text-platinum">
              {spotPrices[metal] < 1
                ? '$' + spotPrices[metal].toFixed(2)
                : fmtUSD(spotPrices[metal])}
            </p>
            <p className="text-xs text-silver-dark">per oz</p>
          </div>
        ))}
      </div>

      {/* Timestamp & staleness */}
      <div className="mt-4 pt-3 border-t border-charcoal-light">
        {lastFetch ? (
          <div className="flex items-center gap-2">
            {isStale ? (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <span>⚠️</span>
                <span>
                  Updated {minutesAgo}m ago
                  {!spotMeta?.lastFetchSuccess && ' (last fetch failed)'}
                </span>
              </span>
            ) : (
              <span className="text-xs text-silver-dark flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                <span>
                  Updated {minutesAgo}m ago
                </span>
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-silver-dark">Using stored prices</p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Breakdown List (generic for location/category)
// ═══════════════════════════════════════════════════════════════════
function BreakdownList({
  title,
  items,
  valueKey,
  countKey,
}: {
  title: string;
  items: Record<string, Record<string, number>>;
  valueKey: string;
  countKey: string;
}) {
  const entries = Object.entries(items).sort(
    (a, b) => (b[1][valueKey] as number) - (a[1][valueKey] as number)
  );

  return (
    <div className="bg-charcoal border border-charcoal-light rounded-lg p-6">
      <h3 className="text-lg font-medium text-platinum mb-4">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-silver-dark text-sm">No data.</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([name, data]) => (
            <div key={name} className="flex justify-between items-center py-2 border-b border-charcoal-light last:border-0">
              <span className="text-silver text-sm">{name}</span>
              <div className="text-right">
                <p className="text-platinum font-medium text-sm">{fmtUSD(data[valueKey] as number)}</p>
                <p className="text-xs text-silver-dark">{data[countKey]} holding{(data[countKey] as number) !== 1 ? 's' : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Loading Skeleton
// ═══════════════════════════════════════════════════════════════════
function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* KPI skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-charcoal border border-charcoal-light rounded-lg p-5">
            <div className="h-3 bg-charcoal-light rounded w-20 mb-3" />
            <div className="h-7 bg-charcoal-light rounded w-32 mb-2" />
            <div className="h-4 bg-charcoal-light rounded w-16" />
          </div>
        ))}
      </div>

      {/* Chart + Spot skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-charcoal border border-charcoal-light rounded-lg p-6">
          <div className="h-5 bg-charcoal-light rounded w-36 mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mb-3">
              <div className="h-3 bg-charcoal-light rounded w-full mb-2" />
              <div className="h-3 bg-charcoal-light rounded w-3/4" />
            </div>
          ))}
        </div>
        <div className="bg-charcoal border border-charcoal-light rounded-lg p-6">
          <div className="h-5 bg-charcoal-light rounded w-36 mb-4" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-black/30 rounded p-3">
                <div className="h-3 bg-charcoal-light rounded w-12 mb-2 mx-auto" />
                <div className="h-6 bg-charcoal-light rounded w-20 mb-1 mx-auto" />
                <div className="h-3 bg-charcoal-light rounded w-8 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Error State
// ═══════════════════════════════════════════════════════════════════
function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-charcoal border border-red-800/40 rounded-lg p-8 text-center max-w-lg mx-auto">
      <div className="w-14 h-14 rounded-full bg-red-900/20 flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">⚠️</span>
      </div>
      <h3 className="text-lg font-medium text-platinum mb-2">Unable to Load Dashboard</h3>
      <p className="text-silver-dark text-sm mb-6">{message}</p>
      <button
        onClick={onRetry}
        className="px-5 py-2 bg-gold/20 text-gold border border-gold/30 rounded-lg hover:bg-gold/30 transition-colors text-sm font-medium"
      >
        Retry
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Placeholder for unbuilt pages
// ═══════════════════════════════════════════════════════════════════
function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-6">
        <span className="text-2xl">🏗️</span>
      </div>
      <h2 className="text-2xl font-semibold text-platinum mb-2">{title}</h2>
      <p className="text-silver-dark max-w-md">{description}</p>
      <p className="text-xs text-silver-dark/50 mt-4">Coming soon</p>
    </div>
  );
}
