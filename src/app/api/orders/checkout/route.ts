export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const checkoutSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
  buyerCountry: z.string().length(2).default('US'),
  buyerState: z.string().optional(),
  paymentMethod: z.enum(['credit_card', 'w3c_token', 'crypto']),
  referralCode: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items, buyerCountry, buyerState, paymentMethod } = parsed.data;

  // Fetch products and validate stock
  const productIds = items.map(i => i.productId);
  const { data: products } = await supabase
    .from('products')
    .select('id, price, stock, name')
    .in('id', productIds)
    .eq('status', 'active');

  if (!products || products.length !== productIds.length) {
    return NextResponse.json({ error: 'Some products not found or unavailable' }, { status: 400 });
  }

  const priceMap = new Map(products.map(p => [p.id, p]));

  // Validate stock
  for (const item of items) {
    const product = priceMap.get(item.productId);
    if (!product || product.stock < item.quantity) {
      return NextResponse.json(
        { error: `Insufficient stock for product: ${product?.name ?? item.productId}` },
        { status: 400 }
      );
    }
  }

  // Calculate subtotal
  const subtotal = items.reduce((sum, item) => {
    const product = priceMap.get(item.productId)!;
    return sum + Number(product.price) * item.quantity;
  }, 0);

  // Calculate tax
  const taxRes = await fetch(new URL('/api/tax/calculate', request.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ buyerCountry, buyerState, orderAmount: subtotal }),
  });
  const taxData = await taxRes.json();

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      buyer_id: user.id,
      total_amount: taxData.totalWithTax ?? subtotal,
      payment_status: 'pending',
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }

  // Create order items
  const orderItems = items.map(item => ({
    order_id: order.id,
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: Number(priceMap.get(item.productId)!.price),
  }));

  await supabase.from('order_items').insert(orderItems);

  // Return based on payment method
  if (paymentMethod === 'credit_card') {
    // In production: create Stripe PaymentIntent here
    return NextResponse.json({
      orderId: order.id,
      subtotal,
      tax: taxData.taxAmount ?? 0,
      total: taxData.totalWithTax ?? subtotal,
      paymentMethod: 'credit_card',
      // clientSecret: stripe.paymentIntents.create(...).client_secret
      message: 'Stripe integration required — set STRIPE_SECRET_KEY',
    });
  }

  return NextResponse.json({
    orderId: order.id,
    subtotal,
    tax: taxData.taxAmount ?? 0,
    total: taxData.totalWithTax ?? subtotal,
    paymentMethod,
    message: paymentMethod === 'w3c_token'
      ? 'Transfer W3C tokens to complete purchase'
      : 'Crypto payment pending',
  });
}
