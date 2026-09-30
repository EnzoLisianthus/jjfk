/* ==========================================================
   JJFK v1 -> New JJFK Migration Service Worker

   목적:
   - 기존 jjfk-cache-v2 등 예전 캐시 제거
   - 기존 홈 화면 PWA를 migration 안내 화면으로 전환
   - navigation은 항상 네트워크 최신 index.html을 우선 사용
   ========================================================== */

const MIGRATION_CACHE = "jjfk-migration-20260930-v1";
const MIGRATION_URL = "./index.html?migration=20260930";
const FALLBACK_KEY = "./index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(MIGRATION_CACHE);

      try {
        const response = await fetch(MIGRATION_URL, {
          cache: "reload"
        });

        if (response.ok) {
          await cache.put(FALLBACK_KEY, response.clone());
        }
      } catch {
        // 네트워크가 없는 설치 시에는 activate 이후 기존 캐시를
        // 무조건 지우지 않도록 fallback 존재 여부를 확인합니다.
      }

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const migrationCache = await caches.open(MIGRATION_CACHE);
      const migrationFallback = await migrationCache.match(FALLBACK_KEY);

      /*
       * 새 안내 화면을 실제로 확보한 경우에만 과거 JJFK 캐시를 지웁니다.
       * 네트워크 단절 중 업데이트가 걸려도 기존 앱 캐시를 먼저 날려
       * 빈 화면이 되는 상황을 피합니다.
       */
      if (migrationFallback) {
        const cacheNames = await caches.keys();

        await Promise.all(
          cacheNames.map((name) => {
            if (name === MIGRATION_CACHE) return Promise.resolve(false);

            if (
              name.startsWith("jjfk-cache-") ||
              name.startsWith("jjfk-migration-")
            ) {
              return caches.delete(name);
            }

            return Promise.resolve(false);
          })
        );
      }

      await self.clients.claim();

      /*
       * 이미 켜져 있는 구버전 PWA도 새 SW가 활성화되면
       * 가능한 경우 즉시 migration 화면으로 이동시킵니다.
       */
      if (migrationFallback) {
        const windows = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true
        });

        const target = new URL(MIGRATION_URL, self.registration.scope).href;

        await Promise.all(
          windows.map(async (client) => {
            try {
              await client.navigate(target);
            } catch {
              // iOS가 현재 navigation을 허용하지 않으면
              // 다음 실행/새로고침부터 migration 화면이 표시됩니다.
            }
          })
        );
      }
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);

  /* Moodle 등 cross-origin 요청은 건드리지 않습니다. */
  if (requestUrl.origin !== scopeUrl.origin) return;

  /*
   * 설치된 PWA를 실행하거나 페이지를 이동할 때마다
   * migration index.html을 네트워크에서 가장 먼저 확인합니다.
   */
  if (request.mode === "navigate") {
    event.respondWith(networkFirstMigration());
    return;
  }

  /* manifest/icons 같은 정적 파일은 일반 네트워크 요청으로 둡니다. */
});

async function networkFirstMigration() {
  const cache = await caches.open(MIGRATION_CACHE);

  try {
    const response = await fetch(MIGRATION_URL, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    await cache.put(FALLBACK_KEY, response.clone());
    return response;
  } catch {
    const cached = await cache.match(FALLBACK_KEY);

    if (cached) return cached;

    return new Response(
      `<!doctype html>
       <html lang="ko">
       <meta charset="utf-8">
       <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
       <body style="margin:0;background:#0d0e12;color:white;font-family:-apple-system,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px;text-align:center;box-sizing:border-box">
         <div>
           <h2>JJFK 업데이트 안내</h2>
           <p style="color:#aaa;line-height:1.6">안내 화면을 불러오려면 인터넷 연결이 필요합니다.<br>연결 후 앱을 다시 열어주세요.</p>
         </div>
       </body>
       </html>`,
      {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
