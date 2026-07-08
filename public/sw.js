/**
 * Service Worker minimo pro LokAgenda.
 *
 * Chrome/Edge exigem SW registrado com fetch handler pra considerar o app
 * instalavel (senao o `beforeinstallprompt` nunca dispara). Nao vamos cachear
 * nada agressivamente pra evitar problema de stale content pos-deploy — o
 * network-first passthrough abaixo satisfaz o criterio de instalabilidade
 * sem interferir na experiencia.
 */

self.addEventListener('install', (event) => {
  // Ativa imediatamente sem esperar aba antiga fechar.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Toma controle das paginas abertas.
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Passthrough puro. Sem cache. Se voce quiser offline no futuro, adiciona
  // caches.open() aqui — mas requer estrategia de invalidacao no deploy.
  event.respondWith(fetch(event.request))
})
