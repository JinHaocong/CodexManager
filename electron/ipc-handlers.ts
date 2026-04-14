import { ipcMain, app, BrowserWindow, Notification } from 'electron'
import axios from 'axios'
import fs from 'node:fs'
import path from 'node:path'
import querystring from 'node:querystring'

import type { Account, ProxyRequestPayload, SystemNotificationPayload } from '../src/types'

import store from './store'
import { APP_CONFIG, getAssetPath } from './constants'
import { OAuthService } from './oauth-service'

const oauthService = new OAuthService()
const OPEN_AUTO_SWITCH_DIALOG_EVENT = 'open-auto-switch-dialog'

interface RegisterIpcHandlersOptions {
  getMainWindow: () => BrowserWindow | null
  showWindow: () => void
  updateTrayMenuLang?: (lang: 'EN' | 'ZH') => void
}

/**
 * 将选中的账号令牌写回 Codex 本地配置。
 * 写入前备份原文件，写入失败时自动回滚，保证配置不会因异常被清空。
 *
 * @param account 需要切换到的账号。
 */
function persistCodexAuth(account: Account): void {
  const backupPath = `${APP_CONFIG.AUTH_FILE}.bak`
  let config: Record<string, unknown> = {}

  if (fs.existsSync(APP_CONFIG.AUTH_FILE)) {
    const raw = fs.readFileSync(APP_CONFIG.AUTH_FILE, 'utf-8')
    if (raw) {
      config = JSON.parse(raw) as Record<string, unknown>
      // 写入前先保留备份，用于失败时回滚。
      fs.writeFileSync(backupPath, raw)
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
    fs.writeFileSync(APP_CONFIG.AUTH_FILE, JSON.stringify(config, null, 2))
  } catch (err) {
    // 写入失败时尝试从备份恢复，确保账号状态不丢失。
    if (fs.existsSync(backupPath)) {
      try {
        fs.writeFileSync(APP_CONFIG.AUTH_FILE, fs.readFileSync(backupPath))
      } catch {
        // 回滚也失败时，只记录日志，不再继续抛出，避免二次崩溃。
        console.error('persistCodexAuth: failed to restore backup')
      }
    }
    throw err
  }
}

/**
 * 复用 Electron 自带的重启能力，避免依赖固定安装路径。
 */
function scheduleRelaunch(): void {
  // 延迟退出当前实例，给渲染层留出处理成功反馈和系统通知的时间窗口。
  setTimeout(() => {
    app.relaunch()
    app.exit(0)
  }, 200)
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
    const accounts = store.get('accounts')
    // 防御性校验，避免脏数据传入渲染层导致崩溃。
    return Array.isArray(accounts) ? accounts : []
  })
  ipcMain.handle('set-accounts', (_, accounts) => store.set('accounts', accounts))
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
  ipcMain.handle('set-refresh-interval-minutes', (_, value) => store.set('refreshIntervalMinutes', value))

  // 3. 账户切换 (写入 ~/.codex/auth.json 并重启)
  ipcMain.handle('switch-account', async (_, account: Account) => {
    try {
      persistCodexAuth(account)
      scheduleRelaunch()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 4. Token 刷新（401 时用 refresh_token 换取新 access_token，避免用户被迫重新登录）
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

  // 5. 应用控制
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
