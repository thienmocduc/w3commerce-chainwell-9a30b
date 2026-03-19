'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface TipButtonProps {
  kocWallet?: string;
  streamId?: string;
  onTipSent?: (amount: number) => void;
}

const TIP_AMOUNTS = [10, 50, 100];

export function TipButton({ onTipSent }: TipButtonProps) {
  const [showAmounts, setShowAmounts] = useState(false);
  const [sending, setSending] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  async function sendTip(amount: number) {
    setSending(true);
    try {
      // In production: call W3CToken.transfer via wagmi
      // For now: emit event
      onTipSent?.(amount);
      setShowAmounts(false);
    } catch (err) {
      console.error('Tip error:', err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => setShowAmounts(!showAmounts)}
        disabled={sending}
      >
        💰 Tip
      </Button>

      {showAmounts && (
        <div className="absolute bottom-full left-0 mb-2 flex gap-1.5 rounded-lg bg-card border border-border p-2 shadow-lg animate-in slide-in-from-bottom-2">
          {TIP_AMOUNTS.map((amount) => (
            <Button
              key={amount}
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => sendTip(amount)}
              disabled={sending}
            >
              {amount} W3C
            </Button>
          ))}
          <div className="flex gap-1">
            <input
              type="number"
              className="w-16 rounded border border-border bg-background px-2 text-xs"
              placeholder="Custom"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
            />
            <Button
              size="sm"
              className="text-xs"
              disabled={!customAmount || sending}
              onClick={() => sendTip(Number(customAmount))}
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
