"use client";

import { useEffect } from "react";

/**
 * 로그인 안 된 상태에서 없는 페이지(404)에 도달하면 로그인으로 보낸다.
 * 서버 not-found에서의 redirect()는 매칭된 라우트의 notFound()에선 하드
 * 내비게이션에 안 먹어서(빈 404), 클라이언트에서 확실히 이동시킨다.
 * (아이폰·아이패드 Safari, 카카오 인앱 브라우저 포함 전 브라우저 동작)
 */
export function LoginRedirect({ to = "/login" }: { to?: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return null;
}
