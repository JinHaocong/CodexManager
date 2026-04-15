import * as Lucide from "lucide-react";

import type { AppLocaleText } from "../constants/i18n";

type Page = "accounts" | "strategy" | "system";

interface Props {
  currentPage: Page;
  onChange: (page: Page) => void;
  translations: AppLocaleText;
}

/**
 * 顶层页面切换，用更明确的产品结构区分不同业务页面。
 */
export function PageTabs({ currentPage, onChange, translations: t }: Props) {
  const tabs = [
    { id: "accounts" as const, label: t.navigation.accounts, icon: Lucide.LayoutList },
    { id: "strategy" as const, label: t.navigation.strategy, icon: Lucide.SlidersHorizontal },
    { id: "system" as const, label: t.navigation.system, icon: Lucide.ShieldCheck },
  ];

  return (
    <nav className="page-tabs no-drag" aria-label="Primary navigation">
      {tabs.map((tab) => {
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            className={`page-tab ${currentPage === tab.id ? "is-active" : ""}`}
            type="button"
            onClick={() => onChange(tab.id)}
          >
            <Icon size={15} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
