import { memo } from 'react'
import { WORLD_SIZE } from '../model/projection'

const S = WORLD_SIZE
const GRID = 110

/**
 * Stylised night street plan for the mock map, drawn only with theme tokens so it
 * re-skins with every theme. Static (no animation): the "life" comes from pins and heatmap.
 */
export const MapStreets = memo(function MapStreets() {
  const lines: number[] = []
  for (let v = GRID / 2; v < S; v += GRID) lines.push(v)
  return (
    <svg aria-hidden width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="absolute inset-0">
      <rect width={S} height={S} fill="var(--nl-background)" />
      {/* City blocks */}
      {lines.flatMap((x, i) =>
        lines.map((y, j) => (
          <rect
            key={`${i}-${j}`}
            x={x + 10}
            y={y + 10}
            width={GRID - 20}
            height={GRID - 20}
            rx={10}
            fill="var(--nl-surface)"
            opacity={(i * 7 + j * 3) % 5 === 0 ? 0.55 : 0.9}
          />
        )),
      )}
      {/* Park and plaza */}
      <rect
        x={GRID * 10.5 + 10}
        y={GRID * 2.5 + 10}
        width={GRID * 2 - 20}
        height={GRID * 2 - 20}
        rx={28}
        fill="var(--nl-success)"
        opacity={0.12}
      />
      <circle
        cx={S / 2 + 40}
        cy={S / 2 - 120}
        r={70}
        fill="var(--nl-surface-raised)"
        stroke="var(--nl-border)"
        strokeWidth={4}
      />
      {/* Seafront */}
      <path
        d={`M0 ${S - 150} Q ${S / 2} ${S - 230} ${S} ${S - 170} L ${S} ${S} L 0 ${S} Z`}
        fill="var(--nl-secondary)"
        opacity={0.08}
      />
      {/* Avenues */}
      <g stroke="var(--nl-border)" strokeLinecap="round" fill="none">
        <path d={`M-50 ${S * 0.85} L ${S + 50} ${S * 0.15}`} strokeWidth={26} />
        <path d={`M ${S * 0.1} -50 L ${S * 0.7} ${S + 50}`} strokeWidth={20} />
      </g>
      <g stroke="var(--nl-primary)" strokeLinecap="round" fill="none" opacity={0.35}>
        <path
          d={`M-50 ${S * 0.85} L ${S + 50} ${S * 0.15}`}
          strokeWidth={2}
          strokeDasharray="2 18"
        />
        <path
          d={`M ${S * 0.1} -50 L ${S * 0.7} ${S + 50}`}
          strokeWidth={2}
          strokeDasharray="2 18"
        />
      </g>
    </svg>
  )
})
