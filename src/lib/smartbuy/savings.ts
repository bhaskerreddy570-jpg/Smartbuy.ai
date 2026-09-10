export interface SavingsResult {
  amount: number;
  percent: number;
  comparedToMerchant: string;
  comparedToPrice: number;
  isValid: boolean;
}

export function calculateSavings(
  price: number,
  comparePrice: number,
  comparedToMerchant: string,
): SavingsResult {
  if (price <= 0 || comparePrice <= 0 || price >= comparePrice) {
    return {
      amount: 0,
      percent: 0,
      comparedToMerchant,
      comparedToPrice: comparePrice,
      isValid: false,
    };
  }

  const amount = comparePrice - price;
  const percent = (amount / comparePrice) * 100;

  return {
    amount: Math.round(amount),
    percent: Math.round(percent * 100) / 100,
    comparedToMerchant,
    comparedToPrice: comparePrice,
    isValid: true,
  };
}

export function findHighestPrice(prices: Array<{ price: number; merchant: string }>): {
  price: number;
  merchant: string;
} | null {
  if (prices.length === 0) return null;
  return prices.reduce((max, p) => (p.price > max.price ? p : max), prices[0]);
}

export function findLowestPrice(prices: Array<{ price: number; merchant: string }>): {
  price: number;
  merchant: string;
} | null {
  const valid = prices.filter((p) => p.price > 0);
  if (valid.length === 0) return null;
  return valid.reduce((min, p) => (p.price < min.price ? p : min), valid[0]);
}
