import { ipcMain, app, BrowserWindow, Notification, dialog } from 'electron'
import axios from 'axios'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import querystring from 'node:querystring'

import type {
  Account,
  AppBackupPayload,
  AutoSwitchStrategy,
  DiagnosticLogEntry,
  NotificationSettings,
  ProxyRequestPayload,
  RefreshIntervalMinutes,
  SystemNotificationPayload,
} from '../src/types'
import {
  DEFAULT_AUTO_SWITCH_STRATEGY,
  DEFAULT_NOTIFICATION_SETTINGS,
  REFRESH_INTERVAL_OPTIONS,
} from '../src/types'

import store, {
  getAccountsFromStore,
  getSecureStorageStatus,
  setAccountsInStore,
} from './store'
import { APP_CONFIG, getAssetPath } from './constants'
import { OAuthService } from './oauth-service'

const oauthService = new OAuthService()
const OPEN_AUTO_SWITCH_DIALOG_EVENT = 'open-auto-switch-dialog'
const BACKUP_VERSION = 1

interface RegisterIpcHandlersOptions {
  getMainWindow: () => BrowserWindow | null
  showWindow: () => void
  updateTrayMenuLang?: (lang: 'EN' | 'ZH') => void
}

/**
 * 安全删除临时文件，忽略不存在的场景。
 *
 * @param filePath 需要删除的文件路径。
 */
function removeFileIfExists(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true })
  }
}

/**
 * 将选中的账号令牌写回 Codex 本地配置。
 * 通过临时文件 + 短生命周期备份完成原子替换，写入失败时自动回滚。
 *
 * @param account 需要切换到的账号。
 */
function persistCodexAuth(account: Account): void {
  const backupPath = `${APP_CONFIG.AUTH_FILE}.bak.tmp`
  const tempPath = `${APP_CONFIG.AUTH_FILE}.tmp`
  let config: Record<string, unknown> = {}
  let backupCreated = false

  if (fs.existsSync(APP_CONFIG.AUTH_FILE)) {
    const raw = fs.readFileSync(APP_CONFIG.AUTH_FILE, 'utf-8')
    if (raw) {
      config = JSON.parse(raw) as Record<string, unknown>
      // 写入前先保留备份，用于失败时回滚。
      fs.writeFileSync(backupPath, raw)
      backupCreated = true
    }
  }

  // 保留原配置中的其他字段，只覆盖 Codex 登录所需的 token 信息。
  config.auth_mode = 'chatgpt'
  config.OPENAI_API_KEY = null
  config.tokens = {
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    id_token: account.id_token,
    last_refresh: new Date().toISOString()
  }

  fs.mkdirSync(path.dirname(APP_CONFIG.AUTH_FILE), { recursive: true })

  try {
    removeFileIfExists(tempPath)
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2))
    fs.renameSync(tempPath, APP_CONFIG.AUTH_FILE)
    removeFileIfExists(backupPath)
  } catch (err) {
    removeFileIfExists(tempPath)

    // 写入失败时尝试从备份恢复，确保账号状态不丢失。
    if (backupCreated && fs.existsSync(backupPath)) {
      try {
        fs.renameSync(backupPath, APP_CONFIG.AUTH_FILE)
      } catch {
        // 回滚也失败时，只记录日志，不再继续抛出，避免二次崩溃。
        console.error('persistCodexAuth: failed to restore backup')
      }
    }

    removeFileIfExists(backupPath)
    throw err
  }
}

/**
 * Promise 版 execFile，便于串联“退出应用 -> 等待进程退出 -> 重新打开”。
 *
 * @param file 可执行文件名。
 * @param args 传给命令的参数数组。
 */
function execFileAsync(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, args, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

/**
 * 简单延迟，给 macOS 应用关闭和重启留出过渡时间。
 *
 * @param ms 需要等待的毫秒数。
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * 检查指定进程是否仍在运行。
 *
 * @param processName 进程名，例如 `Codex`。
 */
async function isProcessRunning(processName: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('pgrep', ['-x', processName], (error, stdout) => {
      if (error) {
        resolve(false)
        return
      }

      resolve(Boolean(stdout.trim()))
    })
  })
}

/**
 * 向指定进程发送退出信号。
 *
 * 这里不用应用层 `quit`，而是直接发进程信号，避免触发 Codex 自己的确认弹窗。
 *
 * @param processName 目标进程名。
 * @param signal 需要发送的 Unix signal。
 */
