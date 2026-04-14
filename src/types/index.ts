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
 * 界面语言。
 */
export type Lang = 'EN' | 'ZH'

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
