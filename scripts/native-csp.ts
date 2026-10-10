/**
 * The web CSP lives in vercel.json (HTTP header). The Capacitor shell serves files
 * locally, so the same policy is injected as a <meta> tag, minus the directives a
 * meta CSP cannot carry (frame-ancestors, reporting, sandbox).
 */
export function nativeCsp(vercelJson: string): string {
  const config = JSON.parse(vercelJson) as {
    headers: { headers: { key: string; value: string }[] }[]
  }
  const policy = config.headers
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === 'Content-Security-Policy')?.value
  if (!policy) throw new Error('vercel.json has no Content-Security-Policy')
  return policy
    .split(';')
    .map((directive) => directive.trim())
    .filter(
      (directive) =>
        directive && !/^(frame-ancestors|report-uri|report-to|sandbox)\b/.test(directive),
    )
    .join('; ')
}
