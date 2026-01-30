/**
 * Google Drive Proxy Edge Function
 * 
 * Proxies downloads from Google Drive to bypass CORS restrictions.
 * This is specifically for the MBTiles package downloads.
 * NO authentication required - public files only.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-client-info',
  'Access-Control-Max-Age': '600',
};

// Known file IDs for security (whitelist approach)
const ALLOWED_FILE_IDS = new Set([
  '1WIIbuiR4SLwpQ-PexKhHBwAb8fwoePQs', // ENRC LOW MBTiles package
]);

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const url = new URL(req.url);
    const fileId = url.searchParams.get('fileId');

    if (!fileId) {
      return new Response(
        JSON.stringify({ error: 'Missing fileId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Security: only allow whitelisted file IDs
    if (!ALLOWED_FILE_IDS.has(fileId)) {
      console.warn(`[proxy-gdrive] Blocked request for non-whitelisted file: ${fileId}`);
      return new Response(
        JSON.stringify({ error: 'File not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[proxy-gdrive] Starting download for file: ${fileId}`);

    // Google Drive direct download URL with confirmation bypass for large files
    const gdriveUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;

    const response = await fetch(gdriveUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error(`[proxy-gdrive] Google Drive error: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ error: `Google Drive error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we got HTML (virus scan page) instead of the file
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      // Try alternative URL format
      const altUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
      console.log(`[proxy-gdrive] Trying alternative URL...`);
      
      const altResponse = await fetch(altUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!altResponse.ok || (altResponse.headers.get('content-type') || '').includes('text/html')) {
        console.error(`[proxy-gdrive] Could not bypass virus scan page`);
        return new Response(
          JSON.stringify({ error: 'File requires manual virus scan confirmation' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Return the alternative response
      const responseHeaders = new Headers(corsHeaders);
      responseHeaders.set('Content-Type', altResponse.headers.get('content-type') || 'application/octet-stream');
      
      const contentLength = altResponse.headers.get('content-length');
      if (contentLength) {
        responseHeaders.set('Content-Length', contentLength);
      }
      
      responseHeaders.set('Content-Disposition', `attachment; filename="ENRC_LOW_2026_01.zip"`);

      console.log(`[proxy-gdrive] Streaming file via alternative URL, size: ${contentLength || 'unknown'}`);
      return new Response(altResponse.body, { status: 200, headers: responseHeaders });
    }

    // Forward the response with CORS headers
    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set('Content-Type', contentType || 'application/octet-stream');
    
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }
    
    responseHeaders.set('Content-Disposition', `attachment; filename="ENRC_LOW_2026_01.zip"`);

    console.log(`[proxy-gdrive] Streaming file, size: ${contentLength || 'unknown'}`);
    return new Response(response.body, { status: 200, headers: responseHeaders });

  } catch (err) {
    console.error('[proxy-gdrive] Error:', err instanceof Error ? err.message : 'Unknown error');
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
