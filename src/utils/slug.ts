/** URL-safe slug from arbitrary text. Returns "" when nothing usable remains. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // drop non-ascii (incl. Korean)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function randomSuffix(len = 5): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** Slug with a guaranteed non-empty base (falls back to a prefix + random). */
export function slugWithFallback(input: string, prefix = "site"): string {
  const base = slugify(input);
  return base || `${prefix}-${randomSuffix()}`;
}
