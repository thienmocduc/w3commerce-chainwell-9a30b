'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { ShoppableTag } from './ShoppableTag';
import { Button } from '@/components/ui/button';

interface VideoItem {
  id: string;
  videoUrl: string;
  kocName: string;
  productName: string;
  productId: string;
  shoppableTags?: { x: number; y: number; productId: string }[];
}

interface VideoFeedProps {
  videos: VideoItem[];
  onAddToCart?: (productId: string) => void;
}

export function VideoFeed({ videos, onAddToCart }: VideoFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll"
    >
      {videos.map((video) => (
        <VideoItem
          key={video.id}
          video={video}
          onAddToCart={onAddToCart}
        />
      ))}
      {videos.length === 0 && (
        <div className="flex h-[100dvh] items-center justify-center text-muted-foreground">
          No videos available
        </div>
      )}
    </div>
  );
}

function VideoItem({
  video,
  onAddToCart,
}: {
  video: VideoItem;
  onAddToCart?: (productId: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // IntersectionObserver for autoplay on viewport entry
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            videoRef.current?.play().catch(() => {});
            setIsPlaying(true);
          } else {
            videoRef.current?.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.7 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const togglePlay = useCallback(() => {
    if (videoRef.current?.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current?.pause();
      setIsPlaying(false);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-[100dvh] w-full snap-start snap-always bg-black"
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={video.videoUrl}
        className="h-full w-full object-cover"
        loop
        muted
        playsInline
      />

      {/* Gradient overlays */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

      {/* Play/pause indicator */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rounded-full bg-white/20 p-4 backdrop-blur-sm">
            <svg className="h-12 w-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Bottom-left info */}
      <div className="absolute bottom-6 left-4 right-16 animate-in slide-in-from-bottom-4 duration-500">
        <p className="text-sm font-bold text-white">@{video.kocName}</p>
        <p className="mt-1 text-xs text-white/80">{video.productName}</p>
      </div>

      {/* Right sidebar actions */}
      <div className="absolute bottom-20 right-3 flex flex-col items-center gap-5" onClick={(e) => e.stopPropagation()}>
        <ActionButton icon="♥" label="Like" />
        <ActionButton icon="💬" label="Chat" />
        <ActionButton icon="↗" label="Share" />
        <Button
          size="sm"
          className="rounded-full bg-primary px-4 text-xs"
          onClick={() => onAddToCart?.(video.productId)}
        >
          Buy
        </Button>
      </div>

      {/* Shoppable tags */}
      {video.shoppableTags?.map((tag, i) => (
        <ShoppableTag
          key={i}
          x={tag.x}
          y={tag.y}
          productId={tag.productId}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
}

function ActionButton({ icon, label }: { icon: string; label: string }) {
  return (
    <button className="flex flex-col items-center gap-1">
      <span className="text-2xl">{icon}</span>
      <span className="text-[10px] text-white/70">{label}</span>
    </button>
  );
}
