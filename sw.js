const CACHE = "emily-habit-v1";
const ASSETS = ["/", "/index.html"];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch (cache-first for app shell) ────────────────────────────────────────
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // Always go network-first for the Anthropic API
  if (e.request.url.includes("anthropic.com")) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow("/");
    })
  );
});

// ── Scheduled notification alarm ─────────────────────────────────────────────
// The main app posts a message to schedule the next notification.
self.addEventListener("message", e => {
  if (e.data && e.data.type === "SCHEDULE_NOTIFICATIONS") {
    scheduleNextNotification();
  }
});

function scheduleNextNotification() {
  const now = new Date();
  const times = [
    { hour: 7,  minute: 0,  title: "Good morning, Emily 🌅",       body: "Time to check your morning habits. Let's start the day right." },
    { hour: 12, minute: 0,  title: "Midday check-in 🌿",            body: "How are your habits going? A few minutes now keeps the streak alive." },
    { hour: 21, minute: 0,  title: "Evening wind-down 🌙",          body: "Bedtime's at 11 — check off what you've done and aim for that sleep bonus." },
  ];

  // Find the next upcoming slot today, or the first slot tomorrow
  let next = null;
  for (const t of times) {
    const candidate = new Date(now);
    candidate.setHours(t.hour, t.minute, 0, 0);
    if (candidate > now) { next = { time: candidate, ...t }; break; }
  }
  // If no more slots today, schedule first slot tomorrow
  if (!next) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(times[0].hour, times[0].minute, 0, 0);
    next = { time: tomorrow, ...times[0] };
  }

  const delay = next.time.getTime() - Date.now();
  setTimeout(() => {
    self.registration.showNotification(next.title, {
      body: next.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "habit-reminder",
      renotify: true,
      requireInteraction: false,
    });
    // After firing, schedule the next one
    scheduleNextNotification();
  }, delay);
}
