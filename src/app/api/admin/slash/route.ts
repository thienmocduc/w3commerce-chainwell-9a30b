export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { getContracts, waitForTx } from '@/lib/blockchain/contractService';

const slashSchema = z.object({
  targetAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  slashRatio: z.number().int().min(1).max(100),
  reason: z.string().min(1).max(500),
  evidence: z.string().optional(),
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
  const parsed = slashSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { targetAddress, slashRatio, reason, evidence } = parsed.data;

  try {
    const { stakingVault } = getContracts();

    // Call slash on-chain
    const tx = await stakingVault.slash(targetAddress, slashRatio, reason);
    const receipt = await waitForTx(tx.hash);

    // Log action
    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action: 'slash',
      details: {
        targetAddress,
        slashRatio,
        reason,
        evidence: evidence ?? null,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      },
    });

    return NextResponse.json({
      txHash: tx.hash,
      slashRatio,
      message: `Slashed ${slashRatio}% of stake for: ${reason}`,
    });
  } catch (err) {
    console.error('Slash error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Slash failed' },
      { status: 500 }
    );
  }
}
