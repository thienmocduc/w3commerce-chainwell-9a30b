import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET pending products for review
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

  const { data: products, count, error } = await supabase
    .from('products')
    .select(`
      *,
      vendor:profiles!products_vendor_id_fkey(
        id, display_name,
        vendor_profiles(business_name, rating, total_products)
      ),
      category:categories(id, slug, name_vi),
      product_images(url, is_primary, sort_order)
    `, { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products, total: count ?? 0 })
}

// POST — approve / reject / pause a product
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { product_id, action, reason } = await req.json()
  if (!product_id || !action) return NextResponse.json({ error: 'product_id and action required' }, { status: 400 })

  const validActions = ['approved', 'rejected', 'paused', 'active']
  if (!validActions.includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const admin = createAdminClient()

  const newStatus = action === 'approved' ? 'active' : action === 'paused' ? 'paused' : action === 'active' ? 'active' : 'rejected'

  const { error: updateErr } = await admin.from('products')
    .update({ status: newStatus })
    .eq('id', product_id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Log approval
  await admin.from('product_approvals').insert({
    product_id,
    admin_id:  user.id,
    action,
    reason,
  })

  // Notify vendor
  const { data: product } = await admin.from('products').select('name_vi, vendor_id').eq('id', product_id).single()
  if (product) {
    const msgs: Record<string, string> = {
      approved: `Sản phẩm "${product.name_vi}" đã được duyệt và đang bán`,
      rejected: `Sản phẩm "${product.name_vi}" bị từ chối: ${reason || 'Không đáp ứng tiêu chuẩn'}`,
      paused:   `Sản phẩm "${product.name_vi}" tạm dừng: ${reason || ''}`,
      active:   `Sản phẩm "${product.name_vi}" đã được kích hoạt lại`,
    }
    await admin.from('notifications').insert({
      user_id: product.vendor_id,
      type:    `product_${action}`,
      title:   msgs[action],
      data:    { product_id, action, reason },
    })
  }

  return NextResponse.json({ success: true, status: newStatus })
}
