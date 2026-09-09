import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { loadSub2ApiKeys, Sub2ApiAuthError } from '../lib/sub2api'
import { setSub2ApiUserScope, type Sub2ApiSession } from '../lib/sub2apiSession'

// 校验身份后才加载 store，按网站和用户隔离本地画廊及配置。
const Workspace = lazy(() => import('./Sub2ApiWorkspace'))

export default function Sub2ApiGate({ session }: { session: Sub2ApiSession }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadSub2ApiKeys>> | null>(null)
  const [error, setError] = useState('')
  const [authFailed, setAuthFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const loadedUserId = useRef<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    const refresh = async () => {
      if (pending) return
      pending = true
      setLoading(true)
      try {
        // 同源部署复用网站刷新后的 token；跨域部署使用菜单传来的会话。
        if (session.origin === window.location.origin) {
          session.token = localStorage.getItem('auth_token') || session.token
        }
        sessionStorage.setItem(`sub2api-session:${window.location.pathname}`, JSON.stringify(session))
        const result = await loadSub2ApiKeys(session, controller.signal)
        if (controller.signal.aborted) return
        if (loadedUserId.current !== null && loadedUserId.current !== result.userId) {
          setData(null)
          window.location.reload()
          return
        }
        loadedUserId.current = result.userId
        setSub2ApiUserScope(session.origin, result.userId)
        setData(result)
        setError('')
        setAuthFailed(false)
      } catch (err) {
        if (controller.signal.aborted) return
        if (err instanceof Sub2ApiAuthError) {
          session.token = ''
          sessionStorage.setItem(`sub2api-session:${window.location.pathname}`, JSON.stringify(session))
        }
        setData(null)
        setAuthFailed(err instanceof Sub2ApiAuthError)
        setError(err instanceof TypeError ? '连接 Sub2API 失败，请检查网络及网站跨域配置后重试' : (err as Error).message)
      } finally {
        pending = false
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    const onStorage = (event: StorageEvent) => {
      if (session.origin !== window.location.origin || event.key !== 'auth_token') return
      if (!event.newValue) {
        session.token = ''
        sessionStorage.setItem(`sub2api-session:${window.location.pathname}`, JSON.stringify(session))
        setRevision((v) => v + 1)
        setData(null)
        setAuthFailed(true)
        setError('你已退出 Sub2API，请重新登录')
      } else void refresh()
    }
    void refresh()
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [session, revision])

  const keysUrl = `${session.origin}/keys`
  const loginUrl = `${session.origin}/login?redirect=${encodeURIComponent(session.entryPath)}`
  if (data && data.keys.length > 0) {
    return <Suspense fallback={<div className="p-12 text-center">正在加载图像工作台…</div>}>
      <Workspace keys={data.keys} origin={session.origin} keysUrl={keysUrl} refreshing={loading} onRefresh={() => setRevision((v) => v + 1)} />
    </Suspense>
  }
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <section className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
        <p className="text-xs tracking-widest text-gray-500 mb-3">SUB2API · GPT IMAGE</p>
        <h1 className="text-xl font-semibold mb-3">{loading ? '正在读取图像配置…' : authFailed ? '请先登录 Sub2API' : error ? '配置读取失败' : '还没有可用的图像分组 Key'}</h1>
        <p role="status" className="text-sm text-gray-500 leading-6">{loading ? '正在验证登录状态并加载你的 API Key。' : error || '请到 API 密钥页面创建 Key，选择已开启图片生成的 OpenAI 或 Grok 分组，然后返回刷新。'}</p>
        {!loading && <div className="flex flex-wrap gap-3 mt-6">
          <a href={authFailed ? loginUrl : keysUrl} target={authFailed ? '_self' : '_blank'} rel="noopener noreferrer" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">{authFailed ? '返回 Sub2API 登录' : '去创建 API Key'}</a>
          {!authFailed && <button onClick={() => setRevision((v) => v + 1)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm">刷新 Key 列表</button>}
        </div>}
      </section>
    </main>
  )
}
