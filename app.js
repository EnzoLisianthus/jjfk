/*
 * JJFK v1 migration safety net.
 *
 * 최신 index.html은 이 파일을 사용하지 않습니다.
 * 하지만 구버전 index.html이 캐시에서 먼저 열리고 app.js만 네트워크에서
 * 갱신되는 경우에도 사용자를 migration 화면으로 보내기 위해 남겨둡니다.
 */
(() => {
  const MIGRATION_URL = "./index.html?migration=20260930";

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./service-worker.js", {
        scope: "./",
        updateViaCache: "none"
      })
      .then((registration) => registration.update().catch(() => {}))
      .catch(() => {});
  }

  try {
    const current = new URL(window.location.href);
    if (current.searchParams.get("migration") !== "20260930") {
      window.location.replace(MIGRATION_URL);
    }
  } catch {
    window.location.href = MIGRATION_URL;
  }
})();
