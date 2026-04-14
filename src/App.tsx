import { useCallback, useEffect, useMemo, useState } from 'react'

import { AccountCard } from './components/AccountCard'
import { AutoSwitchDialog } from './components/AutoSwitchDialog'
import { EmptyState } from './components/EmptyState'
import { Footer } from './components/Footer'
import { Header } from './components/Header'

import { translations } from './constants/i18n'

import { useAccounts } from './hooks/useAccounts'

import type { IpcRenderer } from 'electron'
import type { Account, AutoSwitchDialogMode, AccountFilter, Lang } from './types'
import {
  findNextAvailableAccount,
  formatResetTime,
  formatTimestamp,
  getAutoSwitchSignature,
  getAttentionCount,
  getFilteredAccounts,
  getReadyCount,
  groupAccounts,
  isPrimaryWindowExhausted
} from './utils/account-display'

const { ipcRenderer } = window.require('electron') as { ipcRenderer: IpcRenderer }

/**
 * 应用主界面，负责串联账号数据、筛选、切换与自动切换提醒。
 */
function App() {
  const [lang, setLang] = useState<Lang>('EN')
  const [langReady, setLangReady] = useState(false)
  const [filter, setFilter] = useState<AccountFilter>('all')
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [skipAutoSwitchConfirm, setSkipAutoSwitchConfirm] = useState(false)
  const [autoSwitchSettingsReady, setAutoSwitchSettingsReady] = useState(false)
  const [handledAutoSwitchSignature, setHandledAutoSwitchSignature] = useState<string | null>(null)
  const [rememberAutoSwitchChoice, setRememberAutoSwitchChoice] = useState(false)
  const [autoSwitchDialogMode, setAutoSwitchDialogMode] = useState<AutoSwitchDialogMode | null>(null)

  const {
    accounts,
    setAccounts,
    activeId,
    setActiveId,
    isRefreshing,
    refreshingIds,
    refreshAll,
    handleRefreshOne,
    lastUpdateAt
  } = useAccounts(lang)

  const t = translations[lang]

  useEffect(() => {
    let mounted = true

    const initPreferences = async (): Promise<void> => {
      // 语言和自动切换偏好都依赖本地持久化，首屏统一初始化可避免界面闪动。
      const [savedLang, savedSkipAutoSwitchConfirm] = await Promise.all([
        ipcRenderer.invoke('get-lang') as Promise<Lang | undefined>,
        ipcRenderer.invoke('get-skip-auto-switch-confirm') as Promise<boolean | undefined>
      ])

      if (!mounted) {
        return
      }

      if (savedLang) {
        setLang(savedLang)
      }

      setSkipAutoSwitchConfirm(Boolean(savedSkipAutoSwitchConfirm))
      setAutoSwitchSettingsReady(true)
      setLangReady(true)
    }

    void initPreferences()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (langReady) {
      void ipcRenderer.invoke('set-lang', lang)
    }
  }, [lang, langReady])

  useEffect(() => {
    if (autoSwitchSettingsReady) {
      void ipcRenderer.invoke('set-skip-auto-switch-confirm', skipAutoSwitchConfirm)
    }
  }, [autoSwitchSettingsReady, skipAutoSwitchConfirm])

  const filteredAccounts = useMemo(() => getFilteredAccounts(accounts, filter), [accounts, filter])
  const groupedAccounts = useMemo(() => {
    return groupAccounts(filteredAccounts, activeId)
  }, [activeId, filteredAccounts])

  const activeAccount = useMemo(() => {
    return accounts.find((account) => account.id === activeId) || null
  }, [accounts, activeId])
  const nextAvailableAccount = useMemo(() => {
    return findNextAvailableAccount(accounts, activeId)
  }, [accounts, activeId])
  /**
   * 当前账号一旦耗尽 5 小时额度，就基于全部账户状态生成唯一签名。
   * 这样同一轮刷新里不会因为重复渲染而反复弹窗。
   */
  const autoSwitchSignature = useMemo(() => {
    if (!activeAccount || !isPrimaryWindowExhausted(activeAccount)) {
      return null
    }

    return `${activeAccount.id}:${getAutoSwitchSignature(accounts, activeId)}`
  }, [accounts, activeAccount, activeId])

  const readyCount = useMemo(() => getReadyCount(accounts), [accounts])
  const attentionCount = useMemo(() => getAttentionCount(accounts), [accounts])
  const lastUpdatedLabel = useMemo(() => {
    const formatted = formatTimestamp(lastUpdateAt, lang)
    return t.lastUpdated(formatted || t.meta.never)
  }, [lang, lastUpdateAt, t])

  /**
   * 切换当前激活账号，并在成功后持久化选择结果。
   */
  const handleSwitchAccount = useCallback(async (account: Account): Promise<void> => {
    if (switchingId) {
      return
    }

    setSwitchingId(account.id)

    try {
      const result = await ipcRenderer.invoke('switch-account', account) as { success?: boolean }
      if (result?.success) {
        setActiveId(account.id)
      }
    } finally {
      setSwitchingId(null)
    }
  }, [switchingId])

  /**
   * 删除账号时同步修正当前激活状态，避免界面保留失效选中项。
   */
  const handleDeleteAccount = useCallback((account: Account): void => {
    if (!window.confirm(t.removeConfirm)) {
      return
    }

    const nextAccounts = accounts.filter((item) => item.id !== account.id)
    setAccounts(nextAccounts)

    if (account.id === activeId) {
      setActiveId(nextAccounts[0]?.id ?? null)
    }
  }, [accounts, activeId, setAccounts, setActiveId, t.removeConfirm])

  const handleToggleLang = useCallback((): void => {
    setLang((currentLang) => currentLang === 'EN' ? 'ZH' : 'EN')
  }, [])

  /**
   * 触发 OAuth 流程，交给主进程拉起外部浏览器登录。
   */
  const handleAddAccount = useCallback((): void => {
    ipcRenderer.send('start-oauth')
  }, [])

  /**
   * 统一获取弹窗里展示的账户名称，避免出现空名称。
   */
  const getAccountDisplayName = useCallback((account: Account | null): string => {
    if (!account) {
      return t.personalWorkspace
    }

    return account.orgName || t.personalWorkspace
  }, [t.personalWorkspace])

  /**
   * 当前账号 5 小时额度耗尽后，根据偏好决定是否自动切换或提示用户。
   */
  useEffect(() => {
    if (!autoSwitchSettingsReady || !activeAccount || switchingId || !autoSwitchSignature) {
      return
    }

    if (handledAutoSwitchSignature === autoSwitchSignature) {
      return
    }

    setHandledAutoSwitchSignature(autoSwitchSignature)

    if (nextAvailableAccount) {
      // 用户勾选“下次不再提醒”后，直接切换到当前最优候选账号。
      if (skipAutoSwitchConfirm) {
        void handleSwitchAccount(nextAvailableAccount)
        return
      }

      setRememberAutoSwitchChoice(false)
      setAutoSwitchDialogMode('confirm-switch')
      return
    }

    setRememberAutoSwitchChoice(false)
    setAutoSwitchDialogMode('no-available-account')
  }, [
    activeAccount,
    autoSwitchSettingsReady,
    autoSwitchSignature,
    handleSwitchAccount,
    handledAutoSwitchSignature,
    nextAvailableAccount,
    skipAutoSwitchConfirm,
    switchingId
  ])

  useEffect(() => {
    if (!autoSwitchSignature) {
      setHandledAutoSwitchSignature(null)
      setAutoSwitchDialogMode(null)
      setRememberAutoSwitchChoice(false)
    }
  }, [autoSwitchSignature])

  /**
   * 确认自动切换时按需记住用户偏好，再执行账号切换。
   */
  const handleConfirmAutoSwitch = useCallback(async (): Promise<void> => {
    if (autoSwitchDialogMode === 'confirm-switch' && nextAvailableAccount) {
      if (rememberAutoSwitchChoice) {
        setSkipAutoSwitchConfirm(true)
      }

      setAutoSwitchDialogMode(null)
      await handleSwitchAccount(nextAvailableAccount)
      return
    }

    setAutoSwitchDialogMode(null)
  }, [autoSwitchDialogMode, handleSwitchAccount, nextAvailableAccount, rememberAutoSwitchChoice])

  const handleCloseAutoSwitchDialog = useCallback((): void => {
    setAutoSwitchDialogMode(null)
    setRememberAutoSwitchChoice(false)
  }, [])

  return (
    <div className="app-shell">
      <div className="app-background app-background--one" />
      <div className="app-background app-background--two" />

      <Header
        title="CodexManager"
        subtitle={t.subtitle}
        totalCount={accounts.length}
        readyCount={readyCount}
        attentionCount={attentionCount}
        activeLabel={activeAccount?.orgName || t.meta.inactive}
        selectedFilter={filter}
        lastUpdatedLabel={lastUpdatedLabel}
        isRefreshing={isRefreshing}
        onRefreshAll={refreshAll}
        onFilterChange={setFilter}
        translations={t}
      />

      <main className="scroll-area no-drag">
        {groupedAccounts.length > 0 ? (
          groupedAccounts.map(({ email, accounts: groupedList }) => (
            <section className="account-group" key={email}>
              <div className="account-group-header">
                <span className="account-group-email">{email}</span>
                <span className="account-group-count">{t.groupCount(groupedList.length)}</span>
              </div>

              <div className="account-group-list">
                {groupedList.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    isActive={activeId === account.id}
                    isRefreshing={refreshingIds.has(account.id)}
                    isSwitching={switchingId === account.id}
                    translations={t}
                    // 周额度通常比短窗口更能说明恢复时间，缺失时再回退到 5 小时窗口。
                    resetText={formatResetTime(account.reset_week || account.reset_5h, lang)}
                    onSwitch={handleSwitchAccount}
                    onRefresh={handleRefreshOne}
                    onDelete={handleDeleteAccount}
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <EmptyState
            title={accounts.length > 0 ? t.empty.noMatchTitle : t.empty.noAccountsTitle}
            description={accounts.length > 0 ? t.empty.noMatchDescription : t.empty.noAccountsDescription}
            actionLabel={accounts.length > 0 ? t.actions.showAll : t.actions.addAccount}
            onAction={accounts.length > 0 ? () => setFilter('all') : handleAddAccount}
          />
        )}
      </main>

      <Footer
        lang={lang}
        onAddAccount={handleAddAccount}
        onToggleLang={handleToggleLang}
        onQuit={() => ipcRenderer.send('quit-app')}
        translations={t}
      />

      {autoSwitchDialogMode && activeAccount && (
        <AutoSwitchDialog
          currentLabel={getAccountDisplayName(activeAccount)}
          mode={autoSwitchDialogMode}
          nextLabel={nextAvailableAccount ? getAccountDisplayName(nextAvailableAccount) : undefined}
          rememberChoice={rememberAutoSwitchChoice}
          translations={t}
          onCancel={handleCloseAutoSwitchDialog}
          onConfirm={() => void handleConfirmAutoSwitch()}
          onRememberChoiceChange={setRememberAutoSwitchChoice}
        />
      )}
    </div>
  )
}

export default App
