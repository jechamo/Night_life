// Minimal text-only PDF 1.4 writer (Helvetica, WinAnsi). No dependency: the signed
// documents are plain text, so a full PDF library is not needed (ADR 0009).

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 50
const LINE_H = 15

// WinAnsi (cp1252) code points above 0x7F that differ from Latin-1.
const CP1252: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  '„': 0x84,
  '…': 0x85,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '™': 0x99,
}

function toWinAnsi(text: string): string {
  let out = ''
  for (const ch of text.normalize('NFC')) {
    const code = ch.codePointAt(0) ?? 63
    if (code === 0x2192) out += '->'
    else if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) out += String.fromCharCode(code)
    else if (CP1252[ch] !== undefined) out += String.fromCharCode(CP1252[ch])
    else out += '?'
  }
  return out
}

const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

export interface PdfLine {
  text: string
  size?: number
  bold?: boolean
  gapBefore?: number
}

/** Wraps by an average glyph width (Helvetica ≈ 0.5 em): good enough for body text. */
function wrap(text: string, size: number): string[] {
  const max = Math.floor((PAGE_W - 2 * MARGIN) / (size * 0.5))
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length > max) {
      if (current) lines.push(current)
      current = word
    } else {
      current = (current + ' ' + word).trim()
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

export function buildPdf(lines: readonly PdfLine[]): Uint8Array {
  const pages: string[][] = []
  let current: string[] = []
  pages.push(current)
  let y = PAGE_H - MARGIN
  for (const line of lines) {
    const size = line.size ?? 10
    y -= line.gapBefore ?? 0
    for (const part of wrap(toWinAnsi(line.text), size)) {
      if (y < MARGIN + LINE_H) {
        current = []
        pages.push(current)
        y = PAGE_H - MARGIN
      }
      const font = line.bold ? 'F2' : 'F1'
      current.push(`BT /${font} ${size} Tf ${MARGIN} ${y} Td (${escape(part)}) Tj ET`)
      y -= Math.max(LINE_H, size + 4)
    }
  }

  const objects: string[] = []
  const add = (body: string) => objects.push(body) // object number = index + 1
  add('<< /Type /Catalog /Pages 2 0 R >>')
  add('') // pages, filled below
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  const kids: string[] = []
  for (const content of pages) {
    const stream = content.join('\n')
    add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    const contentRef = objects.length
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentRef} 0 R >>`,
    )
    kids.push(`${objects.length} 0 R`)
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`

  let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

  // Every char is a single byte (0-255): Latin-1 bytes keep the xref offsets exact.
  const bytes = new Uint8Array(pdf.length)
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff
  return bytes
}
