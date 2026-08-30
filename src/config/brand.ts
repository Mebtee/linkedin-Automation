export type BrandColors = {
  /** Deep navy — the major dark background area (right diagonal section). */
  navy: string;
  /** Professional blue — primary accent (diagonal line, arrows, highlights). */
  blue: string;
  /** Electric blue — strong accent variant. */
  electric: string;
  /** Cyan — small, sparse highlights (circuit nodes, signal tag). */
  cyan: string;
  /** Light area background — white canvas on the left/spacious side. */
  background: string;
  /** Very light gray — subtle panels / near-boundary tint. */
  lightGray: string;
  /** Dark navy text on the light area. */
  text: string;
  /** Muted secondary text (gray). */
  muted: string;
};

export type BrandConfig = {
  appName: string;
  shortName: string;
  series: string;
  tagline: string;
  totalDays: number;
  totalModules: number;
  timezone: string;
  colors: BrandColors;
  /** Branded image dimensions. 1600×900 (16:9) is the professional personal-brand
   * canvas: a white/light editorial content zone on the left split diagonally
   * from a deep-navy branding zone on the right (spec: Phase 5I theme redesign).
   * Single source of truth for the SVG viewBox and the rasterized PNG size. */
  image: {
    width: number;
    height: number;
  };
  /** Brand mark asset (TB monogram) used as the personal-brand signature. */
  mark: string;
};

export const brand = {
  appName: "105-Day Learning Journey",
  shortName: "105DLJ",
  series: "105 DAYS OF FULL-STACK DEVELOPMENT",
  tagline: "A personal AI-powered LinkedIn content automation system.",
  totalDays: 105,
  totalModules: 8,
  timezone: "Africa/Addis_Ababa",
  colors: {
    navy: "#061A3A",
    blue: "#1769FF",
    electric: "#146BFF",
    cyan: "#00C8E8",
    background: "#FFFFFF",
    lightGray: "#F4F6F8",
    text: "#0B1930",
    muted: "#5B677A",
  },
  image: {
    width: 1600,
    height: 900,
  },
  mark: "public/branding/tb-logo.png",
} as const satisfies BrandConfig;
