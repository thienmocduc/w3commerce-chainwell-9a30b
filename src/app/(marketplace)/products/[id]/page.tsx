'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/types/database.types';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      setProduct(data);
      setLoading(false);
    }
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <Link href="/products" className="mt-4 inline-block text-primary hover:underline">
          Back to Marketplace
        </Link>
      </div>
    );
  }

  function handleAdd() {
    if (!product) return;
    for (let i = 0; i < qty; i++) addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/products" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to Marketplace
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-muted to-muted/50 text-6xl">
          📦
        </div>

        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>

          {product.dpp_hash && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              ✓ DPP Verified
            </div>
          )}

          <p className="mt-4 text-3xl font-bold">${Number(product.price).toFixed(2)}</p>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {product.description || 'No description available.'}
          </p>

          <div className="mt-6 flex items-center gap-2 text-sm">
            <span className={product.stock > 0 ? 'text-green-600' : 'text-red-500'}>
              {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
            </span>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-border">
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="px-3 py-2 text-lg hover:bg-muted"
              >
                −
              </button>
              <span className="min-w-[3rem] text-center text-sm font-medium">{qty}</span>
              <button
                onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                className="px-3 py-2 text-lg hover:bg-muted"
              >
                +
              </button>
            </div>

            <Button
              onClick={handleAdd}
              disabled={product.stock === 0}
              className="flex-1"
            >
              {added ? '✓ Added to Cart' : 'Add to Cart'}
            </Button>
          </div>

          <Button
            onClick={() => { handleAdd(); router.push('/cart'); }}
            variant="outline"
            disabled={product.stock === 0}
            className="mt-3 w-full"
          >
            Buy Now
          </Button>

          {product.blockchain_tx_hash && (
            <div className="mt-6 rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground">Blockchain Verification</p>
              <p className="mt-1 break-all font-mono text-xs">{product.blockchain_tx_hash}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
