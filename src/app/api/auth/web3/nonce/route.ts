export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const nonce = randomBytes(32).toString('hex');
  const supabase = await createServiceClient();

  const { error } = await supabase.from('session_nonces').insert({
    nonce,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to create nonce' }, { status: 500 });
  }

  return NextResponse.json({ nonce });
}
