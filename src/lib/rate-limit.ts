// Simple in-memory rate limiter for serverless
// Resets on cold start — acceptable for basic protection

const store = new Map<string, { count: number; resetAt: number }>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of store) {
    if (val.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

export function rateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60_000
): { success: boolean; remaining: number } {
  const now = Date.now()
  const entry = store.get(identifier)

  if (!entry || entry.resetAt < now) {
    store.set(identifier, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1 }
  }

  entry.count++
  if (entry.count > limit) {
    return { success: false, remaining: 0 }
  }

  return { success: true, remaining: limit - entry.count }
}

export function rateLimitByIP(req: Request, prefix: string, limit: number = 10, windowMs: number = 60_000) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const key = `${prefix}:${ip}`
  return rateLimit(key, limit, windowMs)
}
