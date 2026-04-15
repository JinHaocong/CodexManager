import * as Lucide from "lucide-react";
import appIconUrl from "../../assets/app-icon.svg";

import type { AppLocaleText } from "../constants/i18n";
import type { Lang } from "../types";

type AppPage = "accounts" | "strategy" | "system";

interface Props {
  activeLabel: string;
  attentionCount: number;
  currentPage: AppPage;
  lang: Lang;
  readyCount: number;
  totalCount: number;
  onAddAccount: () => void;
  onChangePage: (page: AppPage) => void;
  onQuit: () => void;
  onToggleLang: () => void;
  translations: AppLocaleText;
}

/**
 * 侧边导航壳，负责承载品牌、页面切换、关键摘要和全局动作。
 */
export function AppSidebar({
  activeLabel,
  attentionCount,
  currentPage,
  lang,
  readyCount,
  totalCount,
  onAddAccount,
  onChangePage,
  onQuit,
  onToggleLang,
  translations: t,
}: Props) {
  const navItems = [
    {
      id: "accounts" as const,
      icon: Lucide.LayoutList,
      label: t.navigation.accounts,
    },
    {
      id: "strategy" as const,
      icon: Lucide.SlidersHorizontal,
      label: t.navigation.strategy,
    },
    {
      id: "system" as const,
      icon: Lucide.ShieldCheck,
      label: t.navigation.system,
    },
  ];

  return (
    <aside className="workspace-sidebar">
      <div className="sidebar-brand drag-region">
        <div className="sidebar-brand-mark">
          <img src={appIconUrl} alt="CodexManager" />
        </div>
        <div className="sidebar-brand-copy">
          <strong className="sidebar-brand-title">CodexManager</strong>
          <span className="sidebar-brand-subtitle">{t.subtitle}</span>
        </div>
      </div>

      <nav className="sidebar-nav no-drag">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              className={`sidebar-nav-item ${
                currentPage === item.id ? "is-active" : ""
              }`}
              type="button"
              onClick={() => onChangePage(item.id)}
            >
              <Icon size={15} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <section className="sidebar-summary no-drag">
        <div className="sidebar-summary-header">
          <span className="sidebar-summary-label">{t.stats.active}</span>
          <strong className="sidebar-summary-value" title={activeLabel}>
            {activeLabel}
          </strong>
        </div>

        <div className="sidebar-stats">
          <div className="sidebar-stat">
            <span>{t.stats.total}</span>
            <strong>{totalCount}</strong>
          </div>
          <div className="sidebar-stat">
            <span>{t.stats.ready}</span>
            <strong>{readyCount}</strong>
          </div>
          <div className="sidebar-stat">
            <span>{t.stats.attention}</span>
            <strong>{attentionCount}</strong>
          </div>
        </div>
      </section>

      <div className="sidebar-actions no-drag">
        <button className="sidebar-primary-action" type="button" onClick={onAddAccount}>
          <Lucide.Plus size={15} />
          <span>{t.actions.addAccount}</span>
        </button>

        <div className="sidebar-secondary-actions">
          <button className="sidebar-chip" type="button" onClick={onToggleLang}>
            {lang}
          </button>
          <button
            className="sidebar-chip sidebar-chip--danger"
            type="button"
            onClick={onQuit}
          >
            <Lucide.Power size={14} />
            <span>{t.actions.quit}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
