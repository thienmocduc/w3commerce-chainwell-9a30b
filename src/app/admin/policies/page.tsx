'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Save, AlertCircle, RefreshCw, TrendingUp } from 'lucide-react'
import { formatVND } from '@/lib/utils'

interface Policy {
  key: string
  value: number
  label_vi: string
  label_en: string
  description: string
  min_val: number
  max_val: number
  updated_at: string
}

const COMMISSION_KEYS = ['t1_pct', 't2_pct', 'pool_a_pct', 'pool_b_pct', 'pool_c_pct', 'platform_pct']
const GROUPS = [
  {
    id: 'commission',
    label: 'Phân bổ hoa hồng (%)',
    icon: '💰',
    keys: ['t1_pct', 't2_pct', 'pool_a_pct', 'pool_b_pct', 'pool_c_pct', 'platform_pct'],
    desc: 'Tổng phải = 100%',
  },
  {
    id: 'vendor',
    label: 'Quy tắc Vendor',
    icon: '🏪',
    keys: ['min_vendor_disc', 'max_vendor_disc'],
    desc: 'Chiết khấu hàng hoá',
  },
  {
    id: 'shipping',
    label: 'Vận chuyển',
    icon: '📦',
    keys: ['free_ship_min', 'ship_fee'],
    desc: 'Phí ship',
  },
  {
    id: 'rules',
    label: 'Luật tính',
    icon: '⚙️',
    keys: ['t2_min_orders', 'pool_a_top_n', 'commission_delay', 'xp_per_order'],
    desc: 'Điều kiện xét duyệt',
  },
]

