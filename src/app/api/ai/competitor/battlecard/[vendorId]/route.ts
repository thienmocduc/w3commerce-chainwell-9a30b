export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('competitor_data')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('scraped_at', { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const battlecards = (data ?? []).map(d => ({
    ...d,
    freshnessDays: Math.floor(
      (Date.now() - new Date(d.scraped_at).getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));

  return NextResponse.json({ battlecards });
}
