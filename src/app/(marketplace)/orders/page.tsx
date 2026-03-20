'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/ui/button';

interface OrderWithItems {
  id: string;
  total_amount: number;
  payment_status: string;
  created_at: string;
  order_items: { id: string; quantity: number; unit_price: number; product_id: string }[];
}

export default function OrdersPage() {
  const { authUser, loading: userLoading } = useUser();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!authUser) { setLoading(false); return; }
      const supabase = createClient();
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('buyer_id', authUser.id)
        .order('created_at', { ascending: false });
      setOrders((data as OrderWithItems[]) || []);
      setLoading(false);
    }
    if (!userLoading) load();
  }, [authUser, userLoading]);

  if (!userLoading && !authUser) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Sign in to view orders</h1>
        <Link href="/login"><Button className="mt-4">Sign In</Button></Link>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    refunded: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-muted-foreground">No orders yet</p>
          <Link href="/products"><Button className="mt-4">Start Shopping</Button></Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block rounded-xl border border-border p-5 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString('vi-VN', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">${Number(order.total_amount).toFixed(2)}</p>
                  <span className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[order.payment_status] || 'bg-gray-100'}`}>
                    {order.payment_status}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {order.order_items?.length || 0} item(s)
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
