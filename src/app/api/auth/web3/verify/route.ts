export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SiweMessage } from 'siwe';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { message, signature } = await request.json();

    if (!message || !signature) {
      return NextResponse.json({ error: 'Missing message or signature' }, { status: 400 });
    }

    // Parse and verify SIWE message
    const siweMessage = new SiweMessage(message);
    const result = await siweMessage.verify({ signature });

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { address, nonce } = siweMessage;
    const supabase = await createServiceClient();

    // Verify nonce exists and is unused
    const { data: nonceRecord, error: nonceError } = await supabase
      .from('session_nonces')
      .select('*')
      .eq('nonce', nonce)
      .eq('used', false)
      .single();

    if (nonceError || !nonceRecord) {
      return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 401 });
    }

    // Check nonce hasn't expired
    if (new Date(nonceRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Nonce expired' }, { status: 401 });
    }

    // Mark nonce as used
    await supabase
      .from('session_nonces')
      .update({ used: true, wallet: address.toLowerCase() })
      .eq('id', nonceRecord.id);

    // Upsert user with wallet address
    const walletLower = address.toLowerCase();
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletLower)
      .single();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user with wallet
      const email = `${walletLower}@wallet.w3commerce.local`;
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email,
          wallet_address: walletLower,
          role: 'user',
        })
        .select()
        .single();

      if (createError || !newUser) {
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
      }
      userId = newUser.id;
    }

    // Generate a session token (stored as a cookie)
    // For Web3 auth, we use a custom JWT-like approach since Supabase auth
    // is primarily email/password based
    const sessionToken = randomBytes(32).toString('hex');

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        address: walletLower,
      },
      sessionToken,
    });
  } catch (err) {
    console.error('Web3 verify error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

function randomBytes(size: number): Buffer {
  const crypto = require('crypto');
  return crypto.randomBytes(size);
}
