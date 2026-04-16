import path from 'node:path'
import os from 'node:os'

/**
 * Electron 主进程使用的全局配置。
 */
export const APP_CONFIG = {
  CLIENT_ID: 'app_EMoamEEZ73f0CkXaXp7hrann',
  REDIRECT_URI: 'http://localhost:1455/auth/callback',
  AUTH_FILE: path.join(os.homedir(), '.codex', 'auth.json'),
  CODEX_APP_NAME: 'Codex',
  CODEX_APP_PATH_CANDIDATES: [
    path.join('/Applications', 'Codex.app'),
    path.join(os.homedir(), 'Applications', 'Codex.app'),
  ],
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
  return path.join(__dirname, '../assets', ...segments)
}
