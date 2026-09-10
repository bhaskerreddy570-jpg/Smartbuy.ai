import type { CommissionEstimate } from './types';

export function calculateExpectedCommission(
  price: number,
  commissionRate: number,
  conversionProbability = 0.05,
  cancellationRate = 0.1,
): CommissionEstimate {
  const estimatedCommission =
    price * commissionRate * conversionProbability * (1 - cancellationRate);

  return {
    estimatedCommission: Math.round(estimatedCommission * 100) / 100,
    commissionRate,
    conversionProbability,
    cancellationRate,
  };
}

export function calculateBusinessScore(
  hasAffiliate: boolean,
  commissionRate: number,
  conversionProbability: number = 0.05,
  merchantReliability: number = 0.8,
): number {
  if (!hasAffiliate) return 0;

  const commissionFactor = Math.min(commissionRate / 0.1, 1);
  const conversionFactor = Math.min(conversionProbability / 0.1, 1);

  return (
    commissionFactor * 0.4 +
    conversionFactor * 0.3 +
    merchantReliability * 0.3
  );
}
