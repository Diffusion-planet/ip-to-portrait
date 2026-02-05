'use client'

import { NodeBox, Port } from './NodeBox'
import { Slider, Toggle, NumberStepper, Dropdown } from '@/components/ui'

// Mode options matching the CLI
type AdapterMode = 'none' | 'standard' | 'faceid' | 'faceid_plus' | 'clip_blend'
type FaceSwapModel = 'insightface' | 'ghost'

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
  shortcutScale: number

  // CLIP Blend weights
  faceBlendWeight: number
  hairBlendWeight: number

  // Pre-paste settings
  usePrePaste: boolean
  prePasteDenoising: number

  // Face Swap settings
  useFaceSwap: boolean
  faceSwapModel: FaceSwapModel

  // Face Enhance settings (GFPGAN)
  useFaceEnhance: boolean
  faceEnhanceStrength: number

  // Face Swap Refinement settings
  useSwapRefinement: boolean
  swapRefinementStrength: number

  // Auto prompt
  autoPrompt: boolean
}

interface InpaintingParamsNodeProps {
  id: string
  params: InpaintingParams
  onParamChange: (key: keyof InpaintingParams, value: number | boolean | string) => void
  onPortClick?: (portId: string, type: 'input' | 'output') => void
  selected?: boolean
  active?: boolean
}

const MODE_OPTIONS = [
  { value: 'none', label: 'Simple Inpainting (No Face Guide)' },
  { value: 'standard', label: 'Standard (CLIP)' },
  { value: 'faceid', label: 'FaceID' },
  { value: 'faceid_plus', label: 'FaceID Plus v2 (Recommended)' },
  { value: 'clip_blend', label: 'CLIP Blend' },
]

const FACE_SWAP_MODEL_OPTIONS = [
  { value: 'insightface', label: 'InsightFace 128 (Recommended)' },
  { value: 'ghost', label: 'Ghost (High Quality, Experimental)' },
]

