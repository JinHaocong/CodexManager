import { useCallback, useEffect, useMemo, useState } from 'react'

import type { AppLocaleText } from '../constants/i18n'
import type {
  Account,
  AutoSwitchCause,
  AutoSwitchDialogMode,
  SystemNotificationIntent,
} from '../types'
import {
  findNextAvailableAccount,
  getAutoSwitchCause,
} from '../utils/account-display'

interface UseAutoSwitchOptions {
  accounts: Account[]
  activeAccount: Account | null
  activeId: string | null
  preferencesReady: boolean
  skipAutoSwitchConfirm: boolean
  setSkipAutoSwitchConfirm: (value: boolean) => void
  handleSwitchAccount: (account: Account) => Promise<boolean>
  canUseSystemNotifications: () => boolean
  showSystemNotification: (title: string, body: string, intent: SystemNotificationIntent) => void
  getAccountDisplayName: (account: Account | null) => string
  t: AppLocaleText
}

interface UseAutoSwitchResult {
  autoSwitchCause: AutoSwitchCause | null
  nextAvailableAccount: Account | null
  autoSwitchDialogMode: AutoSwitchDialogMode | null
  rememberAutoSwitchChoice: boolean
  setRememberAutoSwitchChoice: (value: boolean) => void
  handleConfirmAutoSwitch: () => Promise<void>
  handleCloseAutoSwitchDialog: () => void
}

/**
 * 封装自动切换的全部状态、推导值与副作用。
 * App 只需透传必要依赖，保持主组件简洁。
 */
