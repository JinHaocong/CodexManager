import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron'
import { getAssetPath } from './constants'

const REFRESH_ACCOUNTS_EVENT = 'refresh-accounts'

/**
 * 托盘管理类，负责托盘图标、菜单与弹层显隐。
 */
export class TrayManager {
  private tray: Tray | null = null

  /**
   * @param window 与托盘交互绑定的主窗口实例。
   */
  constructor(private window: BrowserWindow) {}

  /**
   * 初始化托盘实例和菜单事件。
   */
  public init() {
    const trayImage = nativeImage.createFromPath(getAssetPath('trayIconTemplate.png')).resize({ height: 18 })
    trayImage.setTemplateImage(true)

    this.tray = new Tray(trayImage)
    this.tray.setToolTip('CodexManager')

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open CodexManager', click: () => this.showWindow() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])

    this.tray.on('right-click', () => this.tray?.popUpContextMenu(contextMenu))
    this.tray.on('click', () => {
      this.window.isVisible() ? this.window.hide() : this.showWindow()
    })
  }

  /**
   * 将窗口对齐到托盘图标下方并显示。
   */
  public showWindow() {
    if (!this.tray) return

    const trayBounds = this.tray.getBounds()
    const winBounds = this.window.getBounds()

    // 以托盘中心为基准定位，保持弹层与菜单栏按钮对齐。
    const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (winBounds.width / 2))
    const y = Math.round(trayBounds.y + trayBounds.height + 4)

    this.window.setPosition(x, y, false)
    this.window.show()
    this.window.focus()
    this.requestAccountsRefresh()
  }

  /**
   * 展开主界面时主动同步额度，减少看到旧状态的时间窗口。
   */
  private requestAccountsRefresh() {
    const sendRefresh = () => {
      if (!this.window.isDestroyed()) {
        this.window.webContents.send(REFRESH_ACCOUNTS_EVENT)
      }
    }

    if (this.window.webContents.isLoading()) {
      this.window.webContents.once('did-finish-load', sendRefresh)
      return
    }

    sendRefresh()
  }

  /**
   * 销毁托盘实例，释放事件监听。
   */
  public destroy() {
    this.tray?.destroy()
  }
}
