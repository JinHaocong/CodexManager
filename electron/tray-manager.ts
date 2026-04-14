import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron'
import { getAssetPath } from './constants'

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
  private showWindow() {
    if (!this.tray) return

    const trayBounds = this.tray.getBounds()
    const winBounds = this.window.getBounds()

    // 以托盘中心为基准定位，保持弹层与菜单栏按钮对齐。
    const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (winBounds.width / 2))
    const y = Math.round(trayBounds.y + trayBounds.height + 4)

    this.window.setPosition(x, y, false)
    this.window.show()
    this.window.focus()
  }

  /**
   * 销毁托盘实例，释放事件监听。
   */
  public destroy() {
    this.tray?.destroy()
  }
}
