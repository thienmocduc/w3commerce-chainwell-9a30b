'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/ui/button';

type PaymentMethod = 'credit_card' | 'w3c_token' | 'crypto';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart();
  const { authUser } = useUser();
  const [payment, setPayment] = useState<PaymentMethod>('credit_card');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">No items to checkout</h1>
        <Link href="/products"><Button className="mt-4">Browse Products</Button></Link>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Please sign in to checkout</h1>
        <p className="mt-2 text-muted-foreground">You need an account to place orders</p>
        <Link href="/login"><Button className="mt-4">Sign In</Button></Link>
      </div>
    );
  }

  async function handleCheckout() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({
            product_id: i.product.id,
            quantity: i.quantity,
          })),
          payment_method: payment,
          buyer_location: 'VN',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Checkout failed');
        setLoading(false);
        return;
      }
      clearCart();
      router.push(`/orders/${data.orderId}?success=true`);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  const xpReward = items.reduce((sum, i) => sum + i.quantity * 10, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/cart" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to Cart
      </Link>

      <h1 className="mt-4 text-2xl font-bold">Checkout</h1>

      {error && (
        <div className="mt-4 rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>
      )}

      <div className="mt-6 space-y-3">
        {items.map(({ product, quantity }) => (
          <div key={product.id} className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="font-medium text-sm">{product.name}</p>
              <p className="text-xs text-muted-foreground">Qty: {quantity}</p>
            </div>
            <p className="font-medium">${(Number(product.price) * quantity).toFixed(2)}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Payment Method</h2>
        <div className="space-y-2">
          {([
            { value: 'credit_card' as const, label: 'Credit Card', icon: '💳', desc: 'Visa, Mastercard, etc.' },
            { value: 'w3c_token' as const, label: 'W3C Token', icon: '🪙', desc: 'Pay with W3C tokens' },
            { value: 'crypto' as const, label: 'Crypto Wallet', icon: '⛓️', desc: 'MetaMask, WalletConnect' },
          ]).map(m => (
            <label
              key={m.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                payment === m.value ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'
              }`}
            >
              <input
                type="radio"
                name="payment"
                value={m.value}
                checked={payment === m.value}
                onChange={() => setPayment(m.value)}
                className="sr-only"
              />
              <span className="text-2xl">{m.icon}</span>
              <div>
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-border p-5 space-y-3">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>${totalPrice.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-green-600">
          <span>XP Reward</span>
          <span>+{xpReward} XP</span>
        </div>
        <div className="border-t border-border pt-3 flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>${totalPrice.toFixed(2)}</span>
        </div>
      </div>

      <Button
        onClick={handleCheckout}
        disabled={loading}
        className="mt-6 w-full py-3 text-base"
      >
        {loading ? 'Processing...' : `Pay $${totalPrice.toFixed(2)}`}
      </Button>
    </div>
  );
}
