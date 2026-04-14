/**
 * 保留 Electron 默认的版本信息注入逻辑，方便本地调试页复用。
 */
window.addEventListener('DOMContentLoaded', () => {
  /**
   * 用指定文本替换调试页中的占位元素。
   */
  const replaceText = (selector: string, text: string) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type as keyof NodeJS.ProcessVersions]!)
  }
})
