"use client";

import { createContext, useContext } from "react";
import type { Locale } from "@/lib/i18n";

const LocaleContext = createContext<Locale>("ko");

/** 서버 레이아웃이 읽은 로케일을 클라이언트 컴포넌트에 내려주는 프로바이더. */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

/** 현재 로케일. 대시보드 클라이언트 컴포넌트에서 `useLocale() === "ko"`로 분기한다. */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}
