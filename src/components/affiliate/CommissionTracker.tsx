'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Commission } from '@/lib/types/database.types';

interface CommissionTrackerProps {
  kocId: string;
}

interface CommissionSummary {
  totalEarnings: number;
  pendingAmount: number;
  confirmedAmount: number;
  paidAmount: number;
  thisMonthEarnings: number;
}

export function CommissionTracker({ kocId }: CommissionTrackerProps) {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [summary, setSummary] = useState<CommissionSummary>({
    totalEarnings: 0,
    pendingAmount: 0,
    confirmedAmount: 0,
    paidAmount: 0,
    thisMonthEarnings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCommissions() {
      const supabase = createClient();
      const { data } = await supabase
        .from('commissions')
        .select('*')
        .eq('koc_id', kocId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        setCommissions(data);

        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        setSummary({
          totalEarnings: data.reduce((sum, c) => sum + Number(c.amount), 0),
          pendingAmount: data.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount), 0),
          confirmedAmount: data.filter(c => c.status === 'confirmed').reduce((sum, c) => sum + Number(c.amount), 0),
          paidAmount: data.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0),
          thisMonthEarnings: data
            .filter(c => c.created_at >= firstOfMonth)
            .reduce((sum, c) => sum + Number(c.amount), 0),
        });
      }
      setLoading(false);
    }

    fetchCommissions();
  }, [kocId]);

  if (loading) {
    return <div className="animate-pulse h-32 rounded-lg bg-muted" />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Earnings" value={`$${summary.totalEarnings.toFixed(2)}`} />
        <StatCard label="This Month" value={`$${summary.thisMonthEarnings.toFixed(2)}`} />
        <StatCard label="Pending" value={`$${summary.pendingAmount.toFixed(2)}`} className="text-yellow-500" />
        <StatCard label="Paid" value={`$${summary.paidAmount.toFixed(2)}`} className="text-green-500" />
      </div>

      <div className="rounded-lg border border-border">
        <div className="border-b border-border px-4 py-2">
          <h4 className="text-sm font-medium">Recent Commissions</h4>
        </div>
        <div className="divide-y divide-border">
          {commissions.slice(0, 10).map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <span className="text-sm font-medium">${Number(c.amount).toFixed(2)}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
          {commissions.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No commissions yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${className ?? ''}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-500',
    confirmed: 'bg-blue-500/10 text-blue-500',
    paid: 'bg-green-500/10 text-green-500',
    clawed_back: 'bg-red-500/10 text-red-500',
  };

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase ${colors[status] ?? ''}`}>
      {status}
    </span>
  );
}
