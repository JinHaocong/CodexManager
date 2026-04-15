import type {
  Account,
  AccountFilter,
  AccountSortKey,
  AccountStatus,
  AutoSwitchCause,
  AutoSwitchStrategy,
  Lang,
} from '../types'
import { DEFAULT_AUTO_SWITCH_STRATEGY } from '../types'

export interface AccountGroup {
  email: string
  accounts: Account[]
}

interface GroupAccountsOptions {
  sortKey?: AccountSortKey
  pinnedAccountIds?: string[]
}

/**
 * 数值越小越靠前，用于统一控制状态排序优先级。
 */
const STATUS_PRIORITY: Record<AccountStatus, number> = {
  expired: 0,
  disabled: 1,
  exhausted: 2,
  warning: 3,
  normal: 4,
}

/**
 * 将用量值限制在 0-100 区间，避免异常数据撑破进度条。
 */
export function clampUsage(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/**
 * 获取账号在某个额度窗口中的剩余百分比。
 *
 * @param account 目标账号。
 * @param window 额度窗口类型。
 */
export function getRemainingQuota(
  account: Account,
  window: '5h' | '7d',
): number {
  const usage = window === '7d' ? account.usage_week : account.usage_5h
  return Math.max(0, 100 - clampUsage(usage))
}

/**
 * 统计当前还能直接切换使用的账户数量。
 */
export function getReadyCount(accounts: Account[]): number {
  return accounts.filter(({ status }) => status === 'normal' || status === 'warning').length
}

/**
 * 统计需要额外关注的账户数量。
 */
export function getAttentionCount(accounts: Account[]): number {
  return accounts.filter(({ status }) => status !== 'normal').length
}

/**
 * 判断账号是否命中搜索关键词。
 *
 * @param account 目标账号。
 * @param query 搜索文本。
 */
export function matchesAccountQuery(account: Account, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }

  const searchFields = [
    account.email,
    account.orgName,
    account.accountId,
    account.planType,
    account.status,
  ]

  return searchFields.some((field) => field?.toLowerCase().includes(normalizedQuery))
}

/**
 * 根据筛选和搜索条件返回对应账户列表。
 */
export function getFilteredAccounts(
  accounts: Account[],
  filter: AccountFilter,
  query = '',
): Account[] {
  const queryFiltered = query
    ? accounts.filter((account) => matchesAccountQuery(account, query))
    : accounts

  if (filter === 'healthy') {
    return queryFiltered.filter(({ status }) => status === 'normal')
  }

  if (filter === 'attention') {
    return queryFiltered.filter(({ status }) => status !== 'normal')
  }

  return queryFiltered
}

/**
 * 为账户状态映射统一的界面色调。
 */
export function getStatusTone(status: AccountStatus): 'healthy' | 'warning' | 'danger' | 'muted' {
  if (status === 'normal') {
    return 'healthy'
  }

  if (status === 'warning') {
    return 'warning'
  }

  if (status === 'exhausted') {
    return 'danger'
  }

  return 'muted'
}

/**
 * 将用量数值映射为进度条色调。
 */
export function getUsageTone(value: number): 'healthy' | 'warning' | 'danger' {
  if (value >= 100) {
    return 'danger'
  }

  if (value >= 80) {
    return 'warning'
  }

  return 'healthy'
}

/**
 * 判断当前账号是由哪个额度窗口触发自动切换。
 */
export function getAutoSwitchCause(account: Account): AutoSwitchCause | null {
  const isShortWindowExhausted = clampUsage(account.usage_5h) >= 100
  const isLongWindowExhausted = clampUsage(account.usage_week) >= 100

  if (isShortWindowExhausted && isLongWindowExhausted) {
    return 'both'
  }

  if (isShortWindowExhausted) {
    return '5h'
  }

  if (isLongWindowExhausted) {
    return '7d'
  }

  return null
}

/**
 * 判断账号是否仍处于自动切换冷却期内。
 *
 * @param account 候选账号。
 * @param strategy 当前自动切换策略。
 */
export function isInAutoSwitchCooldown(
  account: Account,
  strategy: AutoSwitchStrategy = DEFAULT_AUTO_SWITCH_STRATEGY,
): boolean {
  if (!strategy.cooldownMinutes || !account.last_switched_at) {
    return false
  }

  const lastSwitchedAt = new Date(account.last_switched_at).getTime()
  if (Number.isNaN(lastSwitchedAt)) {
    return false
  }

  return Date.now() - lastSwitchedAt < strategy.cooldownMinutes * 60 * 1000
}

/**
 * 判断账号是否允许手动切换。
 * 手动切换只拦真正不可用的账号，不受自动切换策略阈值影响。
 */
export function canManuallySwitchTo(account: Account): boolean {
  return (
    clampUsage(account.usage_5h) < 100 &&
    clampUsage(account.usage_week) < 100 &&
    account.status !== 'disabled' &&
    account.status !== 'expired'
  )
}

/**
 * 判断账号当前是否仍可继续承接自动切换。
 */
