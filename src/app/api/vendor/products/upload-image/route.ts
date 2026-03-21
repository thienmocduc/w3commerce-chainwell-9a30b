import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/vendor/products/upload-image
// Accepts multipart/form-data with 'file' field
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['vendor', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Vendor only' }, { status: 403 })
  }

  const formData = await req.formData()
  const file     = formData.get('file') as File
  const productId = formData.get('product_id') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Validate file type
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPG/PNG/WebP/AVIF allowed' }, { status: 400 })
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
  }

  const ext          = file.name.split('.').pop() || 'jpg'
  const timestamp    = Date.now()
  const storagePath  = `products/${user.id}/${productId ?? 'temp'}/${timestamp}.${ext}`
  const arrayBuffer  = await file.arrayBuffer()

  // Upload to Supabase Storage (bucket: 'product-images')
  const admin = createAdminClient()
  const { data: upload, error: uploadErr } = await admin.storage
    .from('product-images')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadErr) {
    console.error('[upload image]', uploadErr)
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  // Get public URL
  const { data: { publicUrl } } = admin.storage
    .from('product-images')
    .getPublicUrl(storagePath)

  // If product_id provided, save to product_images table
  if (productId) {
    const { count } = await admin
      .from('product_images')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId)

    await admin.from('product_images').insert({
      product_id:   productId,
      url:          publicUrl,
      storage_path: storagePath,
      is_primary:   count === 0,
      sort_order:   count ?? 0,
    })

    // Also update products.images array
    const { data: product } = await admin
      .from('products')
      .select('images')
      .eq('id', productId)
      .single()

    await admin.from('products')
      .update({ images: [...(product?.images ?? []), publicUrl] })
      .eq('id', productId)
  }

  return NextResponse.json({ url: publicUrl, storage_path: storagePath })
}

// DELETE /api/vendor/products/upload-image
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { storage_path, product_id } = await req.json()
  const admin = createAdminClient()

  await admin.storage.from('product-images').remove([storage_path])

  if (product_id) {
    await admin.from('product_images')
      .delete()
      .eq('storage_path', storage_path)
      .eq('product_id', product_id)
  }

  return NextResponse.json({ deleted: true })
}
