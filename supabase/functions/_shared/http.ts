// Shared HTTP helpers for Edge Functions: strict CORS (own origins only, PRD 6.15 A02)
// and generic errors (details only in server logs, never personal data).

const ALLOWED_ORIGINS = [
  /^https:\/\/nightlife-connect-beige\.vercel\.app$/,
  /^https:\/\/nightlife-connect(-[a-z0-9-]+)?-chaplications-projects\.vercel\.app$/,
  /^http:\/\/localhost:(5173|4173)$/,
  /^http:\/\/127\.0\.0\.1:(5173|4173)$/,
]

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.some((re) => re.test(origin))
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders(req) }) : null
}
