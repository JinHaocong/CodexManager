import * as Lucide from "lucide-react";

import {
  SAGE_THEME_COLORS,
  SAGE_THEME_LABELS,
  SAGE_THEME_TOKENS,
} from "../constants/theme";
import type { SageThemeColor } from "../constants/theme";

interface Props {
  value: SageThemeColor;
  onChange: (value: SageThemeColor) => void;
}

/**
 * Sage 主题色选择器，用 12 个固定色点驱动整站 CSS 变量。
 */
export function ThemePicker({ value, onChange }: Props) {
  return (
    <div className="theme-picker" aria-label="Theme color">
      <Lucide.Palette size={14} />
      <div className="theme-picker-dots">
        {SAGE_THEME_COLORS.map((color) => {
          const token = SAGE_THEME_TOKENS[color];

          return (
            <button
              key={color}
              aria-label={SAGE_THEME_LABELS[color]}
              className={`theme-dot ${value === color ? "is-active" : ""}`}
              style={{ backgroundColor: token.hex, borderColor: token.selection }}
              title={SAGE_THEME_LABELS[color]}
              type="button"
              onClick={() => onChange(color)}
            />
          );
        })}
      </div>
    </div>
  );
}
