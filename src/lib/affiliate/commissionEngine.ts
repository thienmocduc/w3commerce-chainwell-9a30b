export type RuleType = 'flat' | 'tiered' | 'recurring' | 'lifetime' | 'split';

export interface AffiliateRule {
  id: string;
  rule_type: RuleType;
  commission_rate: number;     // percentage (0-100)
  threshold_amount?: number;
  bonus_amount?: number;
  config: {
    tiers?: { minRevenue: number; rate: number }[];
    recurringMonths?: number;
    splitKocIds?: string[];
    splitRatios?: number[];
  };
}

export interface CommissionResult {
  kocId: string;
  amount: number;
  ruleId: string;
  type: RuleType;
}

/**
 * Calculate commission for a single order based on applicable rules
 * Uses integer arithmetic (basis points) to avoid floating point errors
 */
export function calculateCommission(
  orderAmount: number,
  kocId: string,
  kocTotalRevenue: number,
  rules: AffiliateRule[]
): CommissionResult[] {
  const results: CommissionResult[] = [];

  for (const rule of rules) {
    switch (rule.rule_type) {
      case 'flat': {
        const amount = Math.floor((orderAmount * rule.commission_rate * 100) / 10000) / 100;
        if (amount > 0) {
          results.push({ kocId, amount, ruleId: rule.id, type: 'flat' });
        }
        break;
      }

      case 'tiered': {
        const tiers = rule.config.tiers ?? [];
        const totalAfterOrder = kocTotalRevenue + orderAmount;

        // Find applicable tier based on total revenue
        let applicableRate = rule.commission_rate;
        for (const tier of tiers.sort((a, b) => b.minRevenue - a.minRevenue)) {
          if (totalAfterOrder >= tier.minRevenue) {
            applicableRate = tier.rate;
            break;
          }
        }

        const amount = Math.floor((orderAmount * applicableRate * 100) / 10000) / 100;
        const bonus = (rule.threshold_amount && totalAfterOrder >= rule.threshold_amount)
          ? (rule.bonus_amount ?? 0)
          : 0;

        if (amount + bonus > 0) {
          results.push({ kocId, amount: amount + bonus, ruleId: rule.id, type: 'tiered' });
        }
        break;
      }

      case 'recurring': {
        const amount = Math.floor((orderAmount * rule.commission_rate * 100) / 10000) / 100;
        if (amount > 0) {
          results.push({ kocId, amount, ruleId: rule.id, type: 'recurring' });
          // Note: recurring commissions are flagged for future re-billing
          // The caller should handle scheduling future commission payments
        }
        break;
      }

      case 'lifetime': {
        const amount = Math.floor((orderAmount * rule.commission_rate * 100) / 10000) / 100;
        if (amount > 0) {
          results.push({ kocId, amount, ruleId: rule.id, type: 'lifetime' });
          // Note: lifetime means all future orders from this customer
          // are also tagged for this KOC
        }
        break;
      }

      case 'split': {
        const splitKocIds = rule.config.splitKocIds ?? [];
        const splitRatios = rule.config.splitRatios ?? [];

        if (splitKocIds.length !== splitRatios.length) break;

        // Validate split ratios sum to <= 100
        const totalRatio = splitRatios.reduce((sum, r) => sum + r, 0);
        if (totalRatio > 100) break;

        // Base commission amount
        const totalCommission = Math.floor((orderAmount * rule.commission_rate * 100) / 10000) / 100;

        for (let i = 0; i < splitKocIds.length; i++) {
          const splitAmount = Math.floor((totalCommission * splitRatios[i] * 100) / 10000) / 100;
          if (splitAmount > 0) {
            results.push({
              kocId: splitKocIds[i],
              amount: splitAmount,
              ruleId: rule.id,
              type: 'split',
            });
          }
        }
        break;
      }
    }
  }

  return results;
}
