import { supabase } from "@/integrations/supabase/client";
import { AiracCycle, ChartConfig } from "../types";

export const syncAeronauticalData = async (): Promise<{ airac: AiracCycle, charts: ChartConfig[] }> => {
  const { data, error } = await supabase.functions.invoke('sync-aeronautical-data');
  
  if (error) {
    console.error("[GeminiService] Error calling sync-aeronautical-data:", error);
    throw error;
  }
  
  if (data?.error) {
    console.error("[GeminiService] API error:", data.error);
    throw new Error(data.error);
  }
  
  return data;
};

export const searchAerodrome = async (query: string): Promise<{ icao: string, name: string, lat: number, lng: number } | null> => {
  if (!query || query.trim().length < 2) {
    console.warn("[GeminiService] Query too short");
    return null;
  }
  
  const normalizedQuery = query.trim().toUpperCase();
  
  // Check cache first
  const cachedResult = localStorage.getItem(`aerodromeCache_${normalizedQuery}`);
  if (cachedResult) {
    try {
      console.log(`[GeminiService] Full aerodrome data for ${query} found in cache.`);
      return JSON.parse(cachedResult);
    } catch {
      // Invalid cache, continue with API call
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke('search-aerodrome', {
      body: { query: normalizedQuery }
    });
    
    if (error) {
      console.error(`[GeminiService] Error calling search-aerodrome:`, error);
      return null;
    }
    
    if (data?.error) {
      console.error(`[GeminiService] API error:`, data.error);
      return null;
    }
    
    console.log(`[GeminiService] searchAerodrome for "${query}" returned:`, data);

    // Cache the result
    if (data && data.icao) {
      localStorage.setItem(`aerodromeCache_${data.icao.toUpperCase()}`, JSON.stringify(data));
    }
    
    return data;
  } catch (e) {
    console.error(`[GeminiService] Error calling search-aerodrome for query "${query}":`, e);
    return null;
  }
};
