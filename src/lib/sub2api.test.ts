import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSub2ApiProfiles, keyAllowsAsyncImage, loadSub2ApiKeys, Sub2ApiAuthError, type Sub2ApiKey } from './sub2api'
import { readSub2ApiSession } from './sub2apiSession'

const session = { origin: 'https://sub.example', token: 'fixture-login-token', entryPath: '/custom/image' }
const key: Sub2ApiKey = {
  id: 7, user_id: 42, name: '生图 Key', key: 'sk-fixture', status: 'active', quota: 0, quota_used: 0, expires_at: null,
  group: { id: 3, name: 'Image', status: 'active', platform: 'openai', allow_image_generation: true },
}
const json = (data: unknown) => new Response(JSON.stringify({ code: 0, data }), { headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.restoreAllMocks())

describe('Sub2API image key access', () => {
  it('matches the async endpoint platform and group permission checks', () => {
    expect(keyAllowsAsyncImage(key)).toBe(true)
    expect(keyAllowsAsyncImage({ ...key, group: { ...key.group!, platform: 'grok' } })).toBe(true)
    for (const patch of [
      { status: 'inactive' }, { status: 'expired' }, { status: 'quota_exhausted' },
      { expires_at: '2000-01-01' }, { expires_at: 'invalid' }, { quota: 1, quota_used: 1 }, { key: '' },
      { group: undefined }, { group: { ...key.group!, status: 'inactive' } },
      { group: { ...key.group!, allow_image_generation: false } },
      { group: { ...key.group!, platform: 'gemini' } },
    ]) expect(keyAllowsAsyncImage({ ...key, ...patch })).toBe(false)
  })

  it('authenticates first, loads every page, and excludes other users and unsupported keys', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ id: 42 }))
      .mockResolvedValueOnce(json({ items: [{ ...key, user_id: 99 }, { ...key, status: 'inactive' }], pages: 2 }))
      .mockResolvedValueOnce(json({ items: [key], pages: 2 }))
    expect(await loadSub2ApiKeys(session)).toEqual({ userId: 42, keys: [key] })
    expect(fetchMock.mock.calls[0][0]).toBe('https://sub.example/api/v1/auth/me')
    expect(fetchMock.mock.calls[2][0]).toContain('page=2&')
    for (const [url, options] of fetchMock.mock.calls) {
      expect(String(url)).not.toContain(session.token)
      expect(options).toMatchObject({ headers: { Authorization: `Bearer ${session.token}` }, cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' })
    }
  })

  it('stops at expired authentication and does not request keys', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }))
    await expect(loadSub2ApiKeys(session)).rejects.toBeInstanceOf(Sub2ApiAuthError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('requires a token before sending any request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    await expect(loadSub2ApiKeys({ ...session, token: '' })).rejects.toBeInstanceOf(Sub2ApiAuthError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports an empty authorized list and rejects malformed pagination', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ id: 42 }))
      .mockResolvedValueOnce(json({ items: [], pages: 0 }))
    expect((await loadSub2ApiKeys(session)).keys).toEqual([])
    vi.mocked(fetch).mockResolvedValueOnce(json({ id: 42 })).mockResolvedValueOnce(json({ items: [key] }))
    await expect(loadSub2ApiKeys(session)).rejects.toThrow('密钥列表格式错误')
  })

  it('refreshes credentials, forces async mode, and preserves user model settings', () => {
    const previous = createSub2ApiProfiles([key], session.origin, [])
    previous[0] = { ...previous[0], model: 'gpt-image-1', apiKey: 'stale', provider: 'openai', apiProxy: true }
    const profiles = createSub2ApiProfiles([key], session.origin, previous)
    expect(profiles[0]).toMatchObject({ id: 'sub2api-key-7', name: 'Image / 生图 Key', provider: 'sb2api-async', apiMode: 'images', apiKey: key.key, baseUrl: `${session.origin}/v1`, model: 'gpt-image-1', apiProxy: false, streamImages: false })
    expect(createSub2ApiProfiles([], session.origin, previous)).toEqual([])
  })
})

describe('Sub2API menu session', () => {
  const makeStorage = () => {
    const entries = new Map<string, string>()
    return {
      get length() { return entries.size },
      clear: () => entries.clear(),
      key: (index: number) => [...entries.keys()][index] ?? null,
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value) },
      removeItem: (key: string) => { entries.delete(key) },
    } satisfies Storage
  }

  it('accepts existing menu parameters and restores the same tab on refresh', () => {
    const storage = makeStorage()
    const url = new URL('https://image.example/?token=fixture-login-token&src_host=https://sub.example&user_id=999&src_url=https://sub.example/custom/image')
    expect(readSub2ApiSession(url, storage)).toEqual(session)
    expect(readSub2ApiSession(new URL('https://image.example/'), storage)).toEqual(session)
  })

  it('does not reuse another website token or accept credential-bearing URLs', () => {
    const storage = makeStorage()
    readSub2ApiSession(new URL('https://image.example/?token=old&src_host=https://old.example'), storage)
    expect(readSub2ApiSession(new URL('https://image.example/?src_host=https://new.example'), storage)?.token).toBe('')
    expect(() => readSub2ApiSession(new URL('https://image.example/?src_host=javascript:alert(1)'), storage)).toThrow()
    expect(() => readSub2ApiSession(new URL('https://image.example/?src_host=https://user:pass@sub.example'), storage)).toThrow()
  })

  it('keeps /image and configured deployments gated without query parameters', () => {
    expect(readSub2ApiSession(new URL('https://sub.example/image/'), makeStorage())).toMatchObject({ origin: 'https://sub.example', token: '' })
    expect(readSub2ApiSession(new URL('https://image.example/'), makeStorage(), 'https://sub.example')).toMatchObject({ origin: 'https://sub.example', token: '' })
    expect(readSub2ApiSession(new URL('https://image.example/'), makeStorage())).toBeNull()
  })
})
