/**
 * 账号在界面上的健康状态。
 */
export type AccountStatus = 'normal' | 'warning' | 'exhausted' | 'disabled' | 'expired'

/**
 * 顶部筛选标签类型。
 */
export type AccountFilter = 'all' | 'healthy' | 'attention'

/**
 * 自动切换弹窗展示模式。
 */
export type AutoSwitchDialogMode = 'confirm-switch' | 'no-available-account'

/**
 * 自动切换由哪个额度窗口触发。
 */
export type AutoSwitchCause = '5h' | '7d' | 'both'

/**
 * 后台自动刷新支持的分钟档位。
 */
export const REFRESH_INTERVAL_OPTIONS = [1, 3, 5, 10, 15] as const

/**
 * 后台自动刷新分钟数。
 */
export type RefreshIntervalMinutes = (typeof REFRESH_INTERVAL_OPTIONS)[number]

/**
 * 界面语言。
 */
export type Lang = 'EN' | 'ZH'

/**
 * 主进程代理请求的入参。
 */
export interface ProxyRequestPayload {
  url: string
  headers: Record<string, string>
}

/**
 * 账户切换结果。
 */
export interface SwitchAccountResult {
  success?: boolean
  error?: string
}

/**
 * 系统通知点击后的后续意图。
 */
export type SystemNotificationIntent = 'show-window' | 'open-auto-switch-dialog'

/**
 * 系统通知入参。
 */
export interface SystemNotificationPayload {
  title: string
  body: string
  intent?: SystemNotificationIntent
}

/**
 * OAuth 换取到的核心令牌数据。
 */
export interface OAuthTokenPayload {
  access_token: string
  refresh_token: string
  id_token: string
}

/**
 * OAuth 流程错误信息。
 */
export interface OAuthErrorPayload {
  code?: 'in-progress' | 'listen-failed' | 'token-exchange-failed' | 'timeout'
  message?: string
}

/**
 * 已接入账号的核心信息。
 */
export interface Account {
  id: string
  accountId: string
  email: string
  orgName: string
  planType: string
  access_token: string
  refresh_token: string
  id_token: string
  usage_5h: number
  usage_week: number
  reset_5h?: number
  reset_week?: number
  status: AccountStatus
  last_update: string
}

/**
 * 额度窗口信息。
 */
export interface UsageWindow {
  used_percent?: number
  reset_at?: number
}

/**
 * 额度接口响应体。
 */
export interface UsagePayload {
  rate_limit: {
    primary_window?: UsageWindow
    secondary_window?: UsageWindow
  }
  plan_type?: string
}

/**
 * 组织检查接口响应体。
 */
export interface AccountsCheckPayload {
  accounts?: Record<string, { account?: { name?: string } }>
}

/**
 * 主进程代理请求的统一返回格式。
 */
export interface ProxyResponse<T = unknown> {
  success: boolean
  data?: T
  status?: number
  error?: string
}

/**
 * 渲染层可访问的 Electron 安全桥 API。
 */
export interface CodexAPI {
  proxyRequest: <T>(payload: ProxyRequestPayload) => Promise<ProxyResponse<T>>
  getAccounts: () => Promise<Account[] | undefined>
  setAccounts: (accounts: Account[]) => Promise<void>
  getActiveId: () => Promise<string | null | undefined>
  setActiveId: (id: string | null) => Promise<void>
  getLang: () => Promise<Lang | undefined>
  setLang: (lang: Lang) => Promise<void>
  getSkipAutoSwitchConfirm: () => Promise<boolean | undefined>
  setSkipAutoSwitchConfirm: (value: boolean) => Promise<void>
  getRefreshIntervalMinutes: () => Promise<number | undefined>
  setRefreshIntervalMinutes: (value: RefreshIntervalMinutes) => Promise<void>
  switchAccount: (account: Account) => Promise<SwitchAccountResult>
  refreshToken: (account: Account) => Promise<ProxyResponse<OAuthTokenPayload>>
  startOAuth: () => void
  quitApp: () => void
  showSystemNotification: (payload: SystemNotificationPayload) => void
  onOAuthSuccess: (listener: (payload: OAuthTokenPayload) => void) => () => void
  onOAuthError: (listener: (payload?: OAuthErrorPayload) => void) => () => void
  onRefreshAccounts: (listener: () => void) => () => void
  onOpenAutoSwitchDialog: (listener: () => void) => () => void
}

declare global {
  interface Window {
    codexAPI: CodexAPI
  }
}
