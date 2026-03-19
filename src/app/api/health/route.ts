export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs: number; message?: string }> = {};

  // 1. Supabase
  try {
    const start = Date.now();
    const supabase = await createServiceClient();
    await supabase.from('users').select('id').limit(1);
    checks.supabase = { status: 'ok', latencyMs: Date.now() - start };
  } catch (_err) {
    checks.supabase = { status: 'error', latencyMs: 0, message: String(_err) };
  }

  // 2. Smart Contracts
  try {
    const start = Date.now();
    const { getContracts } = await import('@/lib/blockchain/contractService');
    const { w3cToken } = getContracts();
    await w3cToken.totalSupply();
    checks.blockchain = { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    checks.blockchain = {
      status: 'error',
      latencyMs: 0,
      message: 'Contract not deployed or RPC unavailable',
    };
  }

  // 3. OpenAI
  try {
    const start = Date.now();
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-...') {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: 'health check',
      });
      checks.openai = { status: 'ok', latencyMs: Date.now() - start };
    } else {
      checks.openai = { status: 'error', latencyMs: 0, message: 'API key not configured' };
    }
  } catch (err) {
    checks.openai = { status: 'error', latencyMs: 0, message: String(err) };
  }

  // 4. Redis (Upstash)
  try {
    const start = Date.now();
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      });
      checks.redis = { status: res.ok ? 'ok' : 'error', latencyMs: Date.now() - start };
    } else {
      checks.redis = { status: 'error', latencyMs: 0, message: 'Not configured' };
    }
  } catch (err) {
    checks.redis = { status: 'error', latencyMs: 0, message: String(err) };
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok');

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  }, { status: allOk ? 200 : 503 });
}
