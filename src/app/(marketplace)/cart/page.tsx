'use client';

import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalPrice, totalItems, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Browse our marketplace to find products</p>
        <Link href="/products">
          <Button className="mt-6">Browse Products</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Shopping Cart ({totalItems})</h1>
        <button onClick={clearCart} className="text-sm text-red-500 hover:underline">
          Clear All
        </button>
      </div>

      <div className="space-y-4">
        {items.map(({ product, quantity }) => (
          <div key={product.id} className="flex items-center gap-4 rounded-xl border border-border p-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted text-3xl">
              📦
            </div>
            <div className="flex-1 min-w-0">
              <Link href={`/products/${product.id}`} className="font-medium hover:underline truncate block">
                {product.name}
              </Link>
              <p className="text-sm text-muted-foreground">${Number(product.price).toFixed(2)} each</p>
              {product.dpp_hash && (
                <span className="text-xs text-green-600">✓ DPP Verified</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-border">
                <button
                  onClick={() => updateQuantity(product.id, quantity - 1)}
                  className="px-2.5 py-1 text-sm hover:bg-muted"
                >
                  −
                </button>
                <span className="min-w-[2rem] text-center text-sm">{quantity}</span>
                <button
                  onClick={() => updateQuantity(product.id, Math.min(quantity + 1, product.stock))}
                  className="px-2.5 py-1 text-sm hover:bg-muted"
                >
                  +
                </button>
              </div>
              <p className="min-w-[5rem] text-right font-medium">
                ${(Number(product.price) * quantity).toFixed(2)}
              </p>
              <button
                onClick={() => removeItem(product.id)}
                className="ml-2 text-muted-foreground hover:text-red-500"
                title="Remove"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-border p-6">
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span>${totalPrice.toFixed(2)}</span>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          +10 XP reward per item purchased
        </div>
        <Link href="/checkout">
          <Button className="mt-4 w-full text-base py-3">
            Proceed to Checkout
          </Button>
        </Link>
        <Link href="/products" className="mt-3 block text-center text-sm text-muted-foreground hover:underline">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
