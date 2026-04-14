import path from 'node:path'
import os from 'node:os'
import { app } from 'electron'

/**
 * Electron 主进程使用的全局配置。
 */
export const APP_CONFIG = {
  CLIENT_ID: 'app_EMoamEEZ73f0CkXaXp7hrann',
  REDIRECT_URI: 'http://localhost:1455/auth/callback',
  AUTH_FILE: path.join(os.homedir(), '.codex', 'auth.json'),
  SCOPE: 'openid profile email offline_access api.connectors.read api.connectors.invoke',
  OAUTH_PORT: 1455,
  WINDOW_WIDTH: 430,
  WINDOW_HEIGHT: 700
}

/**
 * 根据运行环境解析应用资源路径。
 *
 * @param segments 资源路径片段。
 */
export function getAssetPath(...segments: string[]): string {
  const basePath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../assets')

  return path.join(basePath, ...segments)
}
