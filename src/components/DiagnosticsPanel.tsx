import * as Lucide from 'lucide-react'

import type { AppLocaleText } from '../constants/i18n'
import type { DiagnosticLogEntry } from '../types'

interface Props {
  logs: DiagnosticLogEntry[]
  onClear: () => void
  translations: AppLocaleText
}

/**
 * 诊断面板，展示最近的重要操作记录，便于定位刷新、切换和通知问题。
 */
export function DiagnosticsPanel({ logs, onClear, translations: t }: Props) {
  const warningCount = logs.filter((log) => log.level === 'warning').length
  const errorCount = logs.filter((log) => log.level === 'error').length
  const visibleLogs = [...logs].reverse().slice(0, 20)

  return (
    <section className="feature-panel feature-panel--diagnostics no-drag">
      <div className="feature-panel-header">
        <div>
          <h2 className="feature-panel-title">{t.diagnostics.title}</h2>
          <p className="feature-panel-description">{t.diagnostics.subtitle}</p>
        </div>

        <button
          className="feature-action-button feature-action-button--compact"
          type="button"
          onClick={onClear}
        >
          <Lucide.Trash2 size={15} />
          <span>{t.actions.clearLogs}</span>
        </button>
      </div>

      <div className="diagnostics-summary">
        <div className="diagnostic-stat">
          <span>{t.diagnostics.totalLogs}</span>
          <strong>{logs.length}</strong>
        </div>
        <div className="diagnostic-stat">
          <span>{t.diagnostics.warningLogs}</span>
          <strong>{warningCount}</strong>
        </div>
        <div className="diagnostic-stat">
          <span>{t.diagnostics.errorLogs}</span>
          <strong>{errorCount}</strong>
        </div>
      </div>

      {visibleLogs.length ? (
        <div className="diagnostic-list">
          {visibleLogs.map((log) => (
            <article className={`diagnostic-item diagnostic-item--${log.level}`} key={log.id}>
              <div className="diagnostic-item-top">
                <span className="diagnostic-badge">
                  {t.diagnostics.categories[log.category]}
                </span>
                <span className="diagnostic-level">
                  {t.diagnostics.levels[log.level]}
                </span>
              </div>
              <p className="diagnostic-message">{log.message}</p>
              <span className="diagnostic-time">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </article>
          ))}
        </div>
      ) : (
        <div className="diagnostic-empty">
          <Lucide.Activity size={16} />
          <span>{t.diagnostics.empty}</span>
        </div>
      )}
    </section>
  )
}
