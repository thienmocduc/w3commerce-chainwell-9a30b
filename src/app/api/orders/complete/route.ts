export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { calculateCommission } from '@/lib/affiliate/commissionEngine';
import { z } from 'zod';

const completeOrderSchema = z.object({
  orderId: z.string().uuid(),
  buyerId: z.string().uuid(),
  productIds: z.array(z.string().uuid()),
  amounts: z.array(z.number().positive()),
  referralChain: z.array(z.object({
    kocId: z.string().uuid(),
    touchType: z.enum(['view', 'click', 'purchase']),
    weight: z.number().min(0).max(1),
  })).optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = completeOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orderId, productIds, referralChain } = parsed.data;
  const supabase = await createServiceClient();

  try {
    // Fetch applicable affiliate rules for each product
    const { data: rules } = await supabase
      .from('affiliate_rules')
      .select('*')
      .in('product_id', productIds)
      .eq('is_active', true);

    const commissionsCreated: Array<{ kocId: string; amount: number; ruleId: string }> = [];

    if (rules && rules.length > 0 && referralChain && referralChain.length > 0) {
      for (const kocRef of referralChain) {
        // Calculate KOC's total revenue this month for tiered rules
        const firstOfMonth = new Date();
        firstOfMonth.setDate(1);
        firstOfMonth.setHours(0, 0, 0, 0);

        const { data: monthlyCommissions } = await supabase
          .from('commissions')
          .select('amount')
          .eq('koc_id', kocRef.kocId)
          .gte('created_at', firstOfMonth.toISOString());

        const kocTotalRevenue = (monthlyCommissions ?? [])
          .reduce((sum, c) => sum + Number(c.amount), 0);

        const totalOrderAmount = parsed.data.amounts.reduce((s, a) => s + a, 0);
        const weightedAmount = totalOrderAmount * kocRef.weight;

        const results = calculateCommission(
          weightedAmount,
          kocRef.kocId,
          kocTotalRevenue,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rules as any[]
        );

        for (const result of results) {
          const { error: commError } = await supabase
            .from('commissions')
            .insert({
              koc_id: result.kocId,
              order_id: orderId,
              rule_id: result.ruleId,
              amount: result.amount,
              status: 'pending',
            });

          if (!commError) {
            commissionsCreated.push(result);
          }
        }
      }
    }

    // Update order status
    await supabase
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('id', orderId);

    return NextResponse.json({
      orderId,
      commissionsCreated: commissionsCreated.length,
      commissions: commissionsCreated,
    });
  } catch (err) {
    console.error('Order complete error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to complete order' },
      { status: 500 }
    );
  }
}
