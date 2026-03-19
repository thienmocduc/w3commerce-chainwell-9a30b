export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key === 'sk-...') throw new Error('OPENAI_API_KEY not configured');
  return new OpenAI({ apiKey: key });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { productCategory, targetPlatforms } = body;

  try {
    // In production: use Apify client to scrape real data
    // For now: generate competitive intelligence via AI
    const prompt = `You are a competitive intelligence analyst for an e-commerce platform.
Generate a realistic battlecard for the "${productCategory}" category on platforms: ${(targetPlatforms ?? ['tiktok']).join(', ')}.

Return a JSON object with this exact structure:
{
  "generatedAt": "${new Date().toISOString()}",
  "competitor": "Example Competitor",
  "products": [
    {
      "name": "Product Name",
      "theirPrice": 29.99,
      "weaknesses": ["weakness 1", "weakness 2"],
      "opportunities": ["opportunity 1"]
    }
  ],
  "pricingRecommendations": ["recommendation 1"],
  "marketingAngles": ["angle 1"],
  "urgencyScore": 7
}`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const battlecard = JSON.parse(response.choices[0].message.content ?? '{}');

    // Save to database
    await supabase.from('competitor_data').insert({
      vendor_id: user.id,
      platform: (targetPlatforms ?? ['tiktok']).join(','),
      product_name: productCategory,
      price: 0,
      sales_count: 0,
      battlecard,
    });

    return NextResponse.json({ battlecard });
  } catch (err) {
    console.error('Competitor analysis error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
