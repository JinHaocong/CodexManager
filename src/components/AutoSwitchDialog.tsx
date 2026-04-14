import type { AppLocaleText } from '../constants/i18n'
import type { AutoSwitchDialogMode } from '../types'

interface Props {
  mode: AutoSwitchDialogMode
  currentLabel: string
  nextLabel?: string
  rememberChoice: boolean
  onRememberChoiceChange: (value: boolean) => void
  onConfirm: () => void
  onCancel: () => void
  translations: AppLocaleText
}

/**
 * 自动切换额度时的确认弹窗。
 *
 * `confirm-switch` 会展示确认与记忆选项，
 * `no-available-account` 只承担状态告知。
 */
export function AutoSwitchDialog({
  mode,
  currentLabel,
  nextLabel,
  rememberChoice,
  onRememberChoiceChange,
  onConfirm,
  onCancel,
  translations: t
}: Props) {
  const isConfirmMode = mode === 'confirm-switch'

  return (
    <div className="modal-backdrop no-drag" role="presentation">
      <section
        aria-labelledby="auto-switch-dialog-title"
        aria-modal="true"
        className="modal-card"
        role="dialog"
      >
        <div className="modal-copy">
          <h2 className="modal-title" id="auto-switch-dialog-title">
            {isConfirmMode ? t.autoSwitch.confirmTitle : t.autoSwitch.noAvailableTitle}
          </h2>
          <p className="modal-description">
            {isConfirmMode && nextLabel
              ? t.autoSwitch.confirmDescription(currentLabel, nextLabel)
              : t.autoSwitch.noAvailableDescription(currentLabel)}
          </p>
        </div>

        <div className="modal-account-list">
          <div className="modal-account-pill">
            <span className="modal-account-label">{t.autoSwitch.currentAccount}</span>
            <strong className="modal-account-value">{currentLabel}</strong>
          </div>

          {isConfirmMode && nextLabel && (
            <div className="modal-account-pill modal-account-pill--accent">
              <span className="modal-account-label">{t.autoSwitch.nextAccount}</span>
              <strong className="modal-account-value">{nextLabel}</strong>
            </div>
          )}
        </div>

        {isConfirmMode && (
          <label className="modal-checkbox">
            <input
              checked={rememberChoice}
              type="checkbox"
              onChange={(event) => onRememberChoiceChange(event.target.checked)}
            />
            <span>{t.autoSwitch.rememberChoice}</span>
          </label>
        )}

        <div className="modal-actions">
          {isConfirmMode && (
            <button className="modal-secondary-button" type="button" onClick={onCancel}>
              {t.autoSwitch.cancel}
            </button>
          )}
          <button className="modal-primary-button" type="button" onClick={onConfirm}>
            {isConfirmMode ? t.autoSwitch.confirm : t.autoSwitch.acknowledge}
          </button>
        </div>
      </section>
    </div>
  )
}