async function terminateProcess(
  processName: string,
  signal: 'TERM' | 'KILL',
): Promise<void> {
  try {
    await execFileAsync('pkill', [`-${signal}`, '-x', processName])
  } catch {
    // 进程不存在时 pkill 会返回非 0，这里直接忽略即可。
  }
}

/**
 * 等待目标进程退出，避免在原实例尚未关闭时直接 reopen 导致“看起来没重启”。
 *
 * @param processName 需要等待退出的进程名。
 * @param timeoutMs 最长等待时间。
 */
async function waitForProcessExit(
  processName: string,
  timeoutMs = 4000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const running = await isProcessRunning(processName)

    if (!running) {
      return
    }

    await delay(150)
  }
}

/**
 * 定位本机已安装的 Codex 应用路径。
 */
function resolveCodexAppPath(): string {
  const matchedPath = APP_CONFIG.CODEX_APP_PATH_CANDIDATES.find((candidate) =>
    fs.existsSync(candidate),
  )

  if (!matchedPath) {
    throw new Error('未找到 Codex.app，请确认 Codex 已安装到 /Applications。')
  }

  return matchedPath
}

/**
 * 退出并重新打开真正的 Codex 应用，让刚写入的 auth.json 立即生效。
 */
async function restartCodexDesktop(): Promise<void> {
  const codexAppPath = resolveCodexAppPath()

  // 先尝试温和终止，给 Codex 留出收尾时间。
  await terminateProcess(APP_CONFIG.CODEX_APP_NAME, 'TERM')
  await waitForProcessExit(APP_CONFIG.CODEX_APP_NAME, 1800)

  // 若仍未退出，再强制结束，避免 switch 成功但应用没有真正重启。
  if (await isProcessRunning(APP_CONFIG.CODEX_APP_NAME)) {
    await terminateProcess(APP_CONFIG.CODEX_APP_NAME, 'KILL')
    await waitForProcessExit(APP_CONFIG.CODEX_APP_NAME, 1200)
  }

  await delay(250)
  await execFileAsync('open', ['-a', codexAppPath])
}

/**
 * 判断值是否为可遍历对象。
 *
 * @param value 待校验的值。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * 过滤出字符串数组，避免导入脏数据污染配置。
 *
 * @param value 待规范化的值。
 */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

/**
 * 规范化自动刷新间隔，确保导入与外部写入始终落在支持的档位内。
 *
 * @param value 原始值。
 */
function normalizeRefreshInterval(value: unknown): RefreshIntervalMinutes {
  if (
    typeof value === 'number' &&
    REFRESH_INTERVAL_OPTIONS.includes(value as RefreshIntervalMinutes)
  ) {
    return value as RefreshIntervalMinutes
  }

  return 3
}

/**
 * 对自动切换策略做兜底规范化。
 *
 * @param value 原始策略配置。
 */
function normalizeAutoSwitchStrategy(value: unknown): AutoSwitchStrategy {
  if (!isRecord(value)) {
    return DEFAULT_AUTO_SWITCH_STRATEGY
  }

  const cooldownMinutes = [0, 5, 10, 20, 30].includes(Number(value.cooldownMinutes))
    ? Number(value.cooldownMinutes)
    : DEFAULT_AUTO_SWITCH_STRATEGY.cooldownMinutes

  return {
    minRemaining5h:
      typeof value.minRemaining5h === 'number'
        ? Math.max(0, Math.min(50, Math.round(value.minRemaining5h)))
        : DEFAULT_AUTO_SWITCH_STRATEGY.minRemaining5h,
    minRemaining7d:
      typeof value.minRemaining7d === 'number'
        ? Math.max(0, Math.min(50, Math.round(value.minRemaining7d)))
        : DEFAULT_AUTO_SWITCH_STRATEGY.minRemaining7d,
    cooldownMinutes: cooldownMinutes as AutoSwitchStrategy['cooldownMinutes'],
    excludedAccountIds: toStringArray(value.excludedAccountIds),
  }
}

/**
 * 对通知偏好做兜底规范化。
 *
 * @param value 原始通知配置。
 */
