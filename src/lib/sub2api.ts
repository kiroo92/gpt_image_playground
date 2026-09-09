import type { ApiProfile } from '../types'
import type { Sub2ApiSession } from './sub2apiSession'

export interface Sub2ApiKey {
  id: number
  user_id: number
  name: string
  key: string
  status: string
  quota: number
  quota_used: number
  expires_at: string | null
  group?: {
    id: number
    name: string
    status: string
    platform: string
    allow_image_generation: boolean
  }
}

export class Sub2ApiAuthError extends Error {}

export async function loadSub2ApiKeys(session: Sub2ApiSession, signal?: AbortSignal) {
  if (!session.token) throw new Sub2ApiAuthError('请从 Sub2API 菜单登录后打开图像工作台')
  const request = async (path: string) => {
    const response = await fetch(`${session.origin}/api/v1${path}`, {
      headers: { Authorization: `Bearer ${session.token}` },
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
    })
    if (response.status === 401 || response.status === 403) {
      throw new Sub2ApiAuthError('登录已过期或访问受限，请返回 Sub2API 重新登录')
    }
    if (!response.ok) throw new Error(`读取 Sub2API 配置失败（HTTP ${response.status}），请重试`)
    const result = await response.json()
    if (result.code !== 0 || !result.data) throw new Error('Sub2API 返回了无效的配置数据')
    return result.data
  }
  const user = await request('/auth/me')
  if (!Number.isSafeInteger(user.id) || user.id <= 0) throw new Sub2ApiAuthError('Sub2API 用户认证信息无效')
  const keys: Sub2ApiKey[] = []
  for (let page = 1; ; page += 1) {
    const data = await request(`/keys?page=${page}&page_size=100&status=active&sort_by=created_at&sort_order=desc`)
    if (!Array.isArray(data.items) || !Number.isSafeInteger(data.pages) || data.pages < 0) {
      throw new Error('Sub2API 密钥列表格式错误')
    }
    keys.push(...data.items.filter((key: Sub2ApiKey) => key?.user_id === user.id && keyAllowsAsyncImage(key)))
    if (page >= data.pages || data.items.length === 0) break
  }
  return { userId: user.id as number, keys }
}

export function keyAllowsAsyncImage(key: Sub2ApiKey, now = Date.now()) {
  return Number.isSafeInteger(key.id) && key.id > 0
    && typeof key.name === 'string'
    && key.status === 'active'
    && typeof key.key === 'string' && key.key.trim().length > 0
    && key.group?.status === 'active'
    && Number.isSafeInteger(key.group.id) && typeof key.group.name === 'string'
    && key.group.allow_image_generation === true
    && ['openai', 'grok'].includes(key.group.platform)
    && (!key.expires_at || Date.parse(key.expires_at) > now)
    && (key.quota === 0 || key.quota_used < key.quota)
}

export function createSub2ApiProfiles(keys: Sub2ApiKey[], origin: string, previous: ApiProfile[]): ApiProfile[] {
  return keys.map((key) => {
    const id = `sub2api-key-${key.id}`
    const saved = previous.find((profile) => profile.id === id)
    return {
      ...saved,
      id,
      name: `${key.group!.name} / ${key.name}`,
      provider: 'sb2api-async',
      baseUrl: `${origin}/v1`,
      apiKey: key.key,
      apiMode: 'images',
      model: saved?.model || (key.group!.platform === 'grok' ? 'grok-imagine-image' : 'gpt-image-2'),
      timeout: saved?.timeout || 600,
      codexCli: saved?.codexCli ?? false,
      apiProxy: false,
      streamImages: false,
      transparentBackgroundMethod: saved?.transparentBackgroundMethod || 'api',
    }
  })
}
