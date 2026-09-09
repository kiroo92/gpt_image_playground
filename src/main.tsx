import 'core-js/actual/array/at'
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import Sub2ApiGate from './components/Sub2ApiGate'
import { readSub2ApiSession, type Sub2ApiSession } from './lib/sub2apiSession'
import { SUB2API_ORIGIN } from './lib/sub2api'
import 'streamdown/styles.css'
import 'katex/dist/katex.min.css'
import './index.css'
import { installMobileViewportGuards } from './lib/viewport'

installMobileViewportGuards()

const incomingUrl = new URL(window.location.href)
const cleanUrl = new URL(incomingUrl)
cleanUrl.searchParams.delete('token')
cleanUrl.searchParams.delete('user_id')
cleanUrl.searchParams.delete('src_url')
if (cleanUrl.href !== incomingUrl.href) window.history.replaceState(null, '', cleanUrl)

let session: Sub2ApiSession | null = null
let sessionError = ''
try {
  session = readSub2ApiSession(incomingUrl, sessionStorage, SUB2API_ORIGIN)
} catch {
  // 普通访问即使浏览器限制会话存储，也继续打开工作台。
  if (incomingUrl.searchParams.get('token')?.trim()) {
    sessionError = 'Sub2API 登录配置读取失败，请从网站菜单重新打开'
  }
}
const App = lazy(() => import('./App'))

// 网站认证模式需要在线校验，避免应用缓存干扰同源 Sub2API 页面。
if ('serviceWorker' in navigator && !session && !sessionError) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
        console.error('Service worker registration failed:', error)
      })
    })
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister())
    })
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {sessionError ? <p role="alert" className="p-12 text-center">{sessionError}</p> : session ? <Sub2ApiGate session={session} /> : <Suspense fallback={<p className="p-12 text-center">正在加载…</p>}><App /></Suspense>}
  </StrictMode>,
)
