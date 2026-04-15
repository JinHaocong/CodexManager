import { app, BrowserWindow, globalShortcut } from 'electron'
import path from 'node:path'
import { APP_CONFIG, getAssetPath } from './constants'
import { registerIpcHandlers } from './ipc-handlers'
import { TrayManager } from './tray-manager'

let win: BrowserWindow | null = null
let trayManager: TrayManager | null = null

/**
 * 创建主窗口并挂载托盘面板逻辑。
 */
async function createWindow() {
  win = new BrowserWindow({
    width: APP_CONFIG.WINDOW_WIDTH,
    height: APP_CONFIG.WINDOW_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // 开发环境加载 Vite Server，生产环境加载静态文件
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    // 开发环境自动打开 DevTools
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 失去焦点自动隐藏（DevTools 获焦时不隐藏主窗口）
  win.on('blur', () => {
    if (!win?.webContents.isDevToolsOpened()) {
      win?.hide()
    }
  })

  trayManager = new TrayManager(win)
  trayManager.init()
}

/**
 * Electron 应用启动入口。
 */
app.whenReady().then(() => {
  // 隐藏 Dock 栏，实现纯粹的菜单栏应用
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide()
  }

  registerIpcHandlers({
    getMainWindow: () => win,
    showWindow: () => trayManager?.showWindow(),
    updateTrayMenuLang: (lang) => trayManager?.updateMenuLang(lang),
  })
  createWindow()

  // 开发环境注册 F12 快捷键切换 DevTools
  if (process.env.VITE_DEV_SERVER_URL) {
    globalShortcut.register('F12', () => {
      win?.webContents.toggleDevTools()
    })
  }
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  trayManager?.destroy()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
