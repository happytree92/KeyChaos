// Material Design 3 primitives, styled with the earth-tone tokens in index.css.
// Kept deliberately small: only what the app uses.

import { useRef, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text'

const VARIANT: Record<ButtonVariant, string> = {
  filled:   'bg-primary text-on-primary hover:bg-primary/90',
  tonal:    'bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80',
  outlined: 'border border-outline text-primary hover:bg-primary/8',
  text:     'text-primary hover:bg-primary/8',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?:    ReactNode
}

export function Button({ variant = 'filled', icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full text-sm font-medium',
        'transition-colors disabled:opacity-40 disabled:pointer-events-none',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string   // required: icon-only buttons need an accessible name
}

export function IconButton({ label, className, children, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex items-center justify-center w-10 h-10 rounded-full shrink-0',
        'text-on-surface-variant hover:bg-on-surface/8 transition-colors disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

// ─── Segmented button (single select) ─────────────────────────────────────────
// Radio-group semantics with roving tabindex: Tab enters the group, arrow keys
// move and select, matching the WAI-ARIA radio group pattern.

interface SegmentedProps<T extends string | number> {
  label:    string
  value:    T
  options:  readonly { value: T; label: ReactNode }[]
  onChange: (value: T) => void
  className?: string
}

export function Segmented<T extends string | number>({ label, value, options, onChange, className }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
               : e.key === 'ArrowLeft'  || e.key === 'ArrowUp'   ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={label}
      className={cx('flex h-10 rounded-full border border-outline overflow-hidden', className)}>
      {options.map((opt, i) => {
        const selected = opt.value === value
        return (
          <button
            key={String(opt.value)}
            ref={el => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={e => onKeyDown(e, i)}
            className={cx(
              'flex-1 min-w-0 px-3 text-sm font-medium transition-colors -outline-offset-2',
              i > 0 && 'border-l border-outline',
              selected
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface hover:bg-on-surface/8',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Switch ───────────────────────────────────────────────────────────────────
// The whole row is the control, so the label is a large, easy target.

interface SwitchRowProps {
  label:    string
  checked:  boolean
  onChange: (checked: boolean) => void
  hint?:    string
}

export function SwitchRow({ label, checked, onChange, hint }: SwitchRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left hover:bg-on-surface/8 transition-colors"
    >
      <span className="min-w-0">
        <span className="block text-sm text-on-surface">{label}</span>
        {hint && <span className="block text-xs text-on-surface-variant">{hint}</span>}
      </span>
      <span aria-hidden="true"
        className={cx(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors',
          checked ? 'bg-primary border-primary' : 'bg-surface-container-high border-outline',
        )}>
        <span className={cx(
          'absolute rounded-full transition-all',
          checked ? 'left-[22px] h-4 w-4 bg-on-primary' : 'left-1 h-3 w-3 bg-outline',
        )} />
      </span>
    </button>
  )
}

// ─── Field label ──────────────────────────────────────────────────────────────

export function FieldLabel({ children, htmlFor, trailing }: { children: ReactNode; htmlFor?: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      {htmlFor
        ? <label htmlFor={htmlFor} className="text-xs font-medium text-on-surface-variant">{children}</label>
        : <span className="text-xs font-medium text-on-surface-variant">{children}</span>}
      {trailing}
    </div>
  )
}

export { cx }
