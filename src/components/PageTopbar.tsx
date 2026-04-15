import * as Lucide from "lucide-react";

interface Props {
  description: string;
  isRefreshing: boolean;
  lastUpdatedLabel: string;
  refreshLabel: string;
  refreshingLabel: string;
  title: string;
  onRefreshAll: () => void;
}

/**
 * 页面级顶部栏，提供紧凑的标题区和统一刷新入口。
 */
export function PageTopbar({
  description,
  isRefreshing,
  lastUpdatedLabel,
  refreshLabel,
  refreshingLabel,
  title,
  onRefreshAll,
}: Props) {
  return (
    <header className="page-topbar drag-region">
      <div className="page-topbar-copy">
        <h1 className="page-topbar-title">{title}</h1>
        <p className="page-topbar-description">{description}</p>
      </div>

      <div className="page-topbar-actions no-drag">
        <span className="page-sync-chip">{lastUpdatedLabel}</span>
        <button
          className="page-refresh-button"
          type="button"
          onClick={onRefreshAll}
          disabled={isRefreshing}
        >
          <Lucide.RefreshCw size={15} className={isRefreshing ? "spin" : ""} />
          <span>{isRefreshing ? refreshingLabel : refreshLabel}</span>
        </button>
      </div>
    </header>
  );
}
