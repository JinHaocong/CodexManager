import { useCallback, useEffect, useMemo, useState } from 'react'

import type { AppLocaleText } from '../constants/i18n'
import type {
  Account,
  AutoSwitchStrategy,
  AutoSwitchCause,
  AutoSwitchDialogMode,
  DiagnosticLogInput,
  NotificationKind,
  SystemNotificationIntent,
} from '../types'
import {
  findNextAvailableAccount,
  getAutoSwitchCause,
} from '../utils/account-display'

const AUTO_SWITCH_NOTIFICATION_CACHE_KEY = 'codex:auto-switch-notification'
const AUTO_SWITCH_NOTIFICATION_TTL_MS = 15_000

interface UseAutoSwitchOptions {
  accounts: Account[]
  activeAccount: Account | null
  activeId: string | null
  preferencesReady: boolean
  autoSwitchStrategy: AutoSwitchStrategy
  pinnedAccountIds: string[]
  skipAutoSwitchConfirm: boolean
  setSkipAutoSwitchConfirm: (value: boolean) => void
  handleSwitchAccount: (account: Account) => Promise<boolean>
  appendDiagnosticLog: (entry: DiagnosticLogInput) => void
  showSystemNotification: (
    kind: NotificationKind,
    title: string,
    body: string,
    intent: SystemNotificationIntent,
  ) => boolean
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

interface AutoSwitchNotificationCache {
  signature: string
  timestamp: number
}

/**
 * 读取最近一次自动切换通知缓存。
 */
function readAutoSwitchNotificationCache(): AutoSwitchNotificationCache | null {
  try {
    const raw = window.localStorage.getItem(AUTO_SWITCH_NOTIFICATION_CACHE_KEY)
    if (!raw) {
      return null
    }

    return JSON.parse(raw) as AutoSwitchNotificationCache
  } catch {
    return null
  }
}

/**
 * 判断同一条自动切换通知是否刚刚展示过。
 *
 * @param signature 当前自动切换事件签名。
 */
function shouldSuppressAutoSwitchNotification(signature: string): boolean {
  const cache = readAutoSwitchNotificationCache()
  if (!cache || cache.signature !== signature) {
    return false
  }

  return Date.now() - cache.timestamp < AUTO_SWITCH_NOTIFICATION_TTL_MS
}

/**
 * 记录本次自动切换通知，避免短时间内重复弹同一条系统提醒。
 *
 * @param signature 当前自动切换事件签名。
 */
function markAutoSwitchNotification(signature: string): void {
  try {
    window.localStorage.setItem(
      AUTO_SWITCH_NOTIFICATION_CACHE_KEY,
      JSON.stringify({
        signature,
        timestamp: Date.now(),
      } satisfies AutoSwitchNotificationCache),
    )
  } catch {
    // 本地缓存不可用时退化为正常提醒，不阻断主流程。
  }
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
  autoSwitchStrategy,
  pinnedAccountIds,
  skipAutoSwitchConfirm,
  setSkipAutoSwitchConfirm,
  handleSwitchAccount,
  appendDiagnosticLog,
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
    return findNextAvailableAccount(
      accounts,
      activeId,
      autoSwitchCause,
      autoSwitchStrategy,
      pinnedAccountIds,
    )
  }, [accounts, activeId, autoSwitchCause, autoSwitchStrategy, pinnedAccountIds])

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
      showSystemNotification(
        'switchSuccess',
        t.autoSwitch.switchedTitle,
        t.autoSwitch.switchedDescription(getAccountDisplayName(account)),
        'show-window',
      )

      appendDiagnosticLog({
        level: 'info',
        category: 'switch',
        message: `应用已切换到账号 ${account.email}。`,
        accountId: account.id,
        email: account.email,
      })
    },
    [appendDiagnosticLog, getAccountDisplayName, showSystemNotification, t.autoSwitch],
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
          } else {
            appendDiagnosticLog({
              level: 'warning',
              category: 'switch',
              message: `自动切换到账号 ${nextAvailableAccount.email} 失败。`,
              accountId: nextAvailableAccount.id,
              email: nextAvailableAccount.email,
            })
          }
        })()
        return
      }

      setRememberAutoSwitchChoice(false)
      if (shouldSuppressAutoSwitchNotification(autoSwitchSignature)) {
        return
      }

      markAutoSwitchNotification(autoSwitchSignature)
      setAutoSwitchDialogMode(null)

      const shown = showSystemNotification(
        'autoSwitchConfirm',
        t.autoSwitch.confirmTitle,
        t.autoSwitch.confirmDescription(
          getAccountDisplayName(activeAccount),
          getAccountDisplayName(nextAvailableAccount),
          t.autoSwitch.reasonLabel(autoSwitchCause),
        ),
        'open-auto-switch-dialog',
      )

      appendDiagnosticLog({
        level: 'warning',
        category: 'notification',
        message: shown
          ? `已向系统发送自动切换确认提醒，候选账号为 ${nextAvailableAccount.email}。`
          : `当前账号额度耗尽，已回退到应用内确认弹窗。`,
        accountId: activeAccount.id,
        email: activeAccount.email,
      })

      if (!shown) {
        setAutoSwitchDialogMode('confirm-switch')
      }

      return
    }

    setRememberAutoSwitchChoice(false)
    if (shouldSuppressAutoSwitchNotification(autoSwitchSignature)) {
      return
    }

    markAutoSwitchNotification(autoSwitchSignature)
    setAutoSwitchDialogMode(null)

    const shown = showSystemNotification(
      'autoSwitchUnavailable',
      t.autoSwitch.noAvailableTitle,
      t.autoSwitch.noAvailableDescription(
        getAccountDisplayName(activeAccount),
        t.autoSwitch.reasonLabel(autoSwitchCause),
      ),
      'show-window',
    )

    appendDiagnosticLog({
      level: 'warning',
      category: 'notification',
      message: shown
        ? `已提醒当前账号 ${activeAccount.email} 无可用候选账号可切换。`
        : `当前账号 ${activeAccount.email} 无可用候选账号，已在应用内展示提示。`,
      accountId: activeAccount.id,
      email: activeAccount.email,
    })

    if (!shown) {
      setAutoSwitchDialogMode('no-available-account')
    }
  }, [
    activeAccount,
    appendDiagnosticLog,
    autoSwitchCause,
    autoSwitchSignature,
    getAccountDisplayName,
    handleSwitchAccount,
    handledAutoSwitchSignature,
    nextAvailableAccount,
    notifyAutoSwitchSuccess,
    autoSwitchStrategy,
    pinnedAccountIds,
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
      } else {
        appendDiagnosticLog({
          level: 'warning',
          category: 'switch',
          message: `确认后切换到账号 ${nextAvailableAccount.email} 失败。`,
          accountId: nextAvailableAccount.id,
          email: nextAvailableAccount.email,
        })
      }
      return
    }
    setAutoSwitchDialogMode(null)
  }, [
    appendDiagnosticLog,
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
