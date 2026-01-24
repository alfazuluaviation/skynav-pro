/* supabase/functions/download/index.ts
   Secure download proxy with JWT validation and CORS preflight handling */

export async function handler(req: Request): Promise<Response> {
  try {
    // --- CORS preflight handling ---
    if (req.method === 'OPTIONS') {
      const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
      const headers = new Headers();
      headers.set('Access-Control-Allow-Origin', allowedOrigin);
      headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Authorization, apikey, Content-Type');
      headers.set('Access-Control-Max-Age', '600');
      headers.set('Vary', 'Origin');
      return new Response(null, { status: 204, headers });
    }

    // Parse request and param
    const url = new URL(req.url);
    const arquivo = url.searchParams.get('arquivo') ?? '';

    const uuidRegex = /^[0-9a-fA-F\-]{8,}$/;
    if (!arquivo || !uuidRegex.test(arquivo)) {
      const respHeaders = new Headers({ 'Content-Type': 'application/json' });
      const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? (req.headers.get('origin') ?? '*');
      respHeaders.set('Access-Control-Allow-Origin', allowedOrigin);
      respHeaders.set('Vary', 'Origin');
      return new Response(JSON.stringify({ success: false, error: 'Parâmetro "arquivo" inválido' }), {
        status: 400,
        headers: respHeaders,
      });
    }

    // --- Accept token from Authorization header OR cookie sb-<project>-auth-token ---
    let token = '';
    const authHeader = (req.headers.get('authorization') || '').trim();
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      const cookieHeader = req.headers.get('cookie') || '';
      const cookieMatch = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/);
      if (cookieMatch) token = decodeURIComponent(cookieMatch[1]);
    }

    const reqOrigin = req.headers.get('origin') ?? '*';
    const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? reqOrigin;

    if (!token) {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      headers.set('Access-Control-Allow-Origin', allowedOrigin);
      headers.set('Vary', 'Origin');
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), {
        status: 401,
        headers,
      });
    }

    // Supabase config (must be defined in function secrets)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('Supabase URL/Anon key not configured');
      const headers = new Headers({ 'Content-Type': 'application/json' });
      headers.set('Access-Control-Allow-Origin', allowedOrigin);
      headers.set('Vary', 'Origin');
      return new Response(JSON.stringify({ success: false, error: 'Server misconfigured' }), {
        status: 500,
        headers,
      });
    }

    // Validate token against Supabase /auth/v1/user
    const userRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    // diagnostic snippet (safe): small body snippet and status (DO NOT log token)
    const userText = await userRes.text().catch(() => '');
    console.warn('Auth check status', userRes.status, 'bodySnippet:', userText.slice(0, 300));

    if (!userRes.ok) {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      headers.set('Access-Control-Allow-Origin', allowedOrigin);
      headers.set('Vary', 'Origin');
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), {
        status: 401,
        headers,
      });
    }

    // AIS credentials
    const AISKEY = Deno.env.get('AISWEB_API_KEY') ?? '';
    const AISPASS = Deno.env.get('AISWEB_API_PASS') ?? '';
    if (!AISKEY || !AISPASS) {
      console.error('AISWEB credentials missing');
      const headers = new Headers({ 'Content-Type': 'application/json' });
      headers.set('Access-Control-Allow-Origin', allowedOrigin);
      headers.set('Vary', 'Origin');
      return new Response(JSON.stringify({ success: false, error: 'Server misconfigured' }), {
        status: 500,
        headers,
      });
    }

    // Build AIS URL and proxy the request
    const aisUrl = `https://aisweb.decea.gov.br/download/?arquivo=${encodeURIComponent(
      arquivo,
    )}&apikey=${encodeURIComponent(AISKEY)}&apipass=${encodeURIComponent(AISPASS)}`;

    const aisRes = await fetch(aisUrl, { method: 'GET' });

    if (!aisRes.ok) {
      const snippet = await aisRes.text().then(t => t.slice(0, 300)).catch(() => '');
      console.error('AIS responded error', aisRes.status, snippet);
      const headers = new Headers({ 'Content-Type': 'application/json' });
      headers.set('Access-Control-Allow-Origin', allowedOrigin);
      headers.set('Vary', 'Origin');
      return new Response(JSON.stringify({ success: false, error: 'Erro ao obter arquivo externo' }), {
        status: 502,
        headers,
      });
    }

    // Forward stream to client and set CORS
    const headers = new Headers();
    const contentType = aisRes.headers.get('content-type') || 'application/octet-stream';
    headers.set('Content-Type', contentType);
    const cd = aisRes.headers.get('content-disposition');
    if (cd) headers.set('Content-Disposition', cd);

    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Vary', 'Origin');

    return new Response(aisRes.body, { status: 200, headers });
  } catch (err) {
    console.error('download function error', err);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.set('Access-Control-Allow-Origin', Deno.env.get('ALLOWED_ORIGIN') ?? '*');
    headers.set('Vary', 'Origin');
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers,
    });
  }
}
