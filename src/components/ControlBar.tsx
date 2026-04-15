import * as Lucide from 'lucide-react'

import type { AppLocaleText } from '../constants/i18n'
import type { AccountFilter, AccountSortKey } from '../types'

interface Props {
  filter: AccountFilter
  resultCount: number
  searchValue: string
  sortKey: AccountSortKey
  onFilterChange: (value: AccountFilter) => void
  onSearchChange: (value: string) => void
  onSortChange: (value: AccountSortKey) => void
  translations: AppLocaleText
}

/**
 * 列表控制条，承载搜索、排序和面板切换入口。
 */
export function ControlBar({
  filter,
  resultCount,
  searchValue,
  sortKey,
  onFilterChange,
  onSearchChange,
  onSortChange,
  translations: t,
}: Props) {
  const filters: AccountFilter[] = ['all', 'healthy', 'attention']

  return (
    <section className="control-bar no-drag">
      <div className="control-bar-top">
        <strong className="control-value">{t.pages.resultCount(resultCount)}</strong>

        <div className="control-actions">
          <label className="control-select control-select--compact">
            <Lucide.ArrowUpDown size={14} />
            <select
              aria-label={t.toolbar.sortLabel}
              value={sortKey}
              onChange={(event) => onSortChange(event.target.value as AccountSortKey)}
            >
              {Object.entries(t.sorts).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="inline-filter-group">
            {filters.map((currentFilter) => (
              <button
                key={currentFilter}
                className={`inline-filter-chip ${
                  filter === currentFilter ? "is-active" : ""
                }`}
                type="button"
                onClick={() => onFilterChange(currentFilter)}
              >
                {t.filters[currentFilter]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="search-field search-field--full">
        <Lucide.Search size={15} />
        <input
          type="text"
          value={searchValue}
          placeholder={t.toolbar.searchPlaceholder}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {searchValue && (
          <button
            className="search-clear"
            type="button"
            onClick={() => onSearchChange('')}
            title={t.actions.closePanel}
          >
            <Lucide.X size={14} />
          </button>
        )}
      </label>
    </section>
  )
}
