import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// This route is called by Vercel Cron Jobs
// vercel.json config:
// {
//   "crons": [
//     { "path": "/api/cron/pool-payout", "schedule": "0 1 5 * *"   },  <- Pool A: mùng 5 lúc 01:00
//     { "path": "/api/cron/pool-payout", "schedule": "0 1 15 1 *"  },  <- Pool B: 15/1 lúc 01:00
//     { "path": "/api/cron/pool-payout", "schedule": "0 1 15 */3 *"},  <- Pool C: 15 đầu quý
//   ]
// }

export async function POST(req: NextRequest) {
  // Verify cron secret — reject if not configured
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/pool-payout] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { pool_type } = await req.json().catch(() => ({}))
  const admin = createAdminClient()
  const now   = new Date()

  // Determine which pool to run based on current date if not specified
  let targetPool = pool_type
  if (!targetPool) {
    const day   = now.getDate()
    const month = now.getMonth() + 1
    if (day === 5)  targetPool = 'A'
    else if (day === 15 && month === 1) targetPool = 'B'
    else if (day === 15 && [1,4,7,10].includes(month)) targetPool = 'C'
  }

  if (!targetPool) {
    return NextResponse.json({ message: 'No pool due today' })
  }

  // Find the payout job
  const { data: job } = await admin
    .from('payout_jobs')
    .select('*')
    .eq('pool_type', targetPool)
    .eq('status', 'pending')
    .lte('run_at', now.toISOString())
    .order('run_at', { ascending: true })
    .limit(1)
    .single()

  if (!job) return NextResponse.json({ message: `No pending job for Pool ${targetPool}` })

  // Mark as running
  await admin.from('payout_jobs').update({ status: 'running', started_at: now.toISOString() }).eq('id', job.id)

  try {
    let result: { recipients: number; total: number }

    if (targetPool === 'A') result = await runPoolA(admin, job.period)
    else if (targetPool === 'B') result = await runPoolB(admin, job.period)
    else result = await runPoolC(admin, job.period)

    // Mark pool as distributed
    const { data: pool } = await admin
      .from('reward_pools')
      .update({ distributed: true, closed_at: now.toISOString() })
      .eq('pool_type', targetPool)
      .eq('period', job.period)
      .select('id')
      .single()

    // Schedule next pool
    await scheduleNextPool(admin, targetPool)

    // Mark job done
    await admin.from('payout_jobs').update({
      status:       'done',
      total_amount: result.total,
      recipients:   result.recipients,
      finished_at:  now.toISOString(),
    }).eq('id', job.id)

    return NextResponse.json({ success: true, pool: targetPool, ...result })

  } catch (error: any) {
    await admin.from('payout_jobs').update({ status: 'failed', error: error.message }).eq('id', job.id)
    console.error(`[Pool ${targetPool} payout]`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── Pool A: Top N KOC by GMV this month ──────────────────────
async function runPoolA(admin: any, period: string) {
  const { data: pool } = await admin
    .from('reward_pools')
    .select('id, total_amount')
    .eq('pool_type', 'A')
    .eq('period', period)
    .single()

  if (!pool) throw new Error('Pool A not found for period: ' + period)

  // Calculate pool total from contributions
  const { data: contribs } = await admin
    .from('pool_contributions')
    .select('amount')
    .eq('pool_id', pool.id)

  const totalPool = contribs?.reduce((s: number, c: any) => s + c.amount, 0) ?? 0

  // Get top N KOC by commission earned this month
  const topN = await admin.rpc('get_policy', { p_key: 'pool_a_top_n' }).then((r: any) => r.data ?? 30)

  const { data: topKOCs } = await admin
    .from('commissions')
    .select('koc_id, amount.sum()')
    .eq('tier', 'T1')
    .gte('created_at', `${period}-01`)
    .lt('created_at', getNextMonth(period))
    .eq('status', 'paid')
    .order('sum', { ascending: false })
    .limit(topN)

  if (!topKOCs?.length) return { recipients: 0, total: 0 }

  // Equal share among top N
  const sharePerKOC = Math.floor(totalPool / topKOCs.length)
  const payouts = []

  for (let i = 0; i < topKOCs.length; i++) {
    const koc   = topKOCs[i]
    const share = sharePerKOC

    // Credit wallet
    const { data: wallet } = await admin.from('wallets').select('id, balance').eq('user_id', koc.koc_id).single()
    if (wallet) {
      await admin.from('wallets').update({ balance: wallet.balance + share }).eq('id', wallet.id)
      await admin.from('wallet_transactions').insert({
        wallet_id:     wallet.id,
        type:          'pool_payout',
        amount:        share,
        currency:      'VND',
        balance_after: wallet.balance + share,
        ref_type:      'pool',
        note:          `Pool A ${period} — Hạng #${i + 1}`,
      })
    }

    await admin.from('pool_payouts').insert({
      pool_id:   pool.id,
      koc_id:    koc.koc_id,
      rank:      i + 1,
      pct_share: (share / totalPool) * 100,
      amount:    share,
      status:    'paid',
      paid_at:   new Date().toISOString(),
    })

    // Notify
    await admin.from('notifications').insert({
      user_id: koc.koc_id,
      type:    'pool_payout',
      title:   `🏆 Pool A ${period}: +${share.toLocaleString('vi-VN')}đ — Hạng #${i + 1}`,
      data:    { pool: 'A', period, rank: i + 1, amount: share },
    })

    payouts.push({ koc_id: koc.koc_id, amount: share })
  }

  return { recipients: payouts.length, total: totalPool }
}

// ── Pool B: Annual prize (phone→motorbike→car→apartment) ────
async function runPoolB(admin: any, period: string) {
  const { data: pool } = await admin
    .from('reward_pools')
    .select('id')
    .eq('pool_type', 'B')
    .eq('period', period)
    .single()

  if (!pool) throw new Error('Pool B not found')

  const { data: contribs } = await admin
    .from('pool_contributions')
    .select('amount')
    .eq('pool_id', pool.id)

  const totalPool = contribs?.reduce((s: number, c: any) => s + c.amount, 0) ?? 0

  // Top 10 KOC annually
  const { data: topKOCs } = await admin
    .from('commissions')
    .select('koc_id, amount.sum()')
    .eq('tier', 'T1')
    .gte('created_at', `${period}-01-01`)
    .lt('created_at', `${parseInt(period) + 1}-01-01`)
    .eq('status', 'paid')
    .order('sum', { ascending: false })
    .limit(10)

  // Prize structure (in cash value)
  const prizes = [
    totalPool * 0.35,  // #1: ~apartment
    totalPool * 0.25,  // #2: ~car
    totalPool * 0.15,  // #3: ~motorbike
    totalPool * 0.08,  // #4
    totalPool * 0.05,  // #5
    ...Array(5).fill(totalPool * 0.024), // #6-10
  ]

  for (let i = 0; i < Math.min(topKOCs?.length ?? 0, prizes.length); i++) {
    const koc    = topKOCs![i]
    const amount = Math.floor(prizes[i])
    const { data: wallet } = await admin.from('wallets').select('id, balance').eq('user_id', koc.koc_id).single()
    if (wallet) {
      await admin.from('wallets').update({ balance: wallet.balance + amount }).eq('id', wallet.id)
      await admin.from('wallet_transactions').insert({
        wallet_id:     wallet.id,
        type:          'pool_payout',
        amount,
        currency:      'VND',
        balance_after: wallet.balance + amount,
        ref_type:      'pool',
        note:          `Pool B ${period} — Hạng #${i + 1}`,
      })
    }
    await admin.from('notifications').insert({
      user_id: koc.koc_id,
      type:    'pool_payout_b',
      title:   `🎊 Pool B ${period} — Hạng #${i + 1}: ${amount.toLocaleString('vi-VN')}đ`,
      data:    { pool: 'B', period, rank: i + 1, amount },
    })
  }

  return { recipients: topKOCs?.length ?? 0, total: totalPool }
}

// ── Pool C: Global quarterly — equal share among active KOC ─
async function runPoolC(admin: any, period: string) {
  const { data: pool } = await admin
    .from('reward_pools')
    .select('id')
    .eq('pool_type', 'C')
    .eq('period', period)
    .single()

  if (!pool) throw new Error('Pool C not found')

  const { data: contribs } = await admin
    .from('pool_contributions')
    .select('amount')
    .eq('pool_id', pool.id)

  const totalPool = contribs?.reduce((s: number, c: any) => s + c.amount, 0) ?? 0

  // All KOC who had at least 1 commission this quarter
  const [year, quarter] = period.split('-Q')
  const qStart = new Date(parseInt(year), (parseInt(quarter) - 1) * 3, 1).toISOString()
  const qEnd   = new Date(parseInt(year), parseInt(quarter) * 3, 1).toISOString()

  const { data: activeKOCs } = await admin
    .from('commissions')
    .select('koc_id')
    .gte('created_at', qStart)
    .lt('created_at', qEnd)
    .eq('status', 'paid')
    .distinct('koc_id')

  if (!activeKOCs?.length) return { recipients: 0, total: 0 }

  const sharePerKOC = Math.floor(totalPool / activeKOCs.length)

  for (const { koc_id } of activeKOCs) {
    const { data: wallet } = await admin.from('wallets').select('id, balance').eq('user_id', koc_id).single()
    if (wallet && sharePerKOC > 0) {
      await admin.from('wallets').update({ balance: wallet.balance + sharePerKOC }).eq('id', wallet.id)
      await admin.from('wallet_transactions').insert({
        wallet_id:     wallet.id,
        type:          'pool_payout',
        amount:        sharePerKOC,
        currency:      'VND',
        balance_after: wallet.balance + sharePerKOC,
        ref_type:      'pool',
        note:          `Pool C ${period}`,
      })
      await admin.from('notifications').insert({
        user_id: koc_id,
        type:    'pool_payout_c',
        title:   `🌐 Pool C ${period}: +${sharePerKOC.toLocaleString('vi-VN')}đ`,
        data:    { pool: 'C', period, amount: sharePerKOC },
      })
    }
  }

  return { recipients: activeKOCs.length, total: totalPool }
}

async function scheduleNextPool(admin: any, poolType: string) {
  const now = new Date()
  let nextRun: Date
  let period: string

  if (poolType === 'A') {
    nextRun = new Date(now.getFullYear(), now.getMonth() + 1, 5, 1, 0, 0)
    period  = `${nextRun.getFullYear()}-${String(nextRun.getMonth() + 1).padStart(2, '0')}`

    // Create next month's pool
    await admin.from('reward_pools').upsert({ pool_type: 'A', period })
  } else if (poolType === 'B') {
    nextRun = new Date(now.getFullYear() + 1, 0, 15, 1, 0, 0)
    period  = String(nextRun.getFullYear())
    await admin.from('reward_pools').upsert({ pool_type: 'B', period })
  } else {
    const currentQ  = Math.ceil((now.getMonth() + 1) / 3)
    const nextQ     = currentQ === 4 ? 1 : currentQ + 1
    const nextYear  = currentQ === 4 ? now.getFullYear() + 1 : now.getFullYear()
    nextRun = new Date(nextYear, (nextQ - 1) * 3, 15, 1, 0, 0)
    period  = `Q${nextQ}-${nextYear}`
    await admin.from('reward_pools').upsert({ pool_type: 'C', period })
  }

  await admin.from('payout_jobs').insert({
    pool_type: poolType,
    period,
    run_at:    nextRun.toISOString(),
    status:    'pending',
  })
}

function getNextMonth(period: string): string {
  const [y, m] = period.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
