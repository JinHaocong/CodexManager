import { contextBridge, ipcRenderer } from 'electron'

import type {
  Account,
  CodexAPI,
  Lang,
  OAuthErrorPayload,
  OAuthTokenPayload,
  ProxyRequestPayload,
  ProxyResponse,
  RefreshIntervalMinutes,
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
  getSkipAutoSwitchConfirm: () => ipcRenderer.invoke('get-skip-auto-switch-confirm') as Promise<boolean | undefined>,
  setSkipAutoSwitchConfirm: (value: boolean) => {
    return ipcRenderer.invoke('set-skip-auto-switch-confirm', value) as Promise<void>
  },
  getRefreshIntervalMinutes: () => ipcRenderer.invoke('get-refresh-interval-minutes') as Promise<number | undefined>,
  setRefreshIntervalMinutes: (value: RefreshIntervalMinutes) => {
    return ipcRenderer.invoke('set-refresh-interval-minutes', value) as Promise<void>
  },
  switchAccount: (account: Account) => ipcRenderer.invoke('switch-account', account) as Promise<SwitchAccountResult>,
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
