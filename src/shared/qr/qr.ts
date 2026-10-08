/**
 * Minimal QR Code encoder (ISO/IEC 18004), byte mode, versions 1-10, without third-party
 * code (roadmap R5, owner decision). Follows the reference algorithm step by step:
 * data bits → Reed-Solomon (GF(256), 0x11D) → block interleaving → function patterns →
 * zig-zag placement → the mask with the lowest penalty → format and version bits.
 */
export type QrEcc = 'L' | 'M' | 'Q' | 'H'
export type QrMatrix = readonly (readonly boolean[])[]

const MAX_VERSION = 10
// Index = version (0 unused). Tables from ISO/IEC 18004 (Table 9), versions 1-10.
const ECC_PER_BLOCK: Record<QrEcc, readonly number[]> = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
}
const NUM_BLOCKS: Record<QrEcc, readonly number[]> = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
}
const FORMAT_BITS: Record<QrEcc, number> = { L: 1, M: 0, Q: 3, H: 2 }

const bit = (value: number, i: number) => ((value >>> i) & 1) !== 0

function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2
    result -= (25 * align - 10) * align - 55
    if (version >= 7) result -= 36
  }
  return result
}

const dataCodewords = (version: number, ecc: QrEcc) =>
  Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK[ecc][version]! * NUM_BLOCKS[ecc][version]!

function gfMultiply(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j]!, root)
      if (j + 1 < degree) result[j]! ^= result[j + 1]!
    }
    root = gfMultiply(root, 0x02)
  }
  return result
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ result.shift()!
    result.push(0)
    divisor.forEach((coef, i) => (result[i]! ^= gfMultiply(coef, factor)))
  }
  return result
}

/** Byte-mode data codewords for `bytes` at `version`, padded as the standard requires. */
function encodeData(bytes: Uint8Array, version: number, ecc: QrEcc): number[] {
  const bits: number[] = []
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, version <= 9 ? 8 : 16)
  bytes.forEach((b) => push(b, 8))
  const capacity = dataCodewords(version, ecc) * 8
  push(0, Math.min(4, capacity - bits.length))
  push(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8)
  const words: number[] = []
  for (let i = 0; i < bits.length; i += 8)
    words.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0))
  return words
}

function interleave(data: readonly number[], version: number, ecc: QrEcc): number[] {
  const numBlocks = NUM_BLOCKS[ecc][version]!
  const eccLen = ECC_PER_BLOCK[ecc][version]!
  const raw = Math.floor(rawDataModules(version) / 8)
  const numShort = numBlocks - (raw % numBlocks)
  const shortLen = Math.floor(raw / numBlocks)
  const divisor = rsDivisor(eccLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1))
    k += dat.length
    const block = [...dat]
    if (i < numShort) block.push(0)
    blocks.push([...block, ...rsRemainder(dat, divisor)])
  }
  const result: number[] = []
  for (let i = 0; i < blocks[0]!.length; i++)
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) result.push(block[i]!)
    })
  return result
}

