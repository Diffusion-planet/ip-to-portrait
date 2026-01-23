'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'
import { TopBar, BottomBar, SideTools, ReportModal } from '@/components/layout'
import { ImageModal } from '@/components/Modal'
import {
  ReferenceImageFlowNode,
  FaceImageFlowNode,
  PromptFlowNode,
  InpaintingParamsFlowNode,
  GenerationControlFlowNode,
  ResultsFlowNode,
} from '@/components/flow'
import { CustomBezierEdge } from '@/components/flow/CustomEdge'
import { AnimatedEdge } from '@/components/edges/AnimatedEdge'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useUpload, useGeneration } from '@/hooks/useApi'

// Types
interface ResultItem {
  id: string
  imageUrl?: string
  previewUrl?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  error?: string
}

type AdapterMode = 'standard' | 'faceid' | 'faceid_plus' | 'clip_blend'

interface InpaintingParams {
  // Core diffusion
  steps: number
  guidanceScale: number
  denoiseStrength: number
  faceStrength: number

  // Mode selection
  adapterMode: AdapterMode

  // Mask settings
  maskExpand: number
  maskBlur: number
  maskPadding: number
  includeHair: boolean
  includeNeck: boolean

  // FaceID timing
  stopAt: number

  // CLIP Blend weights
  faceBlendWeight: number
  hairBlendWeight: number

  // Auto prompt
  autoPrompt: boolean
}

// React Flow custom node types
const nodeTypes = {
  referenceImage: ReferenceImageFlowNode,
  faceImage: FaceImageFlowNode,
  prompt: PromptFlowNode,
  inpaintingParams: InpaintingParamsFlowNode,
  generationControl: GenerationControlFlowNode,
  results: ResultsFlowNode,
}

// React Flow custom edge types
const edgeTypes = {
  custom: CustomBezierEdge,
  animated: AnimatedEdge,
}

// Default params matching the CLI defaults
const DEFAULT_PARAMS: InpaintingParams = {
  steps: 50,
  guidanceScale: 3,
  denoiseStrength: 0.92,
  faceStrength: 0.85,
  adapterMode: 'faceid_plus',
  maskExpand: 0.3,
  maskBlur: 15,
  maskPadding: 10,
  includeHair: true,
  includeNeck: true,
  stopAt: 1.0,
  faceBlendWeight: 0.6,
  hairBlendWeight: 0.4,
  autoPrompt: false,
}

