import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { getActiveApiProfile } from '../lib/apiProfiles'
import { createManualSub2ApiProfile, SUB2API_ORIGIN } from '../lib/sub2api'
import { getStorageNamespace } from '../lib/sub2apiSession'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import { CloseIcon } from './icons'

export default function ApiKeySettingsModal() {
  const open = useStore((s) => s.showSettings)
  const settings = useStore((s) => s.settings)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const profile = getActiveApiProfile(settings)
  const managed = getStorageNamespace() !== 'gpt-image-playground'
  const [key, setKey] = useState('')
  const [visible, setVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const close = () => setShowSettings(false)

  useCloseOnEscape(open, close)
  usePreventBackgroundScroll(open)
  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    setKey(profile.apiKey)
    setVisible(false)
    inputRef.current?.focus()
    return () => previousFocus?.focus()
  }, [open, profile.apiKey])

  if (!open) return null
  return createPortal(
    <div data-no-drag-select className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={close}>
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-md" />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-title"
        className="relative w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return
          const controls = [...e.currentTarget.querySelectorAll<HTMLElement>('button, input, a[href]')]
          const first = controls[0]
          const last = controls[controls.length - 1]
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
          if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
        }}
        onSubmit={(e) => {
          e.preventDefault()
          if (!managed) {
            const next = createManualSub2ApiProfile(key)
            useStore.getState().setSettings({
              profiles: [...settings.profiles.filter((item) => item.id !== next.id), next],
              activeProfileId: next.id,
            })
            useStore.getState().showToast('API Key 已保存')
          }
          close()
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="api-key-title" className="text-lg font-semibold">API Key</h2>
          <button type="button" onClick={close} aria-label="关闭" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><CloseIcon className="h-4 w-4" /></button>
        </div>
        <p className="mb-4 text-sm text-gray-500">{managed ? `已自动配置：${profile.name}。切换 Key 请使用页面顶部的分组选择。` : '填写 Key 后即可开始生成图片。'}</p>
        <label htmlFor="manual-api-key" className="sr-only">API Key</label>
        <div className="flex overflow-hidden rounded-xl border border-gray-300 dark:border-gray-700 focus-within:ring-2 focus-within:ring-blue-500">
          <input ref={inputRef} id="manual-api-key" type={visible ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={key} readOnly={managed} onChange={(e) => setKey(e.target.value)} placeholder="sk-…" className="min-w-0 flex-1 bg-transparent px-3 py-3 font-mono text-sm outline-none" />
          <button type="button" aria-label={visible ? '隐藏 API Key' : '显示 API Key'} onClick={() => setVisible((value) => !value)} className="px-3 text-sm text-gray-500 hover:text-blue-600">{visible ? '隐藏' : '显示'}</button>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <a href={`${SUB2API_ORIGIN}/keys`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600">获取 API Key ↗</a>
          <button type="submit" className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">{managed ? '完成' : '保存'}</button>
        </div>
      </form>
    </div>, document.body,
  )
}
