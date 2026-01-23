'use client'

import { NodeBox, Port } from './NodeBox'
import { Dropdown } from '@/components/ui'
import { UserLabel } from '@/components/ui'

interface ModelNodeProps {
  id: string
  selectedModel: string
  onModelChange: (model: string) => void
  onPortClick?: (portId: string, type: 'input' | 'output') => void
  selected?: boolean
}

const MODEL_OPTIONS = [
  { value: 'RealVisXL_V4.0', label: 'RealVisXL V4.0' },
  { value: 'DreamShaper_6_SD1.5', label: 'DreamShaper 6 (SD1.5)' },
  { value: 'SDXL_Base_1.0', label: 'SDXL Base 1.0' },
  { value: 'Juggernaut_XL', label: 'Juggernaut XL' },
]

export function ModelNode({
  id,
  selectedModel,
  onModelChange,
  onPortClick,
  selected,
}: ModelNodeProps) {
  const outputPorts: Port[] = [
    { id: 'model', label: 'model', color: 'yellow', type: 'output' },
    { id: 'positive', label: 'positive', color: 'green', type: 'output' },
    { id: 'negative', label: 'negative', color: 'red', type: 'output' },
  ]

  const selectedOption = MODEL_OPTIONS.find(opt => opt.value === selectedModel)

  return (
    <NodeBox
      id={id}
      title="Model"
      outputPorts={outputPorts}
      onPortClick={onPortClick}
      selected={selected}
    >
      <div className="space-y-3">
        <Dropdown
          value={selectedModel}
          onChange={onModelChange}
          options={MODEL_OPTIONS}
        />
        <div className="flex justify-end">
          <UserLabel name="Paul" color="yellow" />
        </div>
      </div>
    </NodeBox>
  )
}
