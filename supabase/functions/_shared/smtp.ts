// Minimal SMTP client over implicit TLS (port 465; Edge Functions block 25/587). Used to
// send the signed PDF from the owner's Gmail with an app password (ADR 0009). The
// recipient comes from Supabase Auth (confirmed email), never from the request body.

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function b64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
const b64Text = (text: string) => b64(encoder.encode(text))
const wrap76 = (s: string) => s.replace(/.{1,76}/g, '$&\r\n')
const clean = (s: string) => s.replace(/[\r\n]/g, '')

export interface Mail {
  to: string
  subject: string
  text: string
  attachment?: { filename: string; contentType: string; bytes: Uint8Array }
}

export async function sendMail(
  config: { host: string; port: number; user: string; password: string; fromName: string },
  mail: Mail,
): Promise<void> {
  const conn = await Deno.connectTls({ hostname: config.host, port: config.port })
  let buffer = ''
  const readReply = async (): Promise<string> => {
    const chunk = new Uint8Array(4096)
    for (;;) {
      const lines = buffer.split('\r\n')
      const done = lines.findIndex((l) => /^\d{3} /.test(l))
      if (done >= 0) {
        const reply = lines.slice(0, done + 1).join('\n')
        buffer = lines.slice(done + 1).join('\r\n')
        return reply
      }
      const n = await conn.read(chunk)
      if (n === null) throw new Error('smtp_closed')
      buffer += decoder.decode(chunk.subarray(0, n))
    }
  }
  const command = async (line: string, expect: string) => {
    await conn.write(encoder.encode(line + '\r\n'))
    const reply = await readReply()
    if (!reply.split('\n').at(-1)?.startsWith(expect)) throw new Error(`smtp_${expect}`)
  }

  try {
    if (!(await readReply()).startsWith('220')) throw new Error('smtp_greeting')
    await command('EHLO nightlife-connect', '250')
    await command('AUTH LOGIN', '334')
    await command(b64Text(config.user), '334')
    await command(b64Text(config.password), '235')
    await command(`MAIL FROM:<${clean(config.user)}>`, '250')
    await command(`RCPT TO:<${clean(mail.to)}>`, '250')
    await command('DATA', '354')

    const boundary = `nl-${crypto.randomUUID()}`
    const headers = [
      `From: =?UTF-8?B?${b64Text(config.fromName)}?= <${clean(config.user)}>`,
      `To: <${clean(mail.to)}>`,
      `Subject: =?UTF-8?B?${b64Text(clean(mail.subject))}?=`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@nightlife-connect>`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ]
    const parts = [
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(b64Text(mail.text)),
    ]
    if (mail.attachment) {
      parts.push(
        `--${boundary}`,
        `Content-Type: ${mail.attachment.contentType}; name="${mail.attachment.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${mail.attachment.filename}"`,
        '',
        wrap76(b64(mail.attachment.bytes)),
      )
    }
    parts.push(`--${boundary}--`, '')
    // Base64 bodies never start a line with "." so no dot-stuffing is needed.
    const message = [...headers, '', ...parts].join('\r\n')
    await conn.write(encoder.encode(message + '\r\n.\r\n'))
    if (!(await readReply()).startsWith('250')) throw new Error('smtp_data')
    await conn.write(encoder.encode('QUIT\r\n'))
  } finally {
    conn.close()
  }
}
