// STORYUP PWA 서비스워커.
// 설치 가능(installability) 조건 충족 + 웹 푸시 수신/클릭 처리.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // respondWith를 호출하지 않으면 브라우저 기본 네트워크 동작을 그대로 사용한다.
});

// 서버가 보낸 웹 푸시 표시.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "STORYUP", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "STORYUP";
  const options = {
    body: data.body || "",
    icon: "/images/logo-badge.png",
    badge: "/images/logo-icon.png",
    data: { url: data.url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 알림 클릭 시 해당 URL로 이동(열려 있으면 포커스).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
