import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code     = searchParams.get('code')
  const redirect = searchParams.get('redirect') || '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Ensure profile exists for OAuth users
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single()

      if (!existing) {
        const name = data.user.user_metadata?.full_name
          || data.user.email?.split('@')[0]
          || 'User'

        await supabase.from('profiles').insert({
          id:           data.user.id,
          role:         'buyer',
          display_name: name,
          referral_code: name.toLowerCase().replace(/\s+/g, '') + Math.random().toString(36).slice(2, 5).toUpperCase(),
        })
      }

      return NextResponse.redirect(`${origin}${redirect}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
