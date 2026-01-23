'use client'

import { NodeBox, Port } from './NodeBox'
import { Dropdown, NumberStepper, Slider, UserLabel } from '@/components/ui'

interface ImageGeneratorNodeProps {
  id: string
  params: {
    seed: number
    controlMode: string
    qualitySteps: number
    promptStrength: number
    samplingMethod: string
  }
  onParamChange: (key: string, value: string | number) => void
  onPortClick?: (portId: string, type: 'input' | 'output') => void
  selected?: boolean
}

const CONTROL_MODES = [
  { value: 'Fixed', label: 'Fixed' },
  { value: 'Random', label: 'Random' },
]

const SAMPLING_METHODS = [
  { value: 'dpm++_2M', label: 'dpm++ 2M' },
  { value: 'euler', label: 'Euler' },
  { value: 'euler_ancestral', label: 'Euler A' },
  { value: 'ddim', label: 'DDIM' },
]

export function ImageGeneratorNode({
  id,
  params,
  onParamChange,
  onPortClick,
  selected,
}: ImageGeneratorNodeProps) {
  const inputPorts: Port[] = [
    { id: 'model', label: 'model', color: 'yellow', type: 'input' },
    { id: 'positive', label: 'positive', color: 'green', type: 'input' },
    { id: 'negative', label: 'negative', color: 'red', type: 'input' },
  ]

  const outputPorts: Port[] = [
    { id: 'image', label: 'image', color: 'blue', type: 'output' },
  ]

  return (
    <NodeBox
      id={id}
      title="Image Generator"
      inputPorts={inputPorts}
      outputPorts={outputPorts}
      onPortClick={onPortClick}
      selected={selected}
    >
      <div className="space-y-4">
        {/* Randomness / Seed */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Randomness</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={params.seed}
              onChange={(e) => onParamChange('seed', parseInt(e.target.value) || 0)}
              className="w-16 px-2 py-1 text-xs text-right bg-black/30 border border-border rounded"
            />
            <UserLabel name="Kate" color="blue" />
          </div>
        </div>

        {/* Control Mode */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Control mode</span>
          <Dropdown
            value={params.controlMode}
            onChange={(val) => onParamChange('controlMode', val)}
            options={CONTROL_MODES}
            className="w-24"
          />
        </div>

        {/* Quality Steps */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Quality steps</span>
          <NumberStepper
            value={params.qualitySteps}
            onChange={(val) => onParamChange('qualitySteps', val)}
            min={1}
            max={100}
          />
        </div>

        {/* Prompt Strength */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Prompt strength</span>
          <Dropdown
            value={params.promptStrength.toString()}
            onChange={(val) => onParamChange('promptStrength', parseFloat(val))}
            options={[
              { value: '6.0', label: '6.0' },
              { value: '7.0', label: '7.0' },
              { value: '7.5', label: '7.5' },
              { value: '8.0', label: '8.0' },
              { value: '8.5', label: '8.5' },
            ]}
            className="w-20"
          />
        </div>

        {/* Sampling Method */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Sampling method</span>
          <Dropdown
            value={params.samplingMethod}
            onChange={(val) => onParamChange('samplingMethod', val)}
            options={SAMPLING_METHODS}
            className="w-28"
          />
        </div>
      </div>
    </NodeBox>
  )
}