class Grid {
  readonly size: number
  readonly modules: boolean[][]
  readonly isFunction: boolean[][]
  constructor(readonly version: number) {
    this.size = version * 4 + 17
    this.modules = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    )
    this.isFunction = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    )
  }
  set(x: number, y: number, dark: boolean) {
    this.modules[y]![x] = dark
    this.isFunction[y]![x] = true
  }
  alignmentPositions(): number[] {
    if (this.version === 1) return []
    const count = Math.floor(this.version / 7) + 2
    const step = Math.ceil((this.version * 4 + 4) / (count * 2 - 2)) * 2
    const result = [6]
    for (let pos = this.size - 7; result.length < count; pos -= step) result.splice(1, 0, pos)
    return result
  }
  drawFunctionPatterns(ecc: QrEcc) {
    for (let i = 0; i < this.size; i++) {
      this.set(6, i, i % 2 === 0)
      this.set(i, 6, i % 2 === 0)
    }
    for (const [cx, cy] of [
      [3, 3],
      [this.size - 4, 3],
      [3, this.size - 4],
    ] as const)
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy))
          const x = cx + dx
          const y = cy + dy
          if (x >= 0 && x < this.size && y >= 0 && y < this.size)
            this.set(x, y, dist !== 2 && dist !== 4)
        }
    const align = this.alignmentPositions()
    const last = align.length - 1
    align.forEach((ax, i) =>
      align.forEach((ay, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++)
            this.set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
      }),
    )
    this.drawFormat(ecc, 0)
    this.drawVersion()
  }
  drawFormat(ecc: QrEcc, mask: number) {
    const data = (FORMAT_BITS[ecc] << 3) | mask
    let rem = data
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((data << 10) | rem) ^ 0x5412
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(bits, i))
    this.set(8, 7, bit(bits, 6))
    this.set(8, 8, bit(bits, 7))
    this.set(7, 8, bit(bits, 8))
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(bits, i))
    for (let i = 0; i < 8; i++) this.set(this.size - 1 - i, 8, bit(bits, i))
    for (let i = 8; i < 15; i++) this.set(8, this.size - 15 + i, bit(bits, i))
    this.set(8, this.size - 8, true)
  }
  drawVersion() {
    if (this.version < 7) return
    let rem = this.version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (this.version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const a = this.size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      this.set(a, b, bit(bits, i))
      this.set(b, a, bit(bits, i))
    }
  }
  drawCodewords(data: readonly number[]) {
    let i = 0
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5
      for (let vert = 0; vert < this.size; vert++)
        for (let j = 0; j < 2; j++) {
          const x = right - j
          const upward = ((right + 1) & 2) === 0
          const y = upward ? this.size - 1 - vert : vert
          if (!this.isFunction[y]![x] && i < data.length * 8) {
            this.modules[y]![x] = bit(data[i >>> 3]!, 7 - (i & 7))
            i++
          }
        }
    }
  }
  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) {
        if (this.isFunction[y]![x]) continue
        const invert = [
          (x + y) % 2 === 0,
          y % 2 === 0,
          x % 3 === 0,
          (x + y) % 3 === 0,
          (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
          ((x * y) % 2) + ((x * y) % 3) === 0,
          (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
          (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
        ][mask]
        if (invert) this.modules[y]![x] = !this.modules[y]![x]
      }
  }
  penalty(): number {
    const size = this.size
    const m = this.modules
    let result = 0
    const addHistory = (run: number, history: number[]) => {
      if (history[0] === 0) run += size
      history.pop()
      history.unshift(run)
    }
    const countPatterns = (h: number[]) => {
      const n = h[1]!
      const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n
      return (
        (core && h[0]! >= n * 4 && h[6]! >= n ? 1 : 0) +
        (core && h[6]! >= n * 4 && h[0]! >= n ? 1 : 0)
      )
    }
    const line = (get: (i: number) => boolean) => {
      let runColor = false
      let run = 0
      const history = [0, 0, 0, 0, 0, 0, 0]
      for (let i = 0; i < size; i++) {
        if (get(i) === runColor) {
          run++
          if (run === 5) result += 3
          else if (run > 5) result++
        } else {
          addHistory(run, history)
          if (!runColor) result += countPatterns(history) * 40
          runColor = get(i)
          run = 1
        }
      }
      if (runColor) {
        addHistory(run, history)
        run = 0
      }
      run += size
      addHistory(run, history)
      result += countPatterns(history) * 40
    }
    for (let y = 0; y < size; y++) line((x) => m[y]![x]!)
    for (let x = 0; x < size; x++) line((y) => m[y]![x]!)
    for (let y = 0; y < size - 1; y++)
      for (let x = 0; x < size - 1; x++) {
        const c = m[y]![x]
        if (c === m[y]![x + 1] && c === m[y + 1]![x] && c === m[y + 1]![x + 1]) result += 3
      }
    const dark = m.reduce((sum, row) => sum + row.filter(Boolean).length, 0)
    const total = size * size
    result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10
    return result
  }
}

/** Encodes `text` (UTF-8, byte mode) in the smallest version that fits, up to version 10. */
export function encodeQr(text: string, options: { ecc?: QrEcc; mask?: number } = {}): QrMatrix {
  const ecc = options.ecc ?? 'M'
  const bytes = new TextEncoder().encode(text)
  let version = 1
  while (
    version <= MAX_VERSION &&
    bytes.length + 2 + (version <= 9 ? 0 : 1) > dataCodewords(version, ecc)
  )
    version++
  if (version > MAX_VERSION) throw new Error('qr_too_long')
  const grid = new Grid(version)
  grid.drawFunctionPatterns(ecc)
  grid.drawCodewords(interleave(encodeData(bytes, version, ecc), version, ecc))
  let mask = options.mask ?? -1
  if (mask < 0) {
    let best = Infinity
    for (let i = 0; i < 8; i++) {
      grid.applyMask(i)
      grid.drawFormat(ecc, i)
      const penalty = grid.penalty()
      if (penalty < best) {
        best = penalty
        mask = i
      }
      grid.applyMask(i)
    }
  }
  grid.applyMask(mask)
  grid.drawFormat(ecc, mask)
  return grid.modules
}
