// Thin typed client for the KeyChaos backend. All calls are same-origin.

export type SymbolSet  = 'safe' | 'none'
export type DigitCount = 2 | 3 | 4
export type Quantity   = 1 | 3 | 5
/** PwdPush expire_after_duration enum: 6 = 1 day, 12 = 1 week, 15 = 1 month. */
export type ExpireDuration = 6 | 12 | 15

export interface SmartPassResult {
  passwords:     string[]
  entropy_bits:  number
  pepper_active: boolean
}

export interface PushResult {
  pushUrl:        string
  expiresAt:      string | null
  viewsRemaining: number | null
}

export interface Health {
  status:  string
  version: string
}

/** Error carrying the HTTP status (0 = network failure) and optional Retry-After seconds. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfter: number | null = null) {
    super(message)
    this.name = 'ApiError'
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Network error — is the server reachable?', 0)
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const retryAfter = typeof data.retryAfter === 'number' ? data.retryAfter : null
    const message    = res.status === 429
      ? 'Too many requests — try again shortly'
      : (typeof data.error === 'string' ? data.error : `Request failed (${res.status})`)
    throw new ApiError(message, res.status, retryAfter)
  }
  return data as T
}

export function generateSmartPass(digitCount: DigitCount, symbolSet: SymbolSet, count: Quantity) {
  return postJson<SmartPassResult>('/api/generate/smartpass', { digitCount, symbolSet, count })
}

export function pushToPwdPush(payload: string, ttl: ExpireDuration, maxViews: number) {
  return postJson<PushResult>('/api/pwdpush/push', { payload, ttl, maxViews, deletable: true })
}

export async function fetchHealth(): Promise<Health> {
  const res = await fetch('/api/health')
  if (!res.ok) throw new ApiError('Health check failed', res.status)
  return res.json()
}
