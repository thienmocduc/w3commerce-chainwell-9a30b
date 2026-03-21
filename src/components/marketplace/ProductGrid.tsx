'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ShoppingCart, Star, Shield, Zap } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart'
import { formatVND, calcCommission, cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { ProductWithVendor } from '@/types/database'

interface Props {
  products: ProductWithVendor[]
  total: number
  page: number
  limit: number
}

export default function ProductGrid({ products, total, page, limit }: Props) {
  if (!products.length) {
    return (
      <div className="text-center py-20 text-gray-400">
        <ShoppingCart className="mx-auto mb-3 opacity-30" size={40} />
        <p className="text-sm">Không tìm thấy sản phẩm nào</p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: Math.ceil(total / limit) }, (_, i) => i + 1).map(p => (
            <Link
              key={p}
              href={`/marketplace?page=${p}`}
              className={cn(
                'w-9 h-9 rounded-lg text-sm font-medium flex items-center justify-center transition-colors',
                p === page
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border'
              )}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function ProductCard({ product }: { product: ProductWithVendor }) {
  const [adding, setAdding] = useState(false)
  const addItem = useCartStore(s => s.addItem)
  const comm = calcCommission(product.price, product.discount_pct)

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setAdding(true)
    addItem(product, 1)
    toast.success(`${product.emoji ?? '🛍️'} ${product.name_vi} đã thêm vào giỏ!`, {
      description: `Hoa hồng T1: ${formatVND(comm.t1)}/đơn`,
      duration: 2500,
    })
    setTimeout(() => setAdding(false), 600)
  }

  return (
    <Link href={`/marketplace/${product.slug}`} className="group">
      <article className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all duration-200">
        {/* Image */}
        <div className="relative bg-gradient-to-br from-indigo-50 to-purple-50 aspect-square flex items-center justify-center overflow-hidden">
          {product.images?.[0] ? (
            <Image
              src={product.images[0]}
              alt={product.name_vi}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          ) : (
            <span className="text-5xl">{product.emoji ?? '🏷️'}</span>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.is_dpp && (
              <span className="flex items-center gap-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                <Shield size={8} />DPP
              </span>
            )}
            {product.discount_pct >= 35 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                -{Math.round(product.discount_pct)}%
              </span>
            )}
          </div>

          {product.stock < 10 && product.stock > 0 && (
            <div className="absolute bottom-2 right-2">
              <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                Còn {product.stock}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-1">
            {product.name_vi}
          </h3>

          {/* Rating + sold */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-0.5">
              <Star size={10} className="fill-amber-400 text-amber-400" />
              <span className="text-xs text-gray-500">{product.rating.toFixed(1)}</span>
            </div>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">{product.sold_count.toLocaleString()} đã bán</span>
          </div>

          {/* Price */}
          <div className="flex items-end justify-between">
            <div>
              <div className="text-base font-bold text-gray-900">
                {formatVND(product.price)}
              </div>
              {product.original_price && product.original_price > product.price && (
                <div className="text-xs text-gray-400 line-through">
                  {formatVND(product.original_price)}
                </div>
              )}
            </div>

            <button
              onClick={handleAdd}
              disabled={adding || product.stock === 0}
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center transition-all',
                adding
                  ? 'bg-green-500 scale-90'
                  : product.stock === 0
                  ? 'bg-gray-100 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
              )}
            >
              {adding ? (
                <span className="text-white text-xs">✓</span>
              ) : (
                <ShoppingCart size={14} className={product.stock === 0 ? 'text-gray-400' : 'text-white'} />
              )}
            </button>
          </div>

          {/* KOC commission preview (visible to KOC users) */}
          <div className="mt-2 pt-2 border-t border-gray-50">
            <div className="flex items-center gap-1">
              <Zap size={9} className="text-indigo-400" />
              <span className="text-[10px] text-indigo-500 font-medium">
                T1: {formatVND(comm.t1)}/đơn
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}
