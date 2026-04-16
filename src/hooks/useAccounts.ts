import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getAccountsCheck, getUsage } from '../services/api'
import type {
  Account,
  AccountUsageHistory,
  AccountUsageHistoryPoint,
  DiagnosticLogInput,
  Lang,
  OAuthTokenPayload,
  RefreshIntervalMinutes,
  RefreshTokenPayload,
} from '../types'
import { getLatestUpdateAt, isUsageExhausted } from '../utils/account-display'

const HISTORY_POINT_LIMIT = 24

interface UseAccountsOptions {
  lang: Lang
  refreshIntervalMinutes: RefreshIntervalMinutes
  appendDiagnosticLog: (entry: DiagnosticLogInput) => void
}

interface UseAccountsResult {
  accounts: Account[]
  setAccounts: Dispatch<SetStateAction<Account[]>>
  usageHistory: AccountUsageHistory
  setUsageHistory: Dispatch<SetStateAction<AccountUsageHistory>>
  activeId: string | null
  setActiveId: Dispatch<SetStateAction<string | null>>
  isRefreshing: boolean
  refreshingIds: Set<string>
  refreshAll: () => Promise<void>
  handleRefreshOne: (account: Account) => Promise<Account>
  lastUpdateAt: string | null
  isLoaded: boolean
}

/**
 * 根据当前账号生成一条历史快照。
 *
 * @param account 需要记录历史的账号。
 */
function createHistoryPoint(account: Account): AccountUsageHistoryPoint {
  return {
    timestamp: account.last_update || new Date().toISOString(),
    usage5h: account.usage_5h,
    usageWeek: account.usage_week,
    status: account.status,
  }
}

/**
 * 将最新快照追加到历史记录中，并自动去重和裁剪。
 *
 * @param history 当前历史集合。
 * @param account 已刷新完成的账号。
 */
function appendHistorySnapshot(
  history: AccountUsageHistory,
  account: Account,
): AccountUsageHistory {
  const nextPoint = createHistoryPoint(account)
  const previousPoints = history[account.id] ?? []
  const lastPoint = previousPoints.at(-1)

  if (
    lastPoint &&
    lastPoint.usage5h === nextPoint.usage5h &&
    lastPoint.usageWeek === nextPoint.usageWeek &&
    lastPoint.status === nextPoint.status
  ) {
    return history
  }

  return {
    ...history,
    [account.id]: [...previousPoints, nextPoint].slice(-HISTORY_POINT_LIMIT),
  }
}

/**
 * 删除已经不在列表中的账号历史，避免备份和诊断面板持续堆积脏数据。
 *
 * @param history 当前历史集合。
 * @param accounts 仍然存在的账号列表。
 */
function pruneUsageHistory(
  history: AccountUsageHistory,
  accounts: Account[],
): AccountUsageHistory {
  const validIds = new Set(accounts.map((account) => account.id))
  const nextHistory: AccountUsageHistory = {}

  Object.entries(history).forEach(([accountId, points]) => {
    if (validIds.has(accountId)) {
      nextHistory[accountId] = points
    }
  })

  return nextHistory
}

/**
 * 管理账户列表、刷新状态、历史快照与本地持久化。
 *
 * @param options 当前语言、刷新间隔和诊断日志回调。
 */
