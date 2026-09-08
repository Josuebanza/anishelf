/*
 * Progressive Web App registration.
 * GitHub Pages is HTTPS, so the service worker can cache the application shell.
 * file:// previews simply skip registration.
 */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker non enregistré :', error);
    });
  });
}
