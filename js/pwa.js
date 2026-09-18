
/* Register the service worker only on http(s). file:// remains usable without it. */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
}