function normalizeNotificationSettings(value: unknown): NotificationSettings {
  if (!isRecord(value)) {
    return DEFAULT_NOTIFICATION_SETTINGS
  }

  return {
    autoSwitchConfirm:
      typeof value.autoSwitchConfirm === 'boolean'
        ? value.autoSwitchConfirm
        : DEFAULT_NOTIFICATION_SETTINGS.autoSwitchConfirm,
    autoSwitchUnavailable:
      typeof value.autoSwitchUnavailable === 'boolean'
        ? value.autoSwitchUnavailable
        : DEFAULT_NOTIFICATION_SETTINGS.autoSwitchUnavailable,
    switchSuccess:
      typeof value.switchSuccess === 'boolean'
        ? value.switchSuccess
        : DEFAULT_NOTIFICATION_SETTINGS.switchSuccess,
    oauthError:
      typeof value.oauthError === 'boolean'
        ? value.oauthError
        : DEFAULT_NOTIFICATION_SETTINGS.oauthError,
    quietHoursEnabled:
      typeof value.quietHoursEnabled === 'boolean'
        ? value.quietHoursEnabled
        : DEFAULT_NOTIFICATION_SETTINGS.quietHoursEnabled,
    quietHoursStart:
      typeof value.quietHoursStart === 'string'
        ? value.quietHoursStart
        : DEFAULT_NOTIFICATION_SETTINGS.quietHoursStart,
    quietHoursEnd:
      typeof value.quietHoursEnd === 'string'
        ? value.quietHoursEnd
        : DEFAULT_NOTIFICATION_SETTINGS.quietHoursEnd,
  }
}

/**
 * 规范化诊断日志数组，导入时自动裁剪到最近 120 条。
 *
 * @param value 原始日志集合。
 */
function normalizeDiagnosticLogs(value: unknown): DiagnosticLogEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is DiagnosticLogEntry => isRecord(item) && typeof item.message === 'string')
    .slice(-120)
}

/**
 * 规范化导入备份内容，兼容缺字段或旧版本文件。
 *
 * @param payload 原始备份对象。
 */
function normalizeBackupPayload(payload: unknown): AppBackupPayload | null {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return null
  }

  const data = payload.data

  return {
    version: typeof payload.version === 'number' ? payload.version : BACKUP_VERSION,
    exportedAt:
      typeof payload.exportedAt === 'string' ? payload.exportedAt : new Date().toISOString(),
    data: {
      accounts: Array.isArray(data.accounts) ? (data.accounts as Account[]) : [],
      activeId: typeof data.activeId === 'string' || data.activeId === null ? data.activeId : null,
      lang: data.lang === 'ZH' ? 'ZH' : 'EN',
      skipAutoSwitchConfirm: Boolean(data.skipAutoSwitchConfirm),
      refreshIntervalMinutes: normalizeRefreshInterval(data.refreshIntervalMinutes),
      autoSwitchStrategy: normalizeAutoSwitchStrategy(data.autoSwitchStrategy),
      notificationSettings: normalizeNotificationSettings(data.notificationSettings),
      pinnedAccountIds: toStringArray(data.pinnedAccountIds),
      usageHistory: isRecord(data.usageHistory) ? (data.usageHistory as AppBackupPayload['data']['usageHistory']) : {},
      diagnosticLogs: normalizeDiagnosticLogs(data.diagnosticLogs),
    },
  }
}

/**
 * 注册所有 IPC 事件处理器。
 */