export function canAutoSwitchTo(
  account: Account,
  strategy: AutoSwitchStrategy = DEFAULT_AUTO_SWITCH_STRATEGY,
): boolean {
  return (
    canManuallySwitchTo(account) &&
    getRemainingQuota(account, '5h') >= strategy.minRemaining5h &&
    getRemainingQuota(account, '7d') >= strategy.minRemaining7d &&
    !strategy.excludedAccountIds.includes(account.id)
  )
}

/**
 * 根据触发原因决定候选账号的优先比较维度。
 *
 * @param account 候选账号。
 * @param cause 当前自动切换触发原因。
 */
function getPrimaryUsageScore(account: Account, cause: AutoSwitchCause | null): number {
  if (cause === '7d') {
    return account.usage_week
  }

  if (cause === 'both') {
    return Math.max(account.usage_5h, account.usage_week)
  }

  return account.usage_5h
}

/**
 * 当主比较维度一致时，再用次级指标兜底，尽量挑出整体更健康的账号。
 *
 * @param account 候选账号。
 * @param cause 当前自动切换触发原因。
 */
function getSecondaryUsageScore(account: Account, cause: AutoSwitchCause | null): number {
  if (cause === '7d') {
    return account.usage_5h
  }

  if (cause === 'both') {
    return account.usage_5h + account.usage_week
  }

  return account.usage_week
}

/**
 * 获取置顶账号的优先级，越小越靠前。
 *
 * @param accountId 账号 ID。
 * @param pinnedAccountIds 置顶列表。
 */
function getPinnedPriority(accountId: string, pinnedAccountIds: string[]): number {
  const index = pinnedAccountIds.indexOf(accountId)
  return index === -1 ? Number.POSITIVE_INFINITY : index
}

/**
 * 计算账号的综合剩余额度分，用于“额度优先”的列表排序。
 *
 * @param account 目标账号。
 */
function getQuotaHealthScore(account: Account): number {
  return getRemainingQuota(account, '5h') + getRemainingQuota(account, '7d')
}

/**
 * 选择最适合自动切换的账号，优先健康状态、置顶优先级与剩余额度更高的账号。
 */
export function findNextAvailableAccount(
  accounts: Account[],
  activeId: string | null,
  cause: AutoSwitchCause | null = null,
  strategy: AutoSwitchStrategy = DEFAULT_AUTO_SWITCH_STRATEGY,
  pinnedAccountIds: string[] = [],
): Account | null {
  const candidates = accounts.filter(
    (account) => account.id !== activeId && canAutoSwitchTo(account, strategy),
  )

  const cooledCandidates = candidates.filter(
    (account) => !isInAutoSwitchCooldown(account, strategy),
  )
  const rankedCandidates = cooledCandidates.length ? cooledCandidates : candidates

  return rankedCandidates
    .sort((left, right) => {
      const pinnedDelta =
        getPinnedPriority(left.id, pinnedAccountIds) - getPinnedPriority(right.id, pinnedAccountIds)
      if (pinnedDelta !== 0) {
        return pinnedDelta
      }

      // 先按状态优先级筛掉边缘账号，再比较触发窗口对应的剩余额度。
      const statusDelta = STATUS_PRIORITY[right.status] - STATUS_PRIORITY[left.status]
      if (statusDelta !== 0) {
        return statusDelta
      }

      const primaryUsageDelta =
        getPrimaryUsageScore(left, cause) - getPrimaryUsageScore(right, cause)
      if (primaryUsageDelta !== 0) {
        return primaryUsageDelta
      }

      const secondaryUsageDelta =
        getSecondaryUsageScore(left, cause) - getSecondaryUsageScore(right, cause)
      if (secondaryUsageDelta !== 0) {
        return secondaryUsageDelta
      }

      return (left.orgName || left.email).localeCompare(right.orgName || right.email)
    })[0] ?? null
}

/**
 * 根据套餐名称返回徽章色调。
 */
export function getPlanTone(planType: string): 'indigo' | 'cyan' | 'amber' | 'violet' | 'neutral' {
  const lowerPlan = planType.toLowerCase()

  if (lowerPlan.includes('plus')) {
    return 'indigo'
  }

  if (lowerPlan.includes('team')) {
    return 'cyan'
  }

  if (lowerPlan.includes('pro')) {
    return 'amber'
  }

  if (lowerPlan.includes('business')) {
    return 'violet'
  }

  return 'neutral'
}

/**
 * 将重置时间戳格式化为紧凑可读的剩余时间。
 */
