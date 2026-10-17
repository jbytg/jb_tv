// JB TV – tiny CORS proxy for Cloudflare Workers (free plan is enough to start)
// Deploy: dash.cloudflare.com → Workers & Pages → Create → "Hello World" → paste this → Deploy.
// Then in index.html set:  const PROXY = 'https://YOUR-WORKER.workers.dev/?url=';
// Only your own site can use it: put your domain in ALLOWED (leave [] to allow everyone).
const ALLOWED = []; // e.g. ['https://jbhub.ryzn.pro']

export default {
  async fetch(req) {
    const u = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const ok = !ALLOWED.length || ALLOWED.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': ok ? (origin || '*') : 'null',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': '*',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const target = u.searchParams.get('url');
    if (!ok || !target || !/^https?:\/\//i.test(target)) return new Response('Forbidden or missing ?url=', { status: 403, headers: cors });

    const headers = { 'User-Agent': 'Mozilla/5.0' };
    if (req.headers.get('Range')) headers.Range = req.headers.get('Range');
    const up = await fetch(target, { headers, redirect: 'follow' });

    const h = new Headers(up.headers);
    Object.entries(cors).forEach(([k, v]) => h.set(k, v));
    const isM3U8 = /mpegurl/i.test(up.headers.get('content-type') || '') || /\.m3u8(\?|$)/i.test(target);
    if (!isM3U8) return new Response(up.body, { status: up.status, headers: h });

    // Rewrite playlist so every segment / sub-playlist also goes through this proxy
    const self = u.origin + u.pathname + '?url=';
    const abs = x => self + encodeURIComponent(new URL(x, up.url).href);
    const text = (await up.text()).split('\n').map(line => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, x) => `URI="${abs(x)}"`);
      return abs(t);
    }).join('\n');
    h.delete('content-length'); h.delete('content-encoding');
    h.set('content-type', 'application/vnd.apple.mpegurl');
    return new Response(text, { status: up.status, headers: h });
  },
};
