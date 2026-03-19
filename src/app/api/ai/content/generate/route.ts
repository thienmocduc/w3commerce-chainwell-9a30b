export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kocId, productId, style } = await request.json();
  const validStyles = ['educational', 'entertainment', 'review', 'tutorial'];

  if (!validStyles.includes(style ?? '')) {
    return NextResponse.json({ error: 'Invalid style' }, { status: 400 });
  }

  // Fetch product info
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Fetch KOC profile for persona
  const { data: _kocProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', kocId)
    .single();

  try {
    const prompt = `You are a viral content strategist. Generate a 60-second video script for a KOC promoting this product.

Product: ${product.name}
Description: ${product.description}
Price: $${product.price}
Style: ${style}

Generate a JSON response with this structure:
{
  "hook": { "text": "...", "duration": "3s", "emotionalTrigger": "..." },
  "agitation": { "text": "...", "duration": "12s", "problem": "..." },
  "solution": { "text": "...", "duration": "10s" },
  "proof": { "text": "...", "duration": "25s", "proofType": "..." },
  "cta": { "text": "...", "duration": "10s", "ctaType": "..." },
  "fullScript": "...",
  "suggestedHashtags": ["#tag1", "#tag2"],
  "formulaScore": 8,
  "disclosure": "#ad #sponsored"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const script = JSON.parse(response.choices[0].message.content ?? '{}');

    return NextResponse.json({
      scripts: [script],
      productName: product.name,
      style,
    });
  } catch (err) {
    console.error('Content generation error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
