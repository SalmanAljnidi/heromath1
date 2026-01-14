const CACHE='hero-math-v3.7-streams';
const ASSETS=['./','./index.html','./styles.css','./manifest.json','./sw.js','./js/main.js','./js/game.js','./js/quiz.js','./js/utils.js','./assets/icons/app-192.png','./assets/icons/app-512.png','./assets/icons/snap.svg','./assets/icons/whatsapp.svg'];
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(ASSETS);self.skipWaiting();})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.map(k=>k!==CACHE?caches.delete(k):0));self.clients.claim();})()));
self.addEventListener('fetch',e=>{
 const r=e.request;
 if(r.mode==='navigate'){
  e.respondWith((async()=>{try{const f=await fetch(r);(await caches.open(CACHE)).put('./index.html',f.clone());return f;}catch{return (await caches.open(CACHE)).match('./index.html');}})());
  return;
 }
 e.respondWith((async()=>{const c=await caches.open(CACHE);const m=await c.match(r);if(m) return m;try{const f=await fetch(r);c.put(r,f.clone());return f;}catch{return m||Response.error();}})());
});