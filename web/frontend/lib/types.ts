// Node Types
export interface NodePosition {
  x: number
  y: number
}

export interface Port {
  id: string
  name: string
  type: 'input' | 'output'
  color: 'green' | 'yellow' | 'red' | 'blue' | 'pink'
  required?: boolean
  connected?: boolean
}

export interface NodeData {
  id: string
  type: string
  title: string
  position: NodePosition
  ports: Port[]
  disabled?: boolean
  data?: Record<string, unknown>
}

export interface Connection {
  id: string
  from: { nodeId: string; portId: string }
  to: { nodeId: string; portId: string }
  active: boolean
}

// Generation Parameters
export interface GenerationParams {
  faceStrength: number
  denoising: number
  guidance: number
  steps: number
  maskPadding: number
  stopAt: number
  includeNeck: boolean
  includeHair: boolean
  autoPrompt: boolean
  prompt: string
  negativePrompt: string
  seed?: number
  numImages: number
  parallelMode: 'auto' | 'batch' | 'sequential'
}

export const defaultParams: GenerationParams = {
  faceStrength: 0.80,
  denoising: 0.85,
  guidance: 2.5,
  steps: 50,
  maskPadding: 10,
  stopAt: 0.7,
  includeNeck: false,
  includeHair: true,
  autoPrompt: false,
  prompt: '',
  negativePrompt: 'blurry, low quality, distorted, deformed',
  numImages: 4,
  parallelMode: 'auto',
}

// Task & Progress
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface GenerationProgress {
  generationIndex: number
  currentStep: number
  totalSteps: number
  previewImage?: string
}

export interface TaskResult {
  index: number
  seed: number
  status: TaskStatus
  imageUrl?: string
  error?: string
}

export interface Task {
  id: string
  status: TaskStatus
  createdAt: string
  params: GenerationParams
  referenceImageUrl?: string
  faceImageUrl?: string
  results: TaskResult[]
  progress?: GenerationProgress[]
}

// WebSocket Messages
export type WSMessageType =
  | 'generation_started'
  | 'step_progress'
  | 'intermediate_image'
  | 'generation_complete'
  | 'generation_failed'

export interface WSMessage {
  type: WSMessageType
  jobId: string
  generationIndex: number
  timestamp: number
  data: {
    currentStep?: number
    totalSteps?: number
    imageData?: string
    finalImageUrl?: string
    error?: string
    count?: number
  }
}

// History
export interface HistoryItem {
  id: string
  createdAt: string
  referenceImage: string
  faceImage: string
  resultImages: string[]
  selectedResult?: string
  params: GenerationParams
  prompt: string
}

// Settings
export interface UserSettings {
  defaultParams: Partial<GenerationParams>
  theme: 'dark'
  showGrid: boolean
  autoSave: boolean
}

// API Responses
export interface UploadResponse {
  success: boolean
  id: string
  url: string
}

export interface GenerateResponse {
  success: boolean
  taskId: string
}

export interface HealthResponse {
  status: string
  device: string
  vramGb?: number
  modelLoaded: boolean
}
