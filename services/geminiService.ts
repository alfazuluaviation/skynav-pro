
import { GoogleGenAI, Type } from "@google/genai";
import { Waypoint, AiracCycle, ChartConfig } from "../types";

export const syncAeronauticalData = async (): Promise<{ airac: AiracCycle, charts: ChartConfig[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const today = new Date().toISOString();
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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

  const data = JSON.parse(response.text.trim());
  return {
    airac: { ...data.airac, status: 'CURRENT' },
    charts: data.charts
  };
};

export const searchAerodrome = async (query: string): Promise<{ icao: string, name: string, lat: number, lng: number } | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Encontre as coordenadas e o nome oficial do aeródromo ou ponto aeronáutico: ${query}. Forneça apenas dados reais e precisos para navegação aérea no Brasil.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          icao: { type: Type.STRING },
          name: { type: Type.STRING },
          lat: { type: Type.NUMBER },
          lng: { type: Type.NUMBER }
        },
        required: ["icao", "name", "lat", "lng"]
      }
    }
  });

  try {
    return JSON.parse(response.text.trim());
  } catch (e) {
    return null;
  }
};
