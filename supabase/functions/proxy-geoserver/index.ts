import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const BASE_WFS_URL = "https://geoaisweb.decea.mil.br/geoserver/wfs";

// Allowed layer names to prevent arbitrary endpoint access
const ALLOWED_LAYERS = ["ICA:airport", "ICA:waypoint", "ICA:vor", "ICA:ndb"];

// Extract error message from XML response
const extractXMLError = (xml: string): string => {
  // Try to extract ServiceException message
  const exceptionMatch = xml.match(/<ServiceException[^>]*>([\s\S]*?)<\/ServiceException>/i);
  if (exceptionMatch) {
    return exceptionMatch[1].trim();
  }
  // Try to extract ows:ExceptionText
  const owsMatch = xml.match(/<ows:ExceptionText>([\s\S]*?)<\/ows:ExceptionText>/i);
  if (owsMatch) {
    return owsMatch[1].trim();
  }
  return "Unknown GeoServer error";
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    
    // Get query parameters
    const typeName = url.searchParams.get("typeName");
    const bbox = url.searchParams.get("bbox");
    const cql_filter = url.searchParams.get("cql_filter");
    const maxFeatures = url.searchParams.get("maxFeatures") || "50";

    // Validate typeName
    if (!typeName || !ALLOWED_LAYERS.includes(typeName)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing typeName parameter" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Build WFS request parameters
    const params = new URLSearchParams({
      service: "WFS",
      version: "1.0.0",
      request: "GetFeature",
      typeName: typeName,
      outputFormat: "application/json",
      maxFeatures: maxFeatures,
    });

    // Add optional parameters
    if (bbox) {
      params.set("bbox", bbox);
    }
    if (cql_filter) {
      params.set("cql_filter", cql_filter);
    }

    const wfsUrl = `${BASE_WFS_URL}?${params.toString()}`;
    console.log(`[proxy-geoserver] Fetching: ${wfsUrl}`);

    const response = await fetch(wfsUrl, {
      headers: {
        "Accept": "application/json, application/geo+json, */*",
        "User-Agent": "Mozilla/5.0 (compatible; AeronavApp/1.0)",
      },
    });

    // Get response text first
    const responseText = await response.text();
    const contentType = response.headers.get("content-type") || "";

    console.log(`[proxy-geoserver] Response status: ${response.status}, Content-Type: ${contentType}`);

    // Check if response is XML (error from GeoServer)
    if (responseText.startsWith("<?xml") || responseText.startsWith("<")) {
      console.error(`[proxy-geoserver] GeoServer returned XML error: ${responseText.substring(0, 500)}`);
      const errorMessage = extractXMLError(responseText);
      
      // Return empty features array instead of error for graceful degradation
      return new Response(
        JSON.stringify({ 
          type: "FeatureCollection",
          features: [],
          _warning: `GeoServer error: ${errorMessage}`
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`[proxy-geoserver] Failed to parse response as JSON: ${responseText.substring(0, 200)}`);
      // Return empty features for graceful degradation
      return new Response(
        JSON.stringify({ 
          type: "FeatureCollection",
          features: [],
          _warning: "Failed to parse GeoServer response"
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    if (!response.ok) {
      console.error(`[proxy-geoserver] GeoServer error: ${response.status}`);
      return new Response(
        JSON.stringify({ 
          type: "FeatureCollection",
          features: [],
          _error: `GeoServer returned ${response.status}`
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[proxy-geoserver] Error:", error);
    // Return empty features for graceful degradation
    return new Response(
      JSON.stringify({ 
        type: "FeatureCollection",
        features: [],
        _error: String(error)
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
