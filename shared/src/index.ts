// Precious Metals Vault AI — Shared Types & Constants

// ─── Metal Types ───────────────────────────────────────────────
export type MetalType = 'gold' | 'silver' | 'platinum' | 'palladium' | 'copper' | 'rhodium' | 'custom';

export const METAL_TYPES: MetalType[] = ['gold', 'silver', 'platinum', 'palladium', 'copper', 'rhodium', 'custom'];

export const METAL_LABELS: Record<MetalType, string> = {
  gold: 'Gold',
  silver: 'Silver',
  platinum: 'Platinum',
  palladium: 'Palladium',
  copper: 'Copper',
  rhodium: 'Rhodium',
  custom: 'Custom',
};

// ─── Category Types ────────────────────────────────────────────
export type Category =
  | 'coin'
  | 'bar'
  | 'round'
  | 'constitutional'
  | 'junk'
  | 'proof'
  | 'commemorative'
  | 'slabbed'
  | 'vintage_bar'
  | 'fractional'
  | 'collectible'
  | 'custom';

export const CATEGORIES: Category[] = [
  'coin', 'bar', 'round', 'constitutional', 'junk', 'proof',
  'commemorative', 'slabbed', 'vintage_bar', 'fractional', 'collectible', 'custom',
];

export const CATEGORY_LABELS: Record<Category, string> = {
  coin: 'Coin',
  bar: 'Bar',
  round: 'Round',
  constitutional: 'Constitutional Silver',
  junk: 'Junk Silver',
  proof: 'Proof',
  commemorative: 'Commemorative',
  slabbed: 'Slabbed Coin',
  vintage_bar: 'Vintage Bar',
  fractional: 'Fractional Bullion',
  collectible: 'Collectible',
  custom: 'Custom',
};

// ─── Holding ───────────────────────────────────────────────────
export interface Holding {
  id: string;
  name: string;
  metal: MetalType;
  category: Category;
  weight: number;        // in troy ounces
  weightUnit: 'oz' | 'g' | 'kg';
  purity: number;        // 0-1 (e.g., 0.9999)
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;  // ISO date
  purchaseCurrency: string;
  storageLocation: string;
  notes?: string;
  grade?: string;        // e.g., "MS-70", "PF-69"
  images?: string[];
  dealer?: string;
  totalCost?: number;
  condition?: string;
  certificationNumber?: string;
  slabCompany?: string;
  serialNumber?: string;
  documents?: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Storage Location ──────────────────────────────────────────
export type LocationType = 'home' | 'bank_vault' | 'private_vault' | 'safe' | 'other';

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  home: 'Home',
  bank_vault: 'Bank Vault',
  private_vault: 'Private Vault',
  safe: 'Safe',
  other: 'Other',
};

export const LOCATION_TYPE_ICONS: Record<LocationType, string> = {
  home: '🏠',
  bank_vault: '🏦',
  private_vault: '🔒',
  safe: '🗄️',
  other: '📦',
};

export interface StorageLocation {
  id: string;
  name: string;
  description?: string;
  type: LocationType;
  insuranceCoverage?: number;
  notes?: string;
  createdAt: string;
}

// ─── Storage Location Detail (with holdings & summary) ──────────
export interface HoldingSummary {
  id: string;
  name: string;
  metal: string;
  weightOunces: number;
  valueUsd: number;
}

export interface StorageLocationDetail extends StorageLocation {
  holdings: HoldingSummary[];
  totalValueUsd: number;
  totalOunces: number;
  itemCount: number;
}

// ─── Spot Price ────────────────────────────────────────────────
export interface SpotPrice {
  metal: MetalType;
  price: number;         // per troy ounce in USD
  currency: string;
  timestamp: string;
}

// ─── API Response wrapper ──────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Subscription Tier ─────────────────────────────────────────
export type SubscriptionTier = 'free' | 'pro' | 'vault';

export const TIER_LIMITS: Record<SubscriptionTier, { maxItems: number; maxLocations: number }> = {
  free: { maxItems: 50, maxLocations: 1 },
  pro: { maxItems: Infinity, maxLocations: 5 },
  vault: { maxItems: Infinity, maxLocations: Infinity },
};
