import { ipcMain, app, nativeImage } from 'electron'
import axios from 'axios'
import fs from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'
import store from './store'
import { APP_CONFIG } from './constants'
import { OAuthService } from './oauth-service'

const oauthService = new OAuthService()

/**
 * 注册所有 IPC 事件处理器。
 */
export function registerIpcHandlers() {
  // 1. 代理请求 (绕过 Header 限制)
  ipcMain.handle('proxy-request', async (_, { url, headers }) => {
    try {
      const response = await axios.get(url, { headers, timeout: 10000 })
      return { success: true, data: response.data }
    } catch (err: any) {
      return { success: false, status: err.response?.status, error: err.message }
    }
  })

  // 2. 持久化存储读写
  ipcMain.handle('get-accounts', () => store.get('accounts'))
  ipcMain.handle('set-accounts', (_, accounts) => store.set('accounts', accounts))
  ipcMain.handle('get-active-id', () => store.get('activeId'))
  ipcMain.handle('set-active-id', (_, id) => store.set('activeId', id))
  ipcMain.handle('get-lang', () => store.get('lang'))
  ipcMain.handle('set-lang', (_, lang) => store.set('lang', lang))
  ipcMain.handle('get-skip-auto-switch-confirm', () => store.get('skipAutoSwitchConfirm'))
  ipcMain.handle('set-skip-auto-switch-confirm', (_, value) => store.set('skipAutoSwitchConfirm', value))

  // 3. 账户切换 (写入 ~/.codex/auth.json 并重启)
  ipcMain.handle('switch-account', async (_, account) => {
    try {
      let config: any = {}
      if (fs.existsSync(APP_CONFIG.AUTH_FILE)) {
        const raw = fs.readFileSync(APP_CONFIG.AUTH_FILE, 'utf-8')
        if (raw) config = JSON.parse(raw)
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
      fs.writeFileSync(APP_CONFIG.AUTH_FILE, JSON.stringify(config, null, 2))

      // 延迟重启确保写入落盘
      exec('pkill -x "Codex"', () => {
        setTimeout(() => exec('open /Applications/Codex.app'), 500)
      })

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 4. 应用控制
  ipcMain.on('start-oauth', (event) => oauthService.start(event.sender))
  ipcMain.on('quit-app', () => app.quit())
}
