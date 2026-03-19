export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { channelArn, productId } = await request.json();

  if (!channelArn || !productId) {
    return NextResponse.json({ error: 'channelArn and productId required' }, { status: 400 });
  }

  try {
    // In production: use AWS IVS PutMetadataCommand
    // const { IvsClient, PutMetadataCommand } = await import('@aws-sdk/client-ivs');
    // const ivs = new IvsClient({ region: process.env.AWS_REGION });
    // await ivs.send(new PutMetadataCommand({
    //   channelArn,
    //   metadata: JSON.stringify({ type: 'product_feature', productId, timestamp: Date.now() }),
    // }));

    return NextResponse.json({
      success: true,
      metadata: {
        type: 'product_feature',
        productId,
        timestamp: Date.now(),
      },
      message: 'Configure AWS credentials to enable real TimedMetadata injection',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to inject metadata' },
      { status: 500 }
    );
  }
}
