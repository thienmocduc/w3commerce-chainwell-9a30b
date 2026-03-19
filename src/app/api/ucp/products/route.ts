export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServiceClient();

  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ucpProducts = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: {
      amount: Number(p.price),
      currency: 'USD',
      tokenEquivalent: null, // calculated dynamically via oracle
    },
    inventory: {
      inStock: p.stock > 0,
      quantity: p.stock,
      reservedCount: 0,
    },
    shipping: {
      available: true,
      estimatedDays: { domestic: 3, international: 7 },
      restrictions: [],
      freeShippingThreshold: 50,
    },
    checkout: {
      endpoint: '/api/orders/checkout',
      method: 'POST',
      requiredFields: ['buyerId', 'shippingAddress', 'paymentMethod'],
      paymentMethods: ['credit_card', 'w3c_token', 'crypto'],
    },
    dpp: {
      hash: p.dpp_hash,
      verifiable: !!p.dpp_hash,
    },
    affiliate: {
      programActive: true,
      trackingParam: 'ref',
    },
  }));

  return NextResponse.json({
    ucpVersion: '1.0',
    generatedAt: new Date().toISOString(),
    products: ucpProducts,
  });
}
