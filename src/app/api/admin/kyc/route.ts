import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET KYC submissions for review
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status') || 'pending'
  const page   = parseInt(searchParams.get('page') || '1')
  const limit  = 20

  const { data, count, error } = await supabase
    .from('kyc_submissions')
    .select(`
      *,
      user:profiles!kyc_submissions_user_id_fkey(id, display_name, role, phone, created_at)
    `, { count: 'exact' })
    .eq('status', status)
    .order('submitted_at', { ascending: true })
    .range((page - 1) * limit, page * limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submissions: data, total: count ?? 0 })
}

// POST — approve / reject KYC
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { submission_id, action, note } = await req.json()
  if (!['verified', 'rejected'].includes(action)) {
    return NextResponse.json({ error: 'action must be verified or rejected' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Update KYC submission
  const { data: sub, error: subErr } = await admin
    .from('kyc_submissions')
    .update({
      status:      action,
      reviewed_by: user.id,
      review_note: note,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', submission_id)
    .select('user_id')
    .single()

  if (subErr || !sub) return NextResponse.json({ error: subErr?.message || 'Not found' }, { status: 500 })

  // Update user's kyc_status in profiles
  await admin.from('profiles')
    .update({ kyc_status: action })
    .eq('id', sub.user_id)

  // Notify user
  const msgs: Record<string, string> = {
    verified: 'Tài khoản của bạn đã được xác minh KYC thành công!',
    rejected: `KYC bị từ chối: ${note || 'Vui lòng kiểm tra lại thông tin và nộp lại'}`,
  }
  await admin.from('notifications').insert({
    user_id: sub.user_id,
    type:    `kyc_${action}`,
    title:   msgs[action],
    data:    { submission_id, action, note },
  })

  return NextResponse.json({ success: true, action })
}

// PUT — submit KYC (for users)
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const required = ['full_name', 'id_number', 'id_type']
  for (const f of required) {
    if (!body[f]) return NextResponse.json({ error: `${f} required` }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('kyc_submissions')
    .upsert({
      user_id:         user.id,
      full_name:       body.full_name,
      dob:             body.dob,
      id_number:       body.id_number,
      id_type:         body.id_type,
      id_front_url:    body.id_front_url,
      id_back_url:     body.id_back_url,
      selfie_url:      body.selfie_url,
      business_license: body.business_license,
      tax_code:        body.tax_code,
      status:          'pending',
      submitted_at:    new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('profiles')
    .update({ kyc_status: 'pending' })
    .eq('id', user.id)

  return NextResponse.json({ submission: data })
}
