'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ProductPopup } from './ProductPopup';

interface LiveStreamPlayerProps {
  playbackUrl: string;
  streamId: string;
  onProductFeatured?: (productId: string) => void;
}

export function LiveStreamPlayer({
  playbackUrl,
  streamId: _streamId,
  onProductFeatured,
}: LiveStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [featuredProductId, setFeaturedProductId] = useState<string | null>(null);
  const [viewerCount] = useState(0);
  const [isLive, setIsLive] = useState(false);

  // Load AWS IVS player (client-only)
  useEffect(() => {
    if (!playbackUrl) return;

    let player: any = null;

    async function initPlayer() {
      try {
        // Dynamic import for client-side only
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const IVSModule = await import('amazon-ivs-player') as any;
        const IVS = IVSModule.default || IVSModule;

        if (!IVS.isPlayerSupported) return;

        player = IVS.create({});
        player.attachHTMLVideoElement(videoRef.current!);

        player.addEventListener(IVS.PlayerState.PLAYING, () => setIsLive(true));
        player.addEventListener(IVS.PlayerState.ENDED, () => setIsLive(false));

        // TimedMetadata for product popups
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        player.addEventListener(IVS.PlayerEventType.TEXT_METADATA_CUE, (cue: any) => {
          try {
            const metadata = JSON.parse(cue.text);
            if (metadata.type === 'product_feature' && metadata.productId) {
              setFeaturedProductId(metadata.productId);
              onProductFeatured?.(metadata.productId);
              // Auto-dismiss after 10s
              setTimeout(() => setFeaturedProductId(null), 10000);
            }
          } catch {
            // Ignore malformed metadata
          }
        });

        player.load(playbackUrl);
        player.play();
      } catch (err) {
        console.error('IVS Player init error:', err);
        // Fallback to regular video element
        if (videoRef.current) {
          videoRef.current.src = playbackUrl;
          videoRef.current.play().catch(() => {});
        }
      }
    }

    initPlayer();

    return () => {
      if (player?.delete) player.delete();
    };
  }, [playbackUrl, onProductFeatured]);

  const dismissProduct = useCallback(() => setFeaturedProductId(null), []);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        playsInline
        autoPlay
      />

      {/* Live indicator */}
      {isLive && (
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded bg-red-600 px-2 py-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          <span className="text-xs font-bold text-white">LIVE</span>
        </div>
      )}

      {/* Viewer count */}
      <div className="absolute right-3 top-3 rounded bg-black/50 px-2 py-1 text-xs text-white">
        👁 {viewerCount}
      </div>

      {/* Product popup (triggered by TimedMetadata) */}
      {featuredProductId && (
        <ProductPopup
          productId={featuredProductId}
          onDismiss={dismissProduct}
        />
      )}
    </div>
  );
}
