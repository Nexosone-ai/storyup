/**
 * Builds a photographic image prompt for a card backdrop. Emphasizes
 * "no text" since STORYUP overlays its own typography on top.
 */
export function buildCardImagePrompt(category: string, subject: string): string {
  const scene = subject.trim().slice(0, 180);
  return [
    `Editorial lifestyle photograph for a ${category} brand.`,
    `Scene inspired by: ${scene}.`,
    "Soft natural window light, warm muted earthy tones, shallow depth of field,",
    "minimalist premium composition, calm and inviting mood, high-end magazine quality.",
    "IMPORTANT: absolutely no text, no letters, no words, no numbers, no logos, no watermarks, no signage in the image.",
  ].join(" ");
}

/** Wide editorial hero photograph for a blog post cover. */
export function buildBlogCoverPrompt(
  category: string,
  title: string,
  keywords: string[],
): string {
  const subject = [title, ...keywords.slice(0, 3)].join(", ").slice(0, 220);
  return [
    `Wide editorial hero photograph for a ${category} brand blog article.`,
    `Article theme: ${subject}.`,
    "Soft natural light, warm muted earthy tones, generous negative space,",
    "minimalist premium composition, calm and inviting mood, high-end magazine quality.",
    "IMPORTANT: absolutely no text, no letters, no words, no numbers, no logos, no watermarks, no signage in the image.",
  ].join(" ");
}
