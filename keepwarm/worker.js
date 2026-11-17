// courant-keepwarm
// Pings the main Courant Worker on a 1-minute cron so its isolates stay warm and
// first visits avoid the ~1.4s cold start. This is an independent, dependency-free
// Worker (no bindings) that only issues a lightweight GET to /api/health — it can
// never affect the main app.
export default {
  async scheduled(_event, env, _ctx) {
    try {
      const base = env.HOME_URL || "https://courant.nagara.cloud";
      await fetch(`${base}/api/health`, { method: "GET" });
    } catch {
      // Ignore: a failed ping just means the next minute retries.
    }
  },
};
