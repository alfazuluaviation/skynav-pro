import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute per IP

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIp = getClientIp(req);
  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    console.warn(`Rate limit exceeded for IP: ${clientIp}`);
    return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }), {
      status: 429,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Retry-After': String(rateCheck.retryAfter)
      },
    });
  }

  try {
    const { icaoCode } = await req.json();

    if (!icaoCode || typeof icaoCode !== 'string' || icaoCode.length !== 4) {
      return new Response(
        JSON.stringify({ success: false, error: 'Código ICAO inválido. Deve ter 4 caracteres.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedIcao = icaoCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    console.log(`Fetching charts for ICAO: ${sanitizedIcao}`);

    // Fetch charts from AISWEB public page
    const url = `https://aisweb.decea.mil.br/?i=cartas&codigo=${sanitizedIcao}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    if (!response.ok) {
      throw new Error(`AISWEB returned status ${response.status}`);
    }

    const html = await response.text();
    
    // Parse chart links from the HTML
    const charts: ChartInfo[] = [];
    
    // Match chart links in the format: href="/api/cartas/..."
    const chartLinkRegex = /<a[^>]*href="([^"]*\/api\/[^"]*\.pdf)"[^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = chartLinkRegex.exec(html)) !== null) {
      const link = match[1].startsWith('http') ? match[1] : `https://aisweb.decea.mil.br${match[1]}`;
      const nome = match[2].trim();
      
      // Extract chart type from the link or name
      let tipo = 'UNKNOWN';
      let tipo_descr = 'Carta Aeronáutica';
      
      const tipoMatch = nome.match(/^(ADC|AOC|ARC|GMC|IAC|LC|PDC|SID|STAR|VAC|PATC|OTR|ATCSMAC)/i);
      if (tipoMatch) {
        tipo = tipoMatch[1].toUpperCase();
        switch (tipo) {
          case 'ADC': tipo_descr = 'Aerodrome Chart'; break;
          case 'AOC': tipo_descr = 'Aircraft Operating Chart'; break;
          case 'ARC': tipo_descr = 'Area Chart'; break;
          case 'GMC': tipo_descr = 'Ground Movement Chart'; break;
          case 'IAC': tipo_descr = 'Instrument Approach Chart'; break;
          case 'LC': tipo_descr = 'Landing Chart'; break;
          case 'PDC': tipo_descr = 'Precision Approach Chart'; break;
          case 'SID': tipo_descr = 'Standard Instrument Departure'; break;
          case 'STAR': tipo_descr = 'Standard Terminal Arrival'; break;
          case 'VAC': tipo_descr = 'Visual Approach Chart'; break;
          case 'PATC': tipo_descr = 'Precision Approach Terrain Chart'; break;
          case 'OTR': tipo_descr = 'Obstacle/Terrain Chart'; break;
          case 'ATCSMAC': tipo_descr = 'ATC Surveillance Minimum Altitude Chart'; break;
        }
      }
      
      charts.push({
        id: `chart-${charts.length + 1}`,
        tipo,
        tipo_descr,
        nome,
        link,
        dt: new Date().toISOString().split('T')[0],
      });
    }

    // Alternative parsing for table-based layout
    if (charts.length === 0) {
      // Try to find chart info in table rows
      const tableRowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/tr>/gi;
      
      while ((match = tableRowRegex.exec(html)) !== null) {
        const nome = match[1].trim();
        let link = match[2];
        
        if (link.includes('.pdf')) {
          link = link.startsWith('http') ? link : `https://aisweb.decea.mil.br${link}`;
          
          let tipo = 'UNKNOWN';
          let tipo_descr = 'Carta Aeronáutica';
          
          const tipoMatch = nome.match(/^(ADC|AOC|ARC|GMC|IAC|LC|PDC|SID|STAR|VAC|PATC|OTR|ATCSMAC)/i);
          if (tipoMatch) {
            tipo = tipoMatch[1].toUpperCase();
            switch (tipo) {
              case 'ADC': tipo_descr = 'Aerodrome Chart'; break;
              case 'SID': tipo_descr = 'Standard Instrument Departure'; break;
              case 'STAR': tipo_descr = 'Standard Terminal Arrival'; break;
              case 'IAC': tipo_descr = 'Instrument Approach Chart'; break;
              case 'VAC': tipo_descr = 'Visual Approach Chart'; break;
              default: tipo_descr = 'Carta Aeronáutica';
            }
          }
          
          charts.push({
            id: `chart-${charts.length + 1}`,
            tipo,
            tipo_descr,
            nome,
            link,
            dt: new Date().toISOString().split('T')[0],
          });
        }
      }
    }

    // Generate direct links based on known DECEA URL patterns
    if (charts.length === 0) {
      // Fallback: Generate common chart types URLs
      const chartTypes = ['ADC', 'SID', 'STAR', 'IAC', 'VAC'];
      
      for (const tipo of chartTypes) {
        charts.push({
          id: `chart-${charts.length + 1}`,
          tipo,
          tipo_descr: tipo === 'ADC' ? 'Aerodrome Chart' : 
                     tipo === 'SID' ? 'Standard Instrument Departure' :
                     tipo === 'STAR' ? 'Standard Terminal Arrival' :
                     tipo === 'IAC' ? 'Instrument Approach Chart' :
                     'Visual Approach Chart',
          nome: `${tipo} - ${sanitizedIcao}`,
          link: `https://aisweb.decea.mil.br/?i=cartas&codigo=${sanitizedIcao}`,
          dt: new Date().toISOString().split('T')[0],
        });
      }
    }

    console.log(`Found ${charts.length} charts for ${sanitizedIcao}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        icao: sanitizedIcao,
        charts,
        aisweb_url: `https://aisweb.decea.mil.br/?i=cartas&codigo=${sanitizedIcao}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching charts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar cartas';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
