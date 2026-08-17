export type BrandColors = {
  navy: string;
  blue: string;
  cyan: string;
  background: string;
  text: string;
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
  /** Branded image dimensions (generation is a later phase). */
  image: {
    width: number;
    height: number;
  };
  /** Brand mark asset reference (defined when image generation lands). */
  mark: string | null;
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
    navy: "#0F172A",
    blue: "#2563EB",
    cyan: "#06B6D4",
    background: "#F8FAFC",
    text: "#111827",
  },
  image: {
    width: 1200,
    height: 628,
  },
  mark: null,
} as const satisfies BrandConfig;
