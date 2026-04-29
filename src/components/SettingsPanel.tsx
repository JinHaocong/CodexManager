import * as Lucide from 'lucide-react'

import { ThemePicker } from './ThemePicker'

import type { AppLocaleText } from '../constants/i18n'
import type { SageThemeColor } from '../constants/theme'
import {
  AUTO_SWITCH_COOLDOWN_OPTIONS,
  REFRESH_INTERVAL_OPTIONS,
} from '../types'
import type {
  AutoSwitchStrategy,
  NotificationKind,
  NotificationSettings,
  RefreshIntervalMinutes,
  SecureStorageStatus,
} from '../types'

type SettingsSection =
  | 'strategy'
  | 'notifications'
  | 'appearance'
  | 'backup'
  | 'security'

interface Props {
  autoSwitchStrategy: AutoSwitchStrategy
  launchAtLoginEnabled: boolean
  notificationSettings: NotificationSettings
  refreshIntervalMinutes: RefreshIntervalMinutes
  secureStorageStatus: SecureStorageStatus
  pinnedCount: number
  excludedCount: number
  sections?: SettingsSection[]
  skipAutoSwitchConfirm: boolean
  showHeader?: boolean
  themeColor?: SageThemeColor
  onRefreshIntervalChange: (value: RefreshIntervalMinutes) => void
  onSkipAutoSwitchConfirmChange: (value: boolean) => void
  onStrategyChange: (value: AutoSwitchStrategy) => void
  onNotificationChange: (
    key: NotificationKind | 'quietHoursEnabled' | 'quietHoursStart' | 'quietHoursEnd',
    value: boolean | string,
  ) => void
  onExport: () => void
  onImport: () => void
  onLaunchAtLoginChange: (value: boolean) => void
  onThemeColorChange?: (value: SageThemeColor) => void
  translations: AppLocaleText
}

/**
 * 设置面板，集中承载自动切换策略、通知和备份相关配置。
 */
