import { useState, useCallback, useEffect, useRef } from 'react'
import { PasswordEngine, GeneratorConfig } from './engine/passwordEngine'
import {
  generateSmartPass, generateSmartPassBatch, calculateSmartPassEntropy,
  SmartPassOptions,
} from './lib/smartpass'
import {
  Shield, RefreshCw, Copy, CheckCircle2, Share2, ChevronDown,
  ToggleLeft, ToggleRight, Info,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type AppMode   = 'smartpass' | 'password' | 'passphrase'
type PushState = 'idle' | 'loading' | 'done' | 'error'
type ExpireDuration = 6 | 12 | 15

interface UIEntry {
  value:          string
  entropy:        number
  copied:         boolean
  pushState:      PushState
  pushUrl:        string
  expiresAt:      string | null
  viewsRemaining: number | null
  retryAfter:     number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DURATION_LABELS: Record<ExpireDuration, string> = { 6: '1 Day', 12: '1 Week', 15: '1 Month' }

const DEFAULT_PASSWORD_CONFIG: GeneratorConfig = {
  mode: 'password', length: 24,
  useSpecialChars: true, useNumbers: true, useUppercase: true, excludeAmbiguous: false,
  wordCount: 4, separator: '-',
}

const DEFAULT_SMARTPASS_OPTS: SmartPassOptions = { digitCount: 2, symbolSet: 'safe' }

function makeEntry(value: string, entropy: number): UIEntry {
  return { value, entropy, copied: false, pushState: 'idle', pushUrl: '', expiresAt: null, viewsRemaining: null, retryAfter: null }
}

const MODE_LABELS: Record<AppMode, string> = {
  smartpass:  'SmartPass ✦',
  password:   'Random',
  passphrase: 'Passphrase',
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [appMode,       setAppMode]       = useState<AppMode>('smartpass')
  const [smartpassOpts, setSmartpassOpts] = useState<SmartPassOptions>(DEFAULT_SMARTPASS_OPTS)
  const [config,        setConfig]        = useState<GeneratorConfig>(DEFAULT_PASSWORD_CONFIG)
  const [quantity,      setQuantity]      = useState<1 | 3 | 5>(3)
  const [pushDuration,  setPushDuration]  = useState<ExpireDuration>(6)
  const [pushViews,     setPushViews]     = useState(5)
  const [entries,       setEntries]       = useState<UIEntry[]>([])
  const [health,        setHealth]        = useState<{ status: string; version: string } | null>(null)
  const [toast,         setToast]         = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateConfig = (u: Partial<GeneratorConfig>) => setConfig(p => ({ ...p, ...u }))
  const updateEntry  = (i: number, u: Partial<UIEntry>) =>
    setEntries(p => p.map((e, idx) => idx === i ? { ...e, ...u } : e))

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(''), 2000)
  }

  // ─── Generate ───────────────────────────────────────────────────────────────

  // Accepts optional overrides so mode-switch clicks can generate immediately
  // without waiting for React to flush state.
  const generateWithMode = useCallback((
    overrideMode?: AppMode,
    overrideQty?: 1 | 3 | 5,
  ) => {
    const mode = overrideMode ?? appMode
    const qty  = overrideQty  ?? quantity

    if (mode === 'smartpass') {
      const batch = generateSmartPassBatch(qty, smartpassOpts)
      const ent   = calculateSmartPassEntropy(smartpassOpts)
      setEntries(batch.map(v => makeEntry(v, ent)))
    } else {
      const cfg   = { ...config, mode: mode as 'password' | 'passphrase' }
      const batch = PasswordEngine.generateBatch(cfg, qty)
      setEntries(batch.map(p => makeEntry(p.value, p.entropy)))
    }
  }, [appMode, quantity, smartpassOpts, config])

  useEffect(() => {
    generateWithMode()
    fetch('/api/health')
      .then(r => r.json())
      .then(d => setHealth(d))
      .catch(() => setHealth({ status: 'offline', version: '0.0.0' }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchMode = (m: AppMode) => {
    setAppMode(m)
    generateWithMode(m)
  }

  // ─── Per-card regenerate ────────────────────────────────────────────────────

  const regenerateOne = (index: number) => {
    if (appMode === 'smartpass') {
      const value   = generateSmartPass(smartpassOpts)
      const entropy = calculateSmartPassEntropy(smartpassOpts)
      updateEntry(index, makeEntry(value, entropy))
    } else {
      const cfg           = { ...config, mode: appMode as 'password' | 'passphrase' }
      const { value, entropy } = PasswordEngine.generate(cfg)
      updateEntry(index, makeEntry(value, entropy))
    }
  }

  // ─── Copy ───────────────────────────────────────────────────────────────────

  const copy = (index: number) => {
    navigator.clipboard.writeText(entries[index].value).catch(err =>
      console.error('Clipboard write failed:', err))
    updateEntry(index, { copied: true })
    showToast('Copied!')
    setTimeout(() => updateEntry(index, { copied: false }), 2000)
  }

  const copyPushUrl = (url: string) => {
    navigator.clipboard.writeText(url).catch(err =>
      console.error('Clipboard write failed:', err))
    showToast('Link copied!')
  }

  // ─── PwdPush ────────────────────────────────────────────────────────────────

  const push = async (index: number) => {
    if (entries[index].pushState === 'loading') return
    updateEntry(index, { pushState: 'loading', pushUrl: '', expiresAt: null, viewsRemaining: null, retryAfter: null })

    try {
      const res  = await fetch('/api/pwdpush/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: entries[index].value, ttl: pushDuration, maxViews: pushViews, deletable: true }),
      })
      const data = await res.json()

      if (res.status === 429) {
        updateEntry(index, { pushState: 'error', retryAfter: data.retryAfter ?? 60 })
        setTimeout(() => updateEntry(index, { pushState: 'idle', retryAfter: null }), 5000)
        return
      }
      if (!res.ok) throw new Error(data.error || 'Push failed')

      updateEntry(index, { pushState: 'done', pushUrl: data.pushUrl, expiresAt: data.expiresAt, viewsRemaining: data.viewsRemaining })
    } catch (err) {
      console.error('PwdPush share failed:', err)
      updateEntry(index, { pushState: 'error' })
      setTimeout(() => updateEntry(index, { pushState: 'idle' }), 4000)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-6 pt-12">

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-surface border border-white/10 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      <div className="w-full max-w-2xl space-y-4">

        {/* Header */}
        <header className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Shield className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-1">
            Key<span className="text-primary">Chaos</span>
          </h1>
          <p className="text-secondary text-xs font-bold tracking-widest uppercase">
            Professional Generator · v{health?.version || '1.3.0'}
          </p>
        </header>

        {/* Config Card */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-5">

          {/* Mode Tabs */}
          <div className="flex gap-2">
            {(['smartpass', 'password', 'passphrase'] as AppMode[]).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  appMode === m
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-white/5 text-secondary hover:bg-white/10'
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          {/* SmartPass Controls */}
          {appMode === 'smartpass' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <p className="text-xs text-secondary leading-relaxed flex-1">
                  Memorable format: <span className="font-mono text-white/70">Adjective + Noun + Symbol + Digits</span>
                  <br />Example: <span className="font-mono text-primary">BoldFalcon#47</span>
                </p>
                <div
                  className="group relative shrink-0 cursor-help"
                  title="Suitable for shared/temporary credentials via PwdPush. For master passwords, use Random mode with length 24+."
                >
                  <Info className="w-4 h-4 text-secondary/50 hover:text-secondary transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-secondary/60 uppercase tracking-widest block mb-2">Digits</span>
                  <div className="flex gap-1.5">
                    {([2, 3, 4] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => setSmartpassOpts(o => ({ ...o, digitCount: d }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-black transition-all ${
                          smartpassOpts.digitCount === d
                            ? 'bg-primary text-white'
                            : 'bg-white/5 text-secondary hover:bg-white/10'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-secondary/60 uppercase tracking-widest block mb-2">Symbol</span>
                  <div className="flex gap-1.5">
                    {(['safe', 'none'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setSmartpassOpts(o => ({ ...o, symbolSet: s }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                          smartpassOpts.symbolSet === s
                            ? 'bg-primary text-white'
                            : 'bg-white/5 text-secondary hover:bg-white/10'
                        }`}
                      >
                        {s === 'safe' ? 'On' : 'Off'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Random (Password) Controls */}
          {appMode === 'password' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-bold text-secondary uppercase tracking-widest">Length</span>
                  <span className="text-xs font-black text-white tabular-nums">{config.length}</span>
                </div>
                <input
                  type="range" min={8} max={128} value={config.length}
                  onChange={e => updateConfig({ length: parseInt(e.target.value) })}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-white/20">8</span>
                  <span className="text-[10px] text-white/20">128</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {([
                  ['useSpecialChars',  'Special chars'],
                  ['useNumbers',       'Numbers'],
                  ['useUppercase',     'Uppercase'],
                  ['excludeAmbiguous', 'Exclude ambiguous (0O1lI|)'],
                ] as [keyof GeneratorConfig, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => updateConfig({ [key]: !config[key] })}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-left"
                  >
                    {config[key]
                      ? <ToggleRight className="w-4 h-4 text-primary shrink-0" />
                      : <ToggleLeft  className="w-4 h-4 text-secondary shrink-0" />
                    }
                    <span className="text-xs font-medium text-secondary leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Passphrase Controls */}
          {appMode === 'passphrase' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-bold text-secondary uppercase tracking-widest">Word count</span>
                  <span className="text-xs font-black text-white tabular-nums">{config.wordCount}</span>
                </div>
                <input
                  type="range" min={3} max={8} value={config.wordCount}
                  onChange={e => updateConfig({ wordCount: parseInt(e.target.value) })}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-white/20">3</span>
                  <span className="text-[10px] text-white/20">8</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-secondary uppercase tracking-widest block mb-2">Separator</span>
                <div className="flex gap-2">
                  {(['-', ' ', '.'] as const).map(sep => (
                    <button
                      key={sep}
                      onClick={() => updateConfig({ separator: sep })}
                      className={`flex-1 py-2 rounded-xl text-sm font-mono font-bold transition-all ${
                        config.separator === sep
                          ? 'bg-primary text-white'
                          : 'bg-white/5 text-secondary hover:bg-white/10'
                      }`}
                    >
                      {sep === ' ' ? '␣ space' : sep}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quantity + Generate */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs font-bold text-secondary uppercase tracking-widest shrink-0">Qty</span>
            <div className="flex gap-2">
              {([1, 3, 5] as const).map(q => (
                <button
                  key={q}
                  onClick={() => {
                    setQuantity(q)
                    generateWithMode(undefined, q)
                  }}
                  className={`w-10 h-9 rounded-lg text-sm font-black transition-all ${
                    quantity === q
                      ? 'bg-primary text-white'
                      : 'bg-white/5 text-secondary hover:bg-white/10'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
            <button
              onClick={() => generateWithMode()}
              className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Generate
            </button>
          </div>
        </div>

        {/* PwdPush Settings */}
        <div className="bg-surface border border-white/10 rounded-2xl px-5 py-4">
          <span className="text-xs font-bold text-secondary uppercase tracking-widest block mb-3">PwdPush defaults</span>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-white/30 font-bold uppercase tracking-widest block mb-1">Expiry</label>
              <div className="relative">
                <select
                  value={pushDuration}
                  onChange={e => setPushDuration(parseInt(e.target.value) as ExpireDuration)}
                  className="w-full appearance-none bg-white/5 border border-white/10 text-white text-sm font-bold rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-primary/50"
                >
                  {(Object.entries(DURATION_LABELS) as [string, string][]).map(([v, label]) => (
                    <option key={v} value={v} className="bg-gray-900">{label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
              </div>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-white/30 font-bold uppercase tracking-widest block mb-1">Max views</label>
              <input
                type="number" min={1} max={100} value={pushViews}
                onChange={e => setPushViews(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                className="w-full bg-white/5 border border-white/10 text-white text-sm font-bold rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>
        </div>

        {/* Password List */}
        {entries.length > 0 && (
          <div className="space-y-3">
            {entries.map((entry, i) => {
              const { label, color, barColor } = PasswordEngine.getStrengthLabel(entry.entropy)
              const isSmartPass = appMode === 'smartpass'
              return (
                <div key={i} className="bg-surface border border-white/10 rounded-2xl p-5 space-y-3">

                  {/* Password value + per-card regenerate */}
                  <div className="flex items-start gap-3">
                    <div className="font-mono text-lg font-bold text-white break-all leading-relaxed flex-1">
                      {entry.value}
                    </div>
                    <button
                      onClick={() => regenerateOne(i)}
                      className="shrink-0 mt-0.5 text-secondary hover:text-white transition-colors"
                      title="Regenerate this one"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Entropy + strength */}
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${Math.min(100, (entry.entropy / 100) * 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-black uppercase tracking-widest shrink-0 ${color}`}>
                      {label}
                    </span>
                    <span className="text-xs text-secondary font-bold tabular-nums shrink-0">
                      ~{entry.entropy} bits
                    </span>
                    {isSmartPass && (
                      <span
                        className="shrink-0 cursor-help"
                        title="Suitable for shared/temporary credentials via PwdPush. For master passwords, use Random mode with length 24+."
                      >
                        <Info className="w-3.5 h-3.5 text-secondary/40 hover:text-secondary transition-colors" />
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => copy(i)}
                      className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-2.5 rounded-xl transition-all active:scale-95 text-sm"
                    >
                      {entry.copied
                        ? <><CheckCircle2 className="w-4 h-4 text-success" />Copied</>
                        : <><Copy        className="w-4 h-4" />Copy</>
                      }
                    </button>
                    <button
                      onClick={() => push(i)}
                      disabled={entry.pushState === 'loading' || entry.pushState === 'done'}
                      className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-success font-bold py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {entry.pushState === 'loading' && <><RefreshCw className="w-4 h-4 animate-spin" />Pushing…</>}
                      {entry.pushState === 'done'    && <><CheckCircle2 className="w-4 h-4" />Pushed</>}
                      {entry.pushState === 'error'   && <><Share2 className="w-4 h-4 text-error" />{entry.retryAfter ? `Retry ${entry.retryAfter}s` : 'Failed'}</>}
                      {entry.pushState === 'idle'    && <><Share2 className="w-4 h-4" />PwdPush</>}
                    </button>
                  </div>

                  {/* Push result */}
                  {entry.pushState === 'done' && entry.pushUrl && (
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                      <a href={entry.pushUrl} target="_blank" rel="noopener noreferrer"
                        className="flex-1 text-xs font-mono text-success truncate hover:underline">
                        {entry.pushUrl}
                      </a>
                      <button onClick={() => copyPushUrl(entry.pushUrl)}
                        className="shrink-0 text-secondary hover:text-white transition-colors" title="Copy link">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {entry.pushState === 'done' && (entry.expiresAt || entry.viewsRemaining != null) && (
                    <p className="text-[10px] text-secondary font-medium">
                      {entry.expiresAt && <>Expires {new Date(entry.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</>}
                      {entry.expiresAt && entry.viewsRemaining != null && ' · '}
                      {entry.viewsRemaining != null && <>{entry.viewsRemaining} view{entry.viewsRemaining !== 1 ? 's' : ''} remaining</>}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <footer className="flex items-center justify-center gap-4 pt-4 pb-8">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${health?.status === 'ok' ? 'bg-success' : 'bg-error'}`} />
            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">
              {health?.status === 'ok' ? 'Online' : 'Offline'}
            </span>
          </div>
          <span className="text-white/10">·</span>
          <span className="text-[10px] text-white/20 font-medium">KeyChaos — MSP Excellence</span>
        </footer>

      </div>
    </div>
  )
}
