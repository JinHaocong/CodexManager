/**
 * 账号在界面上的健康状态。
 */
export type AccountStatus = 'normal' | 'warning' | 'exhausted' | 'disabled' | 'expired'

/**
 * 顶部筛选标签类型。
 */
export type AccountFilter = 'all' | 'healthy' | 'attention'

/**
 * 列表排序策略。
 */
export type AccountSortKey = 'priority' | 'recent' | 'quota' | 'name'

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
 * 自动切换冷却时间支持的分钟档位。
 */
export const AUTO_SWITCH_COOLDOWN_OPTIONS = [0, 5, 10, 20, 30] as const

/**
 * 后台自动刷新分钟数。
 */
export type RefreshIntervalMinutes = (typeof REFRESH_INTERVAL_OPTIONS)[number]

/**
 * 自动切换冷却分钟数。
 */
export type AutoSwitchCooldownMinutes = (typeof AUTO_SWITCH_COOLDOWN_OPTIONS)[number]

/**
 * 界面语言。
 */
export type Lang = 'EN' | 'ZH'

/**
 * 系统通知的业务分类，用于统一走静默时段和开关配置。
 */
export type NotificationKind =
  | 'autoSwitchConfirm'
  | 'autoSwitchUnavailable'
  | 'switchSuccess'
  | 'oauthError'

/**
 * 通知偏好配置。
 */
export interface NotificationSettings {
  autoSwitchConfirm: boolean
  autoSwitchUnavailable: boolean
  switchSuccess: boolean
  oauthError: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
}

/**
 * 自动切换策略配置。
 */
export interface AutoSwitchStrategy {
  minRemaining5h: number
  minRemaining7d: number
  cooldownMinutes: AutoSwitchCooldownMinutes
  excludedAccountIds: string[]
}

/**
 * 账号额度历史快照点。
 */
export interface AccountUsageHistoryPoint {
  timestamp: string
  usage5h: number
  usageWeek: number
  status: AccountStatus
}

/**
 * 账号历史快照表。
 */
export type AccountUsageHistory = Record<string, AccountUsageHistoryPoint[]>

/**
 * 诊断日志级别。
 */
export type DiagnosticLogLevel = 'info' | 'warning' | 'error'

/**
 * 诊断日志分类。
 */
export type DiagnosticLogCategory =
  | 'refresh'
  | 'switch'
  | 'oauth'
  | 'notification'
  | 'repair'
  | 'backup'
  | 'security'
  | 'settings'

/**
 * 可持久化的诊断日志项。
 */
export interface DiagnosticLogEntry {
  id: string
  timestamp: string
  level: DiagnosticLogLevel
  category: DiagnosticLogCategory
  message: string
  accountId?: string
  email?: string
}

/**
 * 新增诊断日志时允许省略的系统字段。
 */
export interface DiagnosticLogInput extends Omit<DiagnosticLogEntry, 'id' | 'timestamp'> {
  id?: string
  timestamp?: string
}

/**
 * 导入导出时使用的备份结构。
 */
export interface AppBackupPayload {
  version: number
  exportedAt: string
  data: {
    accounts: Account[]
    activeId: string | null
    lang: Lang
    skipAutoSwitchConfirm: boolean
    refreshIntervalMinutes: RefreshIntervalMinutes
    autoSwitchStrategy: AutoSwitchStrategy
    notificationSettings: NotificationSettings
    pinnedAccountIds: string[]
    usageHistory: AccountUsageHistory
    diagnosticLogs: DiagnosticLogEntry[]
  }
}

/**
 * 安全存储能力状态。
 */
export interface SecureStorageStatus {
  available: boolean
  mode: 'safe-storage' | 'base64-fallback'
}

/**
 * 自动切换策略默认值。
 */
export const DEFAULT_AUTO_SWITCH_STRATEGY: AutoSwitchStrategy = {
  minRemaining5h: 5,
  minRemaining7d: 10,
  cooldownMinutes: 10,
  excludedAccountIds: [],
}

/**
 * 通知配置默认值。
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  autoSwitchConfirm: true,
  autoSwitchUnavailable: true,
  switchSuccess: true,
  oauthError: true,
  quietHoursEnabled: false,
  quietHoursStart: '23:00',
  quietHoursEnd: '08:00',
}

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
 * refresh_token 换取 access_token 时的返回体。
 * OpenAI 可能只返回新的 access_token，因此其余字段保持可选。
 */
export interface RefreshTokenPayload {
  access_token: string
  refresh_token?: string
  id_token?: string
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
  last_switched_at?: string
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
  getAutoSwitchStrategy: () => Promise<AutoSwitchStrategy | undefined>
  setAutoSwitchStrategy: (value: AutoSwitchStrategy) => Promise<void>
  getNotificationSettings: () => Promise<NotificationSettings | undefined>
  setNotificationSettings: (value: NotificationSettings) => Promise<void>
  getPinnedAccountIds: () => Promise<string[] | undefined>
  setPinnedAccountIds: (value: string[]) => Promise<void>
  getUsageHistory: () => Promise<AccountUsageHistory | undefined>
  setUsageHistory: (value: AccountUsageHistory) => Promise<void>
  getDiagnosticLogs: () => Promise<DiagnosticLogEntry[] | undefined>
  setDiagnosticLogs: (value: DiagnosticLogEntry[]) => Promise<void>
  getSecureStorageStatus: () => Promise<SecureStorageStatus>
  switchAccount: (account: Account) => Promise<SwitchAccountResult>
  syncAccountAuth: (account: Account) => Promise<SwitchAccountResult>
  refreshToken: (account: Account) => Promise<ProxyResponse<RefreshTokenPayload>>
  exportAppBackup: (payload: AppBackupPayload) => Promise<SwitchAccountResult>
  importAppBackup: () => Promise<ProxyResponse<AppBackupPayload>>
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
