/* MINERAL LAB 5 · same-origin PWA resources, stale cache invalidation. */
const CACHE='mineral-lab-pwa-v5-cif22';
const CORE=['./','./index.html','./manifest.webmanifest','./mineral_models.js','./mineral_compare.js','./cod_crystals.js'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const u=new URL(event.request.url);
 if(u.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).then(r=>{const clone=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',clone));return r})
   .catch(()=>caches.match('./index.html')));
  return;
 }
 event.respondWith(fetch(event.request).then(r=>{
  if(r.ok){const clone=r.clone();caches.open(CACHE).then(c=>c.put(event.request,clone))}
  return r;
 }).catch(()=>caches.match(event.request)));
});
