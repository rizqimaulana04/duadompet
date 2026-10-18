// Authenticated pages and financial responses are NEVER stored in Cache Storage.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            '<!doctype html><html lang="id"><meta name="viewport" content="width=device-width"><title>DuaDompet offline</title><body style="font:18px Arial;padding:50px;background:#f8fafc;color:#15213a"><h1>Anda sedang offline.</h1><p>Hubungkan kembali ke internet untuk membuka catatan keuangan Anda.</p><a href="/dashboard">Coba kembali</a></body></html>',
            {
              headers: {
                "Content-Type": "text/html;charset=utf-8",
                "Cache-Control": "no-store",
              },
            },
          ),
      ),
    );
});
