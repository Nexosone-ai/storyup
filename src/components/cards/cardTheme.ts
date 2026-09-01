// Explicit hex values (mirrors globals.css tokens) so html-to-image export
// resolves colors reliably regardless of CSS-variable inheritance.
export const CARD = {
  paper: "#fbfaf8",
  surface: "#ffffff",
  ink: "#1b1a17",
  muted: "#726d64",
  border: "#e9e5dd",
  borderStrong: "#d9d4c9",
  primary: "#1f6f5a",
  primarySoft: "#e7f0ec",
  onPrimary: "#ffffff",
  font: '"Geist", "Pretendard", "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif',
  mono: '"Geist Mono", ui-monospace, monospace',
} as const;

export const IG = { w: 1080, h: 1350 } as const;
