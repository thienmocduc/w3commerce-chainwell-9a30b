'use client';

import { useUser } from '@/hooks/useUser';
import { useProducts } from '@/hooks/useProducts';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function VendorDashboardPage() {
  const { profile, loading } = useUser();
  const router = useRouter();
  const { products, total } = useProducts({
    vendorId: profile?.id,
    status: 'active',
  });

  useEffect(() => {
    if (!loading && (!profile || profile.role !== 'vendor')) {
      router.push('/login');
    }
  }, [profile, loading, router]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Vendor Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DashboardCard title="Active Products" value={String(total)} />
        <DashboardCard title="Total Revenue" value="$0.00" />
        <DashboardCard title="Pending Orders" value="0" />
      </div>

      <div className="rounded-lg border border-border">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-medium">Recent Products</h2>
        </div>
        <div className="divide-y divide-border">
          {products.slice(0, 5).map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">Stock: {p.stock}</p>
              </div>
              <span className="text-sm font-bold">${p.price}</span>
            </div>
          ))}
          {products.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              No products yet. Create your first product to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
