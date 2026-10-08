import type { IncomingMessage, ServerResponse } from 'node:http'
import { OAUTH_CALLBACK_PATH } from './oauth.ts'

/** A narrow unauthenticated callback. The one-use random state is its admission proof. */
export function createOAuthCallbackHandler(manager: { callback(url: URL): Promise<void> }, callbackBase: string) {
  const expected = new URL(callbackBase)
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.setHeader('referrer-policy', 'no-referrer')
    res.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
    res.setHeader('x-content-type-options', 'nosniff')
    const reply = (status: number, message: string) => { res.statusCode = status; res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>DSH 授权结果</title><h1>${message}</h1><p>返回 DSH 查看连接状态。此页面不包含令牌或授权码。</p></html>`) }
    if (req.method !== 'GET') { res.setHeader('allow', 'GET'); reply(405, '不支持此请求'); return }
    if (!req.url || req.url.length > 8192 || req.headers.host !== expected.host) { reply(400, '授权回调无效'); return }
    let url: URL
    try { url = new URL(req.url, expected.origin) } catch { reply(400, '授权回调无效'); return }
    if (url.origin !== expected.origin || url.pathname !== OAUTH_CALLBACK_PATH) { reply(400, '授权回调无效'); return }
    try { await manager.callback(url); reply(200, '授权已完成') } catch { reply(400, '授权未完成或已失效') }
  }
}
