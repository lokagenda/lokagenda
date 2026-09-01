/**
 * Service Worker minimo pro LokAgenda.
 *
 * Existe por UM motivo so: Chrome/Edge exigem um SW com listener de `fetch`
 * registrado pra considerar o app instalavel (senao `beforeinstallprompt`
 * nunca dispara). Nao cacheamos nada — cache aqui vira stale content pos-deploy.
 *
 * IMPORTANTE: o listener NAO chama event.respondWith().
 *
 * A versao anterior fazia `event.respondWith(fetch(event.request))`, um
 * passthrough que parecia inofensivo mas piorava as coisas: ao assumir a
 * resposta, o SW passa a ser o dono do resultado, e quando o fetch rejeita
 * (rede fraca, upload grande, 413) o browser reporta
 *   "FetchEvent.respondWith received an error: TypeError: Load failed"
 * — um erro opaco, no lugar da falha de rede normal que a aplicacao saberia
 * tratar. Relatado por cliente em 01/set tentando cadastrar produto com 1 barra
 * de sinal.
 *
 * Sem respondWith, o browser trata a requisicao nativamente: mantem o criterio
 * de instalabilidade, e preserva range requests, streaming e o tratamento de
 * erro proprio do fetch.
 */

self.addEventListener('install', () => {
  // Ativa imediatamente, sem esperar a aba antiga fechar.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Toma controle das paginas ja abertas.
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // No-op de proposito. A presenca do listener basta pra instalabilidade;
  // nao interceptamos nada. NAO adicione respondWith aqui sem uma estrategia
  // de cache e de erro pensada — ver comentario no topo.
})
