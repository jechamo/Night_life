import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

/** Navigation row for settings-like lists. Whole row is the touch target (>= 56 px). */
export function ListRow({
  to,
  icon: Icon,
  label,
  hint,
}: {
  to: string
  icon: LucideIcon
  label: string
  hint?: string
}) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center gap-3 px-4 py-3 transition-opacity active:opacity-70"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-surface-raised text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-muted-foreground">{hint}</span>}
      </span>
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
    </Link>
  )
}