export function useAccounts({
  lang,
  refreshIntervalMinutes,
  appendDiagnosticLog,
}: UseAccountsOptions): UseAccountsResult {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [usageHistory, setUsageHistory] = useState<AccountUsageHistory>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set())
  const lastUpdateAt = useMemo(() => getLatestUpdateAt(accounts), [accounts])

  /**
   * 保存最新账号列表，供刷新中的异步闭包读取当前快照。
   */
  const accountsRef = useRef<Account[]>([])
  /**
   * 保存最新激活账号 ID，避免异步刷新过程里读到旧闭包值。
   */
  const activeIdRef = useRef<string | null>(null)
  /**
   * 复用全量刷新中的 Promise，避免托盘展开、定时器和手动触发并发执行。
   */
  const refreshAllPromiseRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    accountsRef.current = accounts
  }, [accounts])

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    let mounted = true

    const init = async (): Promise<void> => {
      // 首次启动优先恢复本地缓存，避免界面在空态和真实数据之间闪动。
      const [savedAccounts, savedActiveId, savedUsageHistory] = await Promise.all([
        window.codexAPI.getAccounts(),
        window.codexAPI.getActiveId(),
        window.codexAPI.getUsageHistory(),
      ])

      if (!mounted) {
        return
      }

      if (savedAccounts) {
        setAccounts(savedAccounts)
      }

      if (savedActiveId) {
        setActiveId(savedActiveId)
      }

      if (savedUsageHistory) {
        setUsageHistory(pruneUsageHistory(savedUsageHistory, savedAccounts ?? []))
      }

      setIsLoaded(true)
    }

    void init()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (isLoaded) {
      void window.codexAPI.setAccounts(accounts)
    }
  }, [accounts, isLoaded])

  useEffect(() => {
    if (isLoaded) {
      void window.codexAPI.setActiveId(activeId)
    }
  }, [activeId, isLoaded])

  useEffect(() => {
    if (isLoaded) {
      void window.codexAPI.setUsageHistory(usageHistory)
    }
  }, [isLoaded, usageHistory])

  useEffect(() => {
    if (!isLoaded || !activeId) {
      return
    }

    // 持久化数据与列表变更不同步时，主动回退到一个真实存在的账号。
    if (!accounts.some((account) => account.id === activeId)) {
      setActiveId(accounts[0]?.id ?? null)
    }
  }, [accounts, activeId, isLoaded])

  useEffect(() => {
    setUsageHistory((previous) => {
      const nextHistory = pruneUsageHistory(previous, accounts)
      return JSON.stringify(previous) === JSON.stringify(nextHistory) ? previous : nextHistory
    })
  }, [accounts])

  /**
   * 尝试用 refresh_token 换取新的 access_token。
   * 成功时返回含新 token 的账号对象，失败时返回 null。
   */
  const tryRefreshToken = useCallback(async (account: Account): Promise<Account | null> => {
    try {
      const result = await window.codexAPI.refreshToken(account)
      if (!result.success || !result.data) {
        appendDiagnosticLog({
          level: 'warning',
          category: 'oauth',
          message: `账号 ${account.email} 的会话续期失败，需要重新登录。`,
          accountId: account.id,
          email: account.email,
        })
        return null
      }

      const tokenPayload = result.data as RefreshTokenPayload

      appendDiagnosticLog({
        level: 'info',
        category: 'security',
        message: `账号 ${account.email} 的访问令牌已自动续期。`,
        accountId: account.id,
        email: account.email,
      })

      // 刷新接口可能只返回新的 access_token，缺失字段时保留旧值，避免把账号写成半失效状态。
      return {
        ...account,
        access_token: tokenPayload.access_token,
        refresh_token: tokenPayload.refresh_token || account.refresh_token,
        id_token: tokenPayload.id_token || account.id_token,
      }
    } catch {
      appendDiagnosticLog({
        level: 'warning',
        category: 'oauth',
        message: `账号 ${account.email} 的会话续期请求失败。`,
        accountId: account.id,
        email: account.email,
      })
      return null
    }
  }, [appendDiagnosticLog])

  /**
   * 当前激活账号的 token 在后台刷新后，同步写回 Codex 的 auth.json。
   *
   * @param account 已拿到最新 token 的账号。
   */
  const syncActiveAccountAuth = useCallback(async (account: Account): Promise<void> => {
    if (!activeIdRef.current || account.id !== activeIdRef.current) {
      return
    }

    const result = await window.codexAPI.syncAccountAuth(account)
    if (!result.success) {
      appendDiagnosticLog({
        level: 'error',
        category: 'security',
        message: `当前激活账号 ${account.email} 的本地授权同步失败。`,
        accountId: account.id,
        email: account.email,
      })
      console.error('Failed to sync active account auth:', result.error)
    }
  }, [appendDiagnosticLog])

  /**
   * 在刷新完成后记录关键状态变化，避免诊断面板被普通轮询刷屏。
   *
   * @param previous 刷新前账号。
   * @param next 刷新后账号。
   */
  const trackAccountTransition = useCallback((previous: Account, next: Account): void => {
    if (previous.status === next.status) {
      return
    }

    appendDiagnosticLog({
      level:
        next.status === 'normal' || next.status === 'warning'
          ? 'info'
          : 'warning',
      category: 'refresh',
      message: `账号 ${next.email} 的状态已从 ${previous.status} 变为 ${next.status}。`,
      accountId: next.id,
      email: next.email,
    })
  }, [appendDiagnosticLog])

  /**
   * 刷新单个账户并回填最新状态。
   * 遇到 401 时先尝试 token 刷新，刷新成功则重试，失败才标记 expired。
   */
  const refreshOne = useCallback(async (account: Account): Promise<Account> => {
    try {
      let workingAccount = account
      let usageRes = await getUsage(workingAccount, lang)

      // 401：先尝试自动刷新 token，避免用户被迫重新登录。
      if (!usageRes.success && usageRes.status === 401) {
        const refreshed = await tryRefreshToken(workingAccount)
        if (refreshed) {
          workingAccount = refreshed
          await syncActiveAccountAuth(workingAccount)
          usageRes = await getUsage(workingAccount, lang)
        }
      }

      if (!usageRes.success) {
        if (usageRes.status === 401) {
          const nextAccount = { ...workingAccount, status: 'expired' as const }
          trackAccountTransition(account, nextAccount)
          return nextAccount
        }

        if (usageRes.status === 402 || usageRes.status === 403) {
          const nextAccount = { ...workingAccount, status: 'disabled' as const }
          trackAccountTransition(account, nextAccount)
          return nextAccount
        }

        appendDiagnosticLog({
          level: 'warning',
          category: 'refresh',
          message: `账号 ${account.email} 的额度刷新失败，将保留上一次状态。`,
          accountId: account.id,
          email: account.email,
        })
        return account
      }

      if (!usageRes.data) {
        return workingAccount
      }

      const { rate_limit, plan_type } = usageRes.data

      // orgName 已有值时跳过组织接口，减少每次刷新的请求数量。
      let orgName = workingAccount.orgName
      if (!orgName) {
        const orgRes = await getAccountsCheck(workingAccount, lang)
        if (orgRes.success && orgRes.data?.accounts) {
          const accountsData = orgRes.data.accounts
          const orgInfo = accountsData[workingAccount.accountId]
          const firstOrg = Object.values(accountsData)[0]

          // 主组织名称未返回时，回退到列表中的第一个组织，尽量保证界面有可读名称。
          orgName = orgInfo?.account?.name || firstOrg?.account?.name || ''
        }
      }

      const u5h = rate_limit.primary_window?.used_percent || 0
      const u7d = rate_limit.secondary_window?.used_percent || 0

      let status: Account['status'] = 'normal'
      // 优先标记真正不可用的状态，再处理接近阈值的预警态。
      if (isUsageExhausted(u5h) || isUsageExhausted(u7d)) status = 'exhausted'
      else if (u5h >= 80 || u7d >= 80) status = 'warning'

      const nextAccount: Account = {
        ...workingAccount,
        orgName,
        planType: plan_type || 'free',
        usage_5h: u5h,
        usage_week: u7d,
        reset_5h: rate_limit.primary_window?.reset_at,
        reset_week: rate_limit.secondary_window?.reset_at,
        status,
        last_update: new Date().toISOString(),
      }

      trackAccountTransition(account, nextAccount)
      return nextAccount
    } catch {
      appendDiagnosticLog({
        level: 'warning',
        category: 'refresh',
        message: `账号 ${account.email} 的刷新请求发生异常。`,
        accountId: account.id,
        email: account.email,
      })
      return account
    }
  }, [appendDiagnosticLog, lang, syncActiveAccountAuth, trackAccountTransition, tryRefreshToken])

  useEffect(() => {
    const handleOAuthSuccess = async (tokenData: OAuthTokenPayload): Promise<void> => {
      if (!tokenData || !tokenData.id_token) return

      try {
        const payloadBase64 = tokenData.id_token.split('.')[1]
        const payloadJson = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')))

        const newAccount: Account = {
          id: crypto.randomUUID(),
          accountId: payloadJson.sub || 'unknown',
          email: payloadJson.email || 'Unknown Email',
          orgName: '',
          planType: 'free',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          id_token: tokenData.id_token,
          usage_5h: 0,
          usage_week: 0,
          status: 'normal',
          last_update: new Date().toISOString(),
        }

        const updatedAccount = await refreshOne(newAccount)
        const existingAccount = accountsRef.current.find(
          (account) => account.accountId === newAccount.accountId,
        )
        const resolvedActiveId = existingAccount?.id ?? newAccount.id

        setAccounts((previous) => {
          const exists = previous.find((account) => account.accountId === newAccount.accountId)
          if (exists) {
            return previous.map((account) =>
              account.accountId === newAccount.accountId
                ? { ...updatedAccount, id: account.id, last_switched_at: account.last_switched_at }
                : account,
            )
          }

          return [updatedAccount, ...previous]
        })
        setUsageHistory((previous) => appendHistorySnapshot(previous, updatedAccount))
        setActiveId((previous) => previous || resolvedActiveId)

        appendDiagnosticLog({
          level: 'info',
          category: 'oauth',
          message: existingAccount
            ? `账号 ${updatedAccount.email} 已重新登录并更新。`
            : `账号 ${updatedAccount.email} 已接入 CodexManager。`,
          accountId: existingAccount?.id ?? updatedAccount.id,
          email: updatedAccount.email,
        })
      } catch (err) {
        console.error('Failed to handle oauth success:', err)
      }
    }

    return window.codexAPI.onOAuthSuccess((payload) => {
      void handleOAuthSuccess(payload)
    })
  }, [appendDiagnosticLog, refreshOne])

  /**
   * 外部调用：全量刷新。
   */
  const refreshAll = useCallback((): Promise<void> => {
    if (refreshAllPromiseRef.current) {
      return refreshAllPromiseRef.current
    }

    if (!accountsRef.current.length) {
      return Promise.resolve()
    }

    const runRefreshAll = async (): Promise<void> => {
      setIsRefreshing(true)

      try {
        const snapshot = [...accountsRef.current]
        const updated = await Promise.all(snapshot.map(refreshOne))
        const updatedMap = new Map(updated.map((account) => [account.id, account]))

        // 只回填当前仍存在的账号，避免删除操作被并发刷新“写回来”。
        setAccounts((previous) => previous.map((item) => updatedMap.get(item.id) ?? item))
        setUsageHistory((previous) => {
          return updated.reduce(
            (history, account) => appendHistorySnapshot(history, account),
            previous,
          )
        })
      } finally {
        setIsRefreshing(false)
        refreshAllPromiseRef.current = null
      }
    }

    const refreshPromise = runRefreshAll()
    refreshAllPromiseRef.current = refreshPromise

    return refreshPromise
  }, [refreshOne])

  useEffect(() => {
    if (!isLoaded || !accounts.length) {
      return
    }

    /**
     * 菜单栏应用常驻后台时，定时同步额度，确保耗尽后能及时触发自动切换判断。
     */
    const intervalId = window.setInterval(() => {
      void refreshAll()
    }, refreshIntervalMinutes * 60 * 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [accounts.length, isLoaded, refreshAll, refreshIntervalMinutes])

  useEffect(() => {
    /**
     * 主进程要求立即同步时，复用同一套全量刷新逻辑。
     */
    const handleExternalRefresh = (): void => {
      void refreshAll()
    }

    return window.codexAPI.onRefreshAccounts(handleExternalRefresh)
  }, [refreshAll])

  /**
   * 外部调用：单点刷新。
   */
  const handleRefreshOne = useCallback(async (account: Account): Promise<Account> => {
    setRefreshingIds((previous) => {
      const next = new Set(previous)
      next.add(account.id)
      return next
    })

    try {
      const updated = await refreshOne(account)

      setAccounts((previous) =>
        previous.map((item) => (item.id === account.id ? updated : item)),
      )
      setUsageHistory((previous) => appendHistorySnapshot(previous, updated))

      return updated
    } finally {
      setRefreshingIds((previous) => {
        const next = new Set(previous)
        next.delete(account.id)
        return next
      })
    }
  }, [refreshOne])

  return {
    accounts,
    setAccounts,
    usageHistory,
    setUsageHistory,
    activeId,
    setActiveId,
    isRefreshing,
    refreshingIds,
    refreshAll,
    handleRefreshOne,
    lastUpdateAt,
    isLoaded,
  }
}
