import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AISWEB API Credentials (Static for public use discovered via site scripts)
const AISWEB_API_KEY = "1587263166";
const AISWEB_API_PASS = "3199249e-755b-1033-a49b-72567f175e3a";

interface RotaerData {
  icao: string;
  name: string;
  city: string;
  state: string;
  ciad: string;
  coordinates: string;
  elevation: string;
  type: string;
  operator: string;
  distanceFromCity: string;
  utc: string;
  operations: string;
  lighting: string[];
  fir: string;
  jurisdiction: string;
  runways: RunwayInfo[];
  communications: CommunicationInfo[];
  radioNav: string[];
  fuel: string;
  services: string;
  firefighting: string;
  meteorology: string[];
  ais: string[];
  remarks: RemarkSection[];
  declaredDistances: DeclaredDistance[];
  complements: string[];
  aiswebUrl: string;
  rawHeader?: string;
  notams?: string[];
}

interface RunwayInfo {
  designation: string;
  dimensions: string;
  surface: string;
  strength: string;
  lighting: string[];
}

interface CommunicationInfo {
  name: string;
  frequencies: string[];
}

interface RemarkSection {
  title: string;
  items: string[];
}

interface DeclaredDistance {
  runway: string;
  tora: string;
  toda: string;
  asda: string;
  lda: string;
  geoidal: string;
  coordinates: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
    const url = `https://aisweb.decea.mil.br/?i=aerodromos&codigo=${sanitizedIcao}`;

    // Parallel fetching: Scraping for ROTAER + API for NOTAM
    const [rotaerRes, notamRes] = await Promise.all([
      fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch(`https://aisweb.decea.mil.br/api/?apiKey=${AISWEB_API_KEY}&apiPass=${AISWEB_API_PASS}&area=notam&icaocode=${sanitizedIcao}&dist=N`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    ]);

    if (!rotaerRes.ok) throw new Error(`AISWEB ROTAER returned status ${rotaerRes.status}`);

    const html = await rotaerRes.text();
    const notamXml = notamRes.ok ? await notamRes.text() : "";

    const cleanHtmlForText = (raw: string) => {
      if (!raw) return '';
      return raw
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<td[^>]*>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&ccedil;/gi, 'c')
        .replace(/&atilde;/gi, 'a')
        .replace(/&otilde;/gi, 'o')
        .replace(/&Aacute;/gi, 'A')
        .replace(/&Eacute;/gi, 'E')
        .replace(/&Iacute;/gi, 'I')
        .replace(/&Oacute;/gi, 'O')
        .replace(/&Uacute;/gi, 'U')
        .replace(/&aacute;/gi, 'a')
        .replace(/&eacute;/gi, 'e')
        .replace(/&iacute;/gi, 'i')
        .replace(/&oacute;/gi, 'o')
        .replace(/&uacute;/gi, 'u')
        .replace(/\n\s*\n/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const rotaerBlockMatch = html.match(/<div[^>]*id="rotaer"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i);
    const rotaerHtml = rotaerBlockMatch ? rotaerBlockMatch[1].trim() : '';

    // Advanced NOTAM Parsing from XML
    let notams: string[] = [];
    if (notamXml) {
      // Manual extraction of items since we don't have a full XML parser in standard edge runtime without extra libs
      // but we can use reliable regex on this specific XML structure
      const itemMatches = notamXml.match(/<item>([\s\S]*?)<\/item>/gi);
      if (itemMatches) {
        notams = itemMatches.map(item => {
          const nMatch = item.match(/<n>(.*?)<\/n>/i);
          const bMatch = item.match(/<b>(.*?)<\/b>/i);
          const cMatch = item.match(/<c>(.*?)<\/c>/i);
          const dMatch = item.match(/<d>(.*?)<\/d>/i);
          const eMatch = item.match(/<e>(.*?)<\/e>/i);
          const codMatch = item.match(/<cod>(.*?)<\/cod>/i);
          const firMatch = item.match(/<fir>(.*?)<\/fir>/i);
          const trafficMatch = item.match(/<traffic>(.*?)<\/traffic>/i);
          const scopeMatch = item.match(/<scope>(.*?)<\/scope>/i);
          const lowerMatch = item.match(/<lower>(.*?)<\/lower>/i);
          const upperMatch = item.match(/<upper>(.*?)<\/upper>/i);
          const geoMatch = item.match(/<geo>(.*?)<\/geo>/i);

          const n = nMatch ? nMatch[1] : '';
          const b = bMatch ? bMatch[1] : '';
          const c = cMatch ? cMatch[1] : '';
          const d = dMatch ? dMatch[1] : '';
          const e = eMatch ? eMatch[1] : '';
          const fir = firMatch ? firMatch[1] : '';
          const cod = codMatch ? codMatch[1] : '';
          const traffic = trafficMatch ? trafficMatch[1] : 'IV';
          const scope = scopeMatch ? scopeMatch[1] : 'A';
          const lower = lowerMatch ? lowerMatch[1] : '000';
          const upper = upperMatch ? upperMatch[1] : '999';
          const geo = geoMatch ? geoMatch[1] : '';

          // Format following the "Official Document" look
          // Q) FIR/QCODE/TRAFFIC/PURPOSE/SCOPE/LOWER/UPPER/GEOCORDS
          const qLine = `Q) ${fir}/${cod}/${traffic}/BO/${scope}/${lower}/${upper}/${geo}`;

          let formatted = `${n}\n\n${qLine}\n${e}`;
          if (d) formatted += `\nORIGEM: AISWEB\n\nHORÁRIO: ${d}`;

          // Format validity: 2601200940 -> 20/01/26 09:40
          const formatAisDate = (raw: string) => {
            if (raw === 'PERM') return 'PERM';
            if (raw.length !== 10) return raw;
            return `${raw.substring(4, 6)}/${raw.substring(2, 4)}/${raw.substring(0, 2)} ${raw.substring(6, 8)}:${raw.substring(8, 10)}`;
          };

          formatted += `\nVIGÊNCIA: ${formatAisDate(b)} a ${formatAisDate(c)} UTC`;

          return formatted;
        });
      }
    }

    const nameMatch = html.match(/<h2[^>]*>([^<]+)- ([^<]+)<\/h2>/i);
    const name = nameMatch ? nameMatch[2].trim() : '';
    const cityState = nameMatch ? nameMatch[1].trim().split('/') : ['', ''];
    const city = cityState[0]?.trim() || '';
    const state = cityState[1]?.trim() || '';

    const coordsMatch = html.match(/Coordenadas:<\/strong>\s*([^<]+)/i);
    const elevMatch = html.match(/Eleva&ccedil;&atilde;o:<\/strong>\s*([^<]+)/i);
    const firMatch = html.match(/FIR:<\/strong>\s*([^<]+)/i);
    const utcMatch = html.match(/Fuso Hor&aacute;rio:<\/strong>\s*([^<]+)/i);

    const sections: Record<string, string> = {};
    const sectionRegex = /<h4[^>]*>([^<]+)<\/h4>([\s\S]*?)(?=<h4|$|<!--)/gi;
    let match;
    while ((match = sectionRegex.exec(html)) !== null) {
      sections[match[1].trim()] = match[2].trim();
    }

    const cleanHeaderHtml = (raw: string) => {
      return raw
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&ccedil;/gi, 'c')
        .replace(/&atilde;/gi, 'a')
        .replace(/&otilde;/gi, 'o')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l)
        .join('\n');
    };

