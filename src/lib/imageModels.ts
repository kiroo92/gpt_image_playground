import type { ApiProfile } from '../types'

export const GPT_IMAGE_25_MODELS = ['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare'] as const
export const BUILTIN_IMAGE_MODELS = ['gpt-image-2', 'gpt-image-2.5', ...GPT_IMAGE_25_MODELS] as const
export const DEFAULT_IMAGES_MODEL = 'gpt-image-2.5-sunburst'
const IMAGE_MODELS_STORAGE_KEY = 'gpt-image-playground-supported-models'

export function getSupportedImageModels(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(IMAGE_MODELS_STORAGE_KEY) || 'null')
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    }
  } catch {
    // 浏览器禁用本地存储时使用内置列表。
  }
  return [...BUILTIN_IMAGE_MODELS]
}

export function saveSupportedImageModels(models: string[]) {
  const unique = [...new Set(models.map((model) => model.trim()).filter(Boolean))]
  try {
    localStorage.setItem(IMAGE_MODELS_STORAGE_KEY, JSON.stringify(unique))
  } catch {
    // 模型列表不是请求凭据，存储失败时仍保留当前页面状态由调用方处理。
  }
  return unique
}

export async function fetchUpstreamImageModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  })
  if (!response.ok) throw new Error(`同步上游模型失败（HTTP ${response.status}）`)
  const payload = await response.json() as { data?: Array<{ id?: unknown }> }
  const models = Array.isArray(payload.data)
    ? payload.data.map((item) => typeof item?.id === 'string' ? item.id.trim() : '').filter((model) => /gpt-image|imagine-image/i.test(model))
    : []
  if (models.length === 0) throw new Error('上游没有返回可用的图像模型')
  return [...new Set(models)]
}

export function getImageGenerationModel(profile: ApiProfile) {
  return profile.provider === 'openai' && profile.apiMode === 'responses'
    ? profile.imageGenerationModel?.trim() ?? ''
    : profile.model
}

export function isGptImage25Model(model: string) {
  return model.trim().toLowerCase().includes('gpt-image-2.5')
}
