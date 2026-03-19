export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get('vendor_id');

  let query = supabase
    .from('affiliate_rules')
    .select('*')
    .eq('is_active', true);

  if (vendorId) {
    query = query.eq('vendor_id', vendorId);
  }

  const { data, error } = await query.order('commission_rate', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rules: data });
}
