import type {
  AccountFilter,
  AccountSortKey,
  AccountStatus,
  AutoSwitchCause,
  AutoSwitchCooldownMinutes,
  DiagnosticLogCategory,
  DiagnosticLogLevel,
  Lang,
  RefreshIntervalMinutes,
} from '../types'

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
  navigation: {
    accounts: string
    strategy: string
    system: string
  }
  pages: {
    accountsTitle: string
    accountsDescription: string
    strategyTitle: string
    strategyDescription: string
    systemTitle: string
    systemDescription: string
    resultCount: (count: number) => string
  }
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
    unavailable: string
    switching: string
    repair: string
    repairing: string
    remove: string
    quit: string
    language: string
    showAll: string
    settings: string
    diagnostics: string
    closePanel: string
    pin: string
    unpin: string
    excludeAutoSwitch: string
    includeAutoSwitch: string
    exportData: string
    importData: string
    clearLogs: string
  }
  oauth: {
    title: string
    inProgress: string
    unavailable: string
    exchangeFailed: string
    timeout: string
  }
  toolbar: {
    searchPlaceholder: string
    sortLabel: string
  }
  sorts: Record<AccountSortKey, string>
  settings: {
    title: string
    subtitle: string
    strategySection: string
    notificationsSection: string
    backupSection: string
    securitySection: string
    refreshInterval: string
    refreshIntervalOption: (value: RefreshIntervalMinutes) => string
    minRemaining5h: string
    minRemaining7d: string
    cooldown: string
    cooldownOption: (value: AutoSwitchCooldownMinutes) => string
    skipConfirm: string
    quietHours: string
    quietHoursStart: string
    quietHoursEnd: string
    strategyHint: string
    pinnedCount: (count: number) => string
    excludedCount: (count: number) => string
    excludedAccount: string
    secureStorageEnabled: string
    secureStorageFallback: string
    importConfirm: string
  }
  usage: {
    shortWindow: string
    longWindow: string
    resetIn: string
  }
  history: {
    recentTrend: string
    empty: string
  }
  empty: {
    noAccountsTitle: string
    noAccountsDescription: string
    noMatchTitle: string
    noMatchDescription: string
  }
  switchGuard: {
    disabled: string
    expired: string
    exhausted: (reason: string) => string
    exhaustedWithReset: (reason: string, reset: string) => string
    unavailable: string
  }
  status: Record<AccountStatus, string>
  statusDescription: Record<AccountStatus, string>
  autoSwitch: {
    reasonLabel: (cause: AutoSwitchCause) => string
    confirmTitle: string
    confirmDescription: (current: string, next: string, reason: string) => string
    switchedTitle: string
    switchedDescription: (next: string) => string
    noAvailableTitle: string
    noAvailableDescription: (current: string, reason: string) => string
    currentAccount: string
    nextAccount: string
    rememberChoice: string
      confirm: string
      cancel: string
      acknowledge: string
  }
  repair: {
    refreshed: (email: string) => string
    relogin: (email: string) => string
    stillExhausted: (email: string) => string
  }
  backup: {
    exportSuccess: string
    exportFailed: string
    importSuccess: string
    importFailed: string
  }
  diagnostics: {
    title: string
    subtitle: string
    empty: string
    totalLogs: string
    warningLogs: string
    errorLogs: string
    categories: Record<DiagnosticLogCategory, string>
    levels: Record<DiagnosticLogLevel, string>
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
    navigation: {
      accounts: 'Accounts',
      strategy: 'Strategy',
      system: 'System'
    },
    pages: {
      accountsTitle: 'Account directory',
      accountsDescription: 'Search, sort and switch across every connected workspace from a single operational view.',
      strategyTitle: 'Strategy center',
      strategyDescription: 'Tune auto-switch rules and notification behavior without distracting operational noise.',
      systemTitle: 'System desk',
      systemDescription: 'Handle backup, local security and diagnostics from a dedicated maintenance view.',
      resultCount: (count: number) => `${count} result${count === 1 ? '' : 's'}`
    },
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
      unavailable: 'Unavailable',
      switching: 'Switching',
      repair: 'Repair',
      repairing: 'Repairing',
      remove: 'Remove',
      quit: 'Quit',
      language: 'Language',
      showAll: 'Show all',
      settings: 'Settings',
      diagnostics: 'Diagnostics',
      closePanel: 'Close',
      pin: 'Pin',
      unpin: 'Unpin',
      excludeAutoSwitch: 'Skip auto switch',
      includeAutoSwitch: 'Rejoin auto switch',
      exportData: 'Export backup',
      importData: 'Import backup',
      clearLogs: 'Clear logs'
    },
    oauth: {
      title: 'Sign-in issue',
      inProgress: 'A sign-in flow is already in progress. Finish it in the browser first.',
      unavailable: 'The local callback port is unavailable. Close any duplicate app instance and try again.',
      exchangeFailed: 'The authorization succeeded, but exchanging tokens failed. Please try again.',
      timeout: 'The sign-in flow timed out. Please try again from the app.'
    },
    toolbar: {
      searchPlaceholder: 'Search email, workspace, account ID…',
      sortLabel: 'Sort'
    },
    sorts: {
      priority: 'Priority',
      recent: 'Recent activity',
      quota: 'Most quota left',
      name: 'Name'
    },
    settings: {
      title: 'Workspace controls',
      subtitle: 'Tune auto-switch policy, notifications, backup and security in one place.',
      strategySection: 'Auto-switch strategy',
      notificationsSection: 'Notifications',
      backupSection: 'Backup',
      securitySection: 'Security',
      refreshInterval: 'Auto refresh',
      refreshIntervalOption: (value: RefreshIntervalMinutes) => `${value} min`,
      minRemaining5h: 'Keep at least 5-hour quota',
      minRemaining7d: 'Keep at least 7-day quota',
      cooldown: 'Switch cooldown',
      cooldownOption: (value: AutoSwitchCooldownMinutes) => value === 0 ? 'No cooldown' : `${value} min`,
      skipConfirm: 'Skip confirmation when a better account is available',
      quietHours: 'Quiet hours',
      quietHoursStart: 'Starts',
      quietHoursEnd: 'Ends',
      strategyHint: 'Pins affect priority, and excluded accounts stay available for manual switching but won’t be chosen automatically.',
      pinnedCount: (count: number) => `${count} pinned`,
      excludedCount: (count: number) => `${count} excluded`,
      excludedAccount: 'Excluded from auto switch',
      secureStorageEnabled: 'Sensitive account tokens are encrypted with the system secure storage.',
      secureStorageFallback: 'System secure storage is unavailable, so tokens fall back to base64 obfuscation.',
      importConfirm: 'Importing a backup will replace current local settings. Continue?'
    },
    usage: {
      shortWindow: '5-hour window',
      longWindow: '7-day window',
      resetIn: 'Resets in'
    },
    history: {
      recentTrend: 'Recent trend',
      empty: 'No history yet'
    },
    empty: {
      noAccountsTitle: 'No Codex accounts yet',
      noAccountsDescription: 'Connect your first account to start switching workspaces and monitoring usage here.',
      noMatchTitle: 'Nothing in this view',
      noMatchDescription: 'Try another filter to see the rest of your workspaces.'
    },
    switchGuard: {
      disabled: 'This workspace is currently disabled and cannot be switched to.',
      expired: 'This session has expired. Refresh the account before switching.',
      exhausted: (reason: string) => `This workspace has exhausted its ${reason} and cannot be switched to right now.`,
      exhaustedWithReset: (reason: string, reset: string) => `This workspace has exhausted its ${reason}. It should be available again in ${reset}.`,
      unavailable: 'This workspace is currently unavailable. Refresh it and try again.'
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
      reasonLabel: (cause: AutoSwitchCause) => {
        if (cause === 'both') {
          return '5-hour and 7-day quota'
        }

        return cause === '7d' ? '7-day quota' : '5-hour quota'
      },
      confirmTitle: 'Current account quota is exhausted',
      confirmDescription: (current: string, next: string, reason: string) => `${current} can no longer be used because its ${reason} is exhausted. Switch to ${next} now?`,
      switchedTitle: 'Switched account',
      switchedDescription: (next: string) => `CodexManager has switched to ${next}.`,
      noAvailableTitle: 'No available account to switch',
      noAvailableDescription: (current: string, reason: string) => `${current} has exhausted its ${reason}, and every added account is currently unavailable. Please wait for reset or add another account.`,
      currentAccount: 'Current account',
      nextAccount: 'Suggested account',
      rememberChoice: 'Do not ask again next time',
      confirm: 'Switch now',
      cancel: 'Stay here',
      acknowledge: 'Got it'
    },
    repair: {
      refreshed: (email: string) => `${email} has been refreshed and is available again.`,
      relogin: (email: string) => `${email} still needs re-authentication. Finish the browser sign-in to repair it.`,
      stillExhausted: (email: string) => `${email} is still out of quota after refresh.`
    },
    backup: {
      exportSuccess: 'Backup exported successfully.',
      exportFailed: 'Backup export failed.',
      importSuccess: 'Backup imported successfully.',
      importFailed: 'Backup import failed.'
    },
    diagnostics: {
      title: 'Diagnostics',
      subtitle: 'Recent events help explain refresh, switching and notification decisions.',
      empty: 'No diagnostic events yet.',
      totalLogs: 'Total logs',
      warningLogs: 'Warnings',
      errorLogs: 'Errors',
      categories: {
        refresh: 'Refresh',
        switch: 'Switch',
        oauth: 'Auth',
        notification: 'Notification',
        repair: 'Repair',
        backup: 'Backup',
        security: 'Security',
        settings: 'Settings'
      },
      levels: {
        info: 'Info',
        warning: 'Warning',
        error: 'Error'
      }
    }
  },
  ZH: {
    title: 'CodexManager',
    subtitle: '用更沉稳的方式管理 Codex 账号切换、额度状态与当前工作空间，全局信息一眼看清。',
    personalWorkspace: '个人空间',
    removeConfirm: '确定将这个账号从 CodexManager 中移除吗？',
    groupCount: (count: number) => `${count} 个工作空间`,
    lastUpdated: (value: string) => `最近同步 ${value}`,
    navigation: {
      accounts: '账号列表',
      strategy: '策略中心',
      system: '系统维护'
    },
    pages: {
      accountsTitle: '账号列表',
      accountsDescription: '在一个清晰的工作台里搜索、排序、查看趋势并切换所有已接入账号。',
      strategyTitle: '策略中心',
      strategyDescription: '把自动切换规则和通知偏好独立出来，避免和账号操作混在一起。',
      systemTitle: '系统维护',
      systemDescription: '把备份迁移、本地安全状态和诊断记录放到单独页面，阅读更轻一点。',
      resultCount: (count: number) => `${count} 个结果`
    },
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
      unavailable: '不可切换',
      switching: '切换中',
      repair: '修复账号',
      repairing: '修复中',
      remove: '移除',
      quit: '退出',
      language: '语言',
      showAll: '查看全部',
      settings: '设置中心',
      diagnostics: '诊断面板',
      closePanel: '收起',
      pin: '置顶',
      unpin: '取消置顶',
      excludeAutoSwitch: '排除自动切换',
      includeAutoSwitch: '恢复自动切换',
      exportData: '导出备份',
      importData: '导入备份',
      clearLogs: '清空日志'
    },
    oauth: {
      title: '登录异常',
      inProgress: '当前已有一个登录流程正在进行，请先在浏览器中完成它。',
      unavailable: '本地回调端口不可用，请关闭重复实例后再试一次。',
      exchangeFailed: '浏览器授权已经成功，但换取令牌失败了，请重试。',
      timeout: '登录流程已超时，请回到应用里重新发起登录。'
    },
    toolbar: {
      searchPlaceholder: '搜索邮箱、工作空间、账号 ID…',
      sortLabel: '排序'
    },
    sorts: {
      priority: '优先级',
      recent: '最近活动',
      quota: '剩余额度最多',
      name: '名称'
    },
    settings: {
      title: '工作台设置',
      subtitle: '把自动切换策略、通知、备份和安全能力统一收进这里。',
      strategySection: '自动切换策略',
      notificationsSection: '通知设置',
      backupSection: '备份与迁移',
      securitySection: '本地数据安全',
      refreshInterval: '自动刷新',
      refreshIntervalOption: (value: RefreshIntervalMinutes) => `${value} 分钟`,
      minRemaining5h: '至少保留 5 小时额度',
      minRemaining7d: '至少保留 7 天额度',
      cooldown: '自动切换冷却时间',
      cooldownOption: (value: AutoSwitchCooldownMinutes) => value === 0 ? '不限制' : `${value} 分钟`,
      skipConfirm: '有更优账号时直接自动切换，不再确认',
      quietHours: '系统通知静默时段',
      quietHoursStart: '开始时间',
      quietHoursEnd: '结束时间',
      strategyHint: '置顶会影响自动切换优先级，被排除的账号仍可手动切换，但不会被后台自动选中。',
      pinnedCount: (count: number) => `已置顶 ${count} 个`,
      excludedCount: (count: number) => `已排除 ${count} 个`,
      excludedAccount: '已排除自动切换',
      secureStorageEnabled: '敏感账号令牌会使用系统安全存储进行加密。',
      secureStorageFallback: '当前系统安全存储不可用，令牌会退化为 base64 混淆存储。',
      importConfirm: '导入备份会覆盖当前本地设置，确定继续吗？'
    },
    usage: {
      shortWindow: '5 小时窗口',
      longWindow: '7 天窗口',
      resetIn: '重置剩余'
    },
    history: {
      recentTrend: '最近趋势',
      empty: '暂无历史'
    },
    empty: {
      noAccountsTitle: '还没有 Codex 账号',
      noAccountsDescription: '先接入一个账号，之后你就可以在这里统一切换工作空间并查看额度状态。',
      noMatchTitle: '当前筛选下没有结果',
      noMatchDescription: '换一个筛选条件，就能看到其他工作空间。'
    },
    switchGuard: {
      disabled: '这个工作空间当前已被禁用，暂时不能切换过去。',
      expired: '这个账号的会话已经失效，请先刷新账号后再切换。',
      exhausted: (reason: string) => `这个工作空间的${reason}已耗尽，当前无法切换。`,
      exhaustedWithReset: (reason: string, reset: string) => `这个工作空间的${reason}已耗尽，预计 ${reset} 后可再次使用。`,
      unavailable: '这个工作空间当前不可用，请刷新后再试。'
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
      reasonLabel: (cause: AutoSwitchCause) => {
        if (cause === 'both') {
          return '5 小时和 7 天额度'
        }

        return cause === '7d' ? '7 天额度' : '5 小时额度'
      },
      confirmTitle: '当前账号额度已用尽',
      confirmDescription: (current: string, next: string, reason: string) => `${current} 当前 ${reason}已耗尽，是否立即切换到可继续使用的账号 ${next}？`,
      switchedTitle: '已切换账号',
      switchedDescription: (next: string) => `CodexManager 已切换到 ${next}。`,
      noAvailableTitle: '没有可切换的可用账号',
      noAvailableDescription: (current: string, reason: string) => `${current} 当前 ${reason}已耗尽，而且已添加的账号目前都不可继续使用。请等待额度重置，或添加新的账号。`,
      currentAccount: '当前账号',
      nextAccount: '建议切换',
      rememberChoice: '下次不再提醒',
      confirm: '立即切换',
      cancel: '暂不切换',
      acknowledge: '我知道了'
    },
    repair: {
      refreshed: (email: string) => `${email} 已刷新成功，现在可以继续使用。`,
      relogin: (email: string) => `${email} 仍需要重新登录，请在浏览器中完成授权来修复它。`,
      stillExhausted: (email: string) => `${email} 刷新后额度仍未恢复。`
    },
    backup: {
      exportSuccess: '备份已成功导出。',
      exportFailed: '导出备份失败。',
      importSuccess: '备份已成功导入。',
      importFailed: '导入备份失败。'
    },
    diagnostics: {
      title: '诊断面板',
      subtitle: '这里会记录最近的刷新、切换、通知和修复事件，方便排查问题。',
      empty: '暂时还没有诊断事件。',
      totalLogs: '日志总数',
      warningLogs: '警告',
      errorLogs: '错误',
      categories: {
        refresh: '刷新',
        switch: '切换',
        oauth: '授权',
        notification: '通知',
        repair: '修复',
        backup: '备份',
        security: '安全',
        settings: '设置'
      },
      levels: {
        info: '信息',
        warning: '警告',
        error: '错误'
      }
    }
  }
} satisfies Record<Lang, AppLocaleText>
