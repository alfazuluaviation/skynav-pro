/* supabase/functions/download/index.ts
   Secure download proxy with JWT validation and CORS preflight handling */

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, apikey, Content-Type, x-client-info',
  'Access-Control-Max-Age': '600',
  'Vary': 'Origin',
};

Deno.serve(async (req: Request): Promise<Response> => {
  // --- CORS preflight handling ---
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse request and param
    const url = new URL(req.url);
    const arquivo = url.searchParams.get('arquivo') ?? '';

    // Validate arquivo parameter (UUID format)
    const uuidRegex = /^[0-9a-fA-F\-]{8,}$/;
    if (!arquivo || !uuidRegex.test(arquivo)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parâmetro "arquivo" inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase config (must be defined in function secrets)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('[download] Supabase URL/Anon key not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Server misconfigured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate token against Supabase /auth/v1/user (JWT validation)
    const userRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (!userRes.ok) {
      // Log status only, never log tokens
      console.warn('[download] Auth check failed, status:', userRes.status);
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // AIS credentials from environment (secrets)
    const AISKEY = Deno.env.get('AISWEB_API_KEY') ?? '';
    const AISPASS = Deno.env.get('AISWEB_API_PASS') ?? '';
    if (!AISKEY || !AISPASS) {
      console.error('[download] AISWEB credentials missing');
      return new Response(
        JSON.stringify({ success: false, error: 'Server misconfigured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build AIS URL and proxy the request (credentials stay server-side)
    const aisUrl = `https://aisweb.decea.gov.br/download/?arquivo=${encodeURIComponent(
      arquivo
    )}&apikey=${encodeURIComponent(AISKEY)}&apipass=${encodeURIComponent(AISPASS)}`;

    const aisRes = await fetch(aisUrl, { method: 'GET' });

    if (!aisRes.ok) {
      console.error('[download] AIS responded error, status:', aisRes.status);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao obter arquivo externo' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Forward stream to client with proper headers
    const responseHeaders = new Headers(corsHeaders);
    const contentType = aisRes.headers.get('content-type') || 'application/octet-stream';
    responseHeaders.set('Content-Type', contentType);
    
    const contentDisposition = aisRes.headers.get('content-disposition');
    if (contentDisposition) {
      responseHeaders.set('Content-Disposition', contentDisposition);
    }

    return new Response(aisRes.body, { status: 200, headers: responseHeaders });
    
  } catch (err) {
    // Log error without sensitive data
    console.error('[download] function error:', err instanceof Error ? err.message : 'Unknown error');
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
