/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
  SAFE_BROWSING_API_KEY: string;
}

interface ThreatMatch {
  threatType: string;
  platformType: string;
  threatEntryType: string;
  threat: { url: string };
  cacheDuration?: string;
}

interface SafeBrowsingResponse {
  matches?: ThreatMatch[];
  negativeCacheDuration?: string;
}

interface ScanResult {
  verdict: 'SAFE' | 'SUSPICIOUS' | 'MALICIOUS' | 'UNKNOWN';
  score: number;
  cached: boolean;
  threats?: string[];
  cacheTtl?: number;
  error?: string;
}

// Parse Google's duration format "300.000s" → number of seconds
function parseDuration(duration?: string, fallback = 300): number {
  if (!duration) return fallback;
  return Math.floor(parseFloat(duration.replace('s', '')));
}

async function checkSafeBrowsing(
  url: string,
  apiKey: string
): Promise<{ result: ScanResult; ttl: number }> {
  let response: Response;

  try {
    response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: {
            clientId: 'safescan-app',
            clientVersion: '1.0.0',
          },
          threatInfo: {
            threatTypes: [
              'MALWARE',
              'SOCIAL_ENGINEERING',
              'UNWANTED_SOFTWARE',
              'POTENTIALLY_HARMFUL_APPLICATION',
            ],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
      }
    );
  } catch (err) {
    // Network error — never cache
    return {
      result: {
        verdict: 'UNKNOWN',
        score: -1,
        cached: false,
        error: 'Network error reaching Safe Browsing API',
      },
      ttl: 0,
    };
  }

  if (!response.ok) {
    // API error — never cache
    return {
      result: {
        verdict: 'UNKNOWN',
        score: -1,
        cached: false,
        error: `Safe Browsing API returned status ${response.status}`,
      },
      ttl: 0,
    };
  }

  const data = (await response.json()) as SafeBrowsingResponse;
  const matches = data.matches ?? [];

  if (matches.length === 0) {
    // Safe — use negativeCacheDuration from response per Google's spec
    const ttl = parseDuration(data.negativeCacheDuration, 300);
    return {
      result: {
        verdict: 'SAFE',
        score: 10,
        cached: false,
        cacheTtl: ttl,
      },
      ttl,
    };
  }

  // Malicious — use cacheDuration from first match per Google's spec
  const ttl = parseDuration(matches[0].cacheDuration, 300);
  const threatTypes = matches.map((m) => m.threatType);

  return {
    result: {
      verdict: 'MALICIOUS',
      score: 90,
      cached: false,
      threats: threatTypes,
      cacheTtl: ttl,
    },
    ttl,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow GET
    if (request.method !== 'GET') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders,
      });
    }

    // Extract target URL from query param
    const requestUrl = new URL(request.url);
    const targetUrl = requestUrl.searchParams.get('url');

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Build cache key from target URL
    const cacheKey = new Request(
      `https://safescan-cache.internal/${encodeURIComponent(targetUrl)}`
    );
    const cache = caches.default;

    // Check cache first
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const cachedData = (await cachedResponse.json()) as ScanResult;
      cachedData.cached = true;
      return new Response(JSON.stringify(cachedData), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
        },
      });
    }

    // Cache miss — call Safe Browsing API
    const { result, ttl } = await checkSafeBrowsing(
      targetUrl,
      env.SAFE_BROWSING_API_KEY
    );

    // Only cache real results — never cache UNKNOWN (errors)
    if (result.verdict !== 'UNKNOWN' && ttl > 0) {
      const responseToCache = new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          // TTL comes directly from Google's API response per their caching spec
          'Cache-Control': `public, max-age=${ttl}`,
        },
      });
      await cache.put(cacheKey, responseToCache);
    }

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
      },
    });
  },
} satisfies ExportedHandler<Env>;