    const cleanedRotaerText = cleanHtmlForText(rotaerHtml);
    const labels = ['COM', 'RDONAV', 'CMB', 'SER', 'RFFS', 'MET', 'AIS', 'RMK', 'COMPL'];
    const granularBlocks: string[] = [];

    let headerLinesText = cleanHeaderHtml(rotaerHtml);
    const firstLabelIndexHeader = Math.min(...labels.map(l => {
      const idx = headerLinesText.indexOf(`${l} -`);
      return idx === -1 ? Infinity : idx;
    }));

    let rawHeader = '';
    if (firstLabelIndexHeader !== Infinity) {
      rawHeader = headerLinesText.substring(0, firstLabelIndexHeader).trim();
    } else {
      rawHeader = headerLinesText;
    }

    labels.forEach((label, index) => {
      const currentMarker = `${label} -`;
      const startIdx = cleanedRotaerText.indexOf(currentMarker);
      if (startIdx === -1) return;

      let endIdx = cleanedRotaerText.length;
      labels.forEach(nextLabel => {
        const nextMarker = `${nextLabel} -`;
        const nIdx = cleanedRotaerText.indexOf(nextMarker, startIdx + currentMarker.length);
        if (nIdx !== -1 && nIdx < endIdx) {
          endIdx = nIdx;
        }
      });

      const content = cleanedRotaerText.substring(startIdx + currentMarker.length, endIdx).trim();
      if (content) {
        granularBlocks.push(`${label} - ${content}`);
      }
    });

    const runways: RunwayInfo[] = [];
    const pistasSource = sections['Pistas'];
    if (pistasSource) {
      const rwRegex = /<div class=\"row\">([\s\S]*?)<\/div>/gi;
      let rwMatch;
      while ((rwMatch = rwRegex.exec(pistasSource)) !== null) {
        const content = rwMatch[1];
        const desig = content.match(/<strong>Designa&ccedil;&atilde;o:<\/strong>\s*([^<]+)/i);
        const dim = content.match(/Comprimento x largura:<\/strong>\s*([^<]+)/i);
        const surf = content.match(/Pavimento:<\/strong>\s*([^<]+)/i);
        const strength = content.match(/For&ccedil;a de suporte/i) ? content.match(/For&ccedil;a de suporte:[^<]*<strong>([^<]+)/i) : null;

        if (desig) {
          runways.push({
            designation: desig[1].trim(),
            dimensions: dim ? dim[1].trim() : '',
            surface: surf ? surf[1].trim() : '',
            strength: strength ? strength[1].trim() : '',
            lighting: []
          });
        }
      }
    }

    const rotaerData: RotaerData = {
      icao: sanitizedIcao,
      name,
      city,
      state,
      ciad: '',
      coordinates: coordsMatch ? cleanHtmlForText(coordsMatch[1]) : '',
      elevation: elevMatch ? cleanHtmlForText(elevMatch[1]) : '',
      type: '',
      operator: '',
      distanceFromCity: '',
      utc: utcMatch ? cleanHtmlForText(utcMatch[1]) : '',
      operations: '',
      lighting: [],
      fir: firMatch ? cleanHtmlForText(firMatch[1]) : '',
      jurisdiction: '',
      runways,
      communications: [],
      radioNav: [],
      fuel: '',
      services: '',
      firefighting: '',
      meteorology: [],
      ais: [],
      remarks: [],
      declaredDistances: [],
      complements: granularBlocks,
      aiswebUrl: url,
      rawHeader: rawHeader,
      notams: notams
    };

    return new Response(
      JSON.stringify({ success: true, data: rotaerData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching ROTAER:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao buscar dados do ROTAER.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