export function SettingsPanel({
  autoSwitchStrategy,
  launchAtLoginEnabled,
  notificationSettings,
  refreshIntervalMinutes,
  secureStorageStatus,
  pinnedCount,
  excludedCount,
  sections = ['strategy', 'notifications', 'backup', 'security'],
  skipAutoSwitchConfirm,
  showHeader = true,
  themeColor,
  onRefreshIntervalChange,
  onSkipAutoSwitchConfirmChange,
  onStrategyChange,
  onNotificationChange,
  onExport,
  onImport,
  onLaunchAtLoginChange,
  onThemeColorChange,
  translations: t,
}: Props) {
  const showStrategy = sections.includes('strategy')
  const showNotifications = sections.includes('notifications')
  const showAppearance =
    sections.includes('appearance') && Boolean(themeColor && onThemeColorChange)
  const showBackup = sections.includes('backup')
  const showSecurity = sections.includes('security')
  const isStrategyLayout =
    (showStrategy || showNotifications) && !showBackup && !showSecurity
  const gridClassName = isStrategyLayout
    ? 'settings-grid settings-grid--stacked'
    : 'settings-grid settings-grid--system'

  return (
    <section className="feature-panel no-drag">
      {showHeader && (
        <div className="feature-panel-header">
          <div>
            <h2 className="feature-panel-title">{t.settings.title}</h2>
            <p className="feature-panel-description">{t.settings.subtitle}</p>
          </div>

          <div className="feature-panel-badges">
            <span className="feature-badge">{t.settings.pinnedCount(pinnedCount)}</span>
            <span className="feature-badge">{t.settings.excludedCount(excludedCount)}</span>
          </div>
        </div>
      )}

      <div className={gridClassName}>
        {showStrategy && (
          <section className="settings-card settings-card--strategy">
            <div className="settings-card-header">
              <Lucide.Sparkles size={16} />
              <strong>{t.settings.strategySection}</strong>
            </div>

            <div className="settings-control-grid">
              <label className="settings-field">
                <span>{t.settings.refreshInterval}</span>
                <select
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
              </label>

              <label className="settings-field">
                <span>{t.settings.cooldown}</span>
                <select
                  value={autoSwitchStrategy.cooldownMinutes}
                  onChange={(event) =>
                    onStrategyChange({
                      ...autoSwitchStrategy,
                      cooldownMinutes: Number(
                        event.target.value,
                      ) as AutoSwitchStrategy['cooldownMinutes'],
                    })
                  }
                >
                  {AUTO_SWITCH_COOLDOWN_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t.settings.cooldownOption(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="settings-field">
                <span>{t.settings.minRemaining5h}</span>
                <select
                  value={autoSwitchStrategy.minRemaining5h}
                  onChange={(event) =>
                    onStrategyChange({
                      ...autoSwitchStrategy,
                      minRemaining5h: Number(event.target.value),
                    })
                  }
                >
                  {[0, 5, 10, 15, 20].map((option) => (
                    <option key={option} value={option}>
                      {option}%
                    </option>
                  ))}
                </select>
              </label>

              <label className="settings-field">
                <span>{t.settings.minRemaining7d}</span>
                <select
                  value={autoSwitchStrategy.minRemaining7d}
                  onChange={(event) =>
                    onStrategyChange({
                      ...autoSwitchStrategy,
                      minRemaining7d: Number(event.target.value),
                    })
                  }
                >
                  {[0, 5, 10, 15, 20, 30].map((option) => (
                    <option key={option} value={option}>
                      {option}%
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="settings-field-hint">{t.settings.candidateQuotaHint}</p>

            <label className="settings-switch settings-switch--card">
              <input
                type="checkbox"
                checked={skipAutoSwitchConfirm}
                onChange={(event) =>
                  onSkipAutoSwitchConfirmChange(event.target.checked)
                }
              />
              <span>{t.settings.skipConfirm}</span>
            </label>

            <p className="settings-hint">{t.settings.strategyHint}</p>
          </section>
        )}

        {showNotifications && (
          <section className="settings-card settings-card--notifications">
            <div className="settings-card-header">
              <Lucide.Bell size={16} />
              <strong>{t.settings.notificationsSection}</strong>
            </div>

            <div className="settings-switch-list">
              {(
                [
                  ['autoSwitchConfirm', t.autoSwitch.confirmTitle],
                  ['autoSwitchUnavailable', t.autoSwitch.noAvailableTitle],
                  ['switchSuccess', t.autoSwitch.switchedTitle],
                  ['oauthError', t.oauth.title],
                ] as const
              ).map(([key, label]) => (
                <label className="settings-switch settings-switch--card" key={key}>
                  <input
                    type="checkbox"
                    checked={notificationSettings[key]}
                    onChange={(event) =>
                      onNotificationChange(key, event.target.checked)
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <label className="settings-switch settings-switch--card">
              <input
                type="checkbox"
                checked={notificationSettings.quietHoursEnabled}
                onChange={(event) =>
                  onNotificationChange('quietHoursEnabled', event.target.checked)
                }
              />
              <span>{t.settings.quietHours}</span>
            </label>

            <div className="settings-time-grid">
              <label className="settings-field">
                <span>{t.settings.quietHoursStart}</span>
                <input
                  type="time"
                  value={notificationSettings.quietHoursStart}
                  onChange={(event) =>
                    onNotificationChange('quietHoursStart', event.target.value)
                  }
                />
              </label>
              <label className="settings-field">
                <span>{t.settings.quietHoursEnd}</span>
                <input
                  type="time"
                  value={notificationSettings.quietHoursEnd}
                  onChange={(event) =>
                    onNotificationChange('quietHoursEnd', event.target.value)
                  }
                />
              </label>
            </div>
          </section>
        )}

        {showAppearance && themeColor && onThemeColorChange && (
          <section className="settings-card settings-card--appearance">
            <div className="settings-card-header">
              <Lucide.Palette size={16} />
              <strong>{t.settings.themeSection}</strong>
            </div>

            <div className="settings-theme-row">
              <ThemePicker value={themeColor} onChange={onThemeColorChange} />
            </div>

            <p className="settings-hint">{t.settings.themeHint}</p>
          </section>
        )}

        {showBackup && (
          <section className="settings-card settings-card--backup">
            <div className="settings-card-header">
              <Lucide.Database size={16} />
              <strong>{t.settings.backupSection}</strong>
            </div>

            <div className="settings-inline-actions">
              <button className="feature-action-button" type="button" onClick={onExport}>
                <Lucide.Download size={15} />
                <span>{t.actions.exportData}</span>
              </button>
              <button className="feature-action-button" type="button" onClick={onImport}>
                <Lucide.Upload size={15} />
                <span>{t.actions.importData}</span>
              </button>
            </div>
          </section>
        )}

        {showSecurity && (
          <section className="settings-card settings-card--security">
            <div className="settings-card-header">
              <Lucide.LockKeyhole size={16} />
              <strong>{t.settings.securitySection}</strong>
            </div>

            <div className="security-card">
              <span
                className={`security-pill ${
                  secureStorageStatus.available ? 'is-safe' : 'is-fallback'
                }`}
              >
                {secureStorageStatus.available ? 'SAFE STORAGE' : 'FALLBACK'}
              </span>
              <p className="security-description">
                {secureStorageStatus.available
                  ? t.settings.secureStorageEnabled
                  : t.settings.secureStorageFallback}
              </p>
            </div>

            <label className="settings-switch settings-switch--card">
              <input
                type="checkbox"
                checked={launchAtLoginEnabled}
                onChange={(event) =>
                  onLaunchAtLoginChange(event.target.checked)
                }
              />
              <span>{t.settings.launchAtLogin}</span>
            </label>

            <p className="settings-hint">{t.settings.launchAtLoginHint}</p>
          </section>
        )}
      </div>
    </section>
  )
}
