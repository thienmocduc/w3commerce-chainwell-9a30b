// Auto-generated from Supabase schema
// Run: npm run db:types  to regenerate

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'buyer' | 'koc' | 'vendor' | 'admin'
export type OrderStatus = 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled' | 'refunded'
export type ProductStatus = 'pending' | 'active' | 'paused' | 'rejected'
export type PaymentMethod = 'wallet' | 'vnpay' | 'momo' | 'cod' | 'w3c_token'
export type CommissionStatus = 'pending' | 'processing' | 'paid' | 'failed'
export type CommissionTier = 'T1' | 'T2' | 'pool_a' | 'pool_b' | 'pool_c'
export type KycStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRole
          display_name: string
          phone: string | null
          avatar_url: string | null
          kyc_status: KycStatus
          kyc_data: Json
          xp: number
          level: string
          referral_code: string | null
          referred_by: string | null
          wallet_address: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }

      koc_profiles: {
        Row: {
          user_id: string
          handle: string
          tier: string
          total_gmv: number
          total_t1: number
          total_t2: number
          current_month_orders: number
          team_size: number
          sponsor_id: string | null
          joined_at: string
        }
        Insert: Omit<Database['public']['Tables']['koc_profiles']['Row'], 'joined_at'> & { joined_at?: string }
        Update: Partial<Database['public']['Tables']['koc_profiles']['Insert']>
      }

      vendor_profiles: {
        Row: {
          user_id: string
          business_name: string
          business_reg: string | null
          category: string[]
          bank_account: Json
          default_discount_pct: number
          total_products: number
          total_orders: number
          total_revenue: number
          rating: number
          joined_at: string
        }
        Insert: Omit<Database['public']['Tables']['vendor_profiles']['Row'], 'joined_at'> & { joined_at?: string }
        Update: Partial<Database['public']['Tables']['vendor_profiles']['Insert']>
      }

      products: {
        Row: {
          id: string
          vendor_id: string
          category_id: string | null
          name_vi: string
          name_en: string | null
          slug: string
          description_vi: string | null
          description_en: string | null
          price: number
          original_price: number | null
          discount_pct: number
          stock: number
          sold_count: number
          images: string[]
          emoji: string | null
          origin: string | null
          certifications: string[]
          status: ProductStatus
          is_dpp: boolean
          dpp_token_id: string | null
          dpp_contract: string | null
          rating: number
          review_count: number
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at' | 'sold_count' | 'rating' | 'review_count'> & {
          id?: string; created_at?: string; updated_at?: string
          sold_count?: number; rating?: number; review_count?: number
        }
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }

      orders: {
        Row: {
          id: string
          order_number: string
          buyer_id: string
          koc_ref_id: string | null
          status: OrderStatus
          subtotal: number
          shipping_fee: number
          discount: number
          total: number
          payment_method: PaymentMethod
          payment_status: string
          tx_hash: string | null
          shipping_address: Json
          notes: string | null
          shipped_at: string | null
          delivered_at: string | null
          cancelled_at: string | null
          cancel_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'order_number' | 'created_at' | 'updated_at'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }

      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          vendor_id: string
          quantity: number
          unit_price: number
          discount_pct: number
          platform_revenue: number
          subtotal: number
          product_snapshot: Json
        }
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>
      }

      commissions: {
        Row: {
          id: string
          order_id: string
          order_item_id: string
          koc_id: string
          tier: CommissionTier
          pct: number
          base_amount: number
          amount: number
          status: CommissionStatus
          paid_at: string | null
          tx_hash: string | null
          wallet_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['commissions']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['commissions']['Insert']>
      }

      wallets: {
        Row: {
          id: string
          user_id: string
          balance: number
          coins: number
          w3c_tokens: number
          frozen: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['wallets']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['wallets']['Insert']>
      }

      reviews: {
        Row: {
          id: string
          product_id: string
          order_id: string | null
          user_id: string
          rating: number
          title: string | null
          body: string | null
          images: string[]
          is_verified: boolean
          helpful_count: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['reviews']['Insert']>
      }

      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          data: Json
          is_read: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }

      categories: {
        Row: {
          id: string
          slug: string
          name_vi: string
          name_en: string
          icon: string | null
          sort_order: number
          is_active: boolean
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
    }

    Functions: {
      process_order_commissions: {
        Args: { p_order_id: string }
        Returns: void
      }
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type KocProfile = Database['public']['Tables']['koc_profiles']['Row']
export type VendorProfile = Database['public']['Tables']['vendor_profiles']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type OrderItem = Database['public']['Tables']['order_items']['Row']
export type Commission = Database['public']['Tables']['commissions']['Row']
export type Wallet = Database['public']['Tables']['wallets']['Row']
export type Review = Database['public']['Tables']['reviews']['Row']
export type Category = Database['public']['Tables']['categories']['Row']

// Extended types with joins
export type ProductWithVendor = Product & {
  vendor: Pick<Profile, 'id' | 'display_name'> & { vendor_profiles: Pick<VendorProfile, 'business_name' | 'rating'> | null }
  category: Category | null
  reviews?: Review[]
}

export type OrderWithItems = Order & {
  order_items: (OrderItem & { product: Pick<Product, 'id' | 'name_vi' | 'name_en' | 'images' | 'emoji'> })[]
}

export type CartItem = {
  product: Product
  quantity: number
  kocRef: string | null   // KOC handle who referred
  kocRefId: string | null // KOC user_id
}
