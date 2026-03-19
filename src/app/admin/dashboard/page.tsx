'use client';

import { useUser } from '@/hooks/useUser';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export default function AdminDashboardPage() {
  const { profile, loading } = useUser();
  const router = useRouter();
  const [stats, setStats] = useState({ users: 0, products: 0, orders: 0, vendors: 0 });

  useEffect(() => {
    if (!loading && (!profile || profile.role !== 'admin')) {
      router.push('/login');
    }
  }, [profile, loading, router]);

  useEffect(() => {
    async function fetchStats() {
      const supabase = createClient();
      const [usersRes, productsRes, ordersRes, vendorsRes] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'vendor'),
      ]);
      setStats({
        users: usersRes.count ?? 0,
        products: productsRes.count ?? 0,
        orders: ordersRes.count ?? 0,
        vendors: vendorsRes.count ?? 0,
      });
    }
    if (profile?.role === 'admin') fetchStats();
  }, [profile]);

  if (loading) {
    return <div className="mx-auto max-w-7xl px-4 py-8"><div className="h-8 w-48 animate-pulse rounded bg-muted" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Admin Dashboard</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Users" value={stats.users} />
        <StatCard label="Vendors" value={stats.vendors} />
        <StatCard label="Products" value={stats.products} />
        <StatCard label="Orders" value={stats.orders} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h3 className="mb-3 font-medium">Quick Actions</h3>
          <div className="flex flex-col gap-2">
            <Button variant="outline" size="sm">Review Pending KYC</Button>
            <Button variant="outline" size="sm">View Slash Reports</Button>
            <Button variant="outline" size="sm">Manage Affiliate Rules</Button>
          </div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <h3 className="mb-3 font-medium">System Health</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Database</span>
              <span className="text-green-500">Connected</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Blockchain (Mumbai)</span>
              <span className="text-yellow-500">Check Required</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">AI Services</span>
              <span className="text-yellow-500">Check Required</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}
