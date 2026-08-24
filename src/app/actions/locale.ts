"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export async function setLocaleAction(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale === "en" ? "en" : "ko", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
