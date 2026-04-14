import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getUsage, getAccountsCheck } from '../services/api'
import type { Account, Lang, OAuthTokenPayload, RefreshIntervalMinutes } from '../types'
import { getLatestUpdateAt } from '../utils/account-display'

/**
 * 管理账户列表、刷新状态与本地持久化。
 *
 * @param lang 当前界面语言，会影响请求头中的语言参数。
 * @param refreshIntervalMinutes 后台自动刷新间隔，单位分钟。
 */
export function useAccounts(lang: Lang, refreshIntervalMinutes: RefreshIntervalMinutes) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set())
  const lastUpdateAt = useMemo(() => getLatestUpdateAt(accounts), [accounts])

  /**
   * 记录最近一次刷新完成的时间戳，用于防止外部触发与定时器并发执行。
   */
  const lastRefreshTimeRef = useRef<number>(0)

  useEffect(() => {
    let mounted = true

    const init = async (): Promise<void> => {
      // 首次启动优先恢复本地缓存，避免界面在空态和真实数据之间闪动。
      const [savedAccounts, savedActiveId] = await Promise.all([
        window.codexAPI.getAccounts(),
        window.codexAPI.getActiveId()
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
    if (!isLoaded || !activeId) {
      return
    }

    // 持久化数据与列表变更不同步时，主动回退到一个真实存在的账号。
    if (!accounts.some((account) => account.id === activeId)) {
      setActiveId(accounts[0]?.id ?? null)
    }
  }, [accounts, activeId, isLoaded])

  /**
   * 尝试用 refresh_token 换取新的 access_token。
   * 成功时返回含新 token 的账号对象，失败时返回 null。
   */
  const tryRefreshToken = useCallback(async (account: Account): Promise<Account | null> => {
    try {
      const result = await window.codexAPI.refreshToken(account)
      if (!result.success || !result.data) {
        return null
      }

      const { access_token, refresh_token, id_token } = result.data as OAuthTokenPayload
      return { ...account, access_token, refresh_token, id_token }
    } catch {
      return null
    }
  }, [])

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
          usageRes = await getUsage(workingAccount, lang)
        }
      }

      if (!usageRes.success) {
        if (usageRes.status === 401) return { ...workingAccount, status: 'expired' }
        if (usageRes.status === 402 || usageRes.status === 403) return { ...workingAccount, status: 'disabled' }
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
      if (u5h >= 100 || u7d >= 100) status = 'exhausted'
      else if (u5h >= 80 || u7d >= 80) status = 'warning'

      return {
        ...workingAccount,
        orgName,
        planType: plan_type || 'free',
        usage_5h: u5h,
        usage_week: u7d,
        reset_5h: rate_limit.primary_window?.reset_at,
        reset_week: rate_limit.secondary_window?.reset_at,
        status,
        last_update: new Date().toISOString()
      }
    } catch {
      return account
    }
  }, [lang, tryRefreshToken])

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
          last_update: new Date().toISOString()
        }

        const updatedAccount = await refreshOne(newAccount)
        const existingAccount = accounts.find((account) => account.accountId === newAccount.accountId)
        const resolvedActiveId = existingAccount?.id ?? newAccount.id

        setAccounts(prev => {
          const exists = prev.find(a => a.accountId === newAccount.accountId)
          if (exists) {
            return prev.map(a => a.accountId === newAccount.accountId ? { ...updatedAccount, id: a.id } : a)
          }
          return [updatedAccount, ...prev]
        })

        setActiveId(prev => prev || resolvedActiveId)

      } catch (err) {
        console.error('Failed to handle oauth success:', err)
      }
    }

    return window.codexAPI.onOAuthSuccess((payload) => {
      void handleOAuthSuccess(payload)
    })
  }, [accounts, refreshOne])

  /**
   * 外部调用：全量刷新。
   */
  const refreshAll = useCallback(async (): Promise<void> => {
    if (!accounts.length || isRefreshing) {
      return
    }

    lastRefreshTimeRef.current = Date.now()
    setIsRefreshing(true)

    try {
      const snapshot = accounts
      const updated = await Promise.all(snapshot.map(refreshOne))
      const updatedMap = new Map(updated.map((account) => [account.id, account]))

      // 只回填当前仍存在的账号，避免删除操作被并发刷新"写回来"。
      setAccounts((previous) => previous.map((item) => updatedMap.get(item.id) ?? item))
    } finally {
      setIsRefreshing(false)
    }
  }, [accounts, isRefreshing, refreshOne])

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
     * 距上次刷新不足 10 秒时跳过，避免与定时器或打开面板时的刷新并发执行。
     */
    const handleExternalRefresh = (): void => {
      const now = Date.now()
      if (now - lastRefreshTimeRef.current < 10_000) {
        return
      }
      void refreshAll()
    }

    return window.codexAPI.onRefreshAccounts(handleExternalRefresh)
  }, [refreshAll])

  /**
   * 外部调用：单点刷新。
   */
  const handleRefreshOne = useCallback(async (account: Account): Promise<void> => {
    setRefreshingIds((previous) => {
      const next = new Set(previous)
      next.add(account.id)
      return next
    })

    const updated = await refreshOne(account)
    setAccounts((previous) => previous.map((item) => item.id === account.id ? updated : item))
    setRefreshingIds((previous) => {
      const next = new Set(previous)
      next.delete(account.id)
      return next
    })
  }, [refreshOne])

  return {
    accounts,
    setAccounts,
    activeId,
    setActiveId,
    isRefreshing,
    refreshingIds,
    refreshAll,
    handleRefreshOne,
    lastUpdateAt,
    isLoaded
  }
}
