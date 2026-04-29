import type { CSSProperties } from "react";

export const SAGE_THEME_STORAGE_KEY = "codex-manager:sage-theme-color";

export const SAGE_THEME_COLORS = [
  "blue",
  "green",
  "yellow",
  "pink",
  "orange",
  "gray",
  "purple",
  "red",
  "indigo",
  "teal",
  "cyan",
  "rose",
] as const;

export type SageThemeColor = (typeof SAGE_THEME_COLORS)[number];

interface SageThemeToken {
  hex: string;
  light: string;
  selection: string;
  strong: string;
}

type SageThemeVariables = CSSProperties & Record<`--${string}`, string>;

export const SAGE_THEME_LABELS: Record<SageThemeColor, string> = {
  blue: "Blue",
  green: "Green",
  yellow: "Yellow",
  pink: "Pink",
  orange: "Orange",
  gray: "Gray",
  purple: "Purple",
  red: "Red",
  indigo: "Indigo",
  teal: "Teal",
  cyan: "Cyan",
  rose: "Rose",
};

export const SAGE_THEME_TOKENS: Record<SageThemeColor, SageThemeToken> = {
  blue: { hex: "#60a5fa", light: "#93c5fd", selection: "#bfdbfe", strong: "#2563eb" },
  green: { hex: "#10b981", light: "#34d399", selection: "#a7f3d0", strong: "#047857" },
  yellow: { hex: "#fbbf24", light: "#fcd34d", selection: "#fde68a", strong: "#b45309" },
  pink: { hex: "#f472b6", light: "#f9a8d4", selection: "#fbcfe8", strong: "#be185d" },
  orange: { hex: "#fb923c", light: "#fdba74", selection: "#fed7aa", strong: "#c2410c" },
  gray: { hex: "#64748b", light: "#94a3b8", selection: "#e2e8f0", strong: "#334155" },
  purple: { hex: "#a78bfa", light: "#c4b5fd", selection: "#ddd6fe", strong: "#7c3aed" },
  red: { hex: "#f87171", light: "#fca5a5", selection: "#fecaca", strong: "#dc2626" },
  indigo: { hex: "#818cf8", light: "#a5b4fc", selection: "#c7d2fe", strong: "#4f46e5" },
  teal: { hex: "#2dd4bf", light: "#5eead4", selection: "#99f6e4", strong: "#0f766e" },
  cyan: { hex: "#22d3ee", light: "#67e8f9", selection: "#a5f3fc", strong: "#0891b2" },
  rose: { hex: "#fb7185", light: "#fda4af", selection: "#fecdd3", strong: "#be123c" },
};

/**
 * 判断外部存储里的字符串是否是当前支持的 Sage 主题色。
 *
 * @param value 待校验的主题色值。
 */
export function isSageThemeColor(value: string | null): value is SageThemeColor {
  return SAGE_THEME_COLORS.includes(value as SageThemeColor);
}

/**
 * 把十六进制颜色转换成 rgba，用于生成同一主题色的边框、底色和阴影层级。
 *
 * @param hex 十六进制颜色。
 * @param alpha 透明度，范围 0 到 1。
 */
function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/**
 * 生成可直接注入到 React style 的 Sage 主题 CSS 变量。
 *
 * @param themeColor 当前用户选择的主题色。
 */
export function getSageThemeVariables(themeColor: SageThemeColor): SageThemeVariables {
  const theme = SAGE_THEME_TOKENS[themeColor];

  return {
    "--theme-color": theme.hex,
    "--accent": theme.hex,
    "--accent-light": theme.light,
    "--accent-selection": theme.selection,
    "--accent-strong": theme.strong,
    "--accent-soft": hexToRgba(theme.hex, 0.12),
    "--accent-tint": hexToRgba(theme.hex, 0.08),
    "--accent-border": hexToRgba(theme.hex, 0.22),
    "--accent-border-strong": hexToRgba(theme.hex, 0.34),
    "--accent-shadow": hexToRgba(theme.hex, 0.18),
    "--accent-shadow-strong": hexToRgba(theme.hex, 0.28),
    "--accent-fill": theme.hex,
    "--accent-fill-hover": theme.strong,
    "--accent-selection-soft": hexToRgba(theme.selection, 0.48),
    "--accent-selection-strong": hexToRgba(theme.selection, 0.72),
  };
}
