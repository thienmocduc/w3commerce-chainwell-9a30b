'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

interface OrderDetail {
  id: string;
  total_amount: number;
  payment_status: string;
  blockchain_tx_hash: string | null;
  created_at: string;
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    commission_earned: number;
    product_id: string;
    products?: { name: string; dpp_hash: string | null };
  }[];
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get('success') === 'true';
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*, products(name, dpp_hash))')
        .eq('id', id)
        .single();
      setOrder(data as OrderDetail);
      setLoading(false);
    }
    if (id) load();
  }, [id]);

  if (loading) {
    return <div className="mx-auto max-w-2xl px-4 py-12"><div className="h-64 animate-pulse rounded-xl bg-muted" /></div>;
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Order not found</h1>
        <Link href="/orders"><Button className="mt-4" variant="outline">View All Orders</Button></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {isSuccess && (
        <div className="mb-6 rounded-xl bg-green-50 border border-green-200 p-5 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-lg font-bold text-green-700">Order Placed Successfully!</h2>
          <p className="text-sm text-green-600 mt-1">You earned XP for this purchase!</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Order #{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(order.created_at).toLocaleDateString('vi-VN', {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${
          order.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
          order.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {order.payment_status}
        </span>
      </div>

      <div className="space-y-3">
        {order.order_items?.map(item => (
          <div key={item.id} className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium text-sm">{item.products?.name || 'Product'}</p>
              <p className="text-xs text-muted-foreground">Qty: {item.quantity} × ${Number(item.unit_price).toFixed(2)}</p>
              {item.products?.dpp_hash && <span className="text-xs text-green-600">✓ DPP Verified</span>}
            </div>
            <p className="font-medium">${(Number(item.unit_price) * item.quantity).toFixed(2)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-border p-5">
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>${Number(order.total_amount).toFixed(2)}</span>
        </div>
      </div>

      {order.blockchain_tx_hash && (
        <div className="mt-4 rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">Blockchain Transaction</p>
          <p className="mt-1 break-all font-mono text-xs">{order.blockchain_tx_hash}</p>
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <Link href="/orders" className="flex-1"><Button variant="outline" className="w-full">All Orders</Button></Link>
        <Link href="/products" className="flex-1"><Button className="w-full">Continue Shopping</Button></Link>
      </div>
    </div>
  );
}
