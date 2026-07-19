import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { getSpotPriceMeta } from '../services/spotPriceService.js';
import type { ApiResponse } from '@pmvault/shared';

const router = Router();
const DEMO_USER_ID = 'user-demo-001';

interface PortfolioSummary {
  totalValueUsd: number;
  costBasisUsd: number;
  profitLossUsd: number;
  profitLossPercent: number;
  totalHoldings: number;
  totalOunces: number;
  breakdown: {
    byMetal: Record<string, { valueUsd: number; ounces: number; holdings: number; pctOfPortfolio: number }>;
    byCategory: Record<string, { valueUsd: number; count: number }>;
    byLocation: Record<string, { valueUsd: number; count: number }>;
  };
  spotPrices: Record<string, number>;
}

// GET /api/portfolio/summary — calculated portfolio stats
router.get('/summary', (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEMO_USER_ID;
    const db = getDb();

    // Fetch all holdings for the user with storage location names
    const holdings = db.prepare(`
      SELECT
        h.*,
        sl.name as location_name
      FROM holdings h
      LEFT JOIN storage_locations sl ON h.storage_location_id = sl.id
      WHERE h.user_id = ?
    `).all(userId) as Record<string, unknown>[];

    // Fetch latest spot prices (one per metal)
    const spotRows = db.prepare(`
      SELECT metal, price_per_oz_cents
      FROM spot_prices
      WHERE (metal, timestamp) IN (
        SELECT metal, MAX(timestamp) FROM spot_prices GROUP BY metal
      )
    `).all() as Record<string, unknown>[];

    const spotPrices: Record<string, number> = {};
    for (const row of spotRows) {
      spotPrices[row.metal as string] = (row.price_per_oz_cents as number) / 100;
    }

    // Calculate totals
    let totalValueUsd = 0;
    let costBasisUsd = 0;
    const byMetal: Record<string, { valueUsd: number; ounces: number; holdings: number }> = {};
    const byCategory: Record<string, { valueUsd: number; count: number }> = {};
    const byLocation: Record<string, { valueUsd: number; count: number }> = {};
    let totalOunces = 0;

    for (const h of holdings) {
      const metal = h.metal as string;
      const weightGrams = h.weight_grams as number;
      const purity = h.purity as number;
      const quantity = h.quantity as number;
      const totalCostCents = h.total_cost_cents as number;
      const locationName = (h.location_name as string) || 'Unallocated';
      const category = h.category as string;

      // Convert grams to troy ounces for value calculation
      const ounces = (weightGrams / 31.1035) * quantity;
      totalOunces += ounces;

      // Value based on spot price
      const spotPrice = spotPrices[metal] || 0;
      const valueUsd = ounces * purity * spotPrice;
      totalValueUsd += valueUsd;
      costBasisUsd += totalCostCents / 100;

      // By metal
      if (!byMetal[metal]) byMetal[metal] = { valueUsd: 0, ounces: 0, holdings: 0 };
      byMetal[metal].valueUsd += valueUsd;
      byMetal[metal].ounces += ounces * purity;
      byMetal[metal].holdings += 1;

      // By category
      if (!byCategory[category]) byCategory[category] = { valueUsd: 0, count: 0 };
      byCategory[category].valueUsd += valueUsd;
      byCategory[category].count += 1;

      // By location
      if (!byLocation[locationName]) byLocation[locationName] = { valueUsd: 0, count: 0 };
      byLocation[locationName].valueUsd += valueUsd;
      byLocation[locationName].count += 1;
    }

    // Calculate P&L
    const profitLossUsd = totalValueUsd - costBasisUsd;
    const profitLossPercent = costBasisUsd > 0 ? (profitLossUsd / costBasisUsd) * 100 : 0;

    // Add pctOfPortfolio to byMetal
    const byMetalWithPct: Record<string, { valueUsd: number; ounces: number; holdings: number; pctOfPortfolio: number }> = {};
    for (const [metal, data] of Object.entries(byMetal)) {
      byMetalWithPct[metal] = {
        ...data,
        pctOfPortfolio: totalValueUsd > 0 ? (data.valueUsd / totalValueUsd) * 100 : 0,
      };
    }

    const summary: PortfolioSummary = {
      totalValueUsd: Math.round(totalValueUsd * 100) / 100,
      costBasisUsd: Math.round(costBasisUsd * 100) / 100,
      profitLossUsd: Math.round(profitLossUsd * 100) / 100,
      profitLossPercent: Math.round(profitLossPercent * 100) / 100,
      totalHoldings: holdings.length,
      totalOunces: Math.round(totalOunces * 100) / 100,
      breakdown: {
        byMetal: byMetalWithPct,
        byCategory,
        byLocation,
      },
      spotPrices,
    };

    const response: ApiResponse<PortfolioSummary & { spotMeta: ReturnType<typeof getSpotPriceMeta> }> = {
      success: true,
      data: { ...summary, spotMeta: getSpotPriceMeta() },
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error calculating portfolio',
    };
    res.status(500).json(response);
  }
});

export default router;
