/**
 * Fused Design System: TigerGraph × Claude (Anthropic)
 * ====================================================
 * TigerGraph: Orange #FF6B00, Navy #002B49, Electric Blue #0072CE
 * Claude: Cream #faf9f5, Coral #cc785c, Dark #181715
 *
 * The fusion: TigerGraph's authority + Claude's warmth
 * - Canvas: Claude's warm cream (not cold white)
 * - Primary CTA: TigerGraph orange (energy, action)
 * - Secondary accent: Claude coral (warmth, intelligence)
 * - Text/structure: TigerGraph navy (depth, authority)
 * - Dark surfaces: Claude dark (product chrome, code)
 */

export const colors = {
  // ── Brand Primary ─────────────────────────────────
  tigerOrange:       "#FF6B00",
  tigerOrangeHover:  "#E55F00",
  tigerOrangeLight:  "#FFF4EB",
  tigerOrangeMuted:  "#FF8C35",

  // ── Brand Secondary ───────────────────────────────
  tigerNavy:         "#002B49",
  tigerNavyLight:    "#003D6B",
  electricBlue:      "#0072CE",
  electricBlueLight: "#E6F4FF",

  // ── Claude Surfaces ───────────────────────────────
  canvas:            "#faf9f5",
  surfaceSoft:       "#f5f0e8",
  surfaceCard:       "#efe9de",
  surfaceCreamStrong:"#e8e0d2",
  surfaceDark:       "#181715",
  surfaceDarkElev:   "#252320",
  surfaceDarkSoft:   "#1f1e1b",

  // ── Claude Accents ────────────────────────────────
  coral:             "#cc785c",
  coralActive:       "#a9583e",
  coralDisabled:     "#e6dfd8",
  accentTeal:        "#5db8a6",
  accentAmber:       "#e8a55a",

  // ── Text ──────────────────────────────────────────
  ink:               "#141413",
  bodyStrong:        "#252523",
  body:              "#3d3d3a",
  muted:             "#6c6a64",
  mutedSoft:         "#8e8b82",
  onPrimary:         "#ffffff",
  onDark:            "#faf9f5",
  onDarkSoft:        "#a09d96",

  // ── Borders ───────────────────────────────────────
  hairline:          "#e6dfd8",
  hairlineSoft:      "#ebe6df",

  // ── Semantic ──────────────────────────────────────
  success:           "#5db872",
  successLight:      "#ecf7ef",
  warning:           "#d4a017",
  warningLight:      "#fdf6e3",
  error:             "#c64545",
  errorLight:        "#fdf0f0",

  // ── Chart Colors (Pipeline comparison) ────────────
  baseline:          "#0072CE",   // Electric blue for baseline
  graphrag:          "#FF6B00",   // Tiger orange for GraphRAG
  baselineLight:     "#E6F4FF",
  graphragLight:     "#FFF4EB",
} as const;

export const typography = {
  fontSerif:  "'Cormorant Garamond', 'EB Garamond', 'Times New Roman', serif",
  fontSans:   "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontMono:   "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
} as const;

export const spacing = {
  xxs: "4px",
  xs:  "8px",
  sm:  "12px",
  md:  "16px",
  lg:  "24px",
  xl:  "32px",
  xxl: "48px",
  section: "96px",
} as const;

export const rounded = {
  xs:   "4px",
  sm:   "6px",
  md:   "8px",
  lg:   "12px",
  xl:   "16px",
  pill:  "9999px",
  full:  "50%",
} as const;

// Chart-specific tokens for Recharts
export const chartTokens = {
  baseline: {
    stroke: colors.baseline,
    fill: colors.baseline,
    fillOpacity: 0.15,
    name: "Baseline RAG",
  },
  graphrag: {
    stroke: colors.graphrag,
    fill: colors.graphrag,
    fillOpacity: 0.15,
    name: "GraphRAG",
  },
  grid: {
    stroke: colors.tigerNavy,
    strokeOpacity: 0.1,
  },
  tooltip: {
    background: colors.canvas,
    border: colors.hairline,
    text: colors.ink,
  },
} as const;

export type ColorKey = keyof typeof colors;
