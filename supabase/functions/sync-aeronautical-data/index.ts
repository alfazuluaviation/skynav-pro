import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI, Type } from "npm:@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute per IP

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIp = getClientIp(req);
  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    console.warn(`Rate limit exceeded for IP: ${clientIp}`);
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
      status: 429,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Retry-After': String(rateCheck.retryAfter)
      },
    });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const ai = new GoogleGenAI({ apiKey });
    const today = new Date().toISOString();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Today is ${today}. 
      1. Identify the current active AIRAC cycle for Brazil (DECEA).
      2. Provide the exact GPS bounding box coordinates for the Brazil ENRC Low (ENRC L) and ENRC High (ENRC H) aeronautical charts. 
      3. The bounds must be in format [[lat_max, lng_min], [lat_min, lng_max]] covering the Brazilian FIR.
      4. Provide valid placeholder URLs for thumbnails if official ones are not known.
      5. Return a professional JSON structure.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            airac: {
              type: Type.OBJECT,
              properties: {
                current: { type: Type.STRING },
                effectiveDate: { type: Type.STRING },
                expiryDate: { type: Type.STRING },
                nextCycleDate: { type: Type.STRING },
              }
            },
            charts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  shortName: { type: Type.STRING },
                  type: { type: Type.STRING },
                  bounds: { 
                    type: Type.ARRAY,
                    items: { 
                      type: Type.ARRAY, 
                      items: { type: Type.NUMBER } 
                    }
                  },
                  thumbnail: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    const data = JSON.parse(text);
    const result = {
      airac: { ...data.airac, status: 'CURRENT' },
      charts: data.charts
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in sync-aeronautical-data:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
