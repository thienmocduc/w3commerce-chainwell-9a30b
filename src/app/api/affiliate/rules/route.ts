export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const ruleSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  rule_type: z.enum(['flat', 'tiered', 'recurring', 'lifetime', 'split']),
  commission_rate: z.number().min(0).max(100),
  threshold_amount: z.number().nullable().optional(),
  bonus_amount: z.number().nullable().optional(),
  config: z.object({
    tiers: z.array(z.object({ minRevenue: z.number(), rate: z.number() })).optional(),
    recurringMonths: z.number().int().positive().optional(),
    splitKocIds: z.array(z.string()).optional(),
    splitRatios: z.array(z.number()).optional(),
  }).optional(),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('product_id');

  let query = supabase
    .from('affiliate_rules')
    .select('*')
    .eq('vendor_id', user.id)
    .eq('is_active', true);

  if (productId) query = query.eq('product_id', productId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rules: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = ruleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('affiliate_rules')
    .insert({
      vendor_id: user.id,
      ...parsed.data,
      config: parsed.data.config ?? {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rule: data }, { status: 201 });
}
