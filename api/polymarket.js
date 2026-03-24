import { createRelayHandler } from './_relay.js';

export const config = { runtime: 'edge' };

export default createRelayHandler({
  relayPath: '/polymarket',
  timeout: 15000,
  requireApiKey: true,
  requireRateLimit: true,
  cacheHeaders: (ok) => ({
    'Cache-Control': ok
      ? 'public, max-age=120, s-maxage=300, stale-while-revalidate=900, stale-if-error=1800'
      : 'public, max-age=10, s-maxage=30, stale-while-revalidate=120',
    ...(ok && { 'CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900, stale-if-error=1800' }),
  }),
  fallback: (_req, corsHeaders) => new Response(JSON.stringify({
    markets: [],
    timestamp: new Date().toISOString(),
    source: 'fallback',
    error: 'Relay unavailable - no prediction market data',
  }), {
    status: 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=60',
      ...corsHeaders,
    },
  }),
});
