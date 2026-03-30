// ===============================
// JJFK PWA Service Worker
// ===============================

const CACHE_NAME = "jjfk-cache-v1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./style.css",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

// ===============================
// INSTALL
// ===============================
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// ===============================
// ACTIVATE
// ===============================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// ===============================
// FETCH STRATEGY
// ===============================
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // API 요청은 Network First
  if (url.pathname.includes("/api/")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 나머지는 Cache First
  event.respondWith(cacheFirst(req));
});

// ===============================
// CACHE FIRST
// ===============================
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;

  const res = await fetch(req);
  const cache = await caches.open(CACHE_NAME);
  cache.put(req, res.clone());

  return res;
}

// ===============================
// NETWORK FIRST
// ===============================
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    return cached || new Response("offline", { status: 503 });
  }
}

// ===============================
// MESSAGE HANDLING (APP ↔ SW)
// ===============================
self.addEventListener("message", async (event) => {
  const data = event.data;

  if (!data || !data.type) return;

  switch (data.type) {
    case "SAVE_TASKS":
      await saveToCache("tasks", data.payload);
      break;

    case "GET_TASKS":
      const tasks = await getFromCache("tasks");
      event.ports[0]?.postMessage(tasks || []);
      break;

    case "CHECK_DEADLINES":
      checkDeadlines(data.payload);
      break;
  }
});

// ===============================
// CACHE STORAGE HELPERS
// ===============================
async function saveToCache(key, data) {
  const cache = await caches.open(CACHE_NAME);
  const response = new Response(JSON.stringify(data));
  await cache.put(`data-${key}`, response);
}

async function getFromCache(key) {
  const cache = await caches.open(CACHE_NAME);
  const res = await cache.match(`data-${key}`);
  if (!res) return null;
  return await res.json();
}

// ===============================
// NOTIFICATION SYSTEM
// ===============================
async function checkDeadlines(tasks) {
  if (!tasks || !Array.isArray(tasks)) return;

  const now = Date.now();

  for (const task of tasks) {
    if (!task.deadline) continue;

    const deadlineTime = new Date(task.deadline).getTime();
    const diff = deadlineTime - now;

    // 1시간 이내
    if (diff > 0 && diff < 60 * 60 * 1000) {
      self.registration.showNotification("마감 임박", {
        body: task.title || "과제 마감이 1시간 이내입니다.",
        icon: "./icons/icon-192.png",
        badge: "./icons/icon-192.png"
      });
    }

    // 이미 마감
    if (diff <= 0) {
      self.registration.showNotification("마감 완료", {
        body: task.title || "과제가 마감되었습니다.",
        icon: "./icons/icon-192.png",
        badge: "./icons/icon-192.png"
      });
    }
  }
}

// ===============================
// PUSH (확장 대비)
// ===============================
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};

  self.registration.showNotification(data.title || "알림", {
    body: data.body || "",
    icon: "./icons/icon-192.png"
  });
});
