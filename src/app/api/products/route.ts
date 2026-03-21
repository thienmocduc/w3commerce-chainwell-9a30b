import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl

  const category = searchParams.get('category')
  const search   = searchParams.get('q')
  const sort     = searchParams.get('sort') || 'created_at'
  const order    = searchParams.get('order') || 'desc'
  const page     = parseInt(searchParams.get('page') || '1')
  const limit    = parseInt(searchParams.get('limit') || '20')
  const from     = (page - 1) * limit
  const dppOnly  = searchParams.get('dpp') === 'true'

  let query = supabase
    .from('products')
    .select(`
      *,
      category:categories(id, slug, name_vi, name_en, icon),
      vendor:profiles!products_vendor_id_fkey(
        id, display_name,
        vendor_profiles(business_name, rating)
      )
    `, { count: 'exact' })
    .eq('status', 'active')
    .range(from, from + limit - 1)

  if (category) query = query.eq('category_id', category)
  if (dppOnly)  query = query.eq('is_dpp', true)
  if (search)   query = query.textSearch('name_vi', search, { type: 'websearch' })

  // Safe sort fields
  const SORTABLE = ['price', 'rating', 'sold_count', 'created_at', 'discount_pct']
  if (SORTABLE.includes(sort)) {
    query = query.order(sort, { ascending: order === 'asc' })
  }

  const { data: products, error, count } = await query

  if (error) {
    console.error('[GET /api/products]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    products,
    pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) }
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Role check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['vendor', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden — vendor only' }, { status: 403 })
  }

  const body = await req.json()

  // Validate required fields
  const required = ['name_vi', 'price', 'discount_pct', 'category_id']
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 })
    }
  }

  // Validate discount range
  if (body.discount_pct < 15 || body.discount_pct > 55) {
    return NextResponse.json({ error: 'discount_pct must be 15–55%' }, { status: 400 })
  }

  // Generate slug
  const slug = body.name_vi
    .toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim() + '-' + Date.now()

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      vendor_id: user.id,
      name_vi: body.name_vi,
      name_en: body.name_en,
      slug,
      description_vi: body.description_vi,
      description_en: body.description_en,
      price: Number(body.price),
      discount_pct: Number(body.discount_pct),
      stock: Number(body.stock) || 0,
      images: body.images || [],
      emoji: body.emoji || '🏷️',
      origin: body.origin,
      certifications: body.certifications || [],
      category_id: body.category_id,
      is_dpp: Boolean(body.is_dpp),
      status: 'pending',  // Admin must approve
    })
    .select()
    .single()

  if (error) {
    console.error('[POST /api/products]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ product }, { status: 201 })
}
