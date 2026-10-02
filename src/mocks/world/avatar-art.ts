/**
 * Illustrated placeholder avatars drawn as SVG (PRD 6.14: never photos of real
 * people). Deterministic from a seed so the same mock person always looks the same.
 * Replaced by the GPT-illustrated avatars (docs/design/IMAGE_PROMPTS.md, section C).
 */
const SKIN = ['#f1c7a5', '#e0a982', '#c68863', '#9a6040', '#6f4429', '#f6d7c0']
const HAIR = [
  '#1d1a1f',
  '#3b2416',
  '#6b3d1f',
  '#b07a3b',
  '#d9b26a',
  '#8a8a92',
  '#c24b6a',
  '#5b4bd1',
]
const BG = [
  ['#3b1f6e', '#0f6e85'],
  ['#5a1838', '#c46a2c'],
  ['#14325c', '#3aa18b'],
  ['#402060', '#b4407a'],
  ['#1f3b2f', '#6aa84f'],
  ['#2b2f6b', '#7f5af0'],
]

function hash(seed: string): number {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

const pick = <T>(list: readonly T[], n: number): T => list[n % list.length]!

export function avatarDataUri(seed: string, variant = 0): string {
  const h = hash(`${seed}:${variant}`)
  const skin = pick(SKIN, hash(seed))
  const hair = pick(HAIR, hash(seed) >>> 3)
  const [bg1, bg2] = pick(BG, h)
  const hairStyle = (hash(seed) >>> 6) % 4
  const angle = (h % 360).toString()
  const hairShape = [
    '<path d="M110 150c0-60 40-95 90-95s90 35 90 95c-20-30-50-40-90-40s-70 10-90 40z"/>',
    '<path d="M100 175c-5-80 40-120 100-120s105 40 100 120c-10-50-30-80-100-80s-90 30-100 80z"/><path d="M100 175c0 90 15 140 35 160h-30c-20-30-25-90-5-160z"/><path d="M300 175c0 90-15 140-35 160h30c20-30 25-90 5-160z"/>',
    '<circle cx="200" cy="120" r="78"/>',
    '<path d="M118 140c10-50 45-80 82-80s72 30 82 80c-30-12-55-15-82-15s-52 3-82 15z"/>',
  ][hairStyle]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520">
<defs><linearGradient id="b" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
<rect width="400" height="520" fill="url(#b)"/>
<circle cx="${60 + (h % 280)}" cy="${60 + ((h >>> 4) % 160)}" r="${30 + (h % 40)}" fill="#fff" opacity=".08"/>
<path d="M60 520c0-110 60-170 140-170s140 60 140 170z" fill="${pick(BG, h >>> 5)[1]}" opacity=".9"/>
<rect x="172" y="250" width="56" height="70" rx="24" fill="${skin}"/>
<ellipse cx="200" cy="190" rx="78" ry="92" fill="${skin}"/>
<g fill="${hair}">${hairShape}</g>
<circle cx="172" cy="200" r="7" fill="#1b1420"/><circle cx="228" cy="200" r="7" fill="#1b1420"/>
<path d="M178 240q22 18 44 0" stroke="#1b1420" stroke-width="6" fill="none" stroke-linecap="round"/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
