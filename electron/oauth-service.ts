import http from 'node:http'
import crypto from 'node:crypto'
import { shell, WebContents } from 'electron'
import axios from 'axios'
import querystring from 'node:querystring'
import { APP_CONFIG } from './constants'

/**
 * OAuth 认证服务，负责拉起浏览器授权并接收本地回调。
 */
export class OAuthService {
  private verifier: string = ''
  private state: string = ''

  /**
   * 生成 PKCE 校验码。
   */
  private generatePKCE() {
    this.verifier = crypto.randomBytes(32).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    
    return crypto.createHash('sha256')
      .update(this.verifier).digest()
      .toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  /**
   * 开启本地回调服务器并打开浏览器。
   *
   * @param sender 用于把授权结果回传给渲染进程。
   */
  public start(sender: WebContents) {
    const challenge = this.generatePKCE()
    this.state = crypto.randomBytes(16).toString('hex')

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`)
      
      if (url.pathname === '/auth/callback') {
        const code = url.searchParams.get('code')
        const returnedState = url.searchParams.get('state')

        // `state` 校验失败时立即终止，避免串号或伪造回调污染当前登录流程。
        if (returnedState !== this.state) {
          res.end('State mismatch')
          return server.close()
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<div style="text-align:center;padding-top:100px;font-family:sans-serif;"><h1>✓ Authorized</h1><p>Return to app.</p></div>')
        
        try {
          // 本地回调只负责拿到授权码，真正的 token 交换仍走 OpenAI OAuth 接口。
          const tokenRes = await axios.post('https://auth.openai.com/oauth/token', 
            querystring.stringify({
              grant_type: 'authorization_code',
              client_id: APP_CONFIG.CLIENT_ID,
              code,
              redirect_uri: APP_CONFIG.REDIRECT_URI,
              code_verifier: this.verifier
            }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
          )
          
          sender.send('oauth-success', tokenRes.data)
        } catch (err: any) {
          console.error('Token swap error:', err.message)
        }
        server.close()
      }
    }).listen(APP_CONFIG.OAUTH_PORT)

    // 使用系统浏览器完成登录，避免在应用内维护额外的登录容器。
    const authUrl = `https://auth.openai.com/oauth/authorize?` + querystring.stringify({
      response_type: 'code',
      client_id: APP_CONFIG.CLIENT_ID,
      redirect_uri: APP_CONFIG.REDIRECT_URI,
      scope: APP_CONFIG.SCOPE,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      id_token_add_organizations: 'true',
      codex_cli_simplified_flow: 'true',
      state: this.state,
      originator: 'Codex Desktop'
    })
    
    shell.openExternal(authUrl)
  }
}
