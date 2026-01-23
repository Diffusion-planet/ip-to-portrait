'use client'

import { NodeBox, Port } from './NodeBox'
import { ImageUpload } from '@/components/ImageUpload'

interface ReferenceImageNodeProps {
  id: string
  imageUrl?: string | null
  onUpload: (file: File) => Promise<void>
  onClear?: () => void
  isUploading?: boolean
  onPortClick?: (portId: string, type: 'input' | 'output') => void
  selected?: boolean
  active?: boolean
}

export function ReferenceImageNode({
  id,
  imageUrl,
  onUpload,
  onClear,
  isUploading,
  onPortClick,
  selected,
  active,
}: ReferenceImageNodeProps) {
  const outputPorts: Port[] = [
    { id: 'reference_image', label: 'reference', color: 'yellow', type: 'output' },
  ]

  return (
    <NodeBox
      id={id}
      title="Reference Image"
      outputPorts={outputPorts}
      onPortClick={onPortClick}
      selected={selected}
      active={active}
    >
      <div className="space-y-6">
        <p className="text-2xl text-[#888] font-medium">Background/template image</p>
        <ImageUpload
          onUpload={onUpload}
          onClear={onClear}
          previewUrl={imageUrl}
          loading={isUploading}
        />
      </div>
    </NodeBox>
  )
}
