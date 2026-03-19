'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ShoppableTagProps {
  x: number; // percentage position
  y: number;
  productId: string;
  onAddToCart?: (productId: string) => void;
}

export function ShoppableTag({ x, y, productId, onAddToCart }: ShoppableTagProps) {
  const [showCard, setShowCard] = useState(false);

  return (
    <div
      className="absolute z-10"
      style={{ left: `${x}%`, top: `${y}%` }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Pulsing dot */}
      <button
        className="relative h-6 w-6 rounded-full bg-primary/80 shadow-lg transition-transform hover:scale-110"
        onClick={() => setShowCard(!showCard)}
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
        <span className="absolute inset-1 rounded-full bg-white" />
      </button>

      {/* Product popup card */}
      {showCard && (
        <div className="absolute left-8 top-0 w-48 rounded-lg bg-white p-3 shadow-xl animate-in slide-in-from-left-2 duration-200">
          <div className="mb-2 h-24 w-full rounded bg-gray-100" />
          <p className="text-xs font-medium text-gray-900 line-clamp-2">
            Product #{productId.slice(0, 8)}
          </p>
          <Button
            size="sm"
            className="mt-2 w-full text-xs"
            onClick={() => onAddToCart?.(productId)}
          >
            Add to Cart
          </Button>
        </div>
      )}
    </div>
  );
}