export function formatResetTime(resetAt: number | undefined, lang: Lang): string {
  if (!resetAt) {
    return ''
  }

  const diffMilliseconds = resetAt * 1000 - Date.now()
  if (diffMilliseconds <= 0) {
    return ''
  }

  const hours = Math.floor(diffMilliseconds / (60 * 60 * 1000))
  const minutes = Math.floor((diffMilliseconds % (60 * 60 * 1000)) / (60 * 1000))

  if (lang === 'ZH') {
    if (hours > 0 && minutes > 0) {
      return `${hours} 小时 ${minutes} 分钟`
    }

    if (hours > 0) {
      return `${hours} 小时`
    }

    return `${minutes} 分钟`
  }

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`
  }

  if (hours > 0) {
    return `${hours}h`
  }

  return `${minutes}m`
}

/**
 * 获取最近一次成功同步的时间戳。
 */
export function getLatestUpdateAt(accounts: Account[]): string | null {
  const timestamps = accounts
    .map(({ last_update }) => last_update)
    .filter((value): value is string => Boolean(value))

  if (!timestamps.length) {
    return null
  }

  return timestamps.reduce((latest, current) => {
    return new Date(current).getTime() > new Date(latest).getTime() ? current : latest
  })
}

/**
 * 将最近同步时间格式化为本地时钟文案。
 */
export function formatTimestamp(timestamp: string | null, lang: Lang): string {
  if (!timestamp) {
    return lang === 'ZH' ? '从未' : 'never'
  }

  return new Intl.DateTimeFormat(lang === 'ZH' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

/**
 * 缩写账户 ID，避免长串文本挤压卡片布局。
 */
export function getShortAccountId(accountId: string): string {
  if (!accountId) {
    return '--'
  }

  if (accountId.length <= 10) {
    return accountId
  }

  return `${accountId.slice(0, 4)}...${accountId.slice(-4)}`
}

/**
 * 对组内账号排序，优先展示当前激活账号和置顶账号，再按所选策略排序。
 */
function sortAccounts(
  accounts: Account[],
  activeId: string | null,
  sortKey: AccountSortKey,
  pinnedAccountIds: string[],
): Account[] {
  return [...accounts].sort((left, right) => {
    if (left.id === activeId) {
      return -1
    }

    if (right.id === activeId) {
      return 1
    }

    const pinnedDelta =
      getPinnedPriority(left.id, pinnedAccountIds) - getPinnedPriority(right.id, pinnedAccountIds)
    if (pinnedDelta !== 0) {
      return pinnedDelta
    }

    if (sortKey === 'recent') {
      const rightTimestamp = new Date(right.last_switched_at || right.last_update).getTime()
      const leftTimestamp = new Date(left.last_switched_at || left.last_update).getTime()
      return rightTimestamp - leftTimestamp
    }

    if (sortKey === 'quota') {
      const quotaDelta = getQuotaHealthScore(right) - getQuotaHealthScore(left)
      if (quotaDelta !== 0) {
        return quotaDelta
      }
    }

    if (sortKey === 'name') {
      const nameDelta = (left.orgName || left.email).localeCompare(right.orgName || right.email)
      if (nameDelta !== 0) {
        return nameDelta
      }
    }

    const statusDelta = STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status]
    if (statusDelta !== 0) {
      return statusDelta
    }

    // 状态一致时，优先把周额度和短额度消耗更高的账号排前面，便于优先关注。
    const usageDelta = right.usage_week - left.usage_week || right.usage_5h - left.usage_5h
    if (usageDelta !== 0) {
      return usageDelta
    }

    return (left.orgName || left.accountId).localeCompare(right.orgName || right.accountId)
  })
}

/**
 * 按邮箱分组并排序，优先展示当前激活、置顶和状态异常的账户。
 */
export function groupAccounts(
  accounts: Account[],
  activeId: string | null,
  options: GroupAccountsOptions = {},
): AccountGroup[] {
  const { sortKey = 'priority', pinnedAccountIds = [] } = options
  const groupedMap = accounts.reduce<Record<string, Account[]>>((result, account) => {
    const email = account.email || 'Unknown'
    result[email] ||= []
    result[email].push(account)
    return result
  }, {})

  return Object.entries(groupedMap)
    .map(([email, groupedAccounts]) => ({
      email,
      accounts: sortAccounts(groupedAccounts, activeId, sortKey, pinnedAccountIds),
    }))
    .sort((left, right) => {
      const leftHasActive = left.accounts.some(({ id }) => id === activeId)
      const rightHasActive = right.accounts.some(({ id }) => id === activeId)

      if (leftHasActive !== rightHasActive) {
        return leftHasActive ? -1 : 1
      }

      const leftPinnedPriority = Math.min(
        ...left.accounts.map(({ id }) => getPinnedPriority(id, pinnedAccountIds)),
      )
      const rightPinnedPriority = Math.min(
        ...right.accounts.map(({ id }) => getPinnedPriority(id, pinnedAccountIds)),
      )

      if (leftPinnedPriority !== rightPinnedPriority) {
        return leftPinnedPriority - rightPinnedPriority
      }

      // 组排序也沿用状态优先级，确保异常账号所在分组尽量靠前。
      const leftPriority = Math.min(...left.accounts.map(({ status }) => STATUS_PRIORITY[status]))
      const rightPriority = Math.min(...right.accounts.map(({ status }) => STATUS_PRIORITY[status]))

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }

      return left.email.localeCompare(right.email)
    })
}
