import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import ProductGrid from '@/components/marketplace/ProductGrid'
import ProductFilters from '@/components/marketplace/ProductFilters'
import MarketplaceSearch from '@/components/marketplace/MarketplaceSearch'

interface Props {
  searchParams: {
    q?: string
    category?: string
    sort?: string
    dpp?: string
    page?: string
  }
}

export default async function MarketplacePage({ searchParams }: Props) {
  const supabase = await createClient()

  // Fetch categories for filters
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  // Build products query
  const page     = parseInt(searchParams.page || '1')
  const limit    = 20
  const from     = (page - 1) * limit

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

  if (searchParams.category) {
    const cat = categories?.find(c => c.slug === searchParams.category)
    if (cat) query = query.eq('category_id', cat.id)
  }

  if (searchParams.dpp === 'true') query = query.eq('is_dpp', true)

  if (searchParams.q) {
    query = query.or(`name_vi.ilike.%${searchParams.q}%,name_en.ilike.%${searchParams.q}%`)
  }

  const sort = searchParams.sort || 'created_at'
  const sortMap: Record<string, { col: string; asc: boolean }> = {
    newest:    { col: 'created_at',  asc: false },
    price_asc: { col: 'price',       asc: true },
    price_dsc: { col: 'price',       asc: false },
    rating:    { col: 'rating',      asc: false },
    bestsell:  { col: 'sold_count',  asc: false },
    discount:  { col: 'discount_pct',asc: false },
  }
  const s = sortMap[sort] || sortMap.newest
  query = query.order(s.col, { ascending: s.asc })

  const { data: products, count } = await query

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <div className="flex-1">
            <MarketplaceSearch defaultValue={searchParams.q} />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="font-mono text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
              {count ?? 0} sản phẩm
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar filters */}
        <aside className="w-56 flex-shrink-0 hidden md:block">
          <ProductFilters
            categories={categories ?? []}
            activeCategory={searchParams.category}
            dppOnly={searchParams.dpp === 'true'}
            activeSort={sort}
          />
        </aside>

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          <Suspense fallback={<ProductGridSkeleton />}>
            <ProductGrid
              products={products ?? []}
              total={count ?? 0}
              page={page}
              limit={limit}
            />
          </Suspense>
        </div>
      </div>
    </main>
  )
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
          <div className="h-48 bg-gray-100" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-gray-100 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="h-6 bg-gray-100 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
