import type { IpcRenderer } from 'electron'

import type { Account, AccountsCheckPayload, Lang, ProxyResponse, UsagePayload } from '../types'

const { ipcRenderer } = window.require('electron') as { ipcRenderer: IpcRenderer }

/**
 * 通过主进程代理发起请求，统一补齐鉴权与语言头。
 *
 * @param url 目标接口地址。
 * @param account 当前请求使用的账号。
 * @param lang 当前界面语言。
 */
export async function fetchThroughProxy<T>(url: string, account: Account, lang: Lang): Promise<ProxyResponse<T>> {
  return ipcRenderer.invoke('proxy-request', {
    url,
    headers: {
      'Authorization': `Bearer ${account.access_token}`,
      'chatgpt-account-id': account.accountId,
      'Accept': '*/*',
      'oai-language': lang === 'ZH' ? 'zh-CN' : 'en-US',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://chatgpt.com/codex/settings/usage'
    }
  })
}

/**
 * 获取当前账号的额度用量数据。
 */
export function getUsage(account: Account, lang: Lang): Promise<ProxyResponse<UsagePayload>> {
  return fetchThroughProxy<UsagePayload>('https://chatgpt.com/backend-api/wham/usage', account, lang)
}

/**
 * 获取当前账号可访问的组织信息，用于补全工作空间名称。
 */
export function getAccountsCheck(account: Account, lang: Lang): Promise<ProxyResponse<AccountsCheckPayload>> {
  return fetchThroughProxy<AccountsCheckPayload>(
    'https://chatgpt.com/backend-api/accounts/check/v4-2023-04-27?timezone_offset_min=-480',
    account,
    lang
  )
}
