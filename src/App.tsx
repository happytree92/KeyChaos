import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check, Copy, CopyCheck, ExternalLink, KeyRound, Monitor, Moon, RefreshCw, Share2, Sun,
} from 'lucide-react'
import { PasswordEngine, type GeneratorConfig, type StrengthLevel } from './engine/passwordEngine'
import {
  ApiError, fetchHealth, generateSmartPass, pushToPwdPush,
  type DigitCount, type ExpireDuration, type Health, type Quantity, type SymbolSet,
} from './lib/api'
import { useTheme, type ThemePreference } from './hooks/useTheme'
import { Button, FieldLabel, IconButton, Segmented, SwitchRow, cx } from './components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

type AppMode = 'smartpass' | 'password' | 'passphrase'

interface PushInfo {
  state:          'idle' | 'loading' | 'done' | 'error'
  url:            string
  expiresAt:      string | null
  viewsRemaining: number | null
  retryAfter:     number | null
}

interface Entry {
  id:           number
  value:        string
  entropy:      number
  pepperActive: boolean | null   // null = not applicable (client-side modes)
  copied:       boolean
  push:         PushInfo
}

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_VERSION_FALLBACK = '1.5.0'

const MODE_OPTIONS = [
  { value: 'smartpass',  label: 'SmartPass' },
  { value: 'password',   label: 'Random' },
  { value: 'passphrase', label: 'Passphrase' },
] as const

const QTY_OPTIONS    = [1, 3, 5].map(q => ({ value: q as Quantity, label: q }))
const DIGIT_OPTIONS  = [2, 3, 4].map(d => ({ value: d as DigitCount, label: `${d} digits` }))
const EXPIRY_OPTIONS = [
  { value: 6  as ExpireDuration, label: '1 day' },
  { value: 12 as ExpireDuration, label: '1 week' },
  { value: 15 as ExpireDuration, label: '1 month' },
]
const SEPARATOR_OPTIONS = [
  { value: '-', label: <span className="font-mono">-</span> },
  { value: '.', label: <span className="font-mono">.</span> },
  { value: ' ', label: 'Space' },
]
const LENGTH_PRESETS = [16, 24, 32, 64]

const DEFAULT_CONFIG: GeneratorConfig = {
  mode: 'password', length: 24,
  useSpecialChars: true, useNumbers: true, useUppercase: true, excludeAmbiguous: false,
  wordCount: 4, separator: '-',
}

const LEVEL_TEXT: Record<StrengthLevel, string> = { strong: 'text-strong', fair: 'text-fair', weak: 'text-weak' }
const LEVEL_BAR:  Record<StrengthLevel, string> = { strong: 'bg-strong',   fair: 'bg-fair',   weak: 'bg-weak' }

const THEME_ICON:  Record<ThemePreference, typeof Sun>  = { system: Monitor, light: Sun, dark: Moon }
const THEME_LABEL: Record<ThemePreference, string>      = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' }

const IDLE_PUSH: PushInfo = { state: 'idle', url: '', expiresAt: null, viewsRemaining: null, retryAfter: null }

