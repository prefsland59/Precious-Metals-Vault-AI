import { useState, useMemo } from 'react';
import { useHoldingsData } from '../hooks/useHoldingsData';
import type { Holding, MetalType, Category } from '@pmvault/shared';
import { METAL_LABELS, CATEGORY_LABELS, METAL_TYPES, CATEGORIES } from '@pmvault/shared';

// ─── Constants ────────────────────────────────────────────────────

const METAL_COLORS: Record<string, string> = {
  gold: '#d4a843',
  silver: '#c0c0c0',
  platinum: '#e5e4e2',
  palladium: '#9ca3af',
  copper: '#b87333',
  rhodium: '#a8c0c0',
  custom: '#888',
};

type SortOption = 'name-asc' | 'name-desc' | 'newest' | 'oldest' | 'value-high' | 'value-low' | 'metal';

const SORT_LABELS: Record<SortOption, string> = {
  'name-asc': 'Name A–Z',
  'name-desc': 'Name Z–A',
  'newest': 'Newest',
  'oldest': 'Oldest',
  'value-high': 'Highest Value',
  'value-low': 'Lowest Value',
  'metal': 'Metal',
};

const SORT_OPTIONS: SortOption[] = ['name-asc', 'name-desc', 'newest', 'oldest', 'value-high', 'value-low', 'metal'];

// ─── Helpers ──────────────────────────────────────────────────────

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtOz = (n: number) => n.toFixed(3) + ' oz';

const fmtDate = (d: string) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

function calculateValue(h: Holding, spotPrices: Record<string, number>): number {
  const spot = spotPrices[h.metal] || 0;
  const oz = (h.weight * h.quantity * h.purity);
  return oz * spot;
}

function calculateCostBasis(h: Holding): number {
  return h.purchasePrice * h.quantity;
}

// ─── Props ────────────────────────────────────────────────────────

interface PortfolioPageProps {
  onNavigate: (tab: string) => void;
  onSelectHolding?: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────

export function PortfolioPage({ onNavigate, onSelectHolding }: PortfolioPageProps) {
  const { data, loading, error, refetch } = useHoldingsData();

  // ─── Filter/Sort State ──────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [metalFilters, setMetalFilters] = useState<Set<string>>(new Set());
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(new Set());
  const [locationFilters, setLocationFilters] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortOption>('newest');
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);

  // ─── Derived Data ───────────────────────────────────────────────
  const { holdings, locationMap, spotPrices } = data || { holdings: [], locations: new Map(), spotPrices: {} };

  // Extract unique locations from holdings for the filter
  const availableLocations = useMemo(() => {
    const set = new Set<string>();
    for (const h of holdings) {
      const locName = locationMap.get(h.storageLocation) || 'Unallocated';
      set.add(locName);
    }
    return [...set].sort();
  }, [holdings, locationMap]);

  // Filter and sort holdings
  const filteredHoldings = useMemo(() => {
    let result = [...holdings];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((h) => {
        return (
          h.name.toLowerCase().includes(q) ||
          h.metal.toLowerCase().includes(q) ||
          (h.notes && h.notes.toLowerCase().includes(q)) ||
          (h.grade && h.grade.toLowerCase().includes(q))
        );
      });
    }

    // Metal filter
    if (metalFilters.size > 0) {
      result = result.filter((h) => metalFilters.has(h.metal));
    }

    // Category filter
    if (categoryFilters.size > 0) {
      result = result.filter((h) => categoryFilters.has(h.category));
    }

    // Location filter
    if (locationFilters.size > 0) {
      result = result.filter((h) => {
        const locName = locationMap.get(h.storageLocation) || 'Unallocated';
        return locationFilters.has(locName);
      });
    }

    // Sort
    result.sort((a, b) => {
      const valA = calculateValue(a, spotPrices);
      const valB = calculateValue(b, spotPrices);
      switch (sort) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'newest':
          return new Date(b.purchaseDate || 0).getTime() - new Date(a.purchaseDate || 0).getTime();
        case 'oldest':
          return new Date(a.purchaseDate || 0).getTime() - new Date(b.purchaseDate || 0).getTime();
        case 'value-high':
          return valB - valA;
        case 'value-low':
          return valA - valB;
        case 'metal': {
          const metalOrder = ['gold', 'silver', 'platinum', 'palladium', 'copper', 'rhodium', 'custom'];
          return metalOrder.indexOf(a.metal) - metalOrder.indexOf(b.metal);
        }
        default:
          return 0;
      }
    });

