'use client'

import { NodeBox, Port } from './NodeBox'
import { ImageUpload } from '@/components/ImageUpload'
import { Button } from '@/components/ui'
import { WandIcon } from '@/components/icons'

interface FaceImageNodeProps {
  id: string
  imageUrl?: string | null
  onUpload: (file: File) => Promise<void>
  onClear?: () => void
  onAutoPrompt?: () => void
  isUploading?: boolean
  onPortClick?: (portId: string, type: 'input' | 'output') => void
  selected?: boolean
  active?: boolean
}

export function FaceImageNode({
  id,
  imageUrl,
  onUpload,
  onClear,
  onAutoPrompt,
  isUploading,
  onPortClick,
  selected,
  active,
}: FaceImageNodeProps) {
  const outputPorts: Port[] = [
    { id: 'face_image', label: 'face image', color: 'green', type: 'output' },
  ]

  return (
    <NodeBox
      id={id}
      title="Face Image"
      outputPorts={outputPorts}
      onPortClick={onPortClick}
      selected={selected}
      active={active}
    >
      <div className="space-y-6">
        <p className="text-2xl text-[#888] font-medium">Source face for inpainting</p>
        <ImageUpload
          onUpload={onUpload}
          onClear={onClear}
          previewUrl={imageUrl}
          loading={isUploading}
        />

        {imageUrl && onAutoPrompt && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAutoPrompt}
            className="w-full flex items-center justify-center gap-2"
          >
            <WandIcon size={14} />
            Auto Prompt
          </Button>
        )}
      </div>
    </NodeBox>
  )
}
