export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { ethers } from 'ethers';
import { buildDPPClaims, buildDPPMerkleTree } from '@/lib/blockchain/merkleService';

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000),
  price: z.number().positive(),
  stock: z.number().int().min(0),
  dppData: z.object({
    origin: z.string().optional(),
    certifications: z.array(z.string()).optional(),
    carbonFootprint: z.string().optional(),
    ingredients: z.array(z.string()).optional(),
    expiryDate: z.string().optional(),
  }).optional(),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

  const { data, error, count } = await supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('vendor_id', user.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data, total: count, page, limit });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify vendor role
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'vendor' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Vendor access required' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createProductSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, description, price, stock, dppData } = parsed.data;

  // Compute DPP hash
  let dppHash: string | null = null;
  let merkleRoot: string | null = null;

  if (dppData) {
    const dppString = JSON.stringify(dppData);
    dppHash = ethers.keccak256(ethers.toUtf8Bytes(dppString));

    const claims = buildDPPClaims(dppData);
    if (claims.length > 0) {
      const { root } = buildDPPMerkleTree(claims);
      merkleRoot = root;
    }
  }

  // Insert product
  const { data: product, error: insertError } = await supabase
    .from('products')
    .insert({
      vendor_id: user.id,
      name,
      description,
      price,
      stock,
      dpp_hash: dppHash,
      metadata: dppData ? { dpp: dppData, merkleRoot } : {},
      status: 'draft',
    })
    .select()
    .single();

  if (insertError || !product) {
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }

  // Note: On-chain DPP minting happens when product is activated (status → active)
  // This prevents minting for draft products

  return NextResponse.json({ product, dppHash, merkleRoot }, { status: 201 });
}
