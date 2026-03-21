import { createAdminClient } from '@/lib/supabase/server'

export type AuditAction =
  | 'kyc_approve' | 'kyc_reject'
  | 'product_approve' | 'product_reject'
  | 'order_update' | 'user_ban' | 'user_role_change'
  | 'payout_process' | 'refund_process'
  | 'settings_change'

export async function auditLog(params: {
  actor_id: string
  action: AuditAction
  target_type: string
  target_id: string
  details?: Record<string, any>
  ip?: string
}) {
  try {
    const admin = createAdminClient()
    await admin.from('audit_logs').insert({
      actor_id: params.actor_id,
      action: params.action,
      target_type: params.target_type,
      target_id: params.target_id,
      details: params.details || {},
      ip_address: params.ip || null,
      created_at: new Date().toISOString(),
    })
  } catch (e) {
    // Never fail the main operation because of audit logging
    console.error('[audit-log] Failed to write:', e)
  }
}
