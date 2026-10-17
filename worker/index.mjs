export function validIP(value) {
  if (typeof value !== 'string' || value.length > 64) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    return value.split('.').every(part => Number(part) <= 255 && (part === '0' || !part.startsWith('0')));
  }
  if (!value.includes(':') || !/^[\da-f:.]+$/i.test(value)) return false;
  try { return new URL(`http://[${value}]/`).hostname.startsWith('['); } catch { return false; }
}

const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      return response({ service: 'ip-lens-api', ready: Boolean(env.IPINFO_TOKEN) });
    }
    const origin = request.headers.get('Origin');
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
    if (!origin || !allowed.includes(origin)) return response({ error: 'origin_not_allowed' }, 403);
    const cors = { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors,
      'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Accept', 'Access-Control-Max-Age': '86400' } });
    if (request.method !== 'GET') return response({ error: 'method_not_allowed' }, 405, { ...cors, Allow: 'GET, OPTIONS' });
    if (url.pathname === '/api/ip') {
      const ip = request.headers.get('CF-Connecting-IP');
      return validIP(ip) ? response({ ip, provider: 'Cloudflare' }, 200, cors) : response({ error: 'client_ip_unavailable' }, 503, cors);
    }
    if (url.pathname !== '/api/lookup') return response({ error: 'not_found' }, 404, cors);
    const ip = url.searchParams.get('ip') || '';
    if (!validIP(ip)) return response({ error: 'invalid_ip' }, 400, cors);
    if (!env.IPINFO_TOKEN) return response({ error: 'ipinfo_not_configured' }, 503, cors);
    const cache = globalThis.caches?.default;
    const cacheKey = new Request(`${url.origin}/_cache/lite/${encodeURIComponent(ip)}`);
    const hit = cache && await cache.match(cacheKey);
    if (hit) return response({ ...(await hit.json()), cached: true }, 200, cors);
    let upstream;
    try {
      upstream = await fetch(`https://api.ipinfo.io/lite/${encodeURIComponent(ip)}`, {
        headers: { Authorization: `Bearer ${env.IPINFO_TOKEN}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000)
      });
    } catch { return response({ error: 'upstream_unavailable' }, 502, cors); }
    if (!upstream.ok) {
      const error = upstream.status === 429 ? 'upstream_rate_limited' : [401, 403].includes(upstream.status) ? 'ipinfo_token_invalid' : 'upstream_unavailable';
      return response({ error }, upstream.status === 429 ? 429 : 502, cors);
    }
    let raw;
    try { raw = await upstream.json(); } catch { return response({ error: 'upstream_invalid_response' }, 502, cors); }
    const normalize = value => value.includes(':') ? new URL(`http://[${value}]/`).hostname.toLowerCase() : value;
    if (!validIP(raw.ip) || normalize(raw.ip) !== normalize(ip)) return response({ error: 'upstream_invalid_response' }, 502, cors);
    // Return only documented Lite fields. Never return credentials or upstream error text.
    const result = { ip: raw.ip, provider: 'IPinfo Lite', retrievedAt: new Date().toISOString(), cached: false };
    for (const key of ['asn', 'as_name', 'as_domain', 'country_code', 'country', 'continent_code', 'continent']) {
      result[key] = typeof raw[key] === 'string' ? raw[key].slice(0, 256) : null;
    }
    if (cache) ctx.waitUntil(cache.put(cacheKey, response(result, 200, { 'Cache-Control': 'public, max-age=300' })));
    return response(result, 200, cors);
  }
};
