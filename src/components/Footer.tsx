import * as Lucide from "lucide-react";

import type { AppLocaleText } from "../constants/i18n";
import { REFRESH_INTERVAL_OPTIONS } from "../types";
import type { Lang, RefreshIntervalMinutes } from "../types";

interface Props {
  lang: Lang;
  refreshIntervalMinutes: RefreshIntervalMinutes;
  onAddAccount: () => void;
  onRefreshIntervalChange: (value: RefreshIntervalMinutes) => void;
  onToggleLang: () => void;
  onQuit: () => void;
  translations: AppLocaleText;
}

/**
 * 底部操作栏，承载全局级别的新增、语言切换和退出入口。
 */
export function Footer({
  lang,
  refreshIntervalMinutes,
  onAddAccount,
  onRefreshIntervalChange,
  onToggleLang,
  onQuit,
  translations: t,
}: Props) {
  return (
    <footer className="footer-bar no-drag">
      <button className="footer-primary" type="button" onClick={onAddAccount}>
        <Lucide.Plus size={16} />
        <span>{t.actions.addAccount}</span>
      </button>

      <div className="footer-actions">
        <label
          className="footer-chip footer-chip--select"
          title={t.settings.refreshInterval}
        >
          <Lucide.RefreshCw size={15} />
          <select
            aria-label={t.settings.refreshInterval}
            className="footer-select"
            value={refreshIntervalMinutes}
            onChange={(event) =>
              onRefreshIntervalChange(
                Number(event.target.value) as RefreshIntervalMinutes,
              )
            }
          >
            {REFRESH_INTERVAL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t.settings.refreshIntervalOption(option)}
              </option>
            ))}
          </select>
          <Lucide.ChevronDown size={14} />
        </label>
        <button
          className="footer-chip"
          type="button"
          onClick={onToggleLang}
          title={t.actions.language}
        >
          {lang}
        </button>
        <button
          className="footer-chip footer-chip--danger"
          type="button"
          onClick={onQuit}
        >
          <Lucide.Power size={15} />
          <span>{t.actions.quit}</span>
        </button>
      </div>
    </footer>
  );
}
