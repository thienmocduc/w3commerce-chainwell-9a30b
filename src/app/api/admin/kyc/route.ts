export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const kycSchema = z.object({
  vendorId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify admin role
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!adminProfile || adminProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = kycSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { vendorId, action, reason } = parsed.data;

  if (action === 'approve') {
    const { error } = await supabase
      .from('users')
      .update({ role: 'vendor' })
      .eq('id', vendorId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Log action
  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: `kyc_${action}`,
    target_id: vendorId,
    details: { reason: reason ?? null },
  });

  return NextResponse.json({
    success: true,
    message: `Vendor KYC ${action}ed successfully`,
  });
}