const clampViews = (raw: string) => Math.max(1, Math.min(100, parseInt(raw, 10) || 1))

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { theme, cycleTheme } = useTheme()

  const [mode,       setMode]       = useState<AppMode>('smartpass')
  const [digits,     setDigits]     = useState<DigitCount>(2)
  const [symbols,    setSymbols]    = useState<SymbolSet>('safe')
  const [config,     setConfig]     = useState<GeneratorConfig>(DEFAULT_CONFIG)
  const [quantity,   setQuantity]   = useState<Quantity>(3)
  const [expiry,     setExpiry]     = useState<ExpireDuration>(6)
  const [viewsInput, setViewsInput] = useState('5')
  const [entries,    setEntries]    = useState<Entry[]>([])
  const [generating, setGenerating] = useState(false)
  const [genError,   setGenError]   = useState('')
  const [health,     setHealth]     = useState<Health | null>(null)
  const [snack,      setSnack]      = useState('')

  const nextId     = useRef(0)
  const requestSeq = useRef(0)   // bumps on every full generate; stale async results are dropped
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showSnack = useCallback((msg: string) => {
    if (snackTimer.current) clearTimeout(snackTimer.current)
    setSnack(msg)
    snackTimer.current = setTimeout(() => setSnack(''), 2500)
  }, [])

  const makeEntry = (value: string, entropy: number, pepperActive: boolean | null): Entry =>
    ({ id: nextId.current++, value, entropy, pepperActive, copied: false, push: IDLE_PUSH })

  const updateEntry = (id: number, patch: Partial<Entry>) =>
    setEntries(list => list.map(e => (e.id === id ? { ...e, ...patch } : e)))

  const updateConfig = (patch: Partial<GeneratorConfig>) => setConfig(c => ({ ...c, ...patch }))

  // ─── Generate ───────────────────────────────────────────────────────────────
  // Re-runs automatically whenever the mode or any option changes, so the list
  // always reflects what's on screen — no "remember to press Generate" step.

  const generate = useCallback(async () => {
    const seq = ++requestSeq.current
    setGenError('')

    if (mode !== 'smartpass') {
      setGenerating(false)
      const batch = PasswordEngine.generateBatch({ ...config, mode }, quantity)
      setEntries(batch.map(p => makeEntry(p.value, p.entropy, null)))
      return
    }

    setGenerating(true)
    try {
      const data = await generateSmartPass(digits, symbols, quantity)
      if (seq !== requestSeq.current) return
      setEntries(data.passwords.map(v => makeEntry(v, data.entropy_bits, data.pepper_active)))
    } catch (err) {
      if (seq !== requestSeq.current) return
      const msg = err instanceof ApiError ? err.message : 'Generation failed — please try again'
      setGenError(msg)
      showSnack(msg)
    } finally {
      if (seq === requestSeq.current) setGenerating(false)
    }
  }, [mode, config, quantity, digits, symbols, showSnack])

  useEffect(() => { generate() }, [generate])

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => setHealth({ status: 'offline', version: APP_VERSION_FALLBACK }))
  }, [])

  const regenerateOne = async (id: number) => {
    const seq = requestSeq.current
    if (mode !== 'smartpass') {
      const { value, entropy } = PasswordEngine.generate({ ...config, mode })
      updateEntry(id, { value, entropy, copied: false, push: IDLE_PUSH })
      return
    }
    try {
      const data = await generateSmartPass(digits, symbols, 1)
      if (seq !== requestSeq.current) return   // list was replaced meanwhile
      updateEntry(id, {
        value: data.passwords[0], entropy: data.entropy_bits, pepperActive: data.pepper_active,
        copied: false, push: IDLE_PUSH,
      })
    } catch (err) {
      showSnack(err instanceof ApiError ? err.message : 'Regeneration failed')
    }
  }

  // ─── Copy ───────────────────────────────────────────────────────────────────

  const writeClipboard = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showSnack(okMsg)
      return true
    } catch {
      showSnack('Copy failed — select the text and copy it manually')
      return false
    }
  }

  const copyEntry = async (entry: Entry) => {
    if (!(await writeClipboard(entry.value, 'Password copied'))) return
    updateEntry(entry.id, { copied: true })
    setTimeout(() => updateEntry(entry.id, { copied: false }), 2000)
  }

  const copyAll = () => writeClipboard(entries.map(e => e.value).join('\n'), `${entries.length} passwords copied`)

  // ─── PwdPush ────────────────────────────────────────────────────────────────

  const share = async (entry: Entry) => {
    if (entry.push.state === 'loading') return
    updateEntry(entry.id, { push: { ...IDLE_PUSH, state: 'loading' } })
    try {
      const res = await pushToPwdPush(entry.value, expiry, clampViews(viewsInput))
      updateEntry(entry.id, {
        push: { state: 'done', url: res.pushUrl, expiresAt: res.expiresAt, viewsRemaining: res.viewsRemaining, retryAfter: null },
      })
    } catch (err) {
      const retryAfter = err instanceof ApiError ? err.retryAfter : null
      updateEntry(entry.id, { push: { ...IDLE_PUSH, state: 'error', retryAfter } })
      showSnack(err instanceof ApiError ? err.message : 'PwdPush failed')
      // Clear the error badge later — but only if the user hasn't retried meanwhile.
      setTimeout(() => setEntries(list => list.map(e =>
        e.id === entry.id && e.push.state === 'error' ? { ...e, push: IDLE_PUSH } : e)), retryAfter ? 5000 : 4000)
    }
  }

  // ─── Keyboard shortcuts ─────────────────────────────────────────────────────
  // G = generate, 1–5 = copy that row. Ignored while typing in a field.

  const shortcuts = useRef({ generate, copyAt: (_i: number) => {} })
  shortcuts.current = { generate, copyAt: (i: number) => { if (entries[i]) copyEntry(entries[i]) } }

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      if (isTypingTarget(e.target)) return
      if (e.key === 'g' || e.key === 'G') { e.preventDefault(); shortcuts.current.generate() }
      else if (/^[1-5]$/.test(e.key))       { e.preventDefault(); shortcuts.current.copyAt(Number(e.key) - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────────

  const ThemeIcon = THEME_ICON[theme]
  const online    = health?.status === 'ok'

  return (
    <div className="min-h-screen">

      {/* Top app bar */}
      <header className="border-b border-outline-variant bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <KeyRound className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-medium">KeyChaos</h1>
          <span className="ml-auto flex items-center gap-2 text-xs text-on-surface-variant">
            <span aria-hidden="true" className={cx('h-2 w-2 rounded-full', online ? 'bg-strong' : 'bg-weak')} />
            {health ? (online ? 'Online' : 'Offline') : 'Connecting…'} · v{health?.version ?? APP_VERSION_FALLBACK}
          </span>
          <IconButton label={THEME_LABEL[theme]} onClick={cycleTheme}>
            <ThemeIcon className="h-5 w-5" />
          </IconButton>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">

        {/* ─── Controls ─────────────────────────────────────────────────────── */}
        <section aria-label="Generator options"
          className="space-y-5 rounded-2xl bg-surface-container p-5 lg:sticky lg:top-4">

          <Segmented label="Mode" value={mode} options={MODE_OPTIONS} onChange={setMode} />

          {mode === 'smartpass' && (
            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                Adjective + Noun + Symbol + Digits, e.g. <span className="font-mono text-on-surface">BoldFalcon#47</span>.
                Easy to read out over the phone — best for temporary or shared credentials.
                For long-lived admin accounts use Random at 24+ characters.
              </p>
              <div>
                <FieldLabel>Digits</FieldLabel>
                <Segmented label="Digits" value={digits} options={DIGIT_OPTIONS} onChange={setDigits} />
              </div>
              <SwitchRow label="Include symbol" hint="# @ ! * + = -"
                checked={symbols === 'safe'} onChange={on => setSymbols(on ? 'safe' : 'none')} />
            </div>
          )}

          {mode === 'password' && (
            <div className="space-y-4">
              <div>
                <FieldLabel htmlFor="length"
                  trailing={<span className="font-mono text-sm tabular-nums">{config.length}</span>}>
                  Length
                </FieldLabel>
                <input id="length" type="range" min={8} max={128} value={config.length}
                  onChange={e => updateConfig({ length: Number(e.target.value) })} className="w-full" />
                <div className="mt-2 flex gap-2" role="group" aria-label="Length presets">
                  {LENGTH_PRESETS.map(n => (
                    <button key={n} type="button" onClick={() => updateConfig({ length: n })}
                      aria-pressed={config.length === n}
                      className={cx(
                        'h-8 flex-1 rounded-lg border text-xs font-medium transition-colors',
                        config.length === n
                          ? 'border-transparent bg-secondary-container text-on-secondary-container'
                          : 'border-outline text-on-surface-variant hover:bg-on-surface/8',
                      )}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="-mx-3">
                <SwitchRow label="Uppercase"   checked={config.useUppercase}    onChange={v => updateConfig({ useUppercase: v })} />
                <SwitchRow label="Numbers"     checked={config.useNumbers}      onChange={v => updateConfig({ useNumbers: v })} />
                <SwitchRow label="Symbols"     checked={config.useSpecialChars} onChange={v => updateConfig({ useSpecialChars: v })} />
                <SwitchRow label="Exclude look-alikes" hint="0 O 1 l I |"
                  checked={config.excludeAmbiguous} onChange={v => updateConfig({ excludeAmbiguous: v })} />
              </div>
            </div>
          )}

          {mode === 'passphrase' && (
            <div className="space-y-4">
              <div>
                <FieldLabel htmlFor="words"
                  trailing={<span className="font-mono text-sm tabular-nums">{config.wordCount}</span>}>
                  Words
                </FieldLabel>
                <input id="words" type="range" min={3} max={8} value={config.wordCount}
                  onChange={e => updateConfig({ wordCount: Number(e.target.value) })} className="w-full" />
              </div>
              <div>
                <FieldLabel>Separator</FieldLabel>
                <Segmented label="Separator" value={config.separator} options={SEPARATOR_OPTIONS}
                  onChange={v => updateConfig({ separator: v })} />
              </div>
            </div>
          )}

          <div>
            <FieldLabel>How many</FieldLabel>
            <Segmented label="How many" value={quantity} options={QTY_OPTIONS} onChange={setQuantity} />
          </div>

          <Button className="w-full" onClick={generate} disabled={generating}
            icon={<RefreshCw className={cx('h-4 w-4', generating && 'animate-spin')} aria-hidden="true" />}>
            {generating ? 'Generating…' : 'Generate'}
            <kbd className="ml-1 rounded border border-on-primary/40 px-1.5 font-sans text-[11px] leading-4 opacity-80">G</kbd>
          </Button>

          <hr className="border-outline-variant" />

          <div className="space-y-3">
            <h2 className="text-sm font-medium">PwdPush link</h2>
            <div>
              <FieldLabel>Expires after</FieldLabel>
              <Segmented label="Link expires after" value={expiry} options={EXPIRY_OPTIONS} onChange={setExpiry} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="views" className="text-xs font-medium text-on-surface-variant">Max views (1–100)</label>
              <input id="views" type="number" inputMode="numeric" min={1} max={100} value={viewsInput}
                onChange={e => setViewsInput(e.target.value)}
                onBlur={() => setViewsInput(String(clampViews(viewsInput)))}
                className="h-10 w-24 rounded-lg border border-outline bg-surface px-3 text-sm tabular-nums focus:border-primary focus:outline-none" />
            </div>
          </div>
        </section>

        {/* ─── Results ──────────────────────────────────────────────────────── */}
        <section aria-label="Generated passwords" className="space-y-3">
          <div className="flex min-h-10 items-center gap-2">
            <h2 className="text-sm font-medium">Results</h2>
            <span className="hidden text-xs text-on-surface-variant sm:inline">
              Click a password or press 1–{entries.length || quantity} to copy
            </span>
            {entries.length > 1 && (
              <Button variant="text" className="ml-auto" onClick={copyAll}
                icon={<CopyCheck className="h-4 w-4" aria-hidden="true" />}>
                Copy all
              </Button>
            )}
          </div>

          {genError && entries.length === 0 && (
            <p role="alert" className="rounded-xl bg-surface-container p-4 text-sm text-weak">{genError}</p>
          )}

          <ol className="space-y-3" aria-busy={generating}>
            {entries.map((entry, i) => (
              <ResultCard key={entry.id} index={i} entry={entry}
                onCopy={() => copyEntry(entry)}
                onRegenerate={() => regenerateOne(entry.id)}
                onShare={() => share(entry)}
                onCopyLink={() => writeClipboard(entry.push.url, 'Link copied')} />
            ))}
          </ol>
        </section>
      </main>

      {/* Snackbar */}
      <div role="status" aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center px-4">
        {snack && (
          <div className="rounded-lg bg-inverse-surface px-4 py-3 text-sm text-inverse-on-surface shadow-md">
            {snack}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Result card ──────────────────────────────────────────────────────────────

interface ResultCardProps {
  index:        number
  entry:        Entry
  onCopy:       () => void
  onRegenerate: () => void
  onShare:      () => void
  onCopyLink:   () => void
}

function ResultCard({ index, entry, onCopy, onRegenerate, onShare, onCopyLink }: ResultCardProps) {
  const { label, level } = PasswordEngine.getStrengthLabel(entry.entropy)
  const { push }         = entry

  return (
    <li className="rounded-xl border border-outline-variant bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="mt-1 w-4 shrink-0 text-right text-xs tabular-nums text-on-surface-variant" aria-hidden="true">
          {index + 1}
        </span>
        <button type="button" onClick={onCopy} title="Click to copy"
          aria-label={`Password ${index + 1}: ${entry.value}. Click to copy.`}
          className="min-w-0 flex-1 rounded-md text-left font-mono text-lg font-medium break-all hover:text-primary transition-colors">
          {entry.value}
        </button>
        <IconButton label="Regenerate this password" onClick={onRegenerate} className="-mr-2 -mt-2">
          <RefreshCw className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 pl-7">
        <div className="h-1 min-w-24 flex-1 overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true">
          <div className={cx('h-full rounded-full', LEVEL_BAR[level])} style={{ width: `${Math.min(100, entry.entropy)}%` }} />
        </div>
        <span className={cx('text-xs font-medium', LEVEL_TEXT[level])}>{label}</span>
        <span className="text-xs tabular-nums text-on-surface-variant">{entry.entropy} bits</span>
        {entry.pepperActive !== null && (
          <span
            title={entry.pepperActive ? 'Server pepper is active' : 'Set SMARTPASS_PEPPER on the server to enable the pepper'}
            className={cx('rounded-md px-2 py-0.5 text-[11px] font-medium',
              entry.pepperActive ? 'bg-primary-container text-on-primary-container' : 'border border-outline text-fair')}>
            {entry.pepperActive ? 'Pepper on' : 'No pepper'}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 pl-7">
        <Button variant="tonal" onClick={onCopy}
          icon={entry.copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}>
          {entry.copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="outlined" onClick={onShare} disabled={push.state === 'loading' || push.state === 'done'}
          icon={push.state === 'loading'
            ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            : <Share2 className="h-4 w-4" aria-hidden="true" />}
          className={push.state === 'error' ? 'border-weak text-weak' : undefined}>
          {push.state === 'loading' ? 'Sharing…'
            : push.state === 'done'  ? 'Shared'
            : push.state === 'error' ? (push.retryAfter ? `Retry in ${push.retryAfter}s` : 'Share failed')
            : 'Share via PwdPush'}
        </Button>
      </div>

      {push.state === 'done' && push.url && (
        <div className="mt-3 ml-7 rounded-lg bg-surface-container px-3 py-2">
          <div className="flex items-center gap-2">
            <a href={push.url} target="_blank" rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate font-mono text-xs text-primary hover:underline">
              {push.url}
            </a>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" aria-hidden="true" />
            <IconButton label="Copy link" onClick={onCopyLink} className="h-8 w-8">
              <Copy className="h-4 w-4" />
            </IconButton>
          </div>
          {(push.expiresAt || push.viewsRemaining != null) && (
            <p className="text-[11px] text-on-surface-variant">
              {push.expiresAt && <>Expires {new Date(push.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</>}
              {push.expiresAt && push.viewsRemaining != null && ' · '}
              {push.viewsRemaining != null && <>{push.viewsRemaining} view{push.viewsRemaining !== 1 ? 's' : ''} left</>}
            </p>
          )}
        </div>
      )}
    </li>
  )
}
