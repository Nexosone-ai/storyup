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
