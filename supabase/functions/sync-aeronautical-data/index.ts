import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI, Type } from "npm:@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
