import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  const styles = {
    primary: 'bg-ink text-white hover:bg-black disabled:bg-neutral-300',
    secondary: 'bg-white text-ink border border-line hover:bg-canvas disabled:text-neutral-400',
    ghost: 'bg-transparent text-ink hover:bg-black/5',
    danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
  }[variant]
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 h-8 text-sm font-medium transition disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  )
}

export function TextField({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className="block text-sm">
      {label ? <span className="mb-1.5 block font-medium text-ink">{label}</span> : null}
      <input
        className="h-9 w-full rounded-md border border-line bg-white px-3 outline-none ring-accent/30 focus:ring-2"
        {...props}
      />
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export function SelectField({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      {label ? <span className="mb-1.5 block font-medium text-ink">{label}</span> : null}
      <select
        className="h-9 w-full rounded-md border border-line bg-white px-3 outline-none ring-accent/30 focus:ring-2"
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

export function TextArea({
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block text-sm">
      {label ? <span className="mb-1.5 block font-medium text-ink">{label}</span> : null}
      <textarea
        className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-2 outline-none ring-accent/30 focus:ring-2"
        {...props}
      />
    </label>
  )
}

export function Avatar({
  name,
  color,
  size = 24,
}: {
  name: string
  color?: string
  size?: number
}) {
  const letter = (name || '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white"
      style={{ width: size, height: size, background: color || '#4f46e5', fontSize: size * 0.42 }}
      aria-hidden
    >
      {letter}
    </span>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-canvas text-muted">
        <span className="text-2xl">◇</span>
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="grid h-full min-h-40 place-items-center text-sm text-muted">
      <span className="inline-flex items-center gap-2">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" />
        Loading
      </span>
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="text-sm text-red-600">{children}</p>
}