// Auto layout using dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 200 })

  nodes.forEach((node) => {
    // Estimate node dimensions based on type
    const width = node.type === 'inpaintingParams' ? 1000 : node.type === 'results' ? 600 : node.type === 'prompt' ? 500 : 480
    const height = node.type === 'inpaintingParams' ? 1000 : node.type === 'results' ? 500 : node.type === 'prompt' ? 300 : 520
    dagreGraph.setNode(node.id, { width, height })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    let yPosition = nodeWithPosition.y - (nodeWithPosition.height / 2)

    // Center results node vertically relative to control node
    if (node.id === 'results-node') {
      const controlNode = dagreGraph.node('control-node')
      if (controlNode) {
        // Use center y from dagre directly, then convert to top-left position
        yPosition = controlNode.y - (nodeWithPosition.height / 2)
      }
    }

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (nodeWithPosition.width / 2),
        y: yPosition,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

function HomePageContent() {
  // Client ID for WebSocket
  const [clientId] = useState(() => `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)

  // Reference image state (background)
  const [referenceImageId, setReferenceImageId] = useState<string | null>(null)
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null)

  // Face image state
  const [faceImageId, setFaceImageId] = useState<string | null>(null)
  const [faceImageUrl, setFaceImageUrl] = useState<string | null>(null)

  // Prompt state (single prompt for this pipeline)
  const [prompt, setPrompt] = useState('')

  // Inpainting params
  const [params, setParams] = useState<InpaintingParams>(DEFAULT_PARAMS)

  // Generation control
  const [count, setCount] = useState(4)
  const [parallel, setParallel] = useState(false)
  const [seed, setSeed] = useState(-1)
  const [autoPrompt, setAutoPrompt] = useState(false)
  const [typingPrompt, setTypingPrompt] = useState('')

  // Results
  const [results, setResults] = useState<ResultItem[]>([])
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Pipeline stage tracking for animations
  const [pipelineStage, setPipelineStage] = useState<'idle' | 'preparing' | 'loading' | 'processing' | 'completed'>('idle')

  // Project title
  const [projectTitle, setProjectTitle] = useState('Face Inpainting Pipeline')

  // History navigation
  const [historyList, setHistoryList] = useState<any[]>([])
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1)

  // Canvas states
  const [showGrid, setShowGrid] = useState(true)
  const [showConnections, setShowConnections] = useState(true)
  const [focusMode, setFocusMode] = useState(false)

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [modalImageUrl, setModalImageUrl] = useState('')
  const [showReport, setShowReport] = useState(false)

  // Node position history for undo/redo
  const [positionHistory, setPositionHistory] = useState<Array<Record<string, { x: number; y: number }>>>([])
  const [positionHistoryIndex, setPositionHistoryIndex] = useState(-1)
  const positionHistoryRef = useRef({ history: [] as Array<Record<string, { x: number; y: number }>>, index: -1 })
  const nodesRef = useRef<Node[]>([])

  // Hooks
  const { uploadImage, loading: uploading } = useUpload()
  const { startGeneration, cancelBatch } = useGeneration()
  const { zoomIn, zoomOut } = useReactFlow()

  // LocalStorage key for non-logged users
  const LOCAL_HISTORY_KEY = 'fastface_history'

  // Helper to check if user is logged in
  const isLoggedIn = () => {
    if (typeof window === 'undefined') return false
    return !!localStorage.getItem('token')
  }

  // Helper to get auth token
  const getAuthToken = () => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('token')
  }

  // Helper to get/save local history
  const getLocalHistory = () => {
    if (typeof window === 'undefined') return []
    try {
      const data = localStorage.getItem(LOCAL_HISTORY_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  const saveLocalHistory = (history: any[]) => {
    if (typeof window === 'undefined') return
    // Keep only last 50 items
    const trimmed = history.slice(0, 50)
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(trimmed))
  }

  // Fetch history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        if (isLoggedIn()) {
          // Fetch from API for logged-in users
          const token = getAuthToken()
          const response = await fetch('http://localhost:8008/api/history/?limit=20', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })
          if (response.ok) {
            const data = await response.json()
            setHistoryList(data)
          } else if (response.status === 401) {
            // Token expired
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            setHistoryList(getLocalHistory())
          }
        } else {
          // Use localStorage for non-logged users
          setHistoryList(getLocalHistory())
        }
      } catch (error) {
        console.error('Failed to fetch history:', error)
        setHistoryList(getLocalHistory())
      }
    }
    fetchHistory()
  }, [])

  // WebSocket for real-time progress
  const { subscribe, isConnected } = useWebSocket({
    clientId,
    onMessage: (message) => {
      if (message.type === 'generated_prompt' && message.data?.prompt) {
        setTypingPrompt(message.data.prompt)
      }
    },
    onProgress: (data) => {
      // Update pipeline stage based on progress
      if (data.status === 'processing') {
        if (data.progress === 0) {
          setPipelineStage('preparing')
        } else if (data.progress < 5) {
          setPipelineStage('loading')
        } else if (data.progress < 100) {
          setPipelineStage('processing')
        }
      } else if (data.status === 'completed') {
        setPipelineStage('completed')
        setTimeout(() => setPipelineStage('idle'), 2000)
      }

      setResults((prev) =>
        prev.map((r) =>
          r.id === data.task_id
            ? {
                ...r,
                status: data.status,
                progress: data.progress,
                previewUrl: data.preview_url || r.previewUrl,
                imageUrl: data.status === 'completed' ? `http://localhost:8008${data.preview_url || ''}` : r.imageUrl,
                error: data.status === 'failed' ? data.message : undefined,
              }
            : r
        )
      )

      // Check if all tasks are done
      if (data.status === 'completed' || data.status === 'failed') {
        setResults((prev) => {
          const allDone = prev.every((r) =>
            r.status === 'completed' || r.status === 'failed'
          )
          if (allDone) {
            setIsGenerating(false)

            // Save to localStorage for non-logged users
            if (!isLoggedIn()) {
              const completedResults = prev.filter(r => r.status === 'completed' && r.imageUrl)
              if (completedResults.length > 0) {
                const historyItem = {
                  id: `local-${Date.now()}`,
                  title: projectTitle !== 'Face Inpainting Pipeline' ? projectTitle : (prompt ? prompt.slice(0, 50) + (prompt.length > 50 ? '...' : '') : new Date().toLocaleString()),
                  face_image_url: faceImageUrl?.replace('http://localhost:8008', '') || '',
                  face_image_id: faceImageId || '',
                  reference_image_url: referenceImageUrl?.replace('http://localhost:8008', '') || null,
                  reference_image_id: referenceImageId || null,
                  result_urls: completedResults.map(r => r.imageUrl?.replace('http://localhost:8008', '') || ''),
                  params: {
                    prompt,
                    seed,
                    steps: params.steps,
                    guidance_scale: params.guidanceScale,
                    denoise_strength: params.denoiseStrength,
                    face_strength: params.faceStrength,
                    adapter_mode: params.adapterMode,
                    mask_expand: params.maskExpand,
                    mask_blur: params.maskBlur,
                    mask_padding: params.maskPadding,
                    include_hair: params.includeHair,
                    include_neck: params.includeNeck,
                    stop_at: params.stopAt,
                    auto_prompt: autoPrompt,
                  },
                  count,
                  parallel,
                  created_at: new Date().toISOString(),
                  is_favorite: false,
                }

                // Add to local history
                const currentHistory = getLocalHistory()
                const newHistory = [historyItem, ...currentHistory]
                saveLocalHistory(newHistory)
                setHistoryList(newHistory)
                // Reset history index - new generation is independent
                setCurrentHistoryIndex(-1)
              }
            }
          }
          return prev
        })
      }
    },
  })

  // Handle reference image upload
  const handleReferenceUpload = useCallback(async (file: File) => {
    const result = await uploadImage(file)
    if (result) {
      setReferenceImageId(result.id)
      setReferenceImageUrl(`http://localhost:8008${result.url}`)
    }
  }, [uploadImage])

  // Handle reference image clear
  const handleReferenceClear = useCallback(() => {
    setReferenceImageId(null)
    setReferenceImageUrl(null)
  }, [])

  // Handle face image upload
  const handleFaceUpload = useCallback(async (file: File) => {
    const result = await uploadImage(file)
    if (result) {
      setFaceImageId(result.id)
      setFaceImageUrl(`http://localhost:8008${result.url}`)
    }
  }, [uploadImage])

  // Handle face image clear
  const handleFaceClear = useCallback(() => {
    setFaceImageId(null)
    setFaceImageUrl(null)
  }, [])

  // Handle auto prompt generation
  const handleAutoPrompt = useCallback(async () => {
    // TODO: Call Gemini API for auto prompt
    setPrompt('young adult, natural features, soft facial structure, pleasant expression')
    setParams(prev => ({ ...prev, autoPrompt: true }))
  }, [])

  // Handle param change
  const handleParamChange = useCallback((key: keyof InpaintingParams, value: number | boolean | string) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }, [])

  // Handle generation start
  const handleGenerate = useCallback(async () => {
    if (!referenceImageId || !faceImageId) {
      console.log('Missing required images')
      return
    }

    setIsGenerating(true)

    // Create initial result items
    const initialResults: ResultItem[] = Array.from({ length: count }, (_, i) => ({
      id: `pending-${i}`,
      status: 'pending' as const,
      progress: 0,
    }))
    setResults(initialResults)

    const response = await startGeneration({
      reference_image_id: referenceImageId,
      face_image_id: faceImageId,
      params: {
        prompt: autoPrompt ? '' : prompt,
        seed,
        steps: params.steps,
        guidance_scale: params.guidanceScale,
        denoise_strength: params.denoiseStrength,
        face_strength: params.faceStrength,
        adapter_mode: params.adapterMode,
        mask_expand: params.maskExpand,
        mask_blur: params.maskBlur,
        mask_padding: params.maskPadding,
        include_hair: params.includeHair,
        include_neck: params.includeNeck,
        stop_at: params.stopAt,
        face_blend_weight: params.faceBlendWeight,
        hair_blend_weight: params.hairBlendWeight,
        auto_prompt: autoPrompt,
      },
      count,
      parallel,
      title: projectTitle !== 'Face Inpainting Pipeline' ? projectTitle : undefined,
    })

    if (response) {
      const batchId = (response as any).batch_id
      setCurrentBatchId(batchId)
      subscribe(batchId)

      // Update results with actual task IDs
      const tasks = (response as any).tasks || []
      setResults(
        tasks.map((t: any) => ({
          id: t.id,
          status: t.status,
          progress: 0,
        }))
      )
    } else {
      setIsGenerating(false)
    }
  }, [
    referenceImageId,
    faceImageId,
    prompt,
    params,
    autoPrompt,
    startGeneration,
    subscribe,
    count,
    parallel,
    seed,
    projectTitle,
  ])

  // Handle stop
  const handleStop = useCallback(async () => {
    if (currentBatchId) {
      await cancelBatch(currentBatchId)
      setIsGenerating(false)
    }
  }, [currentBatchId, cancelBatch])

  // Handle history restore
  const handleHistoryRestore = useCallback((item: any, _index?: number) => {
    // Refresh history list to ensure sync
    const currentHistory = getLocalHistory()
    setHistoryList(currentHistory)

    // Find the correct index by item ID in the current history list
    const correctIndex = currentHistory.findIndex((h: any) => h.id === item.id)

    // Restore images - extract ID from URL if not present
    if (item.face_image_url) {
      const faceId = item.face_image_id || item.face_image_url.split('/').pop()?.split('.')[0] || ''
      if (faceId) {
        setFaceImageId(faceId)
        setFaceImageUrl(`http://localhost:8008${item.face_image_url}`)
      }
    }
    if (item.reference_image_url) {
      const refId = item.reference_image_id || item.reference_image_url.split('/').pop()?.split('.')[0] || ''
      if (refId) {
        setReferenceImageId(refId)
        setReferenceImageUrl(`http://localhost:8008${item.reference_image_url}`)
      }
    }

    // Restore params
    if (item.params) {
      setPrompt(item.params.prompt || '')
      setSeed(item.params.seed || -1)
      setParams({
        steps: item.params.steps || DEFAULT_PARAMS.steps,
        guidanceScale: item.params.guidance_scale || DEFAULT_PARAMS.guidanceScale,
        denoiseStrength: item.params.denoise_strength || DEFAULT_PARAMS.denoiseStrength,
        faceStrength: item.params.face_strength || DEFAULT_PARAMS.faceStrength,
        adapterMode: item.params.adapter_mode || DEFAULT_PARAMS.adapterMode,
        maskExpand: item.params.mask_expand || DEFAULT_PARAMS.maskExpand,
        maskBlur: item.params.mask_blur || DEFAULT_PARAMS.maskBlur,
        maskPadding: item.params.mask_padding || DEFAULT_PARAMS.maskPadding,
        includeHair: item.params.include_hair ?? DEFAULT_PARAMS.includeHair,
        includeNeck: item.params.include_neck ?? DEFAULT_PARAMS.includeNeck,
        stopAt: item.params.stop_at || DEFAULT_PARAMS.stopAt,
        faceBlendWeight: item.params.face_blend_weight || DEFAULT_PARAMS.faceBlendWeight,
        hairBlendWeight: item.params.hair_blend_weight || DEFAULT_PARAMS.hairBlendWeight,
      })
      setAutoPrompt(item.params.auto_prompt || false)
    }

    // Restore generation control settings
    if (item.count !== undefined) {
      setCount(item.count)
    }
    if (item.parallel !== undefined) {
      setParallel(item.parallel)
    }

    // Restore results
    if (item.result_urls && item.result_urls.length > 0) {
      const restoredResults = item.result_urls.map((url: string, idx: number) => ({
        id: `${item.id}-${idx}`,
        imageUrl: `http://localhost:8008${url}`,
        status: 'completed' as const,
        progress: 100,
      }))
      setResults(restoredResults)
    }

    // Set title
    setProjectTitle(item.title || 'Face Inpainting Pipeline')

    // Track which history item is currently displayed using correct index
    setCurrentHistoryIndex(correctIndex >= 0 ? correctIndex : -1)
  }, [])

  // Navigate to previous history item (older)
  const handleHistoryPrevious = useCallback(() => {
    // Refresh history list from localStorage to ensure sync
    const currentHistory = getLocalHistory()
    setHistoryList(currentHistory)

    // If no history item selected yet, go to the first (newest) item
    if (currentHistoryIndex === -1) {
      if (currentHistory.length > 0) {
        handleHistoryRestore(currentHistory[0], 0)
      }
      return
    }

    // Otherwise go to the next older item (higher index)
    if (currentHistoryIndex < currentHistory.length - 1) {
      const newIndex = currentHistoryIndex + 1
      handleHistoryRestore(currentHistory[newIndex], newIndex)
    }
  }, [currentHistoryIndex, handleHistoryRestore])

  // Navigate to next history item (newer)
  const handleHistoryNext = useCallback(() => {
    // Refresh history list from localStorage to ensure sync
    const currentHistory = getLocalHistory()
    setHistoryList(currentHistory)

    if (currentHistoryIndex > 0) {
      const newIndex = currentHistoryIndex - 1
      handleHistoryRestore(currentHistory[newIndex], newIndex)
    }
  }, [currentHistoryIndex, handleHistoryRestore])

  // Handle reset
  const handleReset = useCallback(() => {
    // Clear images
    setReferenceImageId(null)
    setReferenceImageUrl(null)
    setFaceImageId(null)
    setFaceImageUrl(null)

    // Reset prompt
    setPrompt('')
    setTypingPrompt('')

    // Reset params to default
    setParams(DEFAULT_PARAMS)
    setSeed(-1)
    setAutoPrompt(false)

    // Reset generation control
    setCount(4)
    setParallel(false)

    // Clear results
    setResults([])
    setCurrentBatchId(null)
    setIsGenerating(false)

    // Reset pipeline stage
    setPipelineStage('idle')

    // Reset title
    setProjectTitle('Face Inpainting Pipeline')
  }, [])

  // Handle result actions
  const handleExpandResult = useCallback((resultId: string) => {
    const result = results.find((r) => r.id === resultId)
    if (result?.imageUrl) {
      setModalImageUrl(result.imageUrl)
      setModalOpen(true)
    }
  }, [results])

  const handleDownloadResult = useCallback((resultId: string) => {
    const result = results.find((r) => r.id === resultId)
    if (result?.imageUrl) {
      const a = document.createElement('a')
      a.href = result.imageUrl
      a.download = `result-${resultId}.png`
      a.click()
    }
  }, [results])

  const handleDownloadAll = useCallback(() => {
    results.forEach((result, index) => {
      if (result.imageUrl && result.status === 'completed') {
        setTimeout(() => {
          const a = document.createElement('a')
          a.href = result.imageUrl!
          a.download = `result-${index + 1}.png`
          a.click()
        }, index * 200)
      }
    })
  }, [results])

  // Check if ready to generate
  const canGenerate = !!referenceImageId && !!faceImageId

  // Helper function to calculate optimal connection handles based on node positions
  const calculateOptimalHandles = useCallback((
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number },
    sourceHasPrefix: boolean = false
  ): { sourceHandle: string; targetHandle: string } => {
    const dx = targetPos.x - sourcePos.x
    const dy = targetPos.y - sourcePos.y

    // Determine primary direction based on larger delta
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal connection is dominant
      if (dx > 0) {
        // Target is to the right
        return {
          sourceHandle: sourceHasPrefix ? 'source-right' : 'right',
          targetHandle: 'target-left'
        }
      } else {
        // Target is to the left
        return {
          sourceHandle: sourceHasPrefix ? 'source-left' : 'left',
          targetHandle: 'target-right'
        }
      }
    } else {
      // Vertical connection is dominant
      if (dy > 0) {
        // Target is below
        return {
          sourceHandle: sourceHasPrefix ? 'source-bottom' : 'bottom',
          targetHandle: 'target-top'
        }
      } else {
        // Target is above
        return {
          sourceHandle: sourceHasPrefix ? 'source-top' : 'top',
          targetHandle: 'target-bottom'
        }
      }
    }
  }, [])

  // React Flow nodes
  const initialNodes: Node[] = useMemo(() => [
    {
      id: 'reference-image-node',
      type: 'referenceImage',
      position: { x: 100, y: 80 },
      data: {
        id: 'reference-image-node',
        imageUrl: referenceImageUrl,
        onUpload: handleReferenceUpload,
        onClear: handleReferenceClear,
        isUploading: uploading,
        active: pipelineStage === 'preparing' || pipelineStage === 'loading',
      },
    },
    {
      id: 'face-image-node',
      type: 'faceImage',
      position: { x: 440, y: 80 },
      data: {
        id: 'face-image-node',
        imageUrl: faceImageUrl,
        onUpload: handleFaceUpload,
        onClear: handleFaceClear,
        onAutoPrompt: handleAutoPrompt,
        isUploading: uploading,
        active: pipelineStage === 'preparing' || pipelineStage === 'loading',
      },
    },
    {
      id: 'prompt-node',
      type: 'prompt',
      position: { x: 100, y: 500 },
      data: {
        id: 'prompt-node',
        value: prompt,
        onChange: setPrompt,
        autoPrompt,
        onAutoPromptChange: setAutoPrompt,
        typingText: typingPrompt,
        active: pipelineStage === 'preparing' || pipelineStage === 'loading',
      },
    },
    {
      id: 'params-node',
      type: 'inpaintingParams',
      position: { x: 800, y: 80 },
      data: {
        id: 'params-node',
        params,
        onParamChange: handleParamChange,
        active: pipelineStage === 'loading' || pipelineStage === 'processing',
      },
    },
    {
      id: 'control-node',
      type: 'generationControl',
      position: { x: 1500, y: 80 },
      data: {
        id: 'control-node',
        count,
        parallel,
        seed,
        onCountChange: setCount,
        onParallelChange: setParallel,
        onSeedChange: setSeed,
        onGenerate: handleGenerate,
        onStop: handleStop,
        isGenerating,
        disabled: !canGenerate,
        active: pipelineStage === 'processing',
      },
    },
    {
      id: 'results-node',
      type: 'results',
      position: { x: 1500, y: 380 },
      data: {
        id: 'results-node',
        results,
        count,
        onExpand: handleExpandResult,
        onDownload: handleDownloadResult,
        active: pipelineStage === 'processing',
      },
    },
  ], [
    referenceImageUrl,
    handleReferenceUpload,
    handleReferenceClear,
    uploading,
    faceImageUrl,
    handleFaceUpload,
    handleFaceClear,
    handleAutoPrompt,
    prompt,
    autoPrompt,
    typingPrompt,
    params,
    handleParamChange,
    count,
    parallel,
    seed,
    handleGenerate,
    handleStop,
    isGenerating,
    canGenerate,
    results,
    handleExpandResult,
    handleDownloadResult,
    pipelineStage,
  ])

  // React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    if (!showConnections) return []

    // Node positions for handle calculation
    const nodePositions = {
      'reference-image-node': { x: 100, y: 80 },
      'face-image-node': { x: 440, y: 80 },
      'prompt-node': { x: 100, y: 500 },
      'params-node': { x: 830, y: 80 },
      'control-node': { x: 1500, y: 80 },
      'results-node': { x: 1500, y: 380 },
    }

    // Calculate optimal handles for each connection
    const referenceToParams = calculateOptimalHandles(
      nodePositions['reference-image-node'],
      nodePositions['params-node'],
      false
    )
    const faceToParams = calculateOptimalHandles(
      nodePositions['face-image-node'],
      nodePositions['params-node'],
      false
    )
    const promptToParams = calculateOptimalHandles(
      nodePositions['prompt-node'],
      nodePositions['params-node'],
      false
    )
    const paramsToControl = calculateOptimalHandles(
      nodePositions['params-node'],
      nodePositions['control-node'],
      true
    )
    const controlToResults = calculateOptimalHandles(
      nodePositions['control-node'],
      nodePositions['results-node'],
      true
    )

    return [
      {
        id: 'reference-to-params',
        source: 'reference-image-node',
        sourceHandle: referenceToParams.sourceHandle,
        target: 'params-node',
        targetHandle: referenceToParams.targetHandle,
        type: 'custom',
        animated: false,
        style: {
          stroke: !!referenceImageId ? '#666' : '#444',
          strokeWidth: !!referenceImageId ? 2 : 1.5,
          strokeLinecap: 'round'
        },
      },
      {
        id: 'face-to-params',
        source: 'face-image-node',
        sourceHandle: faceToParams.sourceHandle,
        target: 'params-node',
        targetHandle: faceToParams.targetHandle,
        type: 'custom',
        animated: false,
        style: {
          stroke: !!faceImageId ? '#666' : '#444',
          strokeWidth: !!faceImageId ? 2 : 1.5,
          strokeLinecap: 'round'
        },
      },
      {
        id: 'prompt-to-params',
        source: 'prompt-node',
        sourceHandle: promptToParams.sourceHandle,
        target: 'params-node',
        targetHandle: promptToParams.targetHandle,
        type: 'custom',
        animated: false,
        style: {
          stroke: !!prompt ? '#666' : '#444',
          strokeWidth: !!prompt ? 2 : 1.5,
          strokeLinecap: 'round'
        },
      },
      {
        id: 'params-to-control',
        source: 'params-node',
        sourceHandle: paramsToControl.sourceHandle,
        target: 'control-node',
        targetHandle: paramsToControl.targetHandle,
        type: 'custom',
        animated: false,
        style: {
          stroke: '#666',
          strokeWidth: 2.5,
          strokeLinecap: 'round'
        },
      },
      {
        id: 'control-to-results',
        source: 'control-node',
        sourceHandle: controlToResults.sourceHandle,
        target: 'results-node',
        targetHandle: controlToResults.targetHandle,
        type: 'custom',
        animated: false,
        style: {
          stroke: (results.length > 0 || isGenerating) ? '#666' : '#444',
          strokeWidth: (results.length > 0 || isGenerating) ? 2.5 : 1.5,
          strokeLinecap: 'round'
        },
      },
    ]
  }, [showConnections, referenceImageId, faceImageId, prompt, results.length, isGenerating, calculateOptimalHandles])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Update node data when params change, but preserve positions
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const newNode = initialNodes.find((n) => n.id === node.id)
        if (newNode) {
          return {
            ...node,
            data: newNode.data,
          }
        }
        return node
      })
    )
  }, [params, count, parallel, seed, prompt, setNodes, initialNodes])

  // Auto-layout when images or results change
  useEffect(() => {
    const { nodes: layoutedNodes } = getLayoutedElements(initialNodes, initialEdges)
    setNodes(layoutedNodes)
    // Reset position history when layout changes
    setPositionHistory([])
    setPositionHistoryIndex(-1)
    positionHistoryRef.current = { history: [], index: -1 }
  }, [referenceImageId, faceImageId, results.length])

  // Sync ref with state for reliable access in callbacks
  useEffect(() => {
    positionHistoryRef.current = { history: positionHistory, index: positionHistoryIndex }
  }, [positionHistory, positionHistoryIndex])

  // Keep nodesRef updated for drag handlers
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  // Node position undo/redo handlers
  const savePositionToHistory = useCallback((positions: Record<string, { x: number; y: number }>, isInitial = false) => {
    const ref = positionHistoryRef.current
    if (isInitial && ref.history.length > 0) return // Don't save initial if already have history

    const newHistory = ref.history.slice(0, ref.index + 1)
    const updated = [...newHistory, positions].slice(-50)
    const newIndex = Math.min(ref.index + 1, 49)

    setPositionHistory(updated)
    setPositionHistoryIndex(newIndex)
    positionHistoryRef.current = { history: updated, index: newIndex }
  }, [])

  const handleNodeDragStart = useCallback(() => {
    // Save ALL nodes' positions BEFORE drag starts (initial state)
    const positions: Record<string, { x: number; y: number }> = {}
    nodesRef.current.forEach(n => {
      positions[n.id] = { ...n.position }
    })
    savePositionToHistory(positions, true)
  }, [savePositionToHistory])

  const handleNodeDragStop = useCallback((_event: any, draggedNode: Node, draggedNodes: Node[]) => {
    // Save ALL nodes' positions AFTER drag ends (new state)
    // Use draggedNodes for updated positions, nodesRef for other nodes
    const positions: Record<string, { x: number; y: number }> = {}
    const draggedIds = new Set(draggedNodes.map(n => n.id))

    // First, add all non-dragged nodes from ref
    nodesRef.current.forEach(n => {
      if (!draggedIds.has(n.id)) {
        positions[n.id] = { ...n.position }
      }
    })

    // Then add dragged nodes with their NEW positions from callback
    draggedNodes.forEach(n => {
      positions[n.id] = { ...n.position }
    })

    savePositionToHistory(positions, false)
  }, [savePositionToHistory])

  const undoPosition = useCallback(() => {
    const ref = positionHistoryRef.current
    if (ref.index <= 0) return

    const prevIndex = ref.index - 1
    const prevPositions = ref.history[prevIndex]
    if (prevPositions) {
      setNodes(nds => nds.map(node => ({
        ...node,
        position: prevPositions[node.id] || node.position
      })))
      setPositionHistoryIndex(prevIndex)
      positionHistoryRef.current.index = prevIndex
    }
  }, [setNodes])

  const redoPosition = useCallback(() => {
    const ref = positionHistoryRef.current
    if (ref.index >= ref.history.length - 1) return

    const nextIndex = ref.index + 1
    const nextPositions = ref.history[nextIndex]
    if (nextPositions) {
      setNodes(nds => nds.map(node => ({
        ...node,
        position: nextPositions[node.id] || node.position
      })))
      setPositionHistoryIndex(nextIndex)
      positionHistoryRef.current.index = nextIndex
    }
  }, [setNodes])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to exit focus mode
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false)
        return
      }

      // Only handle other shortcuts if not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Undo/Redo (Ctrl+Z / Ctrl+Shift+Z or Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redoPosition()
        } else {
          undoPosition()
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redoPosition()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undoPosition, redoPosition, focusMode])

  // Recalculate edges when nodes change position
  useEffect(() => {
    if (!showConnections) {
      setEdges([])
      return
    }

    // Get current node positions from nodes state
    const nodePositions: Record<string, { x: number; y: number }> = {}
    nodes.forEach((node) => {
      nodePositions[node.id] = node.position
    })

    // Calculate optimal handles for each connection
    const referenceToParams = calculateOptimalHandles(
      nodePositions['reference-image-node'],
      nodePositions['params-node'],
      false
    )
    const faceToParams = calculateOptimalHandles(
      nodePositions['face-image-node'],
      nodePositions['params-node'],
      false
    )
    const promptToParams = calculateOptimalHandles(
      nodePositions['prompt-node'],
      nodePositions['params-node'],
      false
    )
    const paramsToControl = calculateOptimalHandles(
      nodePositions['params-node'],
      nodePositions['control-node'],
      true
    )
    const controlToResults = calculateOptimalHandles(
      nodePositions['control-node'],
      nodePositions['results-node'],
      true
    )

    const isInputsActive = pipelineStage === 'preparing' || pipelineStage === 'loading'
    const isParamsActive = pipelineStage === 'loading' || pipelineStage === 'processing'
    const isProcessingActive = pipelineStage === 'processing'

    setEdges([
      {
        id: 'reference-to-params',
        source: 'reference-image-node',
        sourceHandle: referenceToParams.sourceHandle,
        target: 'params-node',
        targetHandle: referenceToParams.targetHandle,
        type: isInputsActive ? 'animated' : 'custom',
        animated: false,
        data: { active: isInputsActive },
        style: {
          stroke: !!referenceImageId ? '#666' : '#444',
          strokeWidth: !!referenceImageId ? 2 : 1.5,
          strokeLinecap: 'round'
        },
      },
      {
        id: 'face-to-params',
        source: 'face-image-node',
        sourceHandle: faceToParams.sourceHandle,
        target: 'params-node',
        targetHandle: faceToParams.targetHandle,
        type: isInputsActive ? 'animated' : 'custom',
        animated: false,
        data: { active: isInputsActive },
        style: {
          stroke: !!faceImageId ? '#666' : '#444',
          strokeWidth: !!faceImageId ? 2 : 1.5,
          strokeLinecap: 'round'
        },
      },
      {
        id: 'prompt-to-params',
        source: 'prompt-node',
        sourceHandle: promptToParams.sourceHandle,
        target: 'params-node',
        targetHandle: promptToParams.targetHandle,
        type: isInputsActive ? 'animated' : 'custom',
        animated: false,
        data: { active: isInputsActive },
        style: {
          stroke: !!prompt ? '#666' : '#444',
          strokeWidth: !!prompt ? 2 : 1.5,
          strokeLinecap: 'round'
        },
      },
      {
        id: 'params-to-control',
        source: 'params-node',
        sourceHandle: paramsToControl.sourceHandle,
        target: 'control-node',
        targetHandle: paramsToControl.targetHandle,
        type: isParamsActive ? 'animated' : 'custom',
        animated: false,
        data: { active: isParamsActive },
        style: {
          stroke: '#666',
          strokeWidth: 2.5,
          strokeLinecap: 'round'
        },
      },
      {
        id: 'control-to-results',
        source: 'control-node',
        sourceHandle: controlToResults.sourceHandle,
        target: 'results-node',
        targetHandle: controlToResults.targetHandle,
        type: isProcessingActive ? 'animated' : 'custom',
        animated: false,
        data: { active: isProcessingActive },
        style: {
          stroke: (results.length > 0 || isGenerating) ? '#666' : '#444',
          strokeWidth: (results.length > 0 || isGenerating) ? 2.5 : 1.5,
          strokeLinecap: 'round'
        },
      },
    ])
  }, [nodes, showConnections, referenceImageId, faceImageId, prompt, results.length, isGenerating, pipelineStage, calculateOptimalHandles, setEdges])

  return (
    <div className="h-screen bg-background overflow-hidden relative">
      {/* React Flow Canvas */}
      <div className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{
            type: 'custom',
            animated: false,
          }}
          defaultViewport={{ x: 50, y: 100, zoom: 1.0 }}
          minZoom={0.3}
          maxZoom={1.5}
          fitView
          fitViewOptions={{
            padding: 0.2,
            includeHiddenNodes: false,
          }}
        >
          {showGrid && <Background />}
        </ReactFlow>
      </div>

      {/* Top Bar - Overlaid */}
      {!focusMode && (
        <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
          <div className="pointer-events-auto">
            <TopBar
              projectName={projectTitle}
              isConnected={isConnected}
              onProjectNameChange={setProjectTitle}
              onReset={handleReset}
              onHistoryPrevious={handleHistoryPrevious}
              onHistoryNext={handleHistoryNext}
              canGoPrevious={historyList.length > 0 && (currentHistoryIndex === -1 || currentHistoryIndex < historyList.length - 1)}
              canGoNext={currentHistoryIndex > 0}
              onGenerate={handleGenerate}
              canGenerate={canGenerate}
              isGenerating={isGenerating}
            />
          </div>
        </div>
      )}

      {/* Side Tools */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
        <SideTools
          onZoomIn={() => zoomIn()}
          onZoomOut={() => zoomOut()}
          onToggleGrid={() => setShowGrid((s) => !s)}
          onToggleFocusMode={() => setFocusMode((s) => !s)}
          onToggleConnections={() => setShowConnections((s) => !s)}
          showGrid={showGrid}
          focusMode={focusMode}
          showConnections={showConnections}
        />
      </div>

      {/* Bottom Bar - Floating */}
      {!focusMode && (
        <BottomBar
        prompt={prompt || 'Upload reference and face images to begin...'}
        onHistoryRestore={handleHistoryRestore}
        onReset={handleReset}
        onDownloadAll={handleDownloadAll}
        onRandomSeed={() => setSeed(Math.floor(Math.random() * 2147483647))}
        onCopyPrompt={() => navigator.clipboard.writeText(prompt || '')}
        onToggleGrid={() => setShowGrid(s => !s)}
        onShowReport={() => setShowReport(true)}
        hasResults={results.some(r => r.status === 'completed')}
        hasPrompt={!!prompt}
      />
      )}

      {/* Image Modal */}
      <ImageModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        imageSrc={modalImageUrl}
        title="Generated Result"
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        data={{
          faceImageUrl: faceImageUrl || undefined,
          referenceImageUrl: referenceImageUrl || undefined,
          resultUrls: results.filter(r => r.status === 'completed' && r.imageUrl).map(r => r.imageUrl!),
          prompt: prompt || '',
          params: {
            seed,
            steps: params.steps,
            guidanceScale: params.guidanceScale,
            denoiseStrength: params.denoiseStrength,
            faceStrength: params.faceStrength,
            stopAt: params.stopAt,
            maskBlur: params.maskBlur,
            maskExpand: params.maskExpand,
            maskPadding: params.maskPadding,
            includeHair: params.includeHair,
            includeNeck: params.includeNeck,
            adapterMode: params.adapterMode,
          },
          generatedAt: new Date(),
        }}
      />
    </div>
  )
}

export default function HomePage() {
  return (
    <ReactFlowProvider>
      <HomePageContent />
    </ReactFlowProvider>
  )
}