export function InpaintingParamsNode({
  id,
  params,
  onParamChange,
  onPortClick,
  selected,
  active,
}: InpaintingParamsNodeProps) {
  const inputPorts: Port[] = [
    { id: 'reference_image', label: 'reference', color: 'yellow', type: 'input' },
    { id: 'face_image', label: 'face', color: 'green', type: 'input' },
    { id: 'prompt', label: 'prompt', color: 'green', type: 'input' },
  ]

  const outputPorts: Port[] = [
    { id: 'params', label: 'params', color: 'yellow', type: 'output' },
  ]

  const showClipBlendSettings = params.adapterMode === 'clip_blend'
  const showStopAt = params.adapterMode === 'faceid' || params.adapterMode === 'faceid_plus'

  return (
    <NodeBox
      id={id}
      title="Inpainting Parameters"
      inputPorts={inputPorts}
      outputPorts={outputPorts}
      onPortClick={onPortClick}
      selected={selected}
      active={active}
      className="w-[1200px]"
    >
      <div className="space-y-8">
        {/* Mode Selection - Full Width */}
        <div className="space-y-4">
          <h4 className="text-2xl font-semibold text-[#666] uppercase tracking-wide">
            IP-Adapter Mode
          </h4>
          <Dropdown
            value={params.adapterMode}
            onChange={(v) => onParamChange('adapterMode', v)}
            options={MODE_OPTIONS}
            className="w-full"
          />
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-3 gap-12">
          {/* Column 1: Diffusion */}
          <div className="space-y-6">
            <h4 className="text-2xl font-semibold text-[#666] uppercase tracking-wide border-b border-white/10 pb-2">
              Diffusion
            </h4>

            <div className="flex items-center justify-between">
              <span className="text-2xl text-text-secondary font-medium">Steps</span>
              <NumberStepper
                value={params.steps}
                onChange={(v) => onParamChange('steps', v)}
                min={10}
                max={100}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl text-text-secondary font-medium">Guidance</span>
                <span className="text-2xl text-text-muted font-semibold">{params.guidanceScale.toFixed(1)}</span>
              </div>
              <Slider
                value={params.guidanceScale}
                onChange={(v) => onParamChange('guidanceScale', v)}
                min={1}
                max={15}
                step={0.5}
                showValue={false}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl text-text-secondary font-medium">Denoise</span>
                <span className="text-2xl text-text-muted font-semibold">{params.denoiseStrength.toFixed(2)}</span>
              </div>
              <Slider
                value={params.denoiseStrength}
                onChange={(v) => onParamChange('denoiseStrength', v)}
                min={0.5}
                max={1}
                step={0.02}
                showValue={false}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl text-text-secondary font-medium">Face</span>
                <span className="text-2xl text-text-muted font-semibold">{params.faceStrength.toFixed(2)}</span>
              </div>
              <Slider
                value={params.faceStrength}
                onChange={(v) => onParamChange('faceStrength', v)}
                min={0.5}
                max={1}
                step={0.05}
                showValue={false}
              />
            </div>

            {/* Conditional: FaceID Timing or CLIP Blend */}
            {showStopAt && (
              <div className="space-y-3 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-2xl text-text-secondary font-medium">Stop At</span>
                  <span className="text-2xl text-text-muted font-semibold">{(params.stopAt * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={params.stopAt}
                  onChange={(v) => onParamChange('stopAt', v)}
                  min={0.3}
                  max={1}
                  step={0.05}
                  showValue={false}
                />
                {params.adapterMode === 'faceid_plus' && (
                  <>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-2xl text-text-secondary font-medium">Hair Style</span>
                      <span className="text-2xl text-text-muted font-semibold">{(params.shortcutScale * 100).toFixed(0)}%</span>
                    </div>
                    <Slider
                      value={params.shortcutScale}
                      onChange={(v) => onParamChange('shortcutScale', v)}
                      min={0}
                      max={1}
                      step={0.1}
                      showValue={false}
                    />
                  </>
                )}
              </div>
            )}

            {showClipBlendSettings && (
              <div className="space-y-3 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-2xl text-text-secondary font-medium">Face Wt</span>
                  <span className="text-2xl text-text-muted font-semibold">{(params.faceBlendWeight * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={params.faceBlendWeight}
                  onChange={(v) => onParamChange('faceBlendWeight', v)}
                  min={0.1}
                  max={0.9}
                  step={0.1}
                  showValue={false}
                />
                <div className="flex items-center justify-between">
                  <span className="text-2xl text-text-secondary font-medium">Hair Wt</span>
                  <span className="text-2xl text-text-muted font-semibold">{(params.hairBlendWeight * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={params.hairBlendWeight}
                  onChange={(v) => onParamChange('hairBlendWeight', v)}
                  min={0.1}
                  max={0.9}
                  step={0.1}
                  showValue={false}
                />
              </div>
            )}
          </div>

          {/* Column 2: Mask Settings */}
          <div className="space-y-6">
            <h4 className="text-2xl font-semibold text-[#666] uppercase tracking-wide border-b border-white/10 pb-2">
              Mask
            </h4>

            <div className="flex items-center justify-between">
              <span className="text-2xl text-text-secondary font-medium">Include Hair</span>
              <Toggle
                checked={params.includeHair}
                onChange={(v) => onParamChange('includeHair', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-2xl text-text-secondary font-medium">Include Neck</span>
              <Toggle
                checked={params.includeNeck}
                onChange={(v) => onParamChange('includeNeck', v)}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl text-text-secondary font-medium">Expand</span>
                <span className="text-2xl text-text-muted font-semibold">{params.maskExpand.toFixed(1)}</span>
              </div>
              <Slider
                value={params.maskExpand}
                onChange={(v) => onParamChange('maskExpand', v)}
                min={0.1}
                max={0.5}
                step={0.1}
                showValue={false}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-2xl text-text-secondary font-medium">Blur</span>
              <NumberStepper
                value={params.maskBlur}
                onChange={(v) => onParamChange('maskBlur', v)}
                min={0}
                max={30}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-2xl text-text-secondary font-medium">Padding</span>
              <NumberStepper
                value={params.maskPadding}
                onChange={(v) => onParamChange('maskPadding', v)}
                min={-20}
                max={20}
              />
            </div>

            {/* Pre-paste */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-2xl text-text-secondary font-medium">Pre-paste</span>
                <Toggle
                  checked={params.usePrePaste}
                  onChange={(v) => onParamChange('usePrePaste', v)}
                />
              </div>

              {params.usePrePaste && (
                <div className="space-y-3 pl-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xl text-text-muted font-medium">Denoise</span>
                    <span className="text-xl text-text-muted font-semibold">{params.prePasteDenoising.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={params.prePasteDenoising}
                    onChange={(v) => onParamChange('prePasteDenoising', v)}
                    min={0.4}
                    max={0.8}
                    step={0.05}
                    showValue={false}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Post-Processing */}
          <div className="space-y-6">
            <h4 className="text-2xl font-semibold text-[#666] uppercase tracking-wide border-b border-white/10 pb-2">
              Post-Processing
            </h4>

            {/* Face Swap */}
            <div className="flex items-center justify-between">
              <span className="text-2xl text-text-secondary font-medium">Face Swap</span>
              <Toggle
                checked={params.useFaceSwap}
                onChange={(v) => onParamChange('useFaceSwap', v)}
              />
            </div>

            {params.useFaceSwap && (
              <div className="space-y-4 pl-3 pb-3 border-l-2 border-blue-500/30">
                <div className="space-y-2">
                  <span className="text-xl text-text-muted font-medium">Model</span>
                  <Dropdown
                    value={params.faceSwapModel || 'insightface'}
                    onChange={(v) => onParamChange('faceSwapModel', v)}
                    options={FACE_SWAP_MODEL_OPTIONS}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xl text-text-muted font-medium">Refinement</span>
                  <Toggle
                    checked={params.useSwapRefinement}
                    onChange={(v) => onParamChange('useSwapRefinement', v)}
                  />
                </div>

                {params.useSwapRefinement && (
                  <div className="space-y-2 pl-3">
                    <div className="flex items-center justify-between">
                      <span className="text-lg text-text-muted font-medium">Strength</span>
                      <span className="text-lg text-text-muted font-semibold">{(params.swapRefinementStrength * 100).toFixed(0)}%</span>
                    </div>
                    <Slider
                      value={params.swapRefinementStrength}
                      onChange={(v) => onParamChange('swapRefinementStrength', v)}
                      min={0.1}
                      max={0.5}
                      step={0.05}
                      showValue={false}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Face Enhance */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-2xl text-text-secondary font-medium">Face Enhance</span>
              <Toggle
                checked={params.useFaceEnhance}
                onChange={(v) => onParamChange('useFaceEnhance', v)}
              />
            </div>

            {params.useFaceEnhance && (
              <div className="space-y-3 pl-3 pb-3 border-l-2 border-green-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-xl text-text-muted font-medium">Strength</span>
                  <span className="text-xl text-text-muted font-semibold">{(params.faceEnhanceStrength * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={params.faceEnhanceStrength}
                  onChange={(v) => onParamChange('faceEnhanceStrength', v)}
                  min={0.3}
                  max={1.0}
                  step={0.1}
                  showValue={false}
                />
              </div>
            )}

            {/* Info box */}
            <div className="mt-4 p-3 bg-white/5 rounded-lg text-lg text-text-muted">
              <p className="font-medium mb-1">💡 Tips</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Ghost: 고화질, 느림</li>
                <li>InsightFace: 빠름, 적당한 품질</li>
                <li>Enhance: GFPGAN으로 얼굴 개선</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </NodeBox>
  )
}
