'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TrackingEvent {
  id: string
  order_id: string
  status: string
  note: string | null
  location: string | null
  created_at: string
}

interface OrderTracking {
  events: TrackingEvent[]
  currentStatus: string | null
  isLoading: boolean
  error: string | null
}

const STATUS_LABELS: Record<string, { vi: string; en: string; icon: string }> = {
  pending:   { vi: 'Chờ xử lý',          en: 'Pending',           icon: '🕐' },
  confirmed: { vi: 'Đã xác nhận',         en: 'Confirmed',         icon: '✅' },
  preparing: { vi: 'Đang đóng gói',       en: 'Preparing',         icon: '📦' },
  shipping:  { vi: 'Đang giao hàng',      en: 'Out for delivery',  icon: '🚚' },
  delivered: { vi: 'Đã giao thành công',  en: 'Delivered',         icon: '🎉' },
  cancelled: { vi: 'Đã huỷ',             en: 'Cancelled',         icon: '❌' },
  returned:  { vi: 'Đang hoàn trả',       en: 'Returning',         icon: '↩️' },
}

export function useOrderTracking(orderId: string | null) {
  const [state, setState] = useState<OrderTracking>({
    events: [],
    currentStatus: null,
    isLoading: true,
    error: null,
  })

  const supabase = createClient()

  const fetchTracking = useCallback(async () => {
    if (!orderId) return
    try {
      const res  = await fetch(`/api/orders/tracking?order_id=${orderId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setState(prev => ({
        ...prev,
        events:        data.tracking ?? [],
        currentStatus: data.order?.status ?? null,
        isLoading:     false,
      }))
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message, isLoading: false }))
    }
  }, [orderId])

  useEffect(() => {
    if (!orderId) return
    fetchTracking()

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`order-tracking-${orderId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'order_tracking',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          setState(prev => ({
            ...prev,
            events:        [...prev.events, payload.new as TrackingEvent],
            currentStatus: (payload.new as TrackingEvent).status,
          }))
        }
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          setState(prev => ({
            ...prev,
            currentStatus: (payload.new as any).status,
          }))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orderId, fetchTracking])

  return { ...state, refresh: fetchTracking, labels: STATUS_LABELS }
}

// Component: Order tracking timeline
export function OrderTrackingTimeline({ orderId }: { orderId: string }) {
  const { events, currentStatus, isLoading, labels } = useOrderTracking(orderId)

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-1 py-1">
            <div className="h-3 bg-gray-100 rounded w-1/3" />
            <div className="h-3 bg-gray-100 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )

  if (!events.length) return (
    <p className="text-sm text-gray-400 text-center py-4">Chưa có thông tin vận chuyển</p>
  )

  return (
    <div className="space-y-1">
      {events.map((event, i) => {
        const label  = labels[event.status]
        const isLast = i === events.length - 1
        return (
          <div key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                isLast ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-200' : 'bg-gray-100 text-gray-500'
              }`}>
                {label?.icon ?? '📍'}
              </div>
              {i < events.length - 1 && <div className="w-0.5 h-6 bg-gray-200 my-1" />}
            </div>
            <div className={`pb-4 ${isLast ? 'text-gray-900' : 'text-gray-400'}`}>
              <div className="text-sm font-semibold">{label?.vi ?? event.status}</div>
              {event.note && <div className="text-xs mt-0.5">{event.note}</div>}
              {event.location && <div className="text-xs text-gray-400">📍 {event.location}</div>}
              <div className="text-xs text-gray-400 mt-0.5">
                {new Date(event.created_at).toLocaleString('vi-VN', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