export default function AdminPoliciesPage() {
  const [policies, setPolicies] = useState<Record<string, Policy>>({})
  const [draft,    setDraft]    = useState<Record<string, number>>({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [changed,  setChanged]  = useState<Set<string>>(new Set())

  useEffect(() => { fetchPolicies() }, [])

  const fetchPolicies = async () => {
    setLoading(true)
    const res  = await fetch('/api/admin/policies')
    const data = await res.json()
    const map: Record<string, Policy> = {}
    const vals: Record<string, number> = {}
    data.policies?.forEach((p: Policy) => { map[p.key] = p; vals[p.key] = p.value })
    setPolicies(map)
    setDraft(vals)
    setChanged(new Set())
    setLoading(false)
  }

  const handleChange = (key: string, value: number) => {
    setDraft(prev => ({ ...prev, [key]: value }))
    setChanged(prev => new Set(prev).add(key))
  }

  const commissionSum = COMMISSION_KEYS.reduce((s, k) => s + (draft[k] ?? 0), 0)

  const handleSave = async () => {
    if (commissionSum !== 100) {
      toast.error(`Tổng hoa hồng = ${commissionSum.toFixed(2)}% — phải đúng 100%`)
      return
    }
    setSaving(true)
    const updates = Array.from(changed).map(key => ({ key, value: draft[key] }))
    const res  = await fetch('/api/admin/policies', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(data.error); return }
    toast.success(`Đã lưu ${updates.length} chính sách`)
    setChanged(new Set())
    fetchPolicies()
  }

  const isMoney = (key: string) => ['free_ship_min', 'ship_fee'].includes(key)

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Đang tải...</div>

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cài đặt chính sách</h1>
          <p className="text-sm text-gray-500 mt-1">Điều chỉnh tỷ lệ hoa hồng, phí và quy tắc nền tảng</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchPolicies} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={14} /> Làm mới
          </button>
          {changed.size > 0 && (
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
              <Save size={14} />
              {saving ? 'Đang lưu…' : `Lưu ${changed.size} thay đổi`}
            </button>
          )}
        </div>
      </div>

      {/* Commission sum warning */}
      {COMMISSION_KEYS.some(k => changed.has(k)) && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-5 text-sm font-medium ${
          commissionSum === 100
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <AlertCircle size={16} />
          Tổng phân bổ hoa hồng: <strong>{commissionSum.toFixed(2)}%</strong>
          {commissionSum === 100 ? ' ✓ Hợp lệ' : ` — cần đúng 100% (lệch ${(commissionSum - 100).toFixed(2)}%)`}
        </div>
      )}

      {/* Live preview: commission on 1M order */}
      <div className="card mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-indigo-600" />
          <span className="font-semibold text-sm text-indigo-900">Xem trước: phân bổ 1 đơn 1,000,000đ với CK Vendor 33%</span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { key: 't1_pct',       label: 'KOC T1',      color: 'text-indigo-700' },
            { key: 't2_pct',       label: 'KOC T2',      color: 'text-purple-700' },
            { key: 'pool_a_pct',   label: 'Pool A',      color: 'text-amber-700' },
            { key: 'pool_b_pct',   label: 'Pool B',      color: 'text-orange-700' },
            { key: 'pool_c_pct',   label: 'Pool C',      color: 'text-pink-700' },
            { key: 'platform_pct', label: 'Platform',    color: 'text-gray-700' },
          ].map(({ key, label, color }) => {
            const platRev = 1_000_000 * 0.33
            const amount  = Math.round(platRev * (draft[key] ?? 0) / 100)
            return (
              <div key={key} className="bg-white rounded-xl p-3 text-center border border-white/80">
                <div className={`font-mono text-sm font-bold ${color}`}>{formatVND(amount)}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label} ({(draft[key] ?? 0).toFixed(1)}%)</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Policy groups */}
      <div className="space-y-6">
        {GROUPS.map(group => (
          <div key={group.id} className="card">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">{group.icon}</span>
              <div>
                <h2 className="font-semibold text-gray-900 text-base">{group.label}</h2>
                <p className="text-xs text-gray-400">{group.desc}</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {group.keys.map(key => {
                const policy = policies[key]
                if (!policy) return null
                const val      = draft[key] ?? policy.value
                const isChanged = changed.has(key)
                const isMon    = isMoney(key)
                return (
                  <div key={key} className={`p-4 rounded-xl border-2 transition-colors ${isChanged ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{policy.label_vi}</div>
                        <div className="text-xs text-gray-400">{policy.description}</div>
                      </div>
                      {isChanged && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">Đã sửa</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <input
                        type="range"
                        min={policy.min_val}
                        max={policy.max_val}
                        step={isMon ? 10000 : key === 'commission_delay' ? 1 : 0.5}
                        value={val}
                        onChange={e => handleChange(key, parseFloat(e.target.value))}
                        className="flex-1 accent-indigo-600"
                      />
                      <div className="w-24 flex-shrink-0">
                        <input
                          type="number"
                          min={policy.min_val}
                          max={policy.max_val}
                          step={isMon ? 10000 : 0.5}
                          value={val}
                          onChange={e => handleChange(key, parseFloat(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm font-mono text-right focus:border-indigo-400 outline-none"
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right flex-shrink-0">
                        {isMon ? 'đ' : key === 'xp_per_order' ? 'XP' : key === 'commission_delay' ? 'h' : key.includes('_n') || key.includes('orders') ? '' : '%'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Min: {isMon ? formatVND(policy.min_val) : policy.min_val}</span>
                      <span>Max: {isMon ? formatVND(policy.max_val) : policy.max_val}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Save sticky bar */}
      {changed.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-50">
          <span className="text-sm">{changed.size} chính sách chưa lưu</span>
          <button onClick={() => { setDraft(Object.fromEntries(Object.entries(policies).map(([k,p]) => [k, p.value]))); setChanged(new Set()) }}
            className="text-gray-400 hover:text-white text-sm">Huỷ</button>
          <button onClick={handleSave} disabled={saving || commissionSum !== 100}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 px-4 py-1.5 rounded-xl text-sm font-semibold">
            {saving ? 'Đang lưu…' : 'Lưu ngay'}
          </button>
        </div>
      )}
    </div>
  )
}
