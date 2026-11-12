/* BICA · service worker: guarda a última versão da página para abrir sem internet.
   Sempre tenta a rede primeiro (atualizações chegam normalmente); só usa a cópia quando não há conexão.
   Não intercepta chamadas ao servidor (Apps Script) nem mapas. */
const CACHE='bica-pagina-v1';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.add(new Request('./',{cache:'reload'}))).catch(()=>{}));});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim();})());});
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET'||r.mode!=='navigate')return;
 const u=new URL(r.url);if(u.origin!==location.origin)return;
 e.respondWith((async()=>{
  try{const res=await fetch(r);if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put('./',copy)).catch(()=>{});}return res;}
  catch(err){const c=await caches.open(CACHE);return (await c.match('./'))||(await c.match(r))||Response.error();}
 })());
});
