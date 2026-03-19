'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Button } from '@/components/ui/button';

// CreatorTokenFactory ABI (minimal)
const FACTORY_ABI = [
  {
    inputs: [
      { name: 'name_', type: 'string' },
      { name: 'symbol_', type: 'string' },
    ],
    name: 'deployToken',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'koc', type: 'address' }],
    name: 'getTokenForKOC',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface CreatorTokenLaunchpadProps {
  factoryAddress: `0x${string}`;
  existingTokenAddress?: string;
}

export function CreatorTokenLaunchpad({
  factoryAddress,
  existingTokenAddress,
}: CreatorTokenLaunchpadProps) {
  const { address: _address } = useAccount();
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  function handleDeploy() {
    if (!tokenName || !tokenSymbol) return;

    writeContract({
      address: factoryAddress,
      abi: FACTORY_ABI,
      functionName: 'deployToken',
      args: [tokenName, tokenSymbol],
    });
  }

  if (existingTokenAddress && existingTokenAddress !== '0x0000000000000000000000000000000000000000') {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-medium">Your Creator Token</h3>
        <p className="mt-2 text-sm text-muted-foreground font-mono break-all">
          {existingTokenAddress}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded bg-muted p-3 text-center">
            <p className="text-xs text-muted-foreground">Max Supply</p>
            <p className="text-lg font-bold">10M</p>
          </div>
          <div className="rounded bg-muted p-3 text-center">
            <p className="text-xs text-muted-foreground">Your Share</p>
            <p className="text-lg font-bold">10%</p>
          </div>
          <div className="rounded bg-muted p-3 text-center">
            <p className="text-xs text-muted-foreground">Fan Pool</p>
            <p className="text-lg font-bold">90%</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-lg font-medium">Launch Your Creator Token</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Create your personal token that fans can buy and stake
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Token Name</label>
          <input
            type="text"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="e.g., My Creator Token"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Symbol</label>
          <input
            type="text"
            value={tokenSymbol}
            onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="e.g., MCT"
          />
        </div>

        <div className="rounded bg-muted p-3 text-xs text-muted-foreground">
          <p>Supply: 10,000,000 tokens</p>
          <p>Creator allocation: 1,000,000 (10%)</p>
          <p>Fan allocation: 9,000,000 (90%)</p>
        </div>

        <Button
          className="w-full"
          onClick={handleDeploy}
          disabled={isPending || isConfirming || !tokenName || !tokenSymbol}
        >
          {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Deploying...' : 'Deploy Token'}
        </Button>

        {isSuccess && txHash && (
          <div className="rounded bg-green-500/10 p-3 text-sm text-green-500">
            Token deployed successfully! TX: {txHash.slice(0, 16)}...
          </div>
        )}
      </div>
    </div>
  );
}
