export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const taxSchema = z.object({
  productId: z.string().uuid().optional(),
  buyerCountry: z.string().length(2).toUpperCase(),
  buyerState: z.string().optional(),
  orderAmount: z.number().positive(),
});

// Static tax rates by country/region
const VAT_RATES: Record<string, number> = {
  VN: 10, DE: 19, FR: 20, IT: 22, ES: 21, NL: 21,
  BE: 21, AT: 20, PT: 23, SE: 25, DK: 25, FI: 24,
  IE: 23, PL: 23, CZ: 21, GR: 24, HU: 27, RO: 19,
  GB: 20, JP: 10, KR: 10, SG: 9, AU: 10, NZ: 15,
  CA: 5, IN: 18, TH: 7, MY: 6, PH: 12, ID: 11,
};

const US_STATE_TAX: Record<string, number> = {
  CA: 7.25, TX: 6.25, NY: 8.0, FL: 6.0, WA: 6.5,
  IL: 6.25, PA: 6.0, OH: 5.75, GA: 4.0, NC: 4.75,
  MI: 6.0, NJ: 6.625, VA: 5.3, AZ: 5.6, MA: 6.25,
  TN: 7.0, IN: 7.0, MO: 4.225, MD: 6.0, WI: 5.0,
  CO: 2.9, MN: 6.875, SC: 6.0, AL: 4.0, LA: 4.45,
  KY: 6.0, OR: 0, MT: 0, NH: 0, DE: 0, AK: 0,
};

const CUSTOMS_THRESHOLD_USD = 800;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = taxSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { buyerCountry, buyerState, orderAmount } = parsed.data;

  let taxRate = 0;
  let jurisdiction = buyerCountry;

  if (buyerCountry === 'US' && buyerState) {
    taxRate = US_STATE_TAX[buyerState.toUpperCase()] ?? 0;
    jurisdiction = `US-${buyerState.toUpperCase()}`;
  } else {
    taxRate = VAT_RATES[buyerCountry] ?? 0;
  }

  const taxAmount = Math.round(orderAmount * taxRate) / 100;
  const totalWithTax = orderAmount + taxAmount;
  const requiresCustoms = orderAmount > CUSTOMS_THRESHOLD_USD;

  return NextResponse.json({
    taxRate,
    taxAmount,
    totalWithTax,
    jurisdiction,
    requiresCustomsDeclaration: requiresCustoms,
    currency: 'USD',
  });
}
