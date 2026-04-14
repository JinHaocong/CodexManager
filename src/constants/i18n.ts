import type { AccountFilter, AccountStatus, Lang } from '../types'

/**
 * 界面国际化文案结构。
 */
export interface AppLocaleText {
  title: string
  subtitle: string
  personalWorkspace: string
  removeConfirm: string
  groupCount: (count: number) => string
  lastUpdated: (value: string) => string
  meta: {
    never: string
    inactive: string
    accountId: string
    current: string
  }
  stats: {
    total: string
    ready: string
    attention: string
    active: string
  }
  filters: Record<AccountFilter, string>
  actions: {
    refreshAll: string
    refreshing: string
    addAccount: string
    switch: string
    switching: string
    remove: string
    quit: string
    language: string
    showAll: string
  }
  usage: {
    shortWindow: string
    longWindow: string
    resetIn: string
  }
  empty: {
    noAccountsTitle: string
    noAccountsDescription: string
    noMatchTitle: string
    noMatchDescription: string
  }
  status: Record<AccountStatus, string>
  statusDescription: Record<AccountStatus, string>
  autoSwitch: {
    confirmTitle: string
    confirmDescription: (current: string, next: string) => string
    noAvailableTitle: string
    noAvailableDescription: (current: string) => string
    currentAccount: string
    nextAccount: string
    rememberChoice: string
    confirm: string
    cancel: string
    acknowledge: string
  }
}

/**
 * 应用全部多语言文案。
 */
export const translations = {
  EN: {
    title: 'CodexManager',
    subtitle: 'A calm control panel for switching workspaces, tracking quota, and keeping every Codex account in view.',
    personalWorkspace: 'Personal Workspace',
    removeConfirm: 'Remove this account from CodexManager?',
    groupCount: (count: number) => `${count} workspace${count > 1 ? 's' : ''}`,
    lastUpdated: (value: string) => `Synced ${value}`,
    meta: {
      never: 'never',
      inactive: 'Not selected',
      accountId: 'Account ID',
      current: 'Current'
    },
    stats: {
      total: 'Workspaces',
      ready: 'Ready now',
      attention: 'Need attention',
      active: 'Active'
    },
    filters: {
      all: 'All',
      healthy: 'Healthy',
      attention: 'Attention'
    },
    actions: {
      refreshAll: 'Refresh all',
      refreshing: 'Refreshing',
      addAccount: 'Add account',
      switch: 'Switch',
      switching: 'Switching',
      remove: 'Remove',
      quit: 'Quit',
      language: 'Language',
      showAll: 'Show all'
    },
    usage: {
      shortWindow: '5-hour window',
      longWindow: '7-day window',
      resetIn: 'Resets in'
    },
    empty: {
      noAccountsTitle: 'No Codex accounts yet',
      noAccountsDescription: 'Connect your first account to start switching workspaces and monitoring usage here.',
      noMatchTitle: 'Nothing in this view',
      noMatchDescription: 'Try another filter to see the rest of your workspaces.'
    },
    status: {
      normal: 'Healthy',
      warning: 'Approaching limit',
      exhausted: 'Quota exhausted',
      disabled: 'Access disabled',
      expired: 'Session expired'
    },
    statusDescription: {
      normal: 'Ready to switch right away.',
      warning: 'Still usable, but you should keep an eye on the remaining quota.',
      exhausted: 'This workspace has run out of quota for the current cycle.',
      disabled: 'OpenAI rejected the request for this workspace.',
      expired: 'Refresh the session before trying to switch again.'
    },
    autoSwitch: {
      confirmTitle: 'Current 5-hour quota is exhausted',
      confirmDescription: (current: string, next: string) => `${current} can no longer be used in this 5-hour window. Switch to ${next} now?`,
      noAvailableTitle: 'No available account to switch',
      noAvailableDescription: (current: string) => `${current} has exhausted its 5-hour quota, and every added account is currently unavailable. Please wait for reset or add another account.`,
      currentAccount: 'Current account',
      nextAccount: 'Suggested account',
      rememberChoice: 'Do not ask again next time',
      confirm: 'Switch now',
      cancel: 'Stay here',
      acknowledge: 'Got it'
    }
  },
  ZH: {
    title: 'CodexManager',
    subtitle: '用更沉稳的方式管理 Codex 账号切换、额度状态与当前工作空间，全局信息一眼看清。',
    personalWorkspace: '个人空间',
    removeConfirm: '确定将这个账号从 CodexManager 中移除吗？',
    groupCount: (count: number) => `${count} 个工作空间`,
    lastUpdated: (value: string) => `最近同步 ${value}`,
    meta: {
      never: '从未',
      inactive: '未选中',
      accountId: '账号 ID',
      current: '当前使用'
    },
    stats: {
      total: '工作空间',
      ready: '可立即切换',
      attention: '需要关注',
      active: '当前激活'
    },
    filters: {
      all: '全部',
      healthy: '健康',
      attention: '关注'
    },
    actions: {
      refreshAll: '刷新全部',
      refreshing: '刷新中',
      addAccount: '添加账号',
      switch: '切换',
      switching: '切换中',
      remove: '移除',
      quit: '退出',
      language: '语言',
      showAll: '查看全部'
    },
    usage: {
      shortWindow: '5 小时窗口',
      longWindow: '7 天窗口',
      resetIn: '重置剩余'
    },
    empty: {
      noAccountsTitle: '还没有 Codex 账号',
      noAccountsDescription: '先接入一个账号，之后你就可以在这里统一切换工作空间并查看额度状态。',
      noMatchTitle: '当前筛选下没有结果',
      noMatchDescription: '换一个筛选条件，就能看到其他工作空间。'
    },
    status: {
      normal: '状态健康',
      warning: '额度接近上限',
      exhausted: '额度已耗尽',
      disabled: '访问已禁用',
      expired: '会话已失效'
    },
    statusDescription: {
      normal: '当前状态稳定，可以直接切换使用。',
      warning: '仍可使用，但建议留意剩余额度。',
      exhausted: '当前周期内的额度已经用完。',
      disabled: '这个工作空间的请求被 OpenAI 拒绝了。',
      expired: '需要先刷新会话后再尝试切换。'
    },
    autoSwitch: {
      confirmTitle: '当前账号 5 小时额度已用尽',
      confirmDescription: (current: string, next: string) => `${current} 当前 5 小时额度已耗尽，是否立即切换到可继续使用的账号 ${next}？`,
      noAvailableTitle: '没有可切换的可用账号',
      noAvailableDescription: (current: string) => `${current} 当前 5 小时额度已耗尽，而且已添加的账号目前都不可继续使用。请等待额度重置，或添加新的账号。`,
      currentAccount: '当前账号',
      nextAccount: '建议切换',
      rememberChoice: '下次不再提醒',
      confirm: '立即切换',
      cancel: '暂不切换',
      acknowledge: '我知道了'
    }
  }
} satisfies Record<Lang, AppLocaleText>
