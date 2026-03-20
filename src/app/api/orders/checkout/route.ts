export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface CheckoutItem {
  product_id: string;
  quantity: number;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { items, payment_method } = body as {
    items?: CheckoutItem[];
    payment_method?: string;
    buyer_location?: string;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Items are required' }, { status: 400 });
  }

  // Fetch products and validate stock
  const productIds = items.map(i => i.product_id);
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
    const product = priceMap.get(item.product_id);
    if (!product || product.stock < item.quantity) {
      return NextResponse.json(
        { error: `Insufficient stock for: ${product?.name ?? item.product_id}` },
        { status: 400 }
      );
    }
  }

  // Calculate total
  const totalAmount = items.reduce((sum, item) => {
    const product = priceMap.get(item.product_id)!;
    return sum + Number(product.price) * item.quantity;
  }, 0);

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      buyer_id: user.id,
      total_amount: totalAmount,
      payment_status: 'paid', // Auto-confirm for MVP
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }

  // Create order items
  const orderItems = items.map(item => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: Number(priceMap.get(item.product_id)!.price),
  }));

  await supabase.from('order_items').insert(orderItems);

  // Deduct stock
  for (const item of items) {
    const product = priceMap.get(item.product_id)!;
    await supabase
      .from('products')
      .update({ stock: product.stock - item.quantity })
      .eq('id', item.product_id);
  }

  // Award XP: 10 XP per item purchased
  const totalItemsCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const xpToAward = totalItemsCount * 10;

  const { data: userProfile } = await supabase
    .from('users')
    .select('xp_points, level')
    .eq('id', user.id)
    .single();

  if (userProfile) {
    const newXp = (userProfile.xp_points || 0) + xpToAward;
    // Level thresholds: 0, 100, 300, 600, 1000, 1500, 2500
    const thresholds = [0, 100, 300, 600, 1000, 1500, 2500];
    let newLevel = 1;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (newXp >= thresholds[i]) { newLevel = i + 1; break; }
    }
    await supabase
      .from('users')
      .update({ xp_points: newXp, level: newLevel })
      .eq('id', user.id);
  }

  return NextResponse.json({
    orderId: order.id,
    total: totalAmount,
    xpAwarded: xpToAward,
    paymentMethod: payment_method || 'credit_card',
    message: 'Order placed successfully',
  });
}
