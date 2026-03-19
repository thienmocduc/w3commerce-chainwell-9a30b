export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // In production: use AWS IVS CreateChannelCommand
    // const { IvsClient, CreateChannelCommand } = await import('@aws-sdk/client-ivs');
    // const ivs = new IvsClient({ region: process.env.AWS_REGION });
    // const channel = await ivs.send(new CreateChannelCommand({ ...}));

    // For now: create a livestream record with placeholder data
    const { data: stream, error } = await supabase
      .from('livestreams')
      .insert({
        host_id: user.id,
        status: 'scheduled',
        aws_channel_arn: `arn:aws:ivs:${process.env.AWS_REGION ?? 'ap-southeast-1'}:placeholder`,
        stream_key: `sk_placeholder_${Date.now()}`,
      })
      .select()
      .single();

    if (error || !stream) {
      return NextResponse.json({ error: 'Failed to create stream' }, { status: 500 });
    }

    return NextResponse.json({
      streamId: stream.id,
      streamKey: stream.stream_key,
      playbackUrl: `https://placeholder.ivs.${process.env.AWS_REGION ?? 'ap-southeast-1'}.amazonaws.com/channel/${stream.id}`,
      ingestEndpoint: `rtmps://placeholder.ivs.${process.env.AWS_REGION ?? 'ap-southeast-1'}.amazonaws.com:443/app/`,
      message: 'Configure AWS_ACCESS_KEY_ID to enable real IVS channels',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create stream' },
      { status: 500 }
    );
  }
}
