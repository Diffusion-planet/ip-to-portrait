'use client'

import { NodeBox, Port } from './NodeBox'
import { Slider, Toggle, NumberStepper, Dropdown } from '@/components/ui'

// Mode options matching the CLI
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
  shortcutScale: number

  // CLIP Blend weights
  faceBlendWeight: number
  hairBlendWeight: number

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
  { value: 'standard', label: 'Standard (CLIP)' },
  { value: 'faceid', label: 'FaceID' },
  { value: 'faceid_plus', label: 'FaceID Plus v2 (Recommended)' },
  { value: 'clip_blend', label: 'CLIP Blend' },
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
      className="w-[1000px]"
    >
      <div className="space-y-10">
        {/* Mode Selection - Full Width */}
        <div className="space-y-5">
          <h4 className="text-3xl font-semibold text-[#666] uppercase tracking-wide">
            IP-Adapter Mode
          </h4>
          <Dropdown
            value={params.adapterMode}
            onChange={(v) => onParamChange('adapterMode', v)}
            options={MODE_OPTIONS}
            className="w-full"
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-16">
          {/* Left Column: Diffusion */}
          <div className="space-y-8">
            <h4 className="text-3xl font-semibold text-[#666] uppercase tracking-wide mb-2">
              Diffusion
            </h4>

            <div className="flex items-center justify-between">
              <span className="text-3xl text-text-secondary font-medium">Steps</span>
              <NumberStepper
                value={params.steps}
                onChange={(v) => onParamChange('steps', v)}
                min={10}
                max={100}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl text-text-secondary font-medium">Guidance</span>
                <span className="text-3xl text-text-muted font-semibold">{params.guidanceScale.toFixed(1)}</span>
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

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl text-text-secondary font-medium">Denoise</span>
                <span className="text-3xl text-text-muted font-semibold">{params.denoiseStrength.toFixed(2)}</span>
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

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl text-text-secondary font-medium">Face</span>
                <span className="text-3xl text-text-muted font-semibold">{params.faceStrength.toFixed(2)}</span>
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
              <div className="space-y-4 pt-6 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-3xl text-text-secondary font-medium">Stop At</span>
                  <span className="text-3xl text-text-muted font-semibold">{(params.stopAt * 100).toFixed(0)}%</span>
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
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-3xl text-text-secondary font-medium">Hair Style</span>
                      <span className="text-3xl text-text-muted font-semibold">{(params.shortcutScale * 100).toFixed(0)}%</span>
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
              <div className="space-y-4 pt-6 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-3xl text-text-secondary font-medium">Face Wt</span>
                  <span className="text-3xl text-text-muted font-semibold">{(params.faceBlendWeight * 100).toFixed(0)}%</span>
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
                  <span className="text-3xl text-text-secondary font-medium">Hair Wt</span>
                  <span className="text-3xl text-text-muted font-semibold">{(params.hairBlendWeight * 100).toFixed(0)}%</span>
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

          {/* Right Column: Mask Settings */}
          <div className="space-y-8">
            <h4 className="text-3xl font-semibold text-[#666] uppercase tracking-wide mb-2">
              Mask
            </h4>

            <div className="flex items-center justify-between">
              <span className="text-3xl text-text-secondary font-medium">Include Hair</span>
              <Toggle
                checked={params.includeHair}
                onChange={(v) => onParamChange('includeHair', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-3xl text-text-secondary font-medium">Include Neck</span>
              <Toggle
                checked={params.includeNeck}
                onChange={(v) => onParamChange('includeNeck', v)}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl text-text-secondary font-medium">Expand</span>
                <span className="text-3xl text-text-muted font-semibold">{params.maskExpand.toFixed(1)}</span>
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
              <span className="text-3xl text-text-secondary font-medium">Blur</span>
              <NumberStepper
                value={params.maskBlur}
                onChange={(v) => onParamChange('maskBlur', v)}
                min={0}
                max={30}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-3xl text-text-secondary font-medium">Padding</span>
              <NumberStepper
                value={params.maskPadding}
                onChange={(v) => onParamChange('maskPadding', v)}
                min={-20}
                max={20}
              />
            </div>
          </div>
        </div>
      </div>
    </NodeBox>
  )
}
