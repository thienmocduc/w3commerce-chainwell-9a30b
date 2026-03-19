export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kocId: string }> }
) {
  const { kocId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch all commissions for this KOC
  const { data: commissions } = await supabase
    .from('commissions')
    .select('*')
    .eq('koc_id', kocId)
    .order('created_at', { ascending: false });

  if (!commissions) {
    return NextResponse.json({ error: 'No data found' }, { status: 404 });
  }

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const totalEarnings = commissions.reduce((sum, c) => sum + Number(c.amount), 0);
  const thisMonthEarnings = commissions
    .filter(c => c.created_at >= firstOfMonth)
    .reduce((sum, c) => sum + Number(c.amount), 0);
  const pendingAmount = commissions
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + Number(c.amount), 0);
  const confirmedAmount = commissions
    .filter(c => c.status === 'confirmed')
    .reduce((sum, c) => sum + Number(c.amount), 0);
  const paidAmount = commissions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  return NextResponse.json({
    kocId,
    totalEarnings,
    thisMonthEarnings,
    pendingAmount,
    confirmedAmount,
    paidAmount,
    recentCommissions: commissions.slice(0, 20),
    totalCommissions: commissions.length,
  });
}
