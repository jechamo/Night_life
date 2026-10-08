import { useMemo } from 'react'
import { encodeQr } from '@/shared/qr/qr'
import { cn } from '@/shared/lib/cn'

/**
 * QR code as an SVG drawn from our own encoder (roadmap R5). Always dark on white with the
 * standard 4-module quiet zone, whatever the theme, so door scanners can read it.
 */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string
  label: string
  className?: string
}) {
  const { size, path } = useMemo(() => {
    const matrix = encodeQr(value, { ecc: 'M' })
    let d = ''
    matrix.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x + 4} ${y + 4}h1v1h-1z`
      }),
    )
    return { size: matrix.length + 8, path: d }
  }, [value])
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn('rounded-xl bg-white', className)}
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  )
}
