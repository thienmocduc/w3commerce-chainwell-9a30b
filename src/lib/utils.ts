// ── Currency ──────────────────────────────────────────────
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('vi-VN')
}

// ── Commission calculation ────────────────────────────────
export interface CommissionBreakdown {
  platformRevenue: number   // Total platform gets (100%)
  t1: number                // KOC T1 direct: 40%
  t2: number                // KOC T2 sponsor: 13%
  poolA: number             // Monthly ranking: 9%
  poolB: number             // Annual prize: 5%
  poolC: number             // Global quarterly: 3%
  platform: number          // WellKOC operations: 30%
  vendorReceives: number    // What vendor keeps
}

export function calcCommission(price: number, discountPct: number, qty = 1): CommissionBreakdown {
  const total = price * qty
  const platformRevenue = total * (discountPct / 100)
  const vendorReceives  = total - platformRevenue

  return {
    platformRevenue: Math.round(platformRevenue),
    t1:              Math.round(platformRevenue * 0.40),
    t2:              Math.round(platformRevenue * 0.13),
    poolA:           Math.round(platformRevenue * 0.09),
    poolB:           Math.round(platformRevenue * 0.05),
    poolC:           Math.round(platformRevenue * 0.03),
    platform:        Math.round(platformRevenue * 0.30),
    vendorReceives:  Math.round(vendorReceives),
  }
}

// ── Tailwind class merge ──────────────────────────────────
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Slug / URL ────────────────────────────────────────────
export function buildAffiliateUrl(productId: string, kocHandle: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://wellkoc.com'
  const handle = kocHandle.toLowerCase().replace(/[^a-z0-9.]/g, '').replace(/\s+/g, '.')
  return `${base}/p/${productId}?ref=${handle}`
}

export function slugify(text: string): string {
  return text
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
    .trim()
}

// ── Date ─────────────────────────────────────────────────
export function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'vừa xong'
  if (mins < 60)  return `${mins} phút trước`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs} giờ trước`
  const days = Math.floor(hrs / 24)
  if (days < 30)  return `${days} ngày trước`
  return new Date(date).toLocaleDateString('vi-VN')
}

// ── Order status ──────────────────────────────────────────
export const ORDER_STATUS_LABELS: Record<string, { vi: string; en: string; color: string }> = {
  pending:   { vi: 'Chờ xử lý',    en: 'Pending',   color: 'text-amber-600 bg-amber-50' },
  confirmed: { vi: 'Đã xác nhận',  en: 'Confirmed', color: 'text-blue-600 bg-blue-50' },
  shipping:  { vi: 'Đang giao',    en: 'Shipping',  color: 'text-purple-600 bg-purple-50' },
  delivered: { vi: 'Đã giao',      en: 'Delivered', color: 'text-green-600 bg-green-50' },
  cancelled: { vi: 'Đã hủy',       en: 'Cancelled', color: 'text-red-600 bg-red-50' },
  refunded:  { vi: 'Đã hoàn tiền', en: 'Refunded',  color: 'text-gray-600 bg-gray-50' },
}
