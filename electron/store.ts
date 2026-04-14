import Store from 'electron-store'

/**
 * 持久化配置结构。
 */
interface StoreSchema {
  accounts: any[]
  activeId: string | null
  lang: 'EN' | 'ZH'
  skipAutoSwitchConfirm: boolean
  refreshIntervalMinutes: number
}

/**
 * 应用本地存储实例。
 */
const store = new Store<StoreSchema>({
  defaults: {
    accounts: [],
    activeId: null,
    lang: 'EN',
    skipAutoSwitchConfirm: false,
    refreshIntervalMinutes: 3
  }
})

export default store
