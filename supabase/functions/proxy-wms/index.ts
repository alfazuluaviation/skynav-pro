import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BASE_WMS_URL = "https://geoaisweb.decea.mil.br/geoserver/wms";

// Rate limiting configuration
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 300; // 300 requests per minute per IP (higher for tiles)

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
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
         req.headers.get("x-real-ip") ||
         "unknown";
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Rate limiting check
  const clientIp = getClientIp(req);
  const rateLimitResult = checkRateLimit(clientIp);
  
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({ 
        error: "Rate limit exceeded", 
        retryAfter: rateLimitResult.retryAfter 
      }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Retry-After": String(rateLimitResult.retryAfter)
        } 
      }
    );
  }

  try {
    const url = new URL(req.url);
    
    // Get all query parameters and forward them to WMS
    const wmsParams = new URLSearchParams();
    
    // Required WMS parameters
    const requiredParams = ['service', 'request', 'layers', 'format', 'width', 'height', 'bbox', 'srs'];
    const optionalParams = ['version', 'transparent', 'styles', 'crs'];
    
    // Validate that we have the minimum required params for GetMap
    const request = url.searchParams.get('request');
    if (!request || request.toLowerCase() !== 'getmap') {
      return new Response(
        JSON.stringify({ error: "Only GetMap requests are supported" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Copy all parameters
    for (const [key, value] of url.searchParams.entries()) {
      wmsParams.set(key, value);
    }

    // Ensure service is WMS
    wmsParams.set('service', 'WMS');

    const wmsUrl = `${BASE_WMS_URL}?${wmsParams.toString()}`;
    
    const response = await fetch(wmsUrl, {
      headers: {
        "Accept": "image/png, image/jpeg, image/*",
        "User-Agent": "Mozilla/5.0 (compatible; SkyFPL/1.0)",
      },
    });

    if (!response.ok) {
      console.error(`[proxy-wms] GeoServer error: ${response.status}`);
      return new Response(
        `GeoServer returned ${response.status}`,
        { status: response.status, headers: corsHeaders }
      );
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/png";

    // Return the image with CORS headers and caching
    return new Response(imageBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error("[proxy-wms] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});