/**
 * Foundry Design System Color Palette & Layering Constants
 */

export const THEME = {
  // Foundry Core Palette
  mainBar: "#101214",
  menuPanel: "#17191C",
  menuHover: "#202327",
  selected: "#BCE5F8",
  borderMain: "#292C30",
  mainText: "#F5F5F5",
  secondaryText: "#8B929C",
  success: "#39E58C",
  warmHighlight: "#C4934B",
  destructive: "#A55445",

  // Base shell
  canvas: "#0B0D0F",
  panels: "#17191C",
  raisedPanels: "#202327",
  borders: "#292C30",
  primaryText: "#F5F5F5",

  // Board canvas paper
  paperCanvas: "#0B0D0F",
  gridDotDark: "#292C30",
  gridDotLight: "#C7AE82",

  // Accents
  primaryAccent: "#BCE5F8",
  secondaryAccent: "#8B929C",
  warmAccent: "#C4934B",
  secondaryWarm: "#C7AE82",
  highlight: "#BCE5F8",
  coolUtility: "#557C7B",
  error: "#A55445",
} as const;

/**
 * Architectural Z-Index Layers (Phase 2.2 & 3.6)
 */
export const FOUNDRY_Z_LAYERS = {
  canvas: 0,
  canvasTools: 40,
  floatingWorkspaceMin: 100,
  floatingWorkspaceMax: 169,
  navigationChrome: 180,
  dialog: 200,
  notification: 250,
} as const;

export const EARTH_STICKY_COLORS = [
  { color: "#E5D28E", label: "Sand", name: "sand" },
  { color: "#A7C5C2", label: "Mist", name: "mist" },
  { color: "#B2C9A5", label: "Sage", name: "sage" },
  { color: "#D3A08D", label: "Clay Rose", name: "clayRose" },
  { color: "#C3A47C", label: "Kraft", name: "kraft" },
] as const;

export const EARTH_BRUSH_COLORS = [
  "#F5F5F5",
  "#8B929C",
  "#BCE5F8",
  "#39E58C",
  "#C4934B",
  "#A55445",
  "#557C7B",
  "#0B0D0F",
] as const;

export const EARTH_VECTOR_COLORS = [
  "#F5F5F5",
  "#BCE5F8",
  "#39E58C",
  "#C4934B",
  "#A55445",
  "#557C7B",
  "#8B929C",
  "#0B0D0F",
] as const;
