'use client';

import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { useCart } from '@/hooks/useCart';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function NavBar() {
  const { profile, loading } = useUser();
  const { totalItems } = useCart();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold">
            W3Commerce
          </Link>
          <div className="hidden items-center gap-4 md:flex">
            <Link href="/products" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Products
            </Link>
            <Link href="/academy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Academy
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/cart"
            className="relative text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            🛒
            {totalItems > 0 && (
              <span className="absolute -right-2.5 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </Link>

          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          ) : profile ? (
            <>
              <Link href="/orders" className="hidden text-sm text-muted-foreground hover:text-foreground md:block transition-colors">
                Orders
              </Link>
              {profile.role === 'vendor' && (
                <Link href="/vendor/dashboard">
                  <Button variant="ghost" size="sm">Vendor</Button>
                </Link>
              )}
              {profile.role === 'koc' && (
                <Link href="/koc/dashboard">
                  <Button variant="ghost" size="sm">KOC</Button>
                </Link>
              )}
              {profile.role === 'admin' && (
                <Link href="/admin/dashboard">
                  <Button variant="ghost" size="sm">Admin</Button>
                </Link>
              )}
              <span className="text-xs text-muted-foreground">
                Lv.{profile.level} · {profile.xp_points} XP
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Login</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Register</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
