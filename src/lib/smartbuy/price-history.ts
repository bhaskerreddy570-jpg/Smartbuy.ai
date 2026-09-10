import type { PriceHistoryStats } from './types';

export interface PriceObservationInput {
  price: number;
  observedAt: Date;
}

export function calculatePriceHistoryStats(
  observations: PriceObservationInput[],
  currentPrice?: number,
): PriceHistoryStats {
  if (observations.length === 0) {
    return {
      currentPrice: currentPrice ?? null,
      avg7Day: null,
      avg30Day: null,
      low30Day: null,
      low90Day: null,
      highHistorical: null,
      trend: 'unknown',
      observationCount: 0,
      buyRecommendation: 'insufficient_data',
      buyRecommendationText: 'Not enough historical data to make a reliable price-timing recommendation.',
    };
  }

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const sorted = [...observations].sort(
    (a, b) => b.observedAt.getTime() - a.observedAt.getTime(),
  );

  const prices = sorted.map((o) => o.price);
  const current = currentPrice ?? prices[0];

  const last7 = sorted.filter((o) => now - o.observedAt.getTime() <= 7 * day);
  const last30 = sorted.filter((o) => now - o.observedAt.getTime() <= 30 * day);
  const last90 = sorted.filter((o) => now - o.observedAt.getTime() <= 90 * day);

  const avg = (arr: PriceObservationInput[]) =>
    arr.length > 0 ? arr.reduce((s, o) => s + o.price, 0) / arr.length : null;

  const min = (arr: PriceObservationInput[]) =>
    arr.length > 0 ? Math.min(...arr.map((o) => o.price)) : null;

  const max = (arr: PriceObservationInput[]) =>
    arr.length > 0 ? Math.max(...arr.map((o) => o.price)) : null;

  const avg7 = avg(last7);
  const avg30 = avg(last30);
  const low30 = min(last30);
  const low90 = min(last90);
  const high = max(sorted);

  let trend: PriceHistoryStats['trend'] = 'unknown';
  if (last7.length >= 2) {
    const recentAvg = avg(last7)!;
    const older = sorted.filter((o) => now - o.observedAt.getTime() > 7 * day && now - o.observedAt.getTime() <= 30 * day);
    const olderAvg = avg(older);
    if (olderAvg) {
      const diff = (recentAvg - olderAvg) / olderAvg;
      if (diff > 0.03) trend = 'rising';
      else if (diff < -0.03) trend = 'falling';
      else trend = 'stable';
    }
  }

  let buyRecommendation: PriceHistoryStats['buyRecommendation'] = 'insufficient_data';
  let buyRecommendationText = 'Not enough historical data to make a reliable price-timing recommendation.';

  if (last30.length >= 5 && current && avg30) {
    if (current <= avg30 * 0.95) {
      buyRecommendation = 'buy';
      buyRecommendationText = 'Good time to buy. Current price is below recent average.';
    } else if (current >= avg30 * 1.1) {
      buyRecommendation = 'wait';
      buyRecommendationText = 'Consider waiting. The current price is significantly above recent observed prices.';
    } else {
      buyRecommendation = 'buy';
      buyRecommendationText = 'Current price is within normal range based on recent observations.';
    }
  }

  return {
    currentPrice: current,
    avg7Day: avg7 ? Math.round(avg7) : null,
    avg30Day: avg30 ? Math.round(avg30) : null,
    low30Day: low30,
    low90Day: low90,
    highHistorical: high,
    trend,
    observationCount: observations.length,
    buyRecommendation,
    buyRecommendationText,
  };
}
