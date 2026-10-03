/** Bound memory before parsing untrusted JSON, including chunked requests. */
export async function boundedText(req: Request, limit: number): Promise<string> {
  if (!req.body) throw new Error('empty_body')
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > limit) {
        await reader.cancel()
        throw new Error('body_too_large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

export async function boundedJson(req: Request, limit: number): Promise<unknown> {
  return JSON.parse(await boundedText(req, limit))
}
