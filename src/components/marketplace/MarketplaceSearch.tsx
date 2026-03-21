'use client'
import { useRouter } from 'next/navigation'
import { useState, useCallback } from 'react'
import { Search, X } from 'lucide-react'

interface Props {
  defaultValue?: string
}

export default function MarketplaceSearch({ defaultValue }: Props) {
  const [query, setQuery] = useState(defaultValue || '')
  const router = useRouter()

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) {
      router.push(`/marketplace?q=${encodeURIComponent(trimmed)}`)
    } else {
      router.push('/marketplace')
    }
  }, [query, router])

  const handleClear = () => {
    setQuery('')
    router.push('/marketplace')
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm sản phẩm, thương hiệu, danh mục..."
        className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      )}
    </form>
  )
}
