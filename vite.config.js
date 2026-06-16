import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

function gitValue(command, fallback) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim() || fallback;
  } catch {
    return fallback;
  }
}

const appVersion = process.env.GITHUB_SHA || gitValue('git rev-parse HEAD', 'development');
const commitMessage = gitValue('git log -1 --pretty=%s', 'Nueva versión disponible');
const base = '/porra-mundial-web/';

function versionManifest() {
  return {
    name: 'version-manifest',
    generateBundle(_options, bundle) {
      const cacheName = `porrazo-${appVersion}`;
      const buildAssets = Object.keys(bundle)
        .filter(fileName => fileName.endsWith('.js') || fileName.endsWith('.css'))
        .map(fileName => `${base}${fileName}`);
      const appShell = [
        base,
        `${base}index.html`,
        `${base}favicon.svg`,
        `${base}icon-192.png`,
        `${base}icon-512.png`,
        `${base}manifest.webmanifest`,
        `${base}version.json`,
        ...buildAssets
      ];

      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          version: appVersion,
          message: commitMessage
        })
      });

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `
const CACHE_NAME = ${JSON.stringify(cacheName)};
const APP_SHELL = ${JSON.stringify(appShell)};

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('porrazo-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(${JSON.stringify(base)})) return;
  if (url.pathname.endsWith('/version.json')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(${JSON.stringify(`${base}index.html`)}, copy));
          return response;
        })
        .catch(() => caches.match(${JSON.stringify(`${base}index.html`)}))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(${JSON.stringify(base)});
    })
  );
});
`
      });
    }
  };
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  plugins: [versionManifest()]
});
