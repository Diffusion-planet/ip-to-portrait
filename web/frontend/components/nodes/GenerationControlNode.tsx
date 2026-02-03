'use client'

import { useState } from 'react'
import { NodeBox, Port } from './NodeBox'
import { Button, Toggle, NumberStepper } from '@/components/ui'
import { PlayIcon, StopIcon } from '@/components/icons'

interface GenerationControlNodeProps {
  id: string
  count: number
  parallel: boolean
  seed: number
  onCountChange: (count: number) => void
  onParallelChange: (parallel: boolean) => void
  onSeedChange: (seed: number) => void
  onGenerate: () => void
  onStop?: () => void
  isGenerating?: boolean
  disabled?: boolean
  onPortClick?: (portId: string, type: 'input' | 'output') => void
  selected?: boolean
}

export function GenerationControlNode({
  id,
  count,
  parallel,
  seed,
  onCountChange,
  onParallelChange,
  onSeedChange,
  onGenerate,
  onStop,
  isGenerating,
  disabled = false,
  onPortClick,
  selected,
}: GenerationControlNodeProps) {
  const [seedInput, setSeedInput] = useState('')

  const handleSeedFocus = () => {
    setSeedInput(seed === -1 ? '' : String(seed))
  }

  const handleSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Only allow digits
    if (value === '' || /^\d+$/.test(value)) {
      setSeedInput(value)
    }
  }

  const handleSeedBlur = () => {
    const value = parseInt(seedInput)
    if (seedInput === '' || isNaN(value)) {
      onSeedChange(-1)
      setSeedInput('')
    } else {
      onSeedChange(value)
    }
  }

  const inputPorts: Port[] = [
    { id: 'params', label: 'params', color: 'yellow', type: 'input' },
  ]

  const outputPorts: Port[] = [
    { id: 'results', label: 'results', color: 'green', type: 'output' },
  ]

  return (
    <NodeBox
      id={id}
      title="Generation Control"
      inputPorts={inputPorts}
      outputPorts={outputPorts}
      onPortClick={onPortClick}
      selected={selected}
      className="w-[480px]"
    >
      <div className="space-y-6">
        {/* Count & Parallel */}
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="text-3xl text-text-secondary font-medium">Count</span>
            <NumberStepper
              value={count}
              onChange={onCountChange}
              min={1}
              max={8}
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-3xl text-text-secondary font-medium">Parallel</span>
            <Toggle checked={parallel} onChange={onParallelChange} />
          </div>
        </div>

        {/* Seed */}
        <div className="flex items-center justify-between">
          <span className="text-3xl text-text-secondary font-medium">Seed</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={seedInput || (seed === -1 ? '' : String(seed))}
              onFocus={handleSeedFocus}
              onChange={handleSeedChange}
              onBlur={handleSeedBlur}
              className="w-32 px-5 py-4 text-2xl text-right bg-black/30 border border-border rounded nodrag"
              placeholder="Random"
            />
            <button
              onClick={() => {
                onSeedChange(-1)
                setSeedInput('')
              }}
              className="px-4 py-4 text-xl bg-black/30 border border-border rounded hover:bg-black/50 transition-colors nodrag"
            >
              Random
            </button>
          </div>
        </div>

        {/* Generate Button */}
        {isGenerating ? (
          <Button
            variant="danger"
            size="xl"
            onClick={onStop}
            className="w-full flex items-center justify-center gap-3"
          >
            <StopIcon size={24} />
            Stop
          </Button>
        ) : (
          <Button
            variant="primary"
            size="xl"
            onClick={onGenerate}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-3"
          >
            <PlayIcon size={24} />
            {disabled ? 'Upload Images' : `Generate ${count}`}
          </Button>
        )}
      </div>
    </NodeBox>
  )
}
