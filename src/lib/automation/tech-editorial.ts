/**
 * Tech editorial automation settings.
 * Times are Asia/Seoul local time. This module does not publish on its own.
 * Never store Naver credentials or session cookies in the application.
 */
export const TECH_EDITORIAL_CONFIG = {
  timezone: "Asia/Seoul",
  publishingHoursKst: [8, 12, 18] as const,
  category: "Tech",
  naverBlogId: "nexosone",
  autoPublishStoryup: false, // Enable only after business ownership and generation checks.
  naverPublishingMode: "manual-handoff" as const,
  minimumSources: 2,
  maximumSourceAgeHours: 48,
} as const;

export function kstEditorialSlot(date: Date): string | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TECH_EDITORIAL_CONFIG.timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));
  if (minute >= 10 || !TECH_EDITORIAL_CONFIG.publishingHoursKst.some((h) => h === hour)) return null;
  return `${value("year")}-${value("month")}-${value("day")}-${String(hour).padStart(2, "0")}`;
}

export function normalizeSourceUrl(url: string): string {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported URL scheme");
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) parsed.searchParams.delete(key);
  }
  return parsed.toString();
}
