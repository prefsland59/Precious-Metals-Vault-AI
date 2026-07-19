import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { Holding, SpotPrice, StorageLocation } from '@pmvault/shared';
import { METAL_LABELS, CATEGORY_LABELS } from '@pmvault/shared';
import type { MetalType, Category } from '@pmvault/shared';

// ─── Constants ──────────────────────────────────────────────────────

const METAL_COLORS: Record<string, string> = {
  gold: '#d4a843',
  silver: '#c0c0c0',
  platinum: '#e5e4e2',
  palladium: '#9ca3af',
  copper: '#b87333',
  rhodium: '#a8c0c0',
  custom: '#888',
};

const METAL_ICONS: Record<string, string> = {
  gold: '🪙',
  silver: '🪙',
  platinum: '💎',
  palladium: '🔘',
  copper: '🪨',
  rhodium: '💠',
  custom: '🏷️',
};

// ─── Formatting ─────────────────────────────────────────────────────

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtOz = (n: number) => n.toFixed(3) + ' oz';

const fmtDate = (d: string | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const fmtPct = (n: number) => n.toFixed(2) + '%';

// ─── Calculations ───────────────────────────────────────────────────

function calcActualPMW(holding: Holding): number {
  return holding.weight * holding.quantity * holding.purity;
}

function calcMeltValue(holding: Holding, spotPrice: number): number {
  return calcActualPMW(holding) * spotPrice;
}

function calcCurrentValue(holding: Holding, spotPrice: number): number {
  return calcActualPMW(holding) * spotPrice;
}

function calcCostBasis(holding: Holding): number {
  return holding.totalCost ?? holding.purchasePrice * holding.quantity;
}

function calcPremium(holding: Holding, spotPrice: number): number {
  const costBasis = calcCostBasis(holding);
  const meltValue = calcMeltValue(holding, spotPrice);
  if (meltValue <= 0) return 0;
  return costBasis - meltValue;
}

function calcPremiumPct(holding: Holding, spotPrice: number): number {
  const meltValue = calcMeltValue(holding, spotPrice);
  if (meltValue <= 0) return 0;
  const premium = calcPremium(holding, spotPrice);
  return (premium / meltValue) * 100;
}

// ─── Props ──────────────────────────────────────────────────────────

interface HoldingDetailPageProps {
  holdingId: string;
  onBack: () => void;
}

// ─── Component ──────────────────────────────────────────────────────

export function HoldingDetailPage({ holdingId, onBack }: HoldingDetailPageProps) {
  const [holding, setHolding] = useState<Holding | null>(null);
  const [spotPrice, setSpotPrice] = useState<number>(0);
  const [locationName, setLocationName] = useState<string>('Unknown');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const [h, spots, locationsArr] = await Promise.all([
        api.get<Holding>(`/api/holdings/${holdingId}`),
        api.get<SpotPrice[]>('/api/spot'),
        api.get<StorageLocation[]>('/api/storage-locations'),
      ]);

      setHolding(h);

      // Find spot price for this metal
      const spot = spots.find((s) => s.metal === h.metal);
      setSpotPrice(spot?.price ?? 0);

      // Find location name
      const loc = locationsArr.find((l) => l.id === h.storageLocation);
      setLocationName(loc?.name ?? 'Unknown');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load holding');
    } finally {
      setLoading(false);
    }
  }, [holdingId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return <DetailSkeleton onBack={onBack} />;
  }

  // ─── Error ────────────────────────────────────────────────────────
  if (error || !holding) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mb-6">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-semibold text-platinum mb-2">Holding Not Found</h2>
        <p className="text-silver-dark text-sm mb-6">{error || 'This holding could not be loaded.'}</p>
        <button
          onClick={onBack}
          className="px-5 py-2 bg-gold/20 text-gold border border-gold/30 rounded-lg hover:bg-gold/30 transition-colors text-sm font-medium cursor-pointer"
        >
          ← Back to Portfolio
        </button>
      </div>
    );
  }

  // ─── Computed values ──────────────────────────────────────────────
  const currentValue = calcCurrentValue(holding, spotPrice);
  const costBasis = calcCostBasis(holding);
  const pnl = currentValue - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  const actualPMW = calcActualPMW(holding);
  const meltValue = calcMeltValue(holding, spotPrice);
  const premium = calcPremium(holding, spotPrice);
  const premiumPct = calcPremiumPct(holding, spotPrice);
  const metalColor = METAL_COLORS[holding.metal] || '#888';
  const metalIcon = METAL_ICONS[holding.metal] || '🏷️';

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="p-8">
      {/* ─── Back Button ──────────────────────────────────────────── */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-silver-dark hover:text-silver transition-colors text-sm mb-6 cursor-pointer"
      >
        <span className="text-lg leading-none">←</span>
        <span>Back to Portfolio</span>
      </button>

      {/* ─── Header ───────────────────────────────────────────────── */}
      <div className="bg-charcoal border border-charcoal-light rounded-xl p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Left: name + badges */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: metalColor, boxShadow: '0 0 10px ' + metalColor + '88' }}
              />
              <h1 className="text-2xl font-bold text-platinum">{holding.name}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <span
                className="text-xs px-3 py-1 rounded-full font-medium border"
                style={{
                  color: metalColor,
                  borderColor: metalColor + '55',
                  backgroundColor: metalColor + '15',
                }}
              >
                {METAL_LABELS[holding.metal as MetalType] || holding.metal}
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-black/40 text-silver border border-charcoal-light font-medium">
                {CATEGORY_LABELS[holding.category as Category] || holding.category}
              </span>
              {holding.grade && (
                <span className="text-xs px-3 py-1 rounded-full bg-gold/10 text-gold border border-gold/30 font-medium">
                  {holding.grade}
                </span>
              )}
              {holding.condition && (
                <span className="text-xs px-3 py-1 rounded-full bg-black/40 text-silver border border-charcoal-light font-medium">
                  {holding.condition}
                </span>
              )}
            </div>
          </div>

          {/* Right: value + P&L */}
          <div className="flex flex-col items-end gap-1">
            <p className="text-xs text-silver-dark uppercase tracking-wider">Current Market Value</p>
            <p className="text-3xl font-bold text-platinum">{fmtUSD(currentValue)}</p>
            <div className="flex items-center gap-3 mt-1">
              <p className={'text-sm font-semibold ' + (pnl >= 0 ? 'text-green-400' : 'text-red-400')}>
                {pnl >= 0 ? '+' : ''}{fmtUSD(pnl)}
              </p>
              <p className={'text-sm ' + (pnlPct >= 0 ? 'text-green-400/80' : 'text-red-400/80')}>
                ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
              </p>
            </div>
            <p className="text-xs text-silver-dark mt-1">
              Spot: {fmtUSD(spotPrice)}/oz
            </p>
          </div>
        </div>
      </div>

      {/* ─── Image Section ────────────────────────────────────────── */}
      <div className="bg-charcoal border border-charcoal-light rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-platinum uppercase tracking-wider mb-4">Images</h3>
        {holding.images && holding.images.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {holding.images.map((img, i) => (
              <div
                key={i}
                className="aspect-square bg-black/50 rounded-lg border border-charcoal-light flex items-center justify-center overflow-hidden"
              >
                <img src={img} alt={`${holding.name} image ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Front placeholder */}
            <div className="aspect-square bg-black/30 rounded-lg border border-charcoal-light flex flex-col items-center justify-center gap-2">
              <span className="text-4xl opacity-40">{metalIcon}</span>
              <span className="text-xs text-silver-dark">Front — No image</span>
            </div>
            {/* Back placeholder */}
            <div className="aspect-square bg-black/30 rounded-lg border border-charcoal-light flex flex-col items-center justify-center gap-2">
              <span className="text-4xl opacity-40">↻</span>
              <span className="text-xs text-silver-dark">Back — No image</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Info Cards Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Metal & Weight */}
        <InfoCard title="Metal & Weight" accentColor={metalColor}>
          <InfoRow label="Metal Type" value={METAL_LABELS[holding.metal as MetalType] || holding.metal} />
          <InfoRow label="Category" value={CATEGORY_LABELS[holding.category as Category] || holding.category} />
          <InfoRow label="Weight" value={`${holding.weight.toFixed(3)} ${holding.weightUnit}`} />
          <InfoRow label="Purity" value={fmtPct(holding.purity * 100)} />
          <InfoRow label="Actual PMW" value={`${fmtOz(actualPMW)}`} highlight />
          <InfoRow label="Quantity" value={String(holding.quantity)} />
        </InfoCard>

        {/* Card 2: Purchase Details */}
        <InfoCard title="Purchase Details" accentColor="#c0c0c0">
          <InfoRow label="Price / Unit" value={fmtUSD(holding.purchasePrice)} />
          <InfoRow label="Total Cost" value={fmtUSD(costBasis)} highlight />
          <InfoRow label="Purchase Date" value={fmtDate(holding.purchaseDate)} />
          <InfoRow label="Dealer" value={holding.dealer || '—'} />
          <InfoRow label="Currency" value={holding.purchaseCurrency || 'USD'} />
        </InfoCard>

        {/* Card 3: Value Breakdown */}
        <InfoCard title="Value Breakdown" accentColor="#4ade80">
          <InfoRow label="Current Spot Value" value={fmtUSD(currentValue)} highlight />
          <InfoRow label="Melt Value" value={fmtUSD(meltValue)} />
          <InfoRow label="Premium Paid" value={premium >= 0 ? fmtUSD(premium) : fmtUSD(0)} />
          <InfoRow
            label="Premium %"
            value={premiumPct >= 0 ? fmtPct(premiumPct) : '0.00%'}
          />
          <InfoRow label="Cost Basis" value={fmtUSD(costBasis)} />
        </InfoCard>

        {/* Card 4: Storage & Grade */}
        <InfoCard title="Storage & Grade" accentColor="#e5e4e2">
          <InfoRow label="Storage" value={locationName} />
          <InfoRow label="Condition" value={holding.condition || '—'} />
          <InfoRow label="Grade (AI Est.)" value={holding.grade || '—'} highlight={!!holding.grade} />
          <InfoRow label="Slab Company" value={holding.slabCompany || '—'} />
          <InfoRow label="Cert #" value={holding.certificationNumber || '—'} />
          <InfoRow label="Serial #" value={holding.serialNumber || '—'} />
        </InfoCard>
      </div>

      {/* ─── Notes Section ────────────────────────────────────────── */}
      <div className="bg-charcoal border border-charcoal-light rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-platinum uppercase tracking-wider mb-3">Notes</h3>
        <textarea
          readOnly
          value={holding.notes || ''}
          placeholder="No notes for this item."
          className="w-full bg-black/30 border border-charcoal-light rounded-lg p-4 text-silver text-sm min-h-[100px] resize-y placeholder:text-silver-dark/40 focus:outline-none"
        />
      </div>

      {/* ─── Documents & Receipts ─────────────────────────────────── */}
      <div className="bg-charcoal border border-charcoal-light rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-platinum uppercase tracking-wider mb-3">Documents & Receipts</h3>
        {holding.documents && holding.documents.length > 0 ? (
          <div className="space-y-2">
            {holding.documents.map((doc, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-black/30 border border-charcoal-light rounded-lg p-3"
              >
                <span className="text-lg">📄</span>
                <span className="text-sm text-silver">{doc}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-silver-dark">No documents attached.</p>
        )}
      </div>

      {/* ─── Purchase History ─────────────────────────────────────── */}
      <div className="bg-charcoal border border-charcoal-light rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-platinum uppercase tracking-wider mb-3">Purchase History</h3>
        <div className="space-y-3">
          {/* Current purchase (the holding itself) */}
          <div className="flex items-start gap-4 pl-4 border-l-2" style={{ borderColor: metalColor }}>
            <div>
              <p className="text-sm font-medium text-silver">
                Purchased — {holding.quantity}× {holding.weight.toFixed(3)} oz @ {fmtUSD(holding.purchasePrice)}/unit
              </p>
              <p className="text-xs text-silver-dark mt-0.5">
                {fmtDate(holding.purchaseDate)}
                {holding.dealer ? ` · ${holding.dealer}` : ''}
              </p>
              <p className="text-xs text-silver-dark">Total: {fmtUSD(costBasis)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Footer meta ──────────────────────────────────────────── */}
      <p className="text-xs text-silver-dark/50 text-right">
        ID: {holding.id} · Created {fmtDate(holding.createdAt)} · Updated {fmtDate(holding.updatedAt)}
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  Info Card
// ═════════════════════════════════════════════════════════════════════

function InfoCard({
  title,
  accentColor,
  children,
}: {
  title: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-charcoal border border-charcoal-light rounded-xl overflow-hidden">
      <div
        className="px-4 py-3 border-b border-charcoal-light text-xs font-semibold uppercase tracking-wider"
        style={{ color: accentColor }}
      >
        {title}
      </div>
      <div className="p-4 space-y-2">
        {children}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  Info Row
// ═════════════════════════════════════════════════════════════════════

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-xs text-silver-dark">{label}</span>
      <span className={'text-xs font-medium ' + (highlight ? 'text-platinum' : 'text-silver')}>
        {value}
      </span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  Loading Skeleton
// ═════════════════════════════════════════════════════════════════════

function DetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="p-8 animate-pulse">
      {/* Back button skeleton */}
      <div className="h-5 bg-charcoal-light rounded w-36 mb-6" />

      {/* Header skeleton */}
      <div className="bg-charcoal border border-charcoal-light rounded-xl p-6 mb-6">
        <div className="flex gap-3 mb-3">
          <div className="w-4 h-4 rounded-full bg-charcoal-light" />
          <div className="h-7 bg-charcoal-light rounded w-72" />
        </div>
        <div className="flex gap-2 mb-4">
          <div className="h-6 bg-charcoal-light rounded-full w-16" />
          <div className="h-6 bg-charcoal-light rounded-full w-20" />
        </div>
        <div className="flex justify-between">
          <div className="h-8 bg-charcoal-light rounded w-32" />
          <div className="h-5 bg-charcoal-light rounded w-20" />
        </div>
      </div>

      {/* Image skeleton */}
      <div className="bg-charcoal border border-charcoal-light rounded-xl p-6 mb-6">
        <div className="h-4 bg-charcoal-light rounded w-16 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="aspect-square bg-black/30 border border-charcoal-light rounded-lg" />
          <div className="aspect-square bg-black/30 border border-charcoal-light rounded-lg" />
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-charcoal border border-charcoal-light rounded-xl p-4">
            <div className="h-4 bg-charcoal-light rounded w-24 mb-3" />
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="flex justify-between py-2">
                <div className="h-3 bg-charcoal-light rounded w-16" />
                <div className="h-3 bg-charcoal-light rounded w-20" />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Notes skeleton */}
      <div className="bg-charcoal border border-charcoal-light rounded-xl p-6 mb-6">
        <div className="h-4 bg-charcoal-light rounded w-14 mb-3" />
        <div className="h-24 bg-black/30 border border-charcoal-light rounded-lg" />
      </div>
    </div>
  );
}
