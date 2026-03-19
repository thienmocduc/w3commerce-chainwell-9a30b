// ============================================================
// W3Commerce — Complete Database Types (11 tables)
// Compatible with @supabase/supabase-js v2
// ============================================================

export type UserRole = 'admin' | 'vendor' | 'koc' | 'user';
export type ProductStatus = 'draft' | 'active' | 'paused';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type CommissionStatus = 'pending' | 'confirmed' | 'paid' | 'clawed_back';
export type RuleType = 'flat' | 'tiered' | 'recurring' | 'lifetime' | 'split';
export type NFTType = 'dpp' | 'koc_badge' | 'creator_token';
export type StreamStatus = 'scheduled' | 'live' | 'ended';

export interface User {
  id: string;
  email: string;
  wallet_address: string | null;
  role: UserRole;
  xp_points: number;
  level: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  vendor_id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  dpp_hash: string | null;
  blockchain_tx_hash: string | null;
  embedding: number[] | null;
  metadata: Record<string, unknown> | null;
  status: ProductStatus;
  created_at: string;
}

export interface Order {
  id: string;
  buyer_id: string;
  total_amount: number;
  payment_status: PaymentStatus;
  blockchain_tx_hash: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  commission_earned: number;
}

export interface AffiliateRuleConfig {
  tiers?: { minRevenue: number; rate: number }[];
  recurringMonths?: number;
  splitKocIds?: string[];
  splitRatios?: number[];
}

export interface AffiliateRule {
  id: string;
  vendor_id: string;
  product_id: string | null;
  rule_type: RuleType;
  commission_rate: number;
  threshold_amount: number | null;
  bonus_amount: number | null;
  is_active: boolean;
  config: AffiliateRuleConfig;
}

export interface Commission {
  id: string;
  koc_id: string;
  order_id: string;
  rule_id: string;
  amount: number;
  status: CommissionStatus;
  blockchain_tx_hash: string | null;
  created_at: string;
}

export interface UserNFT {
  id: string;
  user_id: string;
  token_id: string;
  contract_address: string;
  nft_type: NFTType;
  metadata: Record<string, unknown> | null;
  minted_at: string;
  chain_id: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructor_id: string;
  price: number;
  nft_certificate_required: boolean;
  content: Record<string, unknown> | null;
  published: boolean;
  created_at: string;
}

export interface CourseEnrollment {
  id: string;
  user_id: string;
  course_id: string;
  progress: number;
  completed: boolean;
  certificate_nft_id: string | null;
  enrolled_at: string;
}

export interface CompetitorData {
  id: string;
  vendor_id: string;
  platform: string;
  product_name: string;
  price: number;
  sales_count: number;
  battlecard: Record<string, unknown> | null;
  scraped_at: string;
}

export interface Livestream {
  id: string;
  host_id: string;
  aws_channel_arn: string | null;
  stream_key: string | null;
  status: StreamStatus;
  viewer_count: number;
  total_tips: number;
  started_at: string | null;
  ended_at: string | null;
}

