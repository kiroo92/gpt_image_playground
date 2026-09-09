import { useEffect, useState } from 'react'
import App from '../App'
import { initStore, useStore } from '../store'
import { createSub2ApiProfiles, type Sub2ApiKey } from '../lib/sub2api'
import { setPresetConfig } from '../lib/presetConfig'

let initialization: Promise<void> | null = null

export default function Sub2ApiWorkspace({ keys, origin, keysUrl, refreshing, onRefresh }: {
  keys: Sub2ApiKey[]
  origin: string
  keysUrl: string
  refreshing: boolean
  onRefresh: () => void
}) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const activeProfileId = useStore((s) => s.settings.activeProfileId)
  const groups = [...new Map(keys.map((key) => [key.group!.id, key.group!])).values()]

  useEffect(() => {
    let active = true
    // 先替换过期/已删除 Key，再恢复任务，避免恢复流程使用陈旧凭据。
    const state = useStore.getState()
    setPresetConfig(null)
    const profiles = createSub2ApiProfiles(keys, origin, state.settings.profiles)
    state.setSettings({
      profiles,
      customProviders: [],
      activeProfileId: profiles.some((profile) => profile.id === state.settings.activeProfileId) ? state.settings.activeProfileId : profiles[0].id,
      agentApiConfigMode: 'off',
      agentTextProfileId: null,
      agentImageProfileId: null,
    })
    useStore.setState({ ...(!initialization ? { appMode: 'gallery' as const } : {}), previousPresetConfig: null })
    initialization ??= initStore().catch((err) => { initialization = null; throw err })
    void initialization.then(() => { if (active) setReady(true) }).catch(() => {
      if (active) setError('本地画廊加载失败，请检查浏览器存储权限后刷新页面')
    })
    return () => { active = false }
  }, [keys, origin])

  if (error) return <p role="alert" className="p-12 text-center">{error}</p>
  if (!ready) return <p className="p-12 text-center">正在加载图像工作台…</p>
  return <App initialized toolbar={
    <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
        <a href={`${origin}/dashboard`} className="font-semibold" rel="noreferrer">Sub2API</a>
        <span className="text-gray-400">/</span>
        <label htmlFor="sub2api-image-key" className="text-gray-500">图像分组 / API Key</label>
        <select id="sub2api-image-key" value={activeProfileId} onChange={(e) => useStore.getState().setSettings({ activeProfileId: e.target.value })} className="min-w-0 max-w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2">
          {groups.map((group) => <optgroup key={group.id} label={group.name}>
            {keys.filter((key) => key.group!.id === group.id).map((key) => <option key={key.id} value={`sub2api-key-${key.id}`}>{key.name}</option>)}
          </optgroup>)}
        </select>
        <span className="text-xs text-gray-500">Sub2API 异步</span>
        <button onClick={onRefresh} disabled={refreshing} className="text-blue-600 disabled:opacity-50">{refreshing ? '刷新中…' : '刷新 Key'}</button>
        <a href={keysUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-gray-500">管理 Key ↗</a>
      </div>
    </div>
  } />
}
