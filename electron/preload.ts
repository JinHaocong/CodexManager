import { contextBridge, ipcRenderer } from 'electron'

import type {
  Account,
  AccountUsageHistory,
  AppBackupPayload,
  AutoSwitchStrategy,
  CodexAPI,
  DiagnosticLogEntry,
  Lang,
  NotificationSettings,
  OAuthErrorPayload,
  OAuthTokenPayload,
  ProxyRequestPayload,
  ProxyResponse,
  RefreshTokenPayload,
  RefreshIntervalMinutes,
  SecureStorageStatus,
  SwitchAccountResult,
  SystemNotificationPayload,
} from '../src/types'

const OAUTH_SUCCESS_EVENT = 'oauth-success'
const OAUTH_ERROR_EVENT = 'oauth-error'
const REFRESH_ACCOUNTS_EVENT = 'refresh-accounts'
const OPEN_AUTO_SWITCH_DIALOG_EVENT = 'open-auto-switch-dialog'

/**
 * 订阅带单个载荷的主进程事件，并返回取消订阅函数。
 *
 * @param channel 事件通道名。
 * @param listener 渲染层业务回调。
 */
function subscribeWithPayload<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrappedListener = (_event: unknown, payload: T): void => {
    listener(payload)
  }

  ipcRenderer.on(channel, wrappedListener)

  return () => {
    ipcRenderer.removeListener(channel, wrappedListener)
  }
}

/**
 * 订阅不带业务载荷的主进程事件，并返回取消订阅函数。
 *
 * @param channel 事件通道名。
 * @param listener 渲染层业务回调。
 */
function subscribeWithoutPayload(channel: string, listener: () => void): () => void {
  const wrappedListener = (): void => {
    listener()
  }

  ipcRenderer.on(channel, wrappedListener)

  return () => {
    ipcRenderer.removeListener(channel, wrappedListener)
  }
}

const api: CodexAPI = {
  proxyRequest: <T>(payload: ProxyRequestPayload) => {
    return ipcRenderer.invoke('proxy-request', payload) as Promise<ProxyResponse<T>>
  },
  getAccounts: () => ipcRenderer.invoke('get-accounts') as Promise<Account[] | undefined>,
  setAccounts: (accounts: Account[]) => ipcRenderer.invoke('set-accounts', accounts) as Promise<void>,
  getActiveId: () => ipcRenderer.invoke('get-active-id') as Promise<string | null | undefined>,
  setActiveId: (id: string | null) => ipcRenderer.invoke('set-active-id', id) as Promise<void>,
  getLang: () => ipcRenderer.invoke('get-lang') as Promise<Lang | undefined>,
  setLang: (lang: Lang) => ipcRenderer.invoke('set-lang', lang) as Promise<void>,
  getLaunchAtLoginEnabled: () => ipcRenderer.invoke('get-launch-at-login-enabled') as Promise<boolean | undefined>,
  setLaunchAtLoginEnabled: (value: boolean) => {
    return ipcRenderer.invoke('set-launch-at-login-enabled', value) as Promise<void>
  },
  getSkipAutoSwitchConfirm: () => ipcRenderer.invoke('get-skip-auto-switch-confirm') as Promise<boolean | undefined>,
  setSkipAutoSwitchConfirm: (value: boolean) => {
    return ipcRenderer.invoke('set-skip-auto-switch-confirm', value) as Promise<void>
  },
  getRefreshIntervalMinutes: () => ipcRenderer.invoke('get-refresh-interval-minutes') as Promise<number | undefined>,
  setRefreshIntervalMinutes: (value: RefreshIntervalMinutes) => {
    return ipcRenderer.invoke('set-refresh-interval-minutes', value) as Promise<void>
  },
  getAutoSwitchStrategy: () => {
    return ipcRenderer.invoke('get-auto-switch-strategy') as Promise<AutoSwitchStrategy | undefined>
  },
  setAutoSwitchStrategy: (value: AutoSwitchStrategy) => {
    return ipcRenderer.invoke('set-auto-switch-strategy', value) as Promise<void>
  },
  getNotificationSettings: () => {
    return ipcRenderer.invoke('get-notification-settings') as Promise<NotificationSettings | undefined>
  },
  setNotificationSettings: (value: NotificationSettings) => {
    return ipcRenderer.invoke('set-notification-settings', value) as Promise<void>
  },
  getPinnedAccountIds: () => ipcRenderer.invoke('get-pinned-account-ids') as Promise<string[] | undefined>,
  setPinnedAccountIds: (value: string[]) => {
    return ipcRenderer.invoke('set-pinned-account-ids', value) as Promise<void>
  },
  getUsageHistory: () => {
    return ipcRenderer.invoke('get-usage-history') as Promise<AccountUsageHistory | undefined>
  },
  setUsageHistory: (value: AccountUsageHistory) => {
    return ipcRenderer.invoke('set-usage-history', value) as Promise<void>
  },
  getDiagnosticLogs: () => {
    return ipcRenderer.invoke('get-diagnostic-logs') as Promise<DiagnosticLogEntry[] | undefined>
  },
  setDiagnosticLogs: (value: DiagnosticLogEntry[]) => {
    return ipcRenderer.invoke('set-diagnostic-logs', value) as Promise<void>
  },
  getSecureStorageStatus: () => {
    return ipcRenderer.invoke('get-secure-storage-status') as Promise<SecureStorageStatus>
  },
  switchAccount: (account: Account) => ipcRenderer.invoke('switch-account', account) as Promise<SwitchAccountResult>,
  syncAccountAuth: (account: Account) => ipcRenderer.invoke('sync-account-auth', account) as Promise<SwitchAccountResult>,
  refreshToken: (account: Account) => ipcRenderer.invoke('refresh-token', account) as Promise<ProxyResponse<RefreshTokenPayload>>,
  exportAppBackup: (payload: AppBackupPayload) => {
    return ipcRenderer.invoke('export-app-backup', payload) as Promise<SwitchAccountResult>
  },
  importAppBackup: () => {
    return ipcRenderer.invoke('import-app-backup') as Promise<ProxyResponse<AppBackupPayload>>
  },
  startOAuth: () => ipcRenderer.send('start-oauth'),
  quitApp: () => ipcRenderer.send('quit-app'),
  showSystemNotification: (payload: SystemNotificationPayload) => ipcRenderer.send('show-system-notification', payload),
  onOAuthSuccess: (listener: (payload: OAuthTokenPayload) => void) => {
    return subscribeWithPayload(OAUTH_SUCCESS_EVENT, listener)
  },
  onOAuthError: (listener: (payload?: OAuthErrorPayload) => void) => {
    return subscribeWithPayload(OAUTH_ERROR_EVENT, listener)
  },
  onRefreshAccounts: (listener: () => void) => subscribeWithoutPayload(REFRESH_ACCOUNTS_EVENT, listener),
  onOpenAutoSwitchDialog: (listener: () => void) => {
    return subscribeWithoutPayload(OPEN_AUTO_SWITCH_DIALOG_EVENT, listener)
  }
}

contextBridge.exposeInMainWorld('codexAPI', api)
