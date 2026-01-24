/* supabase/functions/download/index.ts
   Secure download proxy with JWT validation */
export async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const arquivo = url.searchParams.get('arquivo') ?? '';

    // 1) Validação básica do parâmetro 'arquivo' (UUID-like / GUID)
    const uuidRegex = /^[0-9a-fA-F\-]{8,}$/;
    if (!arquivo || !uuidRegex.test(arquivo)) {
      return new Response(JSON.stringify({ success: false, error: 'Parâmetro "arquivo" inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2) Validação de sessão (JWT) via endpoint /auth/v1/user do Supabase
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.split(' ')[1];

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('Supabase URL/Anon key not configured');
      return new Response(JSON.stringify({ success: false, error: 'Server misconfigured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verifica token no endpoint /auth/v1/user  retorna 200 se token válido
    const userRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (!userRes.ok) {
      console.warn('Auth check failed', userRes.status);
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3) Ler credenciais AIS do ambiente
    const AISKEY = Deno.env.get('AISWEB_API_KEY') ?? '';
    const AISPASS = Deno.env.get('AISWEB_API_PASS') ?? '';
    if (!AISKEY || !AISPASS) {
      console.error('AISWEB credentials missing');
      return new Response(JSON.stringify({ success: false, error: 'Server misconfigured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4) Montar a URL para o AIS (escape do arquivo e credenciais)
    const aisUrl = `https://aisweb.decea.gov.br/download/?arquivo=${encodeURIComponent(arquivo)}&apikey=${encodeURIComponent(AISKEY)}&apipass=${encodeURIComponent(AISPASS)}`;

    // 5) Fazer fetch ao AIS (stream) e repassar o conteúdo
    const aisRes = await fetch(aisUrl, { method: 'GET' });

    if (!aisRes.ok) {
      const snippet = await aisRes.text().then(t => t.slice(0, 300)).catch(() => '');
      console.error('AIS responded error', aisRes.status, snippet);
      return new Response(JSON.stringify({ success: false, error: 'Erro ao obter arquivo externo' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Preparar headers a serem encaminhados ao cliente
    const headers = new Headers();
    const contentType = aisRes.headers.get('content-type') || 'application/octet-stream';
    headers.set('Content-Type', contentType);
    const cd = aisRes.headers.get('content-disposition');
    if (cd) headers.set('Content-Disposition', cd);

    // CORS: usar ALLOWED_ORIGIN se definido, senão usar origin da request
    const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '';
    if (ALLOWED_ORIGIN) {
      headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    } else {
      const reqOrigin = req.headers.get('origin') ?? '*';
      headers.set('Access-Control-Allow-Origin', reqOrigin);
    }
    headers.set('Vary', 'Origin');

    // Retornar stream diretamente (preserva memória)
    return new Response(aisRes.body, { status: 200, headers });
  } catch (err) {
    console.error('download function error', err);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
