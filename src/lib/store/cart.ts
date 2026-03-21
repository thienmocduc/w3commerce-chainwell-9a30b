'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Product } from '@/types/database'

interface CartStore {
  items: CartItem[]
  kocRefId: string | null    // Current KOC referral session
  kocRefHandle: string | null

  // Actions
  addItem: (product: Product, qty: number, kocRefId?: string, kocRefHandle?: string) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, delta: number) => void
  clearCart: () => void
  setKocRef: (id: string, handle: string) => void

  // Computed
  totalItems: () => number
  subtotal: () => number
  platformRevenue: () => number  // What goes to commission pool
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      kocRefId: null,
      kocRefHandle: null,

      addItem: (product, qty, kocRefId, kocRefHandle) => {
        set(state => {
          const existing = state.items.find(i => i.product.id === product.id)
          if (existing) {
            return {
              items: state.items.map(i =>
                i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i
              )
            }
          }
          return {
            items: [...state.items, {
              product,
              quantity: qty,
              kocRef: kocRefHandle ?? state.kocRefHandle,
              kocRefId: kocRefId ?? state.kocRefId,
            }],
            // Set KOC ref for session if provided
            kocRefId: kocRefId ?? state.kocRefId,
            kocRefHandle: kocRefHandle ?? state.kocRefHandle,
          }
        })
      },

      removeItem: (productId) => {
        set(state => ({ items: state.items.filter(i => i.product.id !== productId) }))
      },

      updateQty: (productId, delta) => {
        set(state => ({
          items: state.items
            .map(i => i.product.id === productId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)
        }))
      },

      clearCart: () => set({ items: [], kocRefId: null, kocRefHandle: null }),

      setKocRef: (id, handle) => set({ kocRefId: id, kocRefHandle: handle }),

      totalItems: () => get().items.reduce((s, i) => s + i.quantity, 0),

      subtotal: () => get().items.reduce((s, i) => s + i.product.price * i.quantity, 0),

      // Platform revenue = sum of (price * discount_pct%) per item
      platformRevenue: () => get().items.reduce((s, i) => {
        const rev = i.product.price * i.quantity * (i.product.discount_pct / 100)
        return s + rev
      }, 0),
    }),
    {
      name: 'wellkoc-cart',
      partialize: (state) => ({ items: state.items, kocRefId: state.kocRefId, kocRefHandle: state.kocRefHandle }),
    }
  )
)
