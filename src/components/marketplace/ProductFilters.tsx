'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shield, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Category {
  id: string
  slug: string
  name_vi: string
  name_en: string
  icon: string | null
}

interface Props {
  categories: Category[]
  activeCategory?: string
  dppOnly: boolean
  activeSort: string
}

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Mới nhất' },
  { value: 'price_asc', label: 'Giá thấp → cao' },
  { value: 'price_dsc', label: 'Giá cao → thấp' },
  { value: 'rating',    label: 'Đánh giá cao' },
  { value: 'bestsell',  label: 'Bán chạy' },
  { value: 'discount',  label: 'Giảm giá nhiều' },
]

export default function ProductFilters({ categories, activeCategory, dppOnly, activeSort }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`/marketplace?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      {/* Sort */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <SlidersHorizontal size={12} />
          Sắp xếp
        </h3>
        <div className="space-y-1">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setParam('sort', opt.value === 'newest' ? null : opt.value)}
              className={cn(
                'block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors',
                activeSort === opt.value
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Danh mục
        </h3>
        <div className="space-y-1">
          <button
            onClick={() => setParam('category', null)}
            className={cn(
              'block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors',
              !activeCategory
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            Tất cả
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setParam('category', cat.slug)}
              className={cn(
                'block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors',
                activeCategory === cat.slug
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              {cat.icon && <span className="mr-1.5">{cat.icon}</span>}
              {cat.name_vi}
            </button>
          ))}
        </div>
      </div>

      {/* DPP filter */}
      <div>
        <button
          onClick={() => setParam('dpp', dppOnly ? null : 'true')}
          className={cn(
            'flex items-center gap-2 w-full text-left text-sm px-3 py-2.5 rounded-lg border transition-colors',
            dppOnly
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          )}
        >
          <Shield size={14} />
          Chỉ sản phẩm DPP
        </button>
      </div>
    </div>
  )
}
