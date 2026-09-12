// STORYUP PWA 서비스워커.
// 설치 가능(installability) 조건을 충족시키기 위한 최소 구현이다.
// 요청은 네트워크로 그대로 흘려보내고(오프라인 캐시는 추후), fetch 핸들러 존재만 보장한다.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // respondWith를 호출하지 않으면 브라우저 기본 네트워크 동작을 그대로 사용한다.
});
