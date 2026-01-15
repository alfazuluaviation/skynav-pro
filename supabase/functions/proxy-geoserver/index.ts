import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const BASE_WFS_URL = "https://geoaisweb.decea.mil.br/geoserver/wfs";

// Allowed layer names to prevent arbitrary endpoint access
const ALLOWED_LAYERS = ["ICA:airport", "ICA:waypoint", "ICA:vor", "ICA:ndb"];

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
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; AeronavApp/1.0)",
      },
    });

    if (!response.ok) {
      console.error(`[proxy-geoserver] GeoServer error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: `GeoServer returned ${response.status}` }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[proxy-geoserver] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch from GeoServer", details: String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
