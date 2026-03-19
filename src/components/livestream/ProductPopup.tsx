'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface ProductPopupProps {
  productId: string;
  onDismiss: () => void;
  onBuy?: (productId: string) => void;
}

export function ProductPopup({ productId, onDismiss, onBuy }: ProductPopupProps) {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onDismiss]);

  return (
    <div className="absolute bottom-4 left-4 right-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-lg bg-white/95 p-3 shadow-xl backdrop-blur-sm">
        {/* Progress bar */}
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${(countdown / 10) * 100}%` }}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="h-16 w-16 flex-shrink-0 rounded bg-gray-100" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              Featured Product
            </p>
            <p className="text-xs text-gray-500">
              Product ID: {productId.slice(0, 8)}...
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Button
              size="sm"
              className="text-xs"
              onClick={() => onBuy?.(productId)}
            >
              Buy Now
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={onDismiss}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
