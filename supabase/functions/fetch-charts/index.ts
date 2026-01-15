import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 60;

const checkRateLimit = (clientIp: string): { allowed: boolean; retryAfter?: number } => {
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count++;
  return { allowed: true };
};

const getClientIp = (req: Request): string => {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
};

interface ChartInfo {
  id: string;
  tipo: string;
  tipo_descr: string;
  nome: string;
  link: string;
  dt: string;
}

const getChartDescription = (tipo: string): string => {
  const descriptions: Record<string, string> = {
    'ADC': 'Aerodrome Chart',
    'AOC': 'Aerodrome Obstacle Chart',
    'ARC': 'Area Chart',
    'GMC': 'Ground Movement Chart',
    'IAC': 'Instrument Approach Chart',
    'LC': 'Landing Chart',
    'PDC': 'Precision Approach Chart',
    'SID': 'Standard Instrument Departure',
    'STAR': 'Standard Terminal Arrival',
    'VAC': 'Visual Approach Chart',
    'PATC': 'Precision Approach Terrain Chart',
    'OTR': 'Obstacle/Terrain Chart',
    'ATCSMAC': 'ATC Surveillance Minimum Altitude Chart',
  };
  return descriptions[tipo.toUpperCase()] || 'Carta Aeronáutica';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = getClientIp(req);
  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { icaoCode } = await req.json();

    if (!icaoCode || typeof icaoCode !== 'string' || icaoCode.length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: 'Código ICAO inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedIcao = icaoCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const charts: ChartInfo[] = [];

    // Attempt to fetch from Aerodromos page (better categorized)
    const url = `https://aisweb.decea.mil.br/?i=aerodromos&codigo=${sanitizedIcao}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    if (response.ok) {
      const html = await response.text();

      // Extract the "Cartas" section more robustly
      // Categories also use h4, so we capture until the next h2 or h3 or some other major block
      const chartsSectionMatch = html.match(/<h4[^>]*>Cartas\s*[(]\d+[)]<\/h4>([\s\S]*?)(?:<h2|<h3|$)/i);

      if (chartsSectionMatch) {
        const sectionHtml = chartsSectionMatch[1];

        // Split by <h4> labels which are the categories (ADC, SID, etc.)
        const categoryBlocks = sectionHtml.split(/<h4[^>]*>/i);

        categoryBlocks.forEach((block, index) => {
          if (index === 0) return; // content before first <h4>

          const categoryMatch = block.match(/^([^<]+)<\/h4>([\s\S]*)$/i);
          if (!categoryMatch) return;

          const tipo = categoryMatch[1].trim();
          const blockContent = categoryMatch[2];
          const tipo_descr = getChartDescription(tipo);

          const linkRegex = /<a[^>]*href=\"([^\"]*download[^\"]*)\"[^>]*>([\s\S]*?)<\/a>/gi;
          let linkMatch;

          while ((linkMatch = linkRegex.exec(blockContent)) !== null) {
            const link = linkMatch[1];
            let label = linkMatch[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

            charts.push({
              id: `chart-${charts.length + 1}`,
              tipo,
              tipo_descr,
              nome: label,
              link: link.startsWith('http') ? link : `https://aisweb.decea.mil.br${link.startsWith('/') ? '' : '/'}${link}`,
              dt: new Date().toISOString().split('T')[0],
            });
          }
        });
      }
    }

    // Smart filtering:
    // 1. If a chart name contains an ICAO-like code (4 letters), it MUST be the requested one.
    // 2. If it contains NO ICAO-like code, assume it's valid for this airport (common for IAC/STAR).
    const filteredCharts = charts.filter(chart => {
      const nameUpper = chart.nome.toUpperCase();
      // Match 4-letter codes that start with S or other known Brazilian ICAO prefixes
      const icaoMatches = nameUpper.match(/\b[S][A-ZW][A-Z0-9]{2}\b/g);

      if (icaoMatches) {
        return icaoMatches.includes(sanitizedIcao);
      }
      return true;
    }).map(chart => {
      let cleanNome = chart.nome;
      const type = chart.tipo.toUpperCase();

      // Fix label duplication like "ADC SBSV ADC" -> "SBSV ADC"
      if (cleanNome.toUpperCase().includes(`${type} `) && cleanNome.toUpperCase().endsWith(` ${type}`)) {
        cleanNome = cleanNome.substring(0, cleanNome.length - type.length).trim();
      }

      return { ...chart, nome: cleanNome };
    });

    // Fallback to table search ONLY if still no charts found
    if (filteredCharts.length === 0) {
      const searchUrl = `https://aisweb.decea.mil.br/?i=cartas&codigo=${sanitizedIcao}`;
      const searchResp = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (searchResp.ok) {
        const searchHtml = await searchResp.text();
        const tableRowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<a[^>]*href="([^"]*download[^"]*)"/gi;
        let m;
        while ((m = tableRowRegex.exec(searchHtml)) !== null) {
          const tipo = m[2].trim();
          const nome = m[3].trim();

          // Strict filtering even in fallback
          if (nome.toUpperCase().includes(sanitizedIcao)) {
            const link = m[4].startsWith('http') ? m[4] : `https://aisweb.decea.mil.br${m[4].startsWith('/') ? '' : '/'}${m[4]}`;
            filteredCharts.push({
              id: `chart-${filteredCharts.length + 1}`,
              tipo,
              tipo_descr: getChartDescription(tipo),
              nome,
              link,
              dt: new Date().toISOString().split('T')[0],
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        icao: sanitizedIcao,
        charts: filteredCharts,
        aisweb_url: `https://aisweb.decea.mil.br/?i=aerodromos&codigo=${sanitizedIcao}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching charts:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao buscar cartas.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