export function registerIpcHandlers({ getMainWindow, showWindow, updateTrayMenuLang }: RegisterIpcHandlersOptions) {
  // 1. 代理请求 (绕过 Header 限制)
  ipcMain.handle('proxy-request', async (_, { url, headers }: ProxyRequestPayload) => {
    try {
      const response = await axios.get(url, { headers, timeout: 10000 })
      return { success: true, data: response.data }
    } catch (err: any) {
      return { success: false, status: err.response?.status, error: err.message }
    }
  })

  // 2. 持久化存储读写
  ipcMain.handle('get-accounts', () => {
    return getAccountsFromStore()
  })
  ipcMain.handle('set-accounts', (_, accounts: Account[]) => setAccountsInStore(Array.isArray(accounts) ? accounts : []))
  ipcMain.handle('get-active-id', () => store.get('activeId'))
  ipcMain.handle('set-active-id', (_, id) => store.set('activeId', id))
  ipcMain.handle('get-lang', () => store.get('lang'))
  ipcMain.handle('set-lang', (_, lang) => {
    store.set('lang', lang)
    // 语言变更时同步更新托盘菜单文案。
    updateTrayMenuLang?.(lang as 'EN' | 'ZH')
  })
  ipcMain.handle('get-skip-auto-switch-confirm', () => store.get('skipAutoSwitchConfirm'))
  ipcMain.handle('set-skip-auto-switch-confirm', (_, value) => store.set('skipAutoSwitchConfirm', value))
  ipcMain.handle('get-refresh-interval-minutes', () => store.get('refreshIntervalMinutes'))
  ipcMain.handle('set-refresh-interval-minutes', (_, value) => {
    store.set('refreshIntervalMinutes', normalizeRefreshInterval(value))
  })
  ipcMain.handle('get-auto-switch-strategy', () => {
    return normalizeAutoSwitchStrategy(store.get('autoSwitchStrategy'))
  })
  ipcMain.handle('set-auto-switch-strategy', (_, value) => {
    store.set('autoSwitchStrategy', normalizeAutoSwitchStrategy(value))
  })
  ipcMain.handle('get-notification-settings', () => {
    return normalizeNotificationSettings(store.get('notificationSettings'))
  })
  ipcMain.handle('set-notification-settings', (_, value) => {
    store.set('notificationSettings', normalizeNotificationSettings(value))
  })
  ipcMain.handle('get-pinned-account-ids', () => toStringArray(store.get('pinnedAccountIds')))
  ipcMain.handle('set-pinned-account-ids', (_, value) => {
    store.set('pinnedAccountIds', toStringArray(value))
  })
  ipcMain.handle('get-usage-history', () => {
    const usageHistory = store.get('usageHistory')
    return isRecord(usageHistory) ? usageHistory : {}
  })
  ipcMain.handle('set-usage-history', (_, value) => {
    store.set('usageHistory', isRecord(value) ? value : {})
  })
  ipcMain.handle('get-diagnostic-logs', () => normalizeDiagnosticLogs(store.get('diagnosticLogs')))
  ipcMain.handle('set-diagnostic-logs', (_, value) => {
    store.set('diagnosticLogs', normalizeDiagnosticLogs(value))
  })
  ipcMain.handle('get-secure-storage-status', () => getSecureStorageStatus())

  // 3. 账户切换 (写入 ~/.codex/auth.json 并重启)
  ipcMain.handle('switch-account', async (_, account: Account) => {
    try {
      persistCodexAuth(account)
      await restartCodexDesktop()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 4. 后台 token 刷新成功后，同步更新当前 Codex 生效的 auth 配置。
  ipcMain.handle('sync-account-auth', async (_, account: Account) => {
    try {
      persistCodexAuth(account)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 5. Token 刷新（401 时用 refresh_token 换取新 access_token，避免用户被迫重新登录）
  ipcMain.handle('refresh-token', async (_, account: Account) => {
    try {
      const response = await axios.post(
        'https://auth.openai.com/oauth/token',
        querystring.stringify({
          grant_type: 'refresh_token',
          client_id: APP_CONFIG.CLIENT_ID,
          refresh_token: account.refresh_token,
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        }
      )
      return { success: true, data: response.data }
    } catch (err: any) {
      return { success: false, status: err.response?.status, error: err.message }
    }
  })

  // 6. 数据备份导入导出
  ipcMain.handle('export-app-backup', async (_, payload: AppBackupPayload) => {
    const backupPayload = normalizeBackupPayload(payload)
    if (!backupPayload) {
      return { success: false, error: 'Invalid backup payload' }
    }

    const result = await dialog.showSaveDialog({
      defaultPath: `CodexManager-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'cancelled' }
    }

    try {
      fs.writeFileSync(result.filePath, JSON.stringify(backupPayload, null, 2), 'utf-8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('import-app-backup', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePaths[0]) {
      return { success: true }
    }

    try {
      const raw = fs.readFileSync(result.filePaths[0], 'utf-8')
      const parsed = normalizeBackupPayload(JSON.parse(raw))

      if (!parsed) {
        return { success: false, error: 'Invalid backup file' }
      }

      return { success: true, data: parsed }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 7. 应用控制
  ipcMain.on('show-system-notification', (_event, payload: SystemNotificationPayload) => {
    if (!payload?.title || !payload?.body) {
      return
    }

    const handleNotificationClick = () => {
      showWindow()

      if (payload.intent === 'open-auto-switch-dialog') {
        getMainWindow()?.webContents.send(OPEN_AUTO_SWITCH_DIALOG_EVENT)
      }
    }

    if (!Notification.isSupported()) {
      handleNotificationClick()
      return
    }

    const notification = new Notification({
      title: payload.title,
      body: payload.body,
      icon: getAssetPath('icon.png')
    })

    notification.on('click', handleNotificationClick)
    notification.show()
  })

  ipcMain.on('start-oauth', (event) => oauthService.start(event.sender))
  ipcMain.on('quit-app', () => app.quit())
}
