import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

const fieldClass =
  'w-full rounded-2xl border border-border bg-surface px-4 text-base text-foreground placeholder:text-muted-foreground aria-[invalid=true]:border-danger'

interface FieldChrome {
  label: string
  hint?: string
  error?: string
  /** Trailing helper (e.g. "120/300"). */
  counter?: string
}

function FieldFrame({
  id,
  label,
  hint,
  error,
  counter,
  children,
}: FieldChrome & { id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {counter && <span className="font-label text-xs text-muted-foreground">{counter}</span>}
      </div>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-msg`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export const TextField = forwardRef<
  HTMLInputElement,
  FieldChrome & InputHTMLAttributes<HTMLInputElement>
>(function TextField({ label, hint, error, counter, className, id: idProp, ...props }, ref) {
  const generated = useId()
  const id = idProp ?? generated
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} counter={counter}>
      <input
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={cn(fieldClass, 'h-12', className)}
        {...props}
      />
    </FieldFrame>
  )
})

export const TextAreaField = forwardRef<
  HTMLTextAreaElement,
  FieldChrome & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextAreaField({ label, hint, error, counter, className, id: idProp, ...props }, ref) {
  const generated = useId()
  const id = idProp ?? generated
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} counter={counter}>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={cn(fieldClass, 'min-h-28 resize-none py-3', className)}
        {...props}
      />
    </FieldFrame>
  )
})
