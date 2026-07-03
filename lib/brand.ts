// lib/brand.ts
// Shared brand tokens (ARCHITECTURE.md §7). One source of truth so the app,
// the invoice PDF, and the SOW/Proposal templates stay visually aligned.
export const brand = {
  oxblood: "#4A0E1C", // PLACEHOLDER — set to the exact Creste oxblood
  ink: "#1A1A1A",
  wordmark: "CRESTE",
  rule: "#4A0E1C", // oxblood section dividers
} as const;

export type Brand = typeof brand;