// ─── Supabase Database interface ───────────────────────────
// For v2 client type-safety, we use a simplified approach:
// cast supabase client methods where needed instead of fighting
// the auto-generated type format. The tables below use
// the standard Row/Insert/Update pattern.
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Partial<User> & Pick<User, 'email'>;
        Update: Partial<User>;
        Relationships: [];
      };
      products: {
        Row: Product;
        Insert: Partial<Product> & Pick<Product, 'vendor_id' | 'name'>;
        Update: Partial<Product>;
        Relationships: [
          { foreignKeyName: 'products_vendor_id_fkey'; columns: ['vendor_id']; referencedRelation: 'users'; referencedColumns: ['id']; isOneToOne: false },
        ];
      };
      orders: {
        Row: Order;
        Insert: Partial<Order> & Pick<Order, 'buyer_id' | 'total_amount'>;
        Update: Partial<Order>;
        Relationships: [
          { foreignKeyName: 'orders_buyer_id_fkey'; columns: ['buyer_id']; referencedRelation: 'users'; referencedColumns: ['id']; isOneToOne: false },
        ];
      };
      order_items: {
        Row: OrderItem;
        Insert: Partial<OrderItem> & Pick<OrderItem, 'order_id' | 'product_id' | 'quantity' | 'unit_price'>;
        Update: Partial<OrderItem>;
        Relationships: [
          { foreignKeyName: 'order_items_order_id_fkey'; columns: ['order_id']; referencedRelation: 'orders'; referencedColumns: ['id']; isOneToOne: false },
          { foreignKeyName: 'order_items_product_id_fkey'; columns: ['product_id']; referencedRelation: 'products'; referencedColumns: ['id']; isOneToOne: false },
        ];
      };
      affiliate_rules: {
        Row: AffiliateRule;
        Insert: Partial<AffiliateRule> & Pick<AffiliateRule, 'vendor_id' | 'rule_type' | 'commission_rate'>;
        Update: Partial<AffiliateRule>;
        Relationships: [
          { foreignKeyName: 'affiliate_rules_vendor_id_fkey'; columns: ['vendor_id']; referencedRelation: 'users'; referencedColumns: ['id']; isOneToOne: false },
        ];
      };
      commissions: {
        Row: Commission;
        Insert: Partial<Commission> & Pick<Commission, 'koc_id' | 'order_id' | 'rule_id' | 'amount'>;
        Update: Partial<Commission>;
        Relationships: [
          { foreignKeyName: 'commissions_koc_id_fkey'; columns: ['koc_id']; referencedRelation: 'users'; referencedColumns: ['id']; isOneToOne: false },
          { foreignKeyName: 'commissions_order_id_fkey'; columns: ['order_id']; referencedRelation: 'orders'; referencedColumns: ['id']; isOneToOne: false },
          { foreignKeyName: 'commissions_rule_id_fkey'; columns: ['rule_id']; referencedRelation: 'affiliate_rules'; referencedColumns: ['id']; isOneToOne: false },
        ];
      };
      user_nfts: {
        Row: UserNFT;
        Insert: Partial<UserNFT> & Pick<UserNFT, 'user_id' | 'token_id' | 'contract_address' | 'nft_type' | 'chain_id'>;
        Update: Partial<UserNFT>;
        Relationships: [
          { foreignKeyName: 'user_nfts_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; isOneToOne: false },
        ];
      };
      courses: {
        Row: Course;
        Insert: Partial<Course> & Pick<Course, 'title' | 'instructor_id'>;
        Update: Partial<Course>;
        Relationships: [
          { foreignKeyName: 'courses_instructor_id_fkey'; columns: ['instructor_id']; referencedRelation: 'users'; referencedColumns: ['id']; isOneToOne: false },
        ];
      };
      course_enrollments: {
        Row: CourseEnrollment;
        Insert: Partial<CourseEnrollment> & Pick<CourseEnrollment, 'user_id' | 'course_id'>;
        Update: Partial<CourseEnrollment>;
        Relationships: [
          { foreignKeyName: 'course_enrollments_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; isOneToOne: false },
          { foreignKeyName: 'course_enrollments_course_id_fkey'; columns: ['course_id']; referencedRelation: 'courses'; referencedColumns: ['id']; isOneToOne: false },
        ];
      };
      competitor_data: {
        Row: CompetitorData;
        Insert: Partial<CompetitorData> & Pick<CompetitorData, 'vendor_id' | 'platform' | 'product_name' | 'price'>;
        Update: Partial<CompetitorData>;
        Relationships: [
          { foreignKeyName: 'competitor_data_vendor_id_fkey'; columns: ['vendor_id']; referencedRelation: 'users'; referencedColumns: ['id']; isOneToOne: false },
        ];
      };
      livestreams: {
        Row: Livestream;
        Insert: Partial<Livestream> & Pick<Livestream, 'host_id'>;
        Update: Partial<Livestream>;
        Relationships: [
          { foreignKeyName: 'livestreams_host_id_fkey'; columns: ['host_id']; referencedRelation: 'users'; referencedColumns: ['id']; isOneToOne: false },
        ];
      };
      session_nonces: {
        Row: { id: string; nonce: string; wallet: string | null; used: boolean; expires_at: string; created_at: string };
        Insert: Partial<{ id: string; nonce: string; wallet: string | null; used: boolean; expires_at: string; created_at: string }> & { nonce: string };
        Update: Partial<{ id: string; nonce: string; wallet: string | null; used: boolean; expires_at: string; created_at: string }>;
        Relationships: [];
      };
      admin_actions: {
        Row: { id: string; admin_id: string; action: string; target_id: string | null; details: Record<string, unknown> | null; created_at: string };
        Insert: Partial<{ id: string; admin_id: string; action: string; target_id: string | null; details: Record<string, unknown> | null; created_at: string }> & { admin_id: string; action: string };
        Update: Partial<{ id: string; admin_id: string; action: string; target_id: string | null; details: Record<string, unknown> | null; created_at: string }>;
        Relationships: [
          { foreignKeyName: 'admin_actions_admin_id_fkey'; columns: ['admin_id']; referencedRelation: 'users'; referencedColumns: ['id']; isOneToOne: false },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_products: {
        Args: { query_embedding: number[]; match_count?: number };
        Returns: { id: string; name: string; description: string; price: number; similarity: number }[];
      };
    };
    Enums: {
      user_role: UserRole;
      product_status: ProductStatus;
      payment_status: PaymentStatus;
      commission_status: CommissionStatus;
      rule_type: RuleType;
      nft_type: NFTType;
      stream_status: StreamStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
