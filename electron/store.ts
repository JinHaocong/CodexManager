import { safeStorage } from 'electron'
import Store from 'electron-store'

import type {
  Account,
  AccountUsageHistory,
  AutoSwitchStrategy,
  DiagnosticLogEntry,
  Lang,
  NotificationSettings,
  SecureStorageStatus,
} from '../src/types'
import {
  DEFAULT_AUTO_SWITCH_STRATEGY,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../src/types'

const SECURE_VALUE_PREFIX = 'codex-secure:'
const BASE64_FALLBACK_PREFIX = 'codex-base64:'

/**
 * 持久化配置结构。
 */
interface StoreSchema {
  accounts: string | Account[]
  activeId: string | null
  lang: Lang
  skipAutoSwitchConfirm: boolean
  refreshIntervalMinutes: number
  autoSwitchStrategy: AutoSwitchStrategy
  notificationSettings: NotificationSettings
  pinnedAccountIds: string[]
  usageHistory: AccountUsageHistory
  diagnosticLogs: DiagnosticLogEntry[]
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
    refreshIntervalMinutes: 3,
    autoSwitchStrategy: DEFAULT_AUTO_SWITCH_STRATEGY,
    notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
    pinnedAccountIds: [],
    usageHistory: {},
    diagnosticLogs: [],
  },
})

/**
 * 判断未知值是否为账号数组。
 *
 * @param value 待校验的值。
 */
function isAccountArray(value: unknown): value is Account[] {
  return Array.isArray(value)
}

/**
 * 判断安全存储当前是否可用，并生成对外展示的状态。
 */
export function getSecureStorageStatus(): SecureStorageStatus {
  const available = safeStorage.isEncryptionAvailable()

  return {
    available,
    mode: available ? 'safe-storage' : 'base64-fallback',
  }
}

/**
 * 对敏感内容做加密或退化编码，保证本地至少不再以明文 JSON 形式存储。
 *
 * @param value 需要安全序列化的数据。
 */
function encodeSecureValue(value: unknown): string {
  const serialized = JSON.stringify(value)
  const status = getSecureStorageStatus()

  if (status.available) {
    return `${SECURE_VALUE_PREFIX}${safeStorage.encryptString(serialized).toString('base64')}`
  }

  return `${BASE64_FALLBACK_PREFIX}${Buffer.from(serialized, 'utf-8').toString('base64')}`
}

/**
 * 读取并解码安全存储内容。
 *
 * @param value 安全序列化后的字符串。
 */
function decodeSecureValue<T>(value: string): T | null {
  try {
    if (value.startsWith(SECURE_VALUE_PREFIX)) {
      const raw = value.slice(SECURE_VALUE_PREFIX.length)
      const decrypted = safeStorage.decryptString(Buffer.from(raw, 'base64'))
      return JSON.parse(decrypted) as T
    }

    if (value.startsWith(BASE64_FALLBACK_PREFIX)) {
      const raw = value.slice(BASE64_FALLBACK_PREFIX.length)
      return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')) as T
    }
  } catch (error) {
    console.error('Failed to decode secure store value:', error)
  }

  return null
}

/**
 * 读取账号列表，并自动把旧的明文数组迁移成加密存储。
 */
export function getAccountsFromStore(): Account[] {
  const storedAccounts = store.get('accounts')

  if (typeof storedAccounts === 'string') {
    return decodeSecureValue<Account[]>(storedAccounts) ?? []
  }

  if (!isAccountArray(storedAccounts)) {
    return []
  }

  // 兼容早期版本的明文数组，一旦读到就立即迁移成受保护格式。
  setAccountsInStore(storedAccounts)
  return storedAccounts
}

/**
 * 以安全格式写入账号列表。
 *
 * @param accounts 待持久化的账号集合。
 */
export function setAccountsInStore(accounts: Account[]): void {
  store.set('accounts', encodeSecureValue(accounts))
}

export default store
