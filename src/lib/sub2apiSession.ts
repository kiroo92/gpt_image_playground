export interface Sub2ApiSession {
  origin: string
  token: string
  entryPath: string
}

let storageNamespace = 'gpt-image-playground'

export function getStorageNamespace() {
  return storageNamespace
}

export function setSub2ApiUserScope(origin: string, userId: number) {
  storageNamespace = `gpt-image-playground:sub2api:${encodeURIComponent(origin)}:${userId}`
}

// 只保存当前标签页的登录凭据；重新打开页面仍需由 Sub2API 菜单携带认证。
export function readSub2ApiSession(url: URL, storage: Storage, configuredUrl = ''): Sub2ApiSession | null {
  const storageKey = `sub2api-session:${url.pathname}`
  const token = url.searchParams.get('token')
  const source = configuredUrl.trim() || url.searchParams.get('src_host')
  let saved: Partial<Sub2ApiSession> | null = null
  try {
    const parsed = JSON.parse(storage.getItem(storageKey) || 'null')
    saved = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof parsed.origin === 'string' ? parsed : null
  } catch {
    storage.removeItem(storageKey)
  }
  if (!source && token === null && !saved && !/^\/image(?:\/|$)/.test(url.pathname)) return null
  const originUrl = new URL(source || saved?.origin || url.origin)
  if (!['http:', 'https:'].includes(originUrl.protocol) || originUrl.username || originUrl.password) {
    throw new Error('Sub2API 网站地址格式错误')
  }
  const origin = originUrl.origin
  let entryPath = saved?.origin === origin && typeof saved.entryPath === 'string' && /^\/custom\/[\w-]+$/.test(saved.entryPath) ? saved.entryPath : '/dashboard'
  const sourceUrl = url.searchParams.get('src_url')
  if (sourceUrl) {
    const entry = new URL(sourceUrl)
    if (entry.origin === origin && /^\/custom\/[\w-]+$/.test(entry.pathname)) entryPath = entry.pathname
  }
  const session = {
    origin,
    token: token ?? (saved?.origin === origin && typeof saved.token === 'string' ? saved.token : ''),
    entryPath,
  }
  storage.setItem(storageKey, JSON.stringify(session))
  return session
}
