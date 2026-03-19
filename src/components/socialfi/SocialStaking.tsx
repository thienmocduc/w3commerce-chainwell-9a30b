'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface SocialStakingProps {
  kocName: string;
  kocWallet: string;
  followers: number;
  totalSales: number;
}

export function SocialStaking({ kocName, kocWallet, followers, totalSales }: SocialStakingProps) {
  const [stakeAmount, setStakeAmount] = useState('');
  const [staking, setStaking] = useState(false);

  async function handleStake() {
    if (!stakeAmount || Number(stakeAmount) <= 0) return;
    setStaking(true);

    try {
      // In production: call StakingVault.stake() then CreatorToken.mint() via wagmi
      console.log(`Staking ${stakeAmount} W3C on ${kocName}`);
    } catch (err) {
      console.error('Staking error:', err);
    } finally {
      setStaking(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-lg font-medium">Stake on {kocName}</h3>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded bg-muted p-3 text-center">
          <p className="text-xs text-muted-foreground">Followers</p>
          <p className="text-lg font-bold">{followers.toLocaleString()}</p>
        </div>
        <div className="rounded bg-muted p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Sales</p>
          <p className="text-lg font-bold">${totalSales.toLocaleString()}</p>
        </div>
        <div className="rounded bg-muted p-3 text-center">
          <p className="text-xs text-muted-foreground">Wallet</p>
          <p className="text-xs font-mono truncate">{kocWallet}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Stake Amount (W3C)</label>
          <input
            type="number"
            min="1"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="100"
          />
        </div>

        <div className="flex gap-2">
          {[100, 500, 1000].map((amount) => (
            <Button
              key={amount}
              variant="outline"
              size="sm"
              onClick={() => setStakeAmount(String(amount))}
            >
              {amount} W3C
            </Button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          7-day lock period. Unstake anytime after lock expires.
        </p>

        <Button
          className="w-full"
          onClick={handleStake}
          disabled={staking || !stakeAmount || Number(stakeAmount) <= 0}
        >
          {staking ? 'Staking...' : `Stake ${stakeAmount || '0'} W3C`}
        </Button>
      </div>
    </div>
  );
}