    return result;
  }, [holdings, search, metalFilters, categoryFilters, locationFilters, sort, spotPrices, locationMap]);

  // Totals
  const totalValue = useMemo(
    () => filteredHoldings.reduce((sum, h) => sum + calculateValue(h, spotPrices), 0),
    [filteredHoldings, spotPrices],
  );
  const totalWeight = useMemo(
    () => filteredHoldings.reduce((sum, h) => sum + h.weight * h.quantity * h.purity, 0),
    [filteredHoldings],
  );

  const activeFilterCount = metalFilters.size + categoryFilters.size + locationFilters.size;

  // ─── Toggle helpers ─────────────────────────────────────────────
  function toggleMetal(metal: string) {
    setMetalFilters((prev) => {
      const next = new Set(prev);
      if (next.has(metal)) next.delete(metal);
      else next.add(metal);
      return next;
    });
  }

  function toggleCategory(cat: string) {
    setCategoryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function toggleLocation(loc: string) {
    setLocationFilters((prev) => {
      const next = new Set(prev);
      if (next.has(loc)) next.delete(loc);
      else next.add(loc);
      return next;
    });
  }

  function clearAllFilters() {
    setSearch('');
    setMetalFilters(new Set());
    setCategoryFilters(new Set());
    setLocationFilters(new Set());
  }

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="p-8">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-platinum">Portfolio</h2>
          <p className="text-silver-dark text-sm mt-1">
            {filteredHoldings.length} item{filteredHoldings.length !== 1 ? 's' : ''}
            {' · '}
            {fmtUSD(totalValue)}
          </p>
        </div>
        <button
          onClick={() => onNavigate('add')}
          className="flex items-center gap-2 px-4 py-2.5 bg-gold/20 text-gold border border-gold/30 rounded-lg hover:bg-gold/30 transition-colors text-sm font-medium cursor-pointer"
        >
          <span className="text-base">+</span>
          Add Item
        </button>
      </div>

      {/* ─── Search & Sort Bar ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-silver-dark text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search name, metal, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-charcoal border border-charcoal-light rounded-lg text-silver placeholder:text-silver-dark/50 focus:outline-none focus:border-gold/50 transition-colors text-sm"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="px-3 py-2.5 bg-charcoal border border-charcoal-light rounded-lg text-silver text-sm focus:outline-none focus:border-gold/50 cursor-pointer appearance-none"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27%3E%3Cpath fill=%27%238a8a8a%27 d=%27M6 8L1 3h10z%27/%3E%3C/svg%3E")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            paddingRight: '2rem',
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {SORT_LABELS[opt]}
            </option>
          ))}
        </select>
      </div>

      {/* ─── Filter Chips ────────────────────────────────────────── */}
      <div className="mb-6 space-y-3">
        {/* Metal chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-silver-dark uppercase tracking-wider mr-1">Metal</span>
          {METAL_TYPES.filter((m) => m !== 'custom' && m !== 'rhodium').map((metal) => (
            <button
              key={metal}
              onClick={() => toggleMetal(metal)}
              className={
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ' +
                (metalFilters.has(metal)
                  ? 'border-gold bg-gold/20 text-gold'
                  : 'border-charcoal-light text-silver-dark hover:border-silver-dark hover:text-silver')
              }
            >
              {METAL_LABELS[metal]}
            </button>
          ))}
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-silver-dark uppercase tracking-wider mr-1">Category</span>
          {CATEGORIES.filter((c) => c !== 'custom').slice(0, 8).map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ' +
                (categoryFilters.has(cat)
                  ? 'border-gold bg-gold/20 text-gold'
                  : 'border-charcoal-light text-silver-dark hover:border-silver-dark hover:text-silver')
              }
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Location chips */}
        {availableLocations.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-silver-dark uppercase tracking-wider mr-1">Location</span>
            {availableLocations.map((loc) => (
              <button
                key={loc}
                onClick={() => toggleLocation(loc)}
                className={
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ' +
                  (locationFilters.has(loc)
                    ? 'border-gold bg-gold/20 text-gold'
                    : 'border-charcoal-light text-silver-dark hover:border-silver-dark hover:text-silver')
                }
              >
                {loc}
              </button>
            ))}
          </div>
        )}

        {/* Active filter badge + clear */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-gold/20 text-gold border border-gold/30">
              {activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''}
            </span>
            <button
              onClick={clearAllFilters}
              className="text-xs text-silver-dark hover:text-silver underline cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ─── Loading State ────────────────────────────────────────── */}
      {loading && <PortfolioSkeleton />}

      {/* ─── Error State ──────────────────────────────────────────── */}
      {error && !loading && (
        <div className="bg-charcoal border border-red-800/40 rounded-lg p-8 text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-full bg-red-900/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-medium text-platinum mb-2">Unable to Load Portfolio</h3>
          <p className="text-silver-dark text-sm mb-6">{error}</p>
          <button
            onClick={refetch}
            className="px-5 py-2 bg-gold/20 text-gold border border-gold/30 rounded-lg hover:bg-gold/30 transition-colors text-sm font-medium cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ─── Empty State ──────────────────────────────────────────── */}
      {data && !loading && holdings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-6">
            <span className="text-2xl">🏦</span>
          </div>
          <h3 className="text-lg font-medium text-platinum mb-2">No holdings yet</h3>
          <p className="text-silver-dark max-w-md mb-6">
            Start building your precious metals portfolio by adding your first item.
          </p>
          <button
            onClick={() => onNavigate('add')}
            className="px-5 py-2.5 bg-gold/20 text-gold border border-gold/30 rounded-lg hover:bg-gold/30 transition-colors text-sm font-medium cursor-pointer"
          >
            + Add Your First Item
          </button>
        </div>
      )}

      {/* ─── Empty state after filtering ──────────────────────────── */}
      {data && !loading && holdings.length > 0 && filteredHoldings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-charcoal border border-charcoal-light flex items-center justify-center mb-4">
            <span className="text-xl">🔍</span>
          </div>
          <h3 className="text-lg font-medium text-platinum mb-2">No matches found</h3>
          <p className="text-silver-dark text-sm mb-4">
            Try adjusting your search or filters.
          </p>
          <button
            onClick={clearAllFilters}
            className="text-sm text-gold hover:text-gold-light underline cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* ─── Holdings Grid ────────────────────────────────────────── */}
      {data && !loading && filteredHoldings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHoldings.map((h) => (
            <HoldingCard
              key={h.id}
              holding={h}
              spotPrice={spotPrices[h.metal] || 0}
              locationName={locationMap.get(h.storageLocation) || 'Unallocated'}
              onClick={() => {
                if (onSelectHolding) {
                  onSelectHolding(h.id);
                } else {
                  setSelectedHolding(h);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* ─── Bottom Summary Bar ──────────────────────────────────── */}
      {data && !loading && filteredHoldings.length > 0 && (
        <div className="mt-6 p-4 bg-charcoal border border-charcoal-light rounded-lg flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8">
          <div className="flex items-center gap-2">
            <span className="text-xs text-silver-dark uppercase tracking-wider">Items</span>
            <span className="text-lg font-semibold text-platinum">{filteredHoldings.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-silver-dark uppercase tracking-wider">Total Value</span>
            <span className="text-lg font-semibold text-platinum">{fmtUSD(totalValue)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-silver-dark uppercase tracking-wider">Total Weight</span>
            <span className="text-lg font-semibold text-platinum">{fmtOz(totalWeight)}</span>
          </div>
        </div>
      )}

      {/* ─── Detail Modal ──────────────────────────────────────────── */}
      {selectedHolding && (
        <HoldingDetailModal
          holding={selectedHolding}
          spotPrice={spotPrices[selectedHolding.metal] || 0}
          locationName={locationMap.get(selectedHolding.storageLocation) || 'Unallocated'}
          onClose={() => setSelectedHolding(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Holding Card
// ═══════════════════════════════════════════════════════════════════

function HoldingCard({
  holding,
  spotPrice,
  locationName,
  onClick,
}: {
  holding: Holding;
  spotPrice: number;
  locationName: string;
  onClick: () => void;
}) {
  const value = calculateValue(holding, { [holding.metal]: spotPrice });
  const costBasis = calculateCostBasis(holding);
  const pnl = value - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  const metalColor = METAL_COLORS[holding.metal] || '#888';
  const totalOz = holding.weight * holding.quantity * holding.purity;

  return (
    <div
      onClick={onClick}
      className="bg-charcoal border border-charcoal-light rounded-lg p-5 hover:border-gold/40 hover:shadow-[0_0_20px_rgba(212,168,67,0.06)] transition-all duration-200 cursor-pointer group"
    >
      {/* Top row: metal dot + name */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-3 h-3 rounded-full mt-1.5 shrink-0"
          style={{ backgroundColor: metalColor, boxShadow: '0 0 6px ' + metalColor + '66' }}
        />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-platinum group-hover:text-gold transition-colors truncate">
            {holding.name}
          </h4>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-black/40 text-silver-dark border border-charcoal-light">
              {METAL_LABELS[holding.metal as MetalType] || holding.metal}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-black/40 text-silver-dark border border-charcoal-light">
              {CATEGORY_LABELS[holding.category as Category] || holding.category}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-black/40 text-silver-dark border border-charcoal-light">
              {fmtOz(totalOz)}
            </span>
          </div>
        </div>
      </div>

      {/* Value + P&L row */}
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <p className="text-xl font-bold text-platinum">{fmtUSD(value)}</p>
        </div>
        <div className="text-right">
          <p className={'text-sm font-medium ' + (pnl >= 0 ? 'text-green-400' : 'text-red-400')}>
            {pnl >= 0 ? '+' : ''}{fmtUSD(pnl)}
          </p>
          <p className={'text-xs ' + (pnlPct >= 0 ? 'text-green-400/70' : 'text-red-400/70')}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Bottom meta row */}
      <div className="flex items-center justify-between text-xs text-silver-dark pt-2 border-t border-charcoal-light">
        <div className="flex items-center gap-3">
          <span>
            {holding.quantity} × {holding.weight.toFixed(2)} oz
          </span>
          <span className="text-silver-dark/60">
            paid {fmtUSD(costBasis)}
          </span>
        </div>
        <span>{locationName}</span>
      </div>

      {/* Purchase date */}
      {holding.purchaseDate && (
        <p className="text-xs text-silver-dark/50 mt-2">{fmtDate(holding.purchaseDate)}</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Holding Detail Modal
// ═══════════════════════════════════════════════════════════════════

function HoldingDetailModal({
  holding,
  spotPrice,
  locationName,
  onClose,
}: {
  holding: Holding;
  spotPrice: number;
  locationName: string;
  onClose: () => void;
}) {
  const value = calculateValue(holding, { [holding.metal]: spotPrice });
  const costBasis = calculateCostBasis(holding);
  const pnl = value - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  const totalOz = holding.weight * holding.quantity * holding.purity;
  const metalColor = METAL_COLORS[holding.metal] || '#888';

  // Close on Escape
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-charcoal border border-charcoal-light rounded-xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div
            className="w-4 h-4 rounded-full mt-1 shrink-0"
            style={{ backgroundColor: metalColor, boxShadow: '0 0 8px ' + metalColor + '88' }}
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-platinum pr-6">{holding.name}</h3>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="text-xs px-2 py-0.5 rounded-full bg-black/40 text-silver border border-charcoal-light">
                {METAL_LABELS[holding.metal as MetalType] || holding.metal}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-black/40 text-silver border border-charcoal-light">
                {CATEGORY_LABELS[holding.category as Category] || holding.category}
              </span>
              {holding.grade && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/30">
                  {holding.grade}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-silver-dark hover:text-silver transition-colors text-xl leading-none cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-black/30 rounded-lg p-3 border border-charcoal-light">
            <p className="text-xs text-silver-dark uppercase tracking-wider mb-1">Current Value</p>
            <p className="text-lg font-bold text-platinum">{fmtUSD(value)}</p>
          </div>
          <div className="bg-black/30 rounded-lg p-3 border border-charcoal-light">
            <p className="text-xs text-silver-dark uppercase tracking-wider mb-1">Cost Basis</p>
            <p className="text-lg font-bold text-platinum">{fmtUSD(costBasis)}</p>
          </div>
          <div className="bg-black/30 rounded-lg p-3 border border-charcoal-light">
            <p className="text-xs text-silver-dark uppercase tracking-wider mb-1">P&amp;L</p>
            <p className={'text-lg font-bold ' + (pnl >= 0 ? 'text-green-400' : 'text-red-400')}>
              {pnl >= 0 ? '+' : ''}{fmtUSD(pnl)}
              <span className="text-xs ml-1">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)</span>
            </p>
          </div>
          <div className="bg-black/30 rounded-lg p-3 border border-charcoal-light">
            <p className="text-xs text-silver-dark uppercase tracking-wider mb-1">Spot Price</p>
            <p className="text-lg font-bold text-platinum">{fmtUSD(spotPrice)}<span className="text-xs text-silver-dark ml-1">/oz</span></p>
          </div>
        </div>

        {/* Details list */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-charcoal-light">
            <span className="text-silver-dark">Weight</span>
            <span className="text-silver">{holding.weight.toFixed(3)} oz × {holding.quantity} = {fmtOz(totalOz)}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-charcoal-light">
            <span className="text-silver-dark">Purity</span>
            <span className="text-silver">{(holding.purity * 100).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-charcoal-light">
            <span className="text-silver-dark">Purchase Price</span>
            <span className="text-silver">{fmtUSD(holding.purchasePrice)} / unit</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-charcoal-light">
            <span className="text-silver-dark">Purchase Date</span>
            <span className="text-silver">{fmtDate(holding.purchaseDate)}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-charcoal-light">
            <span className="text-silver-dark">Storage</span>
            <span className="text-silver">{locationName}</span>
          </div>
          {holding.notes && (
            <div className="flex justify-between py-1.5 border-b border-charcoal-light">
              <span className="text-silver-dark">Notes</span>
              <span className="text-silver text-right max-w-[60%]">{holding.notes}</span>
            </div>
          )}
        </div>

        <p className="text-xs text-silver-dark/50 mt-4 text-right">
          ID: {holding.id}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Loading Skeleton
// ═══════════════════════════════════════════════════════════════════

function PortfolioSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-charcoal border border-charcoal-light rounded-lg p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-3 h-3 rounded-full bg-charcoal-light mt-1.5 shrink-0" />
            <div className="flex-1">
              <div className="h-4 bg-charcoal-light rounded w-3/4 mb-2" />
              <div className="flex gap-1.5">
                <div className="h-5 bg-charcoal-light rounded-full w-14" />
                <div className="h-5 bg-charcoal-light rounded-full w-16" />
                <div className="h-5 bg-charcoal-light rounded-full w-12" />
              </div>
            </div>
          </div>
          <div className="flex justify-between items-baseline mb-2">
            <div className="h-7 bg-charcoal-light rounded w-24" />
            <div className="h-5 bg-charcoal-light rounded w-16" />
          </div>
          <div className="pt-2 border-t border-charcoal-light">
            <div className="h-3 bg-charcoal-light rounded w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
