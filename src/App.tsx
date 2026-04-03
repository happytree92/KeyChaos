import { useState, useEffect, useCallback } from 'react'
import { PasswordEngine, FormulaConfig } from './engine/passwordEngine'
import { EntropyCalculator } from './engine/entropyCalculator'
import { Shield, RefreshCw, Copy, CheckCircle2, Share2 } from 'lucide-react'

const DEFAULT_FORMULA: FormulaConfig = {
  name: 'Professional Passphrase',
  segments: [
    { type: 'word', wordCategory: 'adjective', capitalization: 'title', separator: '-' },
    { type: 'word', wordCategory: 'noun', capitalization: 'title', separator: '-' },
    { type: 'word', wordCategory: 'noun', capitalization: 'title', separator: '-' },
    { type: 'number', numberRange: [100, 999] }
  ]
}

type PushState = 'idle' | 'loading' | 'done' | 'error'

function App() {
  const [password, setPassword] = useState('')
  const [entropy, setEntropy] = useState(0)
  const [copied, setCopied] = useState(false)
  const [health, setHealth] = useState<any>(null)
  const [pushState, setPushState] = useState<PushState>('idle')
  const [pushUrl, setPushUrl] = useState('')

  const generate = useCallback(() => {
    const pw = PasswordEngine.generate(DEFAULT_FORMULA)
    const ent = EntropyCalculator.calculate(DEFAULT_FORMULA)
    setPassword(pw)
    setEntropy(ent)
    setCopied(false)
    setPushState('idle')
    setPushUrl('')
  }, [])

  useEffect(() => {
    generate()
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(() => setHealth({ status: 'offline' }))
  }, [generate])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(password).catch(err => {
      console.error('Clipboard write failed:', err)
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sharePwdPush = async () => {
    if (!password || pushState === 'loading') return
    setPushState('loading')
    setPushUrl('')
    try {
      const res = await fetch('/api/pwdpush/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: password, ttl: 3, maxViews: 5, deletable: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Push failed')
      setPushUrl(data.pushUrl)
      setPushState('done')
    } catch (err) {
      console.error('PwdPush share failed:', err)
      setPushState('error')
      setTimeout(() => setPushState('idle'), 4000)
    }
  }

  const copyPushUrl = () => {
    navigator.clipboard.writeText(pushUrl).catch(err => {
      console.error('Clipboard write failed:', err)
    })
  }

  const { label, color } = EntropyCalculator.getStrengthLabel(entropy)

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-surface border border-white/10 rounded-3xl p-10 shadow-2xl">
        <header className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Shield className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2">
            Key<span className="text-primary">Chaos</span>
          </h1>
          <p className="text-secondary text-sm font-medium tracking-wide uppercase">
            Professional Generator
          </p>
        </header>

        <main className="space-y-8">
          <section>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-primary/20 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
              <div className="relative bg-background border border-white/10 rounded-2xl p-6 flex flex-col items-center">
                <div className="w-full text-center mb-6 py-2 overflow-hidden overflow-ellipsis whitespace-nowrap">
                  <span className="text-2xl font-mono font-bold tracking-wider text-white">
                    {password || '••••••••••••'}
                  </span>
                </div>
                
                <div className="flex gap-3 w-full">
                  <button 
                    onClick={generate}
                    className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 px-6 rounded-xl transition-all active:scale-95"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Regenerate
                  </button>
                  <button 
                    onClick={copyToClipboard}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
                  >
                    {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-secondary font-bold uppercase tracking-widest">Strength</span>
                <span className={`text-xs font-black uppercase tracking-widest ${color}`}>
                  {label}
                </span>
              </div>
              <div className="text-xs text-secondary font-bold">
                ~{entropy} bits
              </div>
            </div>
            
            {/* Entropy Progress Bar */}
            <div className="mt-2 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ease-out rounded-full ${bitsToColor(entropy)}`}
                style={{ width: `${Math.min(100, (entropy / 80) * 100)}%` }}
              ></div>
            </div>
          </section>

          <section className="pt-4 space-y-3">
            <button
              onClick={sharePwdPush}
              disabled={pushState === 'loading' || pushState === 'done'}
              className="w-full relative group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-success/50 to-success/10 rounded-xl blur opacity-0 group-hover:opacity-20 transition duration-300"></div>
              <div className="relative flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 text-success font-bold py-5 rounded-xl transition-all">
                {pushState === 'loading' ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : pushState === 'done' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
                {pushState === 'loading' ? 'Pushing…' : pushState === 'done' ? 'Pushed!' : pushState === 'error' ? 'Push Failed — Retry?' : 'Share via PwdPush'}
              </div>
            </button>

            {pushState === 'done' && pushUrl && (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <a
                  href={pushUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-xs font-mono text-success truncate hover:underline"
                >
                  {pushUrl}
                </a>
                <button
                  onClick={copyPushUrl}
                  className="shrink-0 text-secondary hover:text-white transition-colors"
                  title="Copy link"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}

            {pushState === 'error' && (
              <p className="text-center text-xs text-error font-medium">
                Could not reach PwdPush. Check server config or try again.
              </p>
            )}
          </section>
        </main>

        <footer className="mt-12 pt-8 border-t border-white/5 flex flex-col items-center">
          <div className="flex items-center gap-4 mb-4">
             <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${health?.status === 'ok' ? 'bg-success' : 'bg-error'}`}></div>
                <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">
                  Server: {health?.status === 'ok' ? 'Online' : 'Offline'}
                </span>
             </div>
             <span className="text-white/10">—</span>
             <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">
               v{health?.version || '0.0.0'}
             </span>
          </div>
          <p className="text-[10px] text-white/10 font-medium">
            Designed for MSP Excellence
          </p>
        </footer>
      </div>
    </div>
  )
}

function bitsToColor(bits: number) {
  if (bits >= 60) return 'bg-success shadow-[0_0_10px_rgba(52,211,153,0.3)]';
  if (bits >= 40) return 'bg-warning shadow-[0_0_10px_rgba(251,191,36,0.2)]';
  return 'bg-error shadow-[0_0_10px_rgba(248,113,113,0.2)]';
}

export default App
