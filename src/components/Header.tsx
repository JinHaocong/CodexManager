import * as Lucide from 'lucide-react'
import appIconUrl from '../../assets/app-icon.svg'

import type { AppLocaleText } from '../constants/i18n'
import type { AccountFilter } from '../types'

interface Props {
  title: string
  subtitle: string
  totalCount: number
  readyCount: number
  attentionCount: number
  activeLabel: string
  selectedFilter: AccountFilter
  lastUpdatedLabel: string
  isRefreshing: boolean
  showFilters?: boolean
  onRefreshAll: () => void
  onFilterChange: (filter: AccountFilter) => void
  translations: AppLocaleText
}

/**
 * 顶部概览区域，负责展示全局摘要和筛选入口。
 */
export function Header({
  title,
  subtitle,
  totalCount,
  readyCount,
  attentionCount,
  activeLabel,
  selectedFilter,
  lastUpdatedLabel,
  isRefreshing,
  showFilters = true,
  onRefreshAll,
  onFilterChange,
  translations: t
}: Props) {
  const filterOrder: AccountFilter[] = ['all', 'healthy', 'attention']
  // 摘要信息保持固定顺序，便于用户形成稳定的视觉记忆。
  const summaryItems = [
    { key: 'total', label: t.stats.total, value: String(totalCount), tone: 'neutral' },
    { key: 'ready', label: t.stats.ready, value: String(readyCount), tone: 'accent' },
    { key: 'attention', label: t.stats.attention, value: String(attentionCount), tone: 'warning' },
    { key: 'active', label: t.stats.active, value: activeLabel, tone: 'neutral' }
  ] as const

  return (
    <header className="hero-panel drag-region">
      <div className="hero-main-row">
        <div className="hero-brand">
          <div className="hero-brand-mark">
            <img src={appIconUrl} alt={title} />
          </div>
          <div className="hero-brand-copy">
            <div className="hero-title-row">
              <h1 className="hero-title">{title}</h1>
            </div>
            <p className="hero-subtitle">{subtitle}</p>
          </div>
        </div>

        <div className="hero-actions no-drag">
          <span className="hero-eyebrow">{lastUpdatedLabel}</span>
          <button
            className="refresh-button"
            type="button"
            onClick={onRefreshAll}
            disabled={isRefreshing}
            title={t.actions.refreshAll}
          >
            <Lucide.RefreshCw size={15} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? t.actions.refreshing : t.actions.refreshAll}</span>
          </button>
        </div>
      </div>

      <div className="hero-summary-row no-drag">
        {summaryItems.map((item) => (
          <div key={item.key} className={`hero-stat hero-stat--${item.tone}`}>
            <span className="hero-stat-label">{item.label}</span>
            <strong className="hero-stat-value" title={item.value}>{item.value}</strong>
          </div>
        ))}
      </div>

      {showFilters && (
        <div className="filter-bar no-drag">
          {filterOrder.map((filter) => (
            <button
              key={filter}
              className={`filter-chip ${selectedFilter === filter ? 'is-active' : ''}`}
              type="button"
              onClick={() => onFilterChange(filter)}
            >
              {t.filters[filter]}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
