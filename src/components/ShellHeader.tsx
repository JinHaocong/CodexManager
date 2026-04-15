import * as Lucide from "lucide-react";
import appIconUrl from "../../assets/app-icon.svg";

import type { AppLocaleText } from "../constants/i18n";
import type { Lang } from "../types";

interface Props {
  activeLabel: string;
  isRefreshing: boolean;
  lang: Lang;
  lastUpdatedLabel: string;
  onAddAccount: () => void;
  onQuit: () => void;
  onRefreshAll: () => void;
  onToggleLang: () => void;
  translations: AppLocaleText;
}

/**
 * 应用级顶部栏，承载品牌、当前账号摘要和高频全局动作。
 */
export function ShellHeader({
  activeLabel,
  isRefreshing,
  lang,
  lastUpdatedLabel,
  onAddAccount,
  onQuit,
  onRefreshAll,
  onToggleLang,
  translations: t,
}: Props) {
  return (
    <header className="shell-header">
      <div className="shell-header-top drag-region">
        <div className="shell-brand">
          <div className="shell-brand-mark">
            <img src={appIconUrl} alt="CodexManager" />
          </div>
          <div className="shell-brand-copy">
            <strong className="shell-brand-title">CodexManager</strong>
            <span className="shell-brand-subtitle">{activeLabel}</span>
          </div>
        </div>

        <div className="shell-header-actions no-drag">
          <span className="shell-sync-chip">{lastUpdatedLabel}</span>
          <button
            className="shell-icon-button"
            type="button"
            onClick={onRefreshAll}
            disabled={isRefreshing}
            title={t.actions.refreshAll}
          >
            <Lucide.RefreshCw size={15} className={isRefreshing ? "spin" : ""} />
          </button>
        </div>
      </div>

      <div className="shell-toolbar no-drag">
        <button className="shell-primary-button" type="button" onClick={onAddAccount}>
          <Lucide.Plus size={15} />
          <span>{t.actions.addAccount}</span>
        </button>

        <div className="shell-secondary-actions">
          <button className="shell-chip" type="button" onClick={onToggleLang}>
            {lang}
          </button>
          <button className="shell-chip shell-chip--danger" type="button" onClick={onQuit}>
            <Lucide.Power size={14} />
            <span>{t.actions.quit}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
