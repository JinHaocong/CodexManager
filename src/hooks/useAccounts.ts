import { useCallback, useEffect, useMemo, useState } from 'react'
import type { IpcRenderer } from 'electron'

import { getUsage, getAccountsCheck } from '../services/api'
import type { Account, Lang } from '../types'
import { getLatestUpdateAt } from '../utils/account-display'

const { ipcRenderer } = window.require('electron') as { ipcRenderer: IpcRenderer }

/**
 * 管理账户列表、刷新状态与本地持久化。
 *
 * @param lang 当前界面语言，会影响请求头中的语言参数。
 */
export function useAccounts(lang: Lang) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set())
  const lastUpdateAt = useMemo(() => getLatestUpdateAt(accounts), [accounts])

  useEffect(() => {
    let mounted = true

    const init = async (): Promise<void> => {
      // 首次启动优先恢复本地缓存，避免界面在空态和真实数据之间闪动。
      const savedAccounts = await ipcRenderer.invoke('get-accounts') as Account[] | undefined
      const savedActiveId = await ipcRenderer.invoke('get-active-id') as string | null | undefined
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
      void ipcRenderer.invoke('set-accounts', accounts)
    }
  }, [accounts, isLoaded])

  useEffect(() => {
    if (isLoaded) {
      void ipcRenderer.invoke('set-active-id', activeId)
    }
  }, [activeId, isLoaded])

  /**
   * 刷新单个账户并回填最新状态。
   */
  const refreshOne = useCallback(async (account: Account): Promise<Account> => {
    try {
      const usageRes = await getUsage(account, lang)
      if (!usageRes.success) {
        if (usageRes.status === 401) return { ...account, status: 'expired' }
        if (usageRes.status === 402 || usageRes.status === 403) return { ...account, status: 'disabled' }
        return account
      }

      if (!usageRes.data) {
        return account
      }

      const { rate_limit, plan_type } = usageRes.data
      const orgRes = await getAccountsCheck(account, lang)

      let orgName = account.orgName
      if (orgRes.success && orgRes.data?.accounts) {
        const accountsData = orgRes.data.accounts
        const orgInfo = accountsData[account.accountId]
        const firstOrg = Object.values(accountsData)[0]

        // 主组织名称未返回时，回退到列表中的第一个组织，尽量保证界面有可读名称。
        orgName = orgInfo?.account?.name || firstOrg?.account?.name || orgName
      }

      const u5h = rate_limit.primary_window?.used_percent || 0
      const u7d = rate_limit.secondary_window?.used_percent || 0

      let status: Account['status'] = 'normal'
      // 优先标记真正不可用的状态，再处理接近阈值的预警态。
      if (u5h >= 100 || u7d >= 100) status = 'exhausted'
      else if (u5h >= 80 || u7d >= 80) status = 'warning'

      return {
        ...account,
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
  }, [lang])

  useEffect(() => {
    const handleOAuthSuccess = async (_event: any, tokenData: any) => {
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

        setAccounts(prev => {
          const exists = prev.find(a => a.accountId === newAccount.accountId)
          if (exists) {
            return prev.map(a => a.accountId === newAccount.accountId ? { ...updatedAccount, id: a.id } : a)
          }
          return [updatedAccount, ...prev]
        })

        setActiveId(prev => prev || newAccount.id)

      } catch (err) {
        console.error('Failed to handle oauth success:', err)
      }
    }

    ipcRenderer.on('oauth-success', handleOAuthSuccess)
    return () => {
      ipcRenderer.removeListener('oauth-success', handleOAuthSuccess)
    }
  }, [refreshOne])

  /**
   * 外部调用：全量刷新。
   */
  const refreshAll = useCallback(async (): Promise<void> => {
    if (!accounts.length || isRefreshing) {
      return
    }

    setIsRefreshing(true)
    const updated = await Promise.all(accounts.map(refreshOne))
    setAccounts(updated)
    setIsRefreshing(false)
  }, [accounts, isRefreshing, refreshOne])

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
