// JB TV service worker: app shell + playlist caching. Streams (video) are never touched.
const V = 'jbtv-v1';
const SHELL = ['./'];
const CDN = ['cdnjs.cloudflare.com', 'cdn.tailwindcss.com'];
const LISTS = ['/iptv/index.m3u', '/iptv/index.language.m3u'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const keep = (key, res) => {
  if (res && (res.ok || res.type === 'opaque')) { const c = res.clone(); caches.open(V).then(ch => ch.put(key, c)).catch(() => {}); }
  return res;
};
// Show cached copy instantly, refresh it in the background
const swr = req => caches.match(req).then(hit => {
  const net = fetch(req).then(res => keep(req, res)).catch(() => hit);
  return hit || net;
});

self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url), same = u.origin === location.origin;
  if (r.mode === 'navigate' && same) { // page: network first, cached copy when offline
    const key = u.origin + u.pathname;
    e.respondWith(fetch(r).then(res => keep(key, res)).catch(() => caches.match(key).then(m => m || caches.match('./'))));
    return;
  }
  const playlist = u.hostname === 'iptv-org.github.io' && LISTS.includes(u.pathname);
  if (same || CDN.includes(u.hostname) || playlist) e.respondWith(swr(r));
});
