import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Input validation
const validateIcaoCode = (code: string): { valid: boolean; error?: string } => {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'ICAO code is required' };
  }
  
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length !== 4) {
    return { valid: false, error: 'ICAO code must be exactly 4 characters' };
  }
  
  if (!/^[A-Z]{4}$/.test(trimmed)) {
    return { valid: false, error: 'ICAO code must contain only letters' };
  }
  
  return { valid: true };
};

const cleanText = (text: string): string => {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
};

const parseRotaerTable = (doc: ReturnType<DOMParser['parseFromString']>): Partial<RotaerData> => {
  const data: Partial<RotaerData> = {};
  
  // Get main ROTAER table
  const rotaerDiv = doc?.querySelector('#rotaer') || doc?.querySelector('.rotaer');
  if (!rotaerDiv) {
    console.log("ROTAER div not found");
    return data;
  }

  const table = rotaerDiv.querySelector('table.rotaer');
  if (!table) {
    console.log("ROTAER table not found");
    return data;
  }

  // Parse name and location from title
  const titleSpan = table.querySelector('strong.title');
  if (titleSpan) {
    const titleText = cleanText(titleSpan.textContent || '');
    const match = titleText.match(/^(.+?)\s*\(\s*([A-Z]{4})\s*\)\s*\/\s*(.+?),\s*([A-Z]{2})$/);
    if (match) {
      data.name = match[1].trim();
      data.icao = match[2];
      data.city = match[3].trim();
      data.state = match[4];
    }
  }

  // Parse coordinates and elevation
  const rows = table.querySelectorAll('tr');
  for (const row of rows) {
    const rowElement = row as Element;
    const cells = rowElement.querySelectorAll('td');
    if (cells.length >= 2) {
      const cell0Text = cleanText((cells[0] as Element).textContent || '');
      const cell1Text = cleanText((cells[1] as Element).textContent || '');
      
      // Coordinates (format: 23 26 08S/046 28 23W)
      if (/^\d{2}\s+\d{2}\s+\d{2}[NS]\/\d{3}\s+\d{2}\s+\d{2}[EW]$/.test(cell1Text)) {
        data.coordinates = cell1Text;
      }
      
      // Elevation (format: 750 (2461))
      if (/^\d+\s*\(\d+\)$/.test(cell1Text)) {
        data.elevation = cell1Text;
      }
      
      // FIR and Jurisdiction
      if (cell1Text.includes('SBBS') || cell1Text.includes('SBCW') || cell1Text.includes('SBAZ') || cell1Text.includes('SBRE')) {
        const firMatch = cell1Text.match(/([A-Z]{4})\s*\(([^)]+)\)/);
        if (firMatch) {
          data.fir = firMatch[1];
          data.jurisdiction = firMatch[2];
        }
      }
      
      // Type, Operator, etc.
      if (cell0Text.includes('AD ') || cell0Text.includes('INTL') || cell0Text.includes('PUB')) {
        data.type = cell0Text;
        // Extract specific parts
        const parts = cell0Text.split(/\s+/);
        const utcMatch = cell0Text.match(/UTC[+-]?\d+/);
        if (utcMatch) data.utc = utcMatch[0];
        
        if (cell0Text.includes('VFR') || cell0Text.includes('IFR')) {
          const opsMatch = cell0Text.match(/(VFR|IFR)(\s+(VFR|IFR))?/g);
          if (opsMatch) data.operations = opsMatch.join(' ');
        }
      }
    }
  }

  // Parse runways
  data.runways = [];
  const runwayParagraphs = table.querySelectorAll('p');
  for (const p of runwayParagraphs) {
    const text = cleanText((p as Element).textContent || '');
    const runwayMatch = text.match(/^(\d{2}[LRC]?)\s*-(.+)-\s*(\d{2}[LRC]?)$/);
    if (runwayMatch) {
      const runwayContent = runwayMatch[2];
      const dimMatch = runwayContent.match(/(\d+x\d+)/);
      const surfMatch = runwayContent.match(/(ASPH|CONC|GRVL|GRASS)/i);
      
      data.runways.push({
        designation: `${runwayMatch[1]}/${runwayMatch[3]}`,
        dimensions: dimMatch ? dimMatch[1] : '',
        surface: surfMatch ? surfMatch[1] : '',
        strength: '',
        lighting: []
      });
    }
  }

  // Parse communications
  data.communications = [];
  const comTable = table.querySelector('td strong:contains("COM")');
  const comRows = table.querySelectorAll('tr');
  for (const row of comRows) {
    const rowElement = row as Element;
    const tdText = cleanText(rowElement.textContent || '');
    if (tdText.includes('COM -')) {
      const comDiv = rowElement.querySelectorAll('div');
      for (const div of comDiv) {
        const divText = cleanText((div as Element).textContent || '');
        const freqMatch = divText.match(/^([A-Z\s]+?)\s+([\d.]+(?:\s+[\d.]+)*)/);
        if (freqMatch) {
          const frequencies = freqMatch[2].split(/\s+/).filter(f => /^\d{3}\.\d{3}$/.test(f) || /^\d{2,3}\.\d+$/.test(f));
          if (frequencies.length > 0) {
            data.communications.push({
              name: freqMatch[1].trim(),
              frequencies
            });
          }
        }
      }
      break;
    }
  }

  // Parse radio navigation aids
  data.radioNav = [];
  for (const row of comRows) {
    const rowElement = row as Element;
    const tdText = cleanText(rowElement.textContent || '');
    if (tdText.includes('RDONAV -')) {
      const divs = rowElement.querySelectorAll('div');
      for (const div of divs) {
        const text = cleanText((div as Element).textContent || '');
        if (text.includes('ILS') || text.includes('VOR') || text.includes('NDB') || text.includes('DME') || text.includes('IM') || text.includes('OM') || text.includes('MM')) {
          data.radioNav.push(text);
        }
      }
      break;
    }
  }

  // Parse fuel and services
  for (const row of comRows) {
    const tdText = cleanText((row as Element).textContent || '');
    if (tdText.includes('CMB-') || tdText.includes('CMB -')) {
      const fuelMatch = tdText.match(/CMB[- ]+([^S]+)/);
      if (fuelMatch) data.fuel = fuelMatch[1].trim();
      
      const svcMatch = tdText.match(/SER\s*-\s*([^\s]+)/);
      if (svcMatch) data.services = svcMatch[1].trim();
      
      const rffsMatch = tdText.match(/RFFS\s*-\s*([^C]*CAT[^-]+[-\s]*\d+)/i);
      if (rffsMatch) data.firefighting = rffsMatch[1].trim();
      break;
    }
  }

  // Parse MET info
  data.meteorology = [];
  for (const row of comRows) {
    const tdText = cleanText((row as Element).textContent || '');
    if (tdText.includes('MET -') || tdText.includes('MET CIVIL')) {
      const metContent = tdText.replace(/MET\s*-?\s*/, '');
      data.meteorology.push(metContent.trim());
      break;
    }
  }

  // Parse AIS info  
  data.ais = [];
  for (const row of comRows) {
    const tdText = cleanText((row as Element).textContent || '');
    if (tdText.includes('AIS -') || tdText.includes('AIS CIVIL')) {
      const aisContent = tdText.replace(/AIS\s*-?\s*/, '');
      data.ais.push(aisContent.trim());
      break;
    }
  }

  // Parse remarks sections
  data.remarks = [];
  const remarkHeaders = table.querySelectorAll('h5.mb-0');
  for (const header of remarkHeaders) {
    const title = cleanText((header as Element).textContent || '');
    const nextOl = (header as Element).nextElementSibling;
    if (nextOl && nextOl.tagName === 'OL') {
      const items: string[] = [];
      const lis = nextOl.querySelectorAll('li');
      for (const li of lis) {
        const text = cleanText((li as Element).textContent || '');
        if (text && text !== ' ') {
          items.push(text);
        }
      }
      if (items.length > 0) {
        data.remarks.push({ title, items });
      }
    }
  }

  // Parse declared distances
  data.declaredDistances = [];
  const distTable = table.querySelector('#dist_declarada');
  if (distTable) {
    const distRows = distTable.querySelectorAll('tbody tr');
    for (const row of distRows) {
      const rowElement = row as Element;
      const cells = rowElement.querySelectorAll('td');
      if (cells.length >= 7) {
        data.declaredDistances.push({
          runway: cleanText((cells[0] as Element).textContent || ''),
          tora: cleanText((cells[1] as Element).textContent || ''),
          toda: cleanText((cells[2] as Element).textContent || ''),
          asda: cleanText((cells[3] as Element).textContent || ''),
          lda: cleanText((cells[4] as Element).textContent || ''),
          geoidal: cleanText((cells[5] as Element).textContent || ''),
          coordinates: cleanText((cells[6] as Element).textContent || '').replace(/<br\s*\/?>/g, ' ')
        });
      }
    }
  }

  // Parse complements
  data.complements = [];
  for (const row of comRows) {
    const rowElement = row as Element;
    const tdText = cleanText(rowElement.textContent || '');
    if (tdText.includes('COMPL -')) {
      const lis = rowElement.querySelectorAll('li');
      for (const li of lis) {
        const text = cleanText((li as Element).textContent || '');
        if (text) {
          data.complements.push(text);
        }
      }
      break;
    }
  }

  return data;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { icaoCode } = await req.json();
    
    // Validate input
    const validation = validateIcaoCode(icaoCode);
    if (!validation.valid) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: validation.error 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedCode = icaoCode.trim().toUpperCase();
    const aiswebUrl = `https://aisweb.decea.mil.br/?i=aerodromos&codigo=${normalizedCode}`;
    
    console.log(`Fetching ROTAER data for ${normalizedCode} from ${aiswebUrl}`);
    
    // Fetch the AISWEB page
    const response = await fetch(aiswebUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch AISWEB page: ${response.status}`);
    }

    const html = await response.text();
    
    // Check if aerodrome exists
    if (html.includes('não encontrado') || html.includes('Aeródromo não encontrado') || html.includes('não há informações')) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Aeródromo ${normalizedCode} não encontrado` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('Failed to parse HTML');
    }

    // Extract CIAD from header
    let ciad = '';
    const ciadMatch = html.match(/CIAD:\s*<strong[^>]*>([^<]+)<\/strong>/);
    if (ciadMatch) {
      ciad = ciadMatch[1].trim();
    }

    // Extract name from h1
    let fullName = '';
    const h1 = doc.querySelector('h1');
    if (h1) {
      const h1Text = cleanText(h1.textContent || '');
      const nameMatch = h1Text.match(/^([^(]+)\s*\([A-Z]{4}\)/);
      if (nameMatch) {
        fullName = nameMatch[1].trim();
      }
    }

    // Parse ROTAER table
    const rotaerData = parseRotaerTable(doc);
    
    // Merge extracted data
    const result: RotaerData = {
      icao: normalizedCode,
      name: fullName || rotaerData.name || normalizedCode,
      city: rotaerData.city || '',
      state: rotaerData.state || '',
      ciad: ciad,
      coordinates: rotaerData.coordinates || '',
      elevation: rotaerData.elevation || '',
      type: rotaerData.type || '',
      operator: '',
      distanceFromCity: '',
      utc: rotaerData.utc || 'UTC-3',
      operations: rotaerData.operations || '',
      lighting: rotaerData.lighting || [],
      fir: rotaerData.fir || '',
      jurisdiction: rotaerData.jurisdiction || '',
      runways: rotaerData.runways || [],
      communications: rotaerData.communications || [],
      radioNav: rotaerData.radioNav || [],
      fuel: rotaerData.fuel || '',
      services: rotaerData.services || '',
      firefighting: rotaerData.firefighting || '',
      meteorology: rotaerData.meteorology || [],
      ais: rotaerData.ais || [],
      remarks: rotaerData.remarks || [],
      declaredDistances: rotaerData.declaredDistances || [],
      complements: rotaerData.complements || [],
      aiswebUrl
    };

    console.log(`Successfully parsed ROTAER for ${normalizedCode}`);

    return new Response(JSON.stringify({ 
      success: true, 
      data: result 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-rotaer:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
