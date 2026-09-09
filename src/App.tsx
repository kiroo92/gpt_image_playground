import { useEffect, type ReactNode } from 'react'
import { initStore, useStore } from './store'
import { getActiveApiProfile } from './lib/apiProfiles'
import { setPresetConfig } from './lib/presetConfig'
import { createManualSub2ApiProfile } from './lib/sub2api'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import TaskGrid from './components/TaskGrid'
import AgentWorkspace from './components/AgentWorkspace'
import InputBar from './components/InputBar'
import DetailModal from './components/DetailModal'
import Lightbox from './components/Lightbox'
import ApiKeySettingsModal from './components/ApiKeySettingsModal'
import ConfirmDialog from './components/ConfirmDialog'
import Toast from './components/Toast'
import MaskEditorModal from './components/MaskEditorModal'
import ImageContextMenu from './components/ImageContextMenu'
import SupportPromptModal from './components/SupportPromptModal'
import { FavoriteCollectionPickerModal, FavoriteCollectionsView, ManageCollectionsModal } from './components/FavoriteCollections'
import { useGlobalClickSuppression } from './lib/clickSuppression'

let storeInitializationStarted = false

export default function App({ initialized = false, toolbar }: { initialized?: boolean; toolbar?: ReactNode }) {
  const appMode = useStore((s) => s.appMode)
  const filterFavorite = useStore((s) => s.filterFavorite)
  const activeFavoriteCollectionId = useStore((s) => s.activeFavoriteCollectionId)
  useGlobalClickSuppression()

  useEffect(() => {
    if (initialized) return
    if (storeInitializationStarted) return
    storeInitializationStarted = true

    setPresetConfig(null)
    const state = useStore.getState()
    const profile = createManualSub2ApiProfile('')
    const previous = state.settings.profiles.find((item) => item.id === profile.id) ?? getActiveApiProfile(state.settings)
    // 仅复用同一网站的 Key，旧的其他供应商配置留在本地。
    if (previous.id === profile.id || previous.baseUrl.replace(/\/+$/, '') === profile.baseUrl) profile.apiKey = previous.apiKey
    state.setSettings({
      profiles: [...state.settings.profiles.filter((item) => item.id !== profile.id), profile],
      activeProfileId: profile.id,
      agentApiConfigMode: 'off',
      agentTextProfileId: null,
      agentImageProfileId: null,
      reuseTaskApiProfileTemporarily: false,
    })
    useStore.setState({ appMode: 'gallery', previousPresetConfig: null })
    void initStore().catch((error) => {
      console.warn('Failed to load local gallery:', error)
      useStore.getState().showToast('本地画廊加载失败，请检查浏览器存储权限')
    })
  }, [initialized])

  useEffect(() => {
    const preventPageImageDrag = (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.closest('img')) {
        e.preventDefault()
      }
    }

    document.addEventListener('dragstart', preventPageImageDrag)
    return () => document.removeEventListener('dragstart', preventPageImageDrag)
  }, [])

  return (
    <>
      <Header imageOnly />
      {toolbar}
      {appMode === 'agent' ? (
        <AgentWorkspace />
      ) : (
        <main data-home-main data-drag-select-surface className="pb-48">
          <div className="safe-area-x max-w-7xl mx-auto">
            <SearchBar />
            {filterFavorite && !activeFavoriteCollectionId ? <FavoriteCollectionsView /> : <TaskGrid />}
          </div>
        </main>
      )}
      <InputBar />
      <DetailModal />
      <Lightbox />
      <ApiKeySettingsModal />
      <ConfirmDialog />
      <SupportPromptModal />
      <FavoriteCollectionPickerModal />
      <ManageCollectionsModal />
      <Toast />
      <MaskEditorModal />
      <ImageContextMenu />
    </>
  )
}
