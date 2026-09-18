const ALLOWED_ORIGINS = new Set([
  'https://bontroc.fr',
  'https://www.bontroc.fr',
  'http://localhost:5173',
  'http://localhost:4173',
]);

/** En-têtes CORS : n'autorise que le site de production et le dev local. */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.has(origin) || /^https:\/\/[a-z0-9-]+--bontroc\.netlify\.app$/.test(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://bontroc.fr',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
    'Vary': 'Origin',
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}
