import type {
  UploadResponse,
  GenerateResponse,
  HealthResponse,
  Task,
  HistoryItem,
  UserSettings,
  GenerationParams,
} from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8008'

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Health
  async getHealth(): Promise<HealthResponse> {
    return this.request('/health')
  }

  // Upload
  async uploadImage(file: File, type: 'reference' | 'face'): Promise<UploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    return this.request('/upload', {
      method: 'POST',
      body: formData,
    })
  }

  getUploadUrl(id: string): string {
    return `${this.baseUrl}/uploads/${id}`
  }

  // Generation
  async startGeneration(
    referenceImageId: string,
    faceImageId: string,
    params: GenerationParams
  ): Promise<GenerateResponse> {
    const formData = new FormData()
    formData.append('reference_image_id', referenceImageId)
    formData.append('face_image_id', faceImageId)
    formData.append('face_strength', params.faceStrength.toString())
    formData.append('denoising', params.denoising.toString())
    formData.append('guidance', params.guidance.toString())
    formData.append('steps', params.steps.toString())
    formData.append('mask_padding', params.maskPadding.toString())
    formData.append('stop_at', params.stopAt.toString())
    formData.append('include_neck', params.includeNeck.toString())
    formData.append('include_hair', params.includeHair.toString())
    formData.append('auto_prompt', params.autoPrompt.toString())
    formData.append('prompt', params.prompt)
    formData.append('negative_prompt', params.negativePrompt)
    formData.append('num_images', params.numImages.toString())
    formData.append('parallel_mode', params.parallelMode)

    if (params.seed !== undefined) {
      formData.append('seed', params.seed.toString())
    }

    return this.request('/generate', {
      method: 'POST',
      body: formData,
    })
  }

  // Tasks
  async getTask(taskId: string): Promise<Task> {
    return this.request(`/tasks/${taskId}`)
  }

  async getTasks(): Promise<Task[]> {
    return this.request('/tasks')
  }

  async cancelTask(taskId: string): Promise<void> {
    await this.request(`/tasks/${taskId}`, { method: 'DELETE' })
  }

  // History
  async getHistory(): Promise<HistoryItem[]> {
    return this.request('/history')
  }

  async saveToHistory(item: Omit<HistoryItem, 'id' | 'createdAt'>): Promise<HistoryItem> {
    return this.request('/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
  }

  async deleteHistory(id: string): Promise<void> {
    await this.request(`/history/${id}`, { method: 'DELETE' })
  }

  // Settings
  async getSettings(): Promise<UserSettings> {
    return this.request('/settings')
  }

  async saveSettings(settings: UserSettings): Promise<UserSettings> {
    return this.request('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
  }

  // WebSocket URL
  getWebSocketUrl(taskId: string): string {
    const wsProtocol = this.baseUrl.startsWith('https') ? 'wss' : 'ws'
    const wsHost = this.baseUrl.replace(/^https?:\/\//, '')
    return `${wsProtocol}://${wsHost}/ws/generate/${taskId}`
  }

  // Output URL
  getOutputUrl(path: string): string {
    return `${this.baseUrl}/outputs/${path}`
  }
}

export const api = new ApiClient(API_URL)
export { API_URL }
