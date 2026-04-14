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
  private server: http.Server | null = null
  private timeoutId: NodeJS.Timeout | null = null

  /**
   * 清理本轮 OAuth 上下文，避免下次登录复用旧状态。
   */
  private cleanupFlow() {
    this.verifier = ''
    this.state = ''

    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    if (this.server) {
      this.server.close()
      this.server = null
    }
  }

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
    if (this.server) {
      sender.send('oauth-error', { code: 'in-progress' })
      return
    }

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
          this.cleanupFlow()
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Authorized — CodexManager</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #f0eeff 0%, #e8f4fd 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .card {
      text-align: center; padding: 48px 40px; max-width: 360px; width: 100%;
      background: rgba(255,255,255,0.88); border-radius: 24px;
      box-shadow: 0 20px 60px rgba(92,84,133,0.12);
      backdrop-filter: blur(20px);
    }
    .icon {
      display: inline-grid; place-items: center;
      width: 64px; height: 64px; border-radius: 20px; margin-bottom: 20px;
      background: linear-gradient(180deg, #8d80c6 0%, #7568ad 100%);
      font-size: 28px; color: #fff;
      box-shadow: 0 8px 24px rgba(115,103,170,0.28);
    }
    h1 { font-size: 20px; font-weight: 700; color: #2d2650; margin-bottom: 10px; }
    p { font-size: 14px; color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>Authorization successful</h1>
    <p>You can close this window and return to CodexManager.</p>
  </div>
</body>
</html>`)
        
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
          sender.send('oauth-error', { code: 'token-exchange-failed' })
          console.error('Token swap error:', err.message)
        }

        this.cleanupFlow()
      }
    })

    this.server = server
    this.timeoutId = setTimeout(() => {
      sender.send('oauth-error', { code: 'timeout' })
      this.cleanupFlow()
    }, 5 * 60 * 1000)

    server.once('error', (error: NodeJS.ErrnoException) => {
      sender.send('oauth-error', { code: 'listen-failed', message: error.message })
      this.cleanupFlow()
    })

    server.listen(APP_CONFIG.OAUTH_PORT, () => {
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
      
      void shell.openExternal(authUrl).catch((error) => {
        sender.send('oauth-error', { code: 'listen-failed', message: error.message })
        this.cleanupFlow()
      })
    })
  }
}
