'use client';

import { useUser } from '@/hooks/useUser';
import { CommissionTracker } from '@/components/affiliate/CommissionTracker';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function KOCDashboardPage() {
  const { profile, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!profile || (profile.role !== 'koc' && profile.role !== 'admin'))) {
      router.push('/login');
    }
  }, [profile, loading, router]);

  if (loading || !profile) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">KOC Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Level {profile.level} · {profile.xp_points} XP
          </p>
        </div>
      </div>
      <CommissionTracker kocId={profile.id} />
    </div>
  );
}
