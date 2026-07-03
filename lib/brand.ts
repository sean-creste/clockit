// lib/brand.ts
// Shared brand tokens (ARCHITECTURE.md §7 + the Creste editorial design system).
// One source of truth so the app, the invoice PDF, and the SOW/Proposal
// templates stay visually aligned.
export const brand = {
  // core
  oxblood: "#4A0E1C", // primary accent, rules, wordmark
  ink: "#1A1A1A", // primary text
  paper: "#EDE8E0", // page background (warm)
  card: "#FBF9F5", // surface / card background
  light: "#F6F3EE", // text/knob on oxblood
  wordmark: "CRESTE",
  rule: "#4A0E1C",
  // status accents
  open: "#8A6D00", // amber — uninvoiced / open
  openBg: "rgba(180,140,0,.14)",
  active: "#1F6E45", // green — active
  activeBg: "rgba(31,138,91,.14)",
  danger: "#B4231F", // over-budget / void
} as const;

export type Brand = typeof brand;
