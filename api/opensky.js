import { createRelayHandler } from './_relay.js';

export const config = { runtime: 'edge' };

export default createRelayHandler({
  relayPath: '/opensky',
  timeout: 20000,
  cacheHeaders: () => ({
    'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60, stale-if-error=300',
  }),
  extraHeaders: (response) => {
    const xCache = response.headers.get('x-cache');
    return xCache ? { 'X-Cache': xCache } : {};
  },
  fallback: (_req, corsHeaders) => new Response(JSON.stringify({
    states: [],
    time: Math.floor(Date.now() / 1000),
    source: 'fallback',
    error: 'Relay unavailable - no flight data',
  }), {
    status: 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=30',
      ...corsHeaders,
    },
  }),
});