export function useAutoSwitch({
  accounts,
  activeAccount,
  activeId,
  preferencesReady,
  skipAutoSwitchConfirm,
  setSkipAutoSwitchConfirm,
  handleSwitchAccount,
  canUseSystemNotifications,
  showSystemNotification,
  getAccountDisplayName,
  t,
}: UseAutoSwitchOptions): UseAutoSwitchResult {
  const [handledAutoSwitchSignature, setHandledAutoSwitchSignature] = useState<string | null>(null)
  const [rememberAutoSwitchChoice, setRememberAutoSwitchChoice] = useState(false)
  const [autoSwitchDialogMode, setAutoSwitchDialogMode] = useState<AutoSwitchDialogMode | null>(null)

  const autoSwitchCause = useMemo(() => {
    return activeAccount ? getAutoSwitchCause(activeAccount) : null
  }, [activeAccount])

  const nextAvailableAccount = useMemo(() => {
    return findNextAvailableAccount(accounts, activeId)
  }, [accounts, activeId])

  /**
   * 签名只关联「当前激活账号 + 耗尽原因 + 下一候选账号」三个维度。
   * 其他账号的数据刷新不会改变签名，从而避免同一次耗尽事件被重复通知。
   */
  const autoSwitchSignature = useMemo(() => {
    if (!activeAccount || !autoSwitchCause) {
      return null
    }
    return `${activeAccount.id}:${autoSwitchCause}:${nextAvailableAccount?.id ?? 'none'}`
  }, [activeAccount, autoSwitchCause, nextAvailableAccount])

  /**
   * 自动切换成功后给出系统通知，让后台切换结果对用户可感知。
   */
  const notifyAutoSwitchSuccess = useCallback(
    (account: Account): void => {
      if (!canUseSystemNotifications()) return
      showSystemNotification(
        t.autoSwitch.switchedTitle,
        t.autoSwitch.switchedDescription(getAccountDisplayName(account)),
        'show-window',
      )
    },
    [canUseSystemNotifications, getAccountDisplayName, showSystemNotification, t.autoSwitch],
  )

  /**
   * 当前账号任一关键额度窗口耗尽后，根据偏好决定是否自动切换或提示用户。
   */
  useEffect(() => {
    if (
      !preferencesReady ||
      !activeAccount ||
      !autoSwitchCause ||
      !autoSwitchSignature
    ) {
      return
    }

    if (handledAutoSwitchSignature === autoSwitchSignature) {
      return
    }

    setHandledAutoSwitchSignature(autoSwitchSignature)

    if (nextAvailableAccount) {
      // 用户勾选"下次不再提醒"后，直接切换到当前最优候选账号。
      if (skipAutoSwitchConfirm) {
        void (async () => {
          const switched = await handleSwitchAccount(nextAvailableAccount)
          if (switched) {
            notifyAutoSwitchSuccess(nextAvailableAccount)
          }
        })()
        return
      }

      setRememberAutoSwitchChoice(false)
      if (!canUseSystemNotifications()) {
        setAutoSwitchDialogMode('confirm-switch')
        return
      }

      setAutoSwitchDialogMode(null)
      showSystemNotification(
        t.autoSwitch.confirmTitle,
        t.autoSwitch.confirmDescription(
          getAccountDisplayName(activeAccount),
          getAccountDisplayName(nextAvailableAccount),
          t.autoSwitch.reasonLabel(autoSwitchCause),
        ),
        'open-auto-switch-dialog',
      )
      return
    }

    setRememberAutoSwitchChoice(false)
    if (!canUseSystemNotifications()) {
      setAutoSwitchDialogMode('no-available-account')
      return
    }

    setAutoSwitchDialogMode(null)
    showSystemNotification(
      t.autoSwitch.noAvailableTitle,
      t.autoSwitch.noAvailableDescription(
        getAccountDisplayName(activeAccount),
        t.autoSwitch.reasonLabel(autoSwitchCause),
      ),
      'show-window',
    )
  }, [
    activeAccount,
    autoSwitchCause,
    autoSwitchSignature,
    canUseSystemNotifications,
    getAccountDisplayName,
    handleSwitchAccount,
    handledAutoSwitchSignature,
    nextAvailableAccount,
    notifyAutoSwitchSuccess,
    preferencesReady,
    showSystemNotification,
    skipAutoSwitchConfirm,
    t,
  ])

  /**
   * 额度恢复（签名变回 null）时重置所有弹窗和标记。
   */
  useEffect(() => {
    if (!autoSwitchSignature) {
      setHandledAutoSwitchSignature(null)
      setAutoSwitchDialogMode(null)
      setRememberAutoSwitchChoice(false)
    }
  }, [autoSwitchSignature])

  /**
   * 点击系统通知后再展开应用内确认，避免在后台工作时被面板直接打断。
   */
  useEffect(() => {
    const handleOpenAutoSwitchDialog = (): void => {
      if (!activeAccount || !autoSwitchCause || !nextAvailableAccount || !autoSwitchSignature) {
        return
      }
      setRememberAutoSwitchChoice(false)
      setAutoSwitchDialogMode('confirm-switch')
    }

    return window.codexAPI.onOpenAutoSwitchDialog(handleOpenAutoSwitchDialog)
  }, [activeAccount, autoSwitchCause, autoSwitchSignature, nextAvailableAccount])

  /**
   * 确认自动切换时按需记住用户偏好，再执行账号切换。
   */
  const handleConfirmAutoSwitch = useCallback(async (): Promise<void> => {
    if (autoSwitchDialogMode === 'confirm-switch' && nextAvailableAccount) {
      if (rememberAutoSwitchChoice) {
        setSkipAutoSwitchConfirm(true)
      }
      setAutoSwitchDialogMode(null)
      const switched = await handleSwitchAccount(nextAvailableAccount)
      if (switched) {
        notifyAutoSwitchSuccess(nextAvailableAccount)
      }
      return
    }
    setAutoSwitchDialogMode(null)
  }, [
    autoSwitchDialogMode,
    handleSwitchAccount,
    nextAvailableAccount,
    notifyAutoSwitchSuccess,
    rememberAutoSwitchChoice,
    setSkipAutoSwitchConfirm,
  ])

  const handleCloseAutoSwitchDialog = useCallback((): void => {
    setAutoSwitchDialogMode(null)
    setRememberAutoSwitchChoice(false)
  }, [])

  return {
    autoSwitchCause,
    nextAvailableAccount,
    autoSwitchDialogMode,
    rememberAutoSwitchChoice,
    setRememberAutoSwitchChoice,
    handleConfirmAutoSwitch,
    handleCloseAutoSwitchDialog,
  }
}
