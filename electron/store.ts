import Store from 'electron-store'

/**
 * 持久化配置结构。
 */
interface StoreSchema {
  accounts: any[]
  activeId: string | null
  lang: 'EN' | 'ZH'
  skipAutoSwitchConfirm: boolean
}

/**
 * 应用本地存储实例。
 */
const store = new Store<StoreSchema>({
  defaults: {
    accounts: [],
    activeId: null,
    lang: 'EN',
    skipAutoSwitchConfirm: false
  }
})

export default store
