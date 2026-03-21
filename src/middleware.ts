import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require authentication
const PROTECTED = ['/account', '/checkout', '/vendor', '/koc', '/admin']
// Routes that require specific roles
const ROLE_ROUTES: Record<string, string> = {
  '/vendor': 'vendor',
  '/koc': 'koc',
  '/admin': 'admin',
}

// Security headers
const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Add security headers to all responses
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    supabaseResponse.headers.set(key, value)
  }

  const path = request.nextUrl.pathname

  // CSRF protection for state-changing API requests
  if (path.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin')
    const host = request.headers.get('host')
    // Allow requests with no origin (server-to-server, webhooks)
    // But if origin is present, it must match host
    if (origin && host) {
      const originHost = new URL(origin).host
      if (originHost !== host) {
        return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
      }
    }
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Check if route needs auth
  const needsAuth = PROTECTED.some(p => path.startsWith(p))
  if (needsAuth && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(loginUrl)
  }

  // Check role-specific routes
  const requiredRole = Object.entries(ROLE_ROUTES).find(([route]) => path.startsWith(route))?.[1]
  if (requiredRole && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== requiredRole && profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhook).*)'],
}
