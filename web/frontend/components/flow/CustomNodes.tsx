'use client'

import { Handle, Position, NodeProps } from 'reactflow'
import {
  FaceImageNode as FaceImageNodeComponent,
  ReferenceImageNode as ReferenceImageNodeComponent,
  PromptNode as PromptNodeComponent,
  InpaintingParamsNode as InpaintingParamsNodeComponent,
  GenerationControlNode as GenerationControlNodeComponent,
  ResultsNode as ResultsNodeComponent,
} from '@/components/nodes'

// Custom node wrapper that combines our nodes with React Flow handles
export function ReferenceImageFlowNode({ data }: NodeProps) {
  return (
    <div className="relative">
      <ReferenceImageNodeComponent
        id={data.id}
        imageUrl={data.imageUrl}
        onUpload={data.onUpload}
        onClear={data.onClear}
        isUploading={data.isUploading}
        active={data.active}
      />
      {/* 4-directional handles */}
      <Handle type="source" position={Position.Top} id="top" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Left} id="left" className="!w-2 !h-2 !bg-transparent !border-0" />
    </div>
  )
}

export function FaceImageFlowNode({ data }: NodeProps) {
  return (
    <div className="relative">
      <FaceImageNodeComponent
        id={data.id}
        imageUrl={data.imageUrl}
        onUpload={data.onUpload}
        onClear={data.onClear}
        onAutoPrompt={data.onAutoPrompt}
        isUploading={data.isUploading}
        active={data.active}
      />
      {/* 4-directional handles */}
      <Handle type="source" position={Position.Top} id="top" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Left} id="left" className="!w-2 !h-2 !bg-transparent !border-0" />
    </div>
  )
}

export function PromptFlowNode({ data }: NodeProps) {
  return (
    <div className="relative">
      <PromptNodeComponent
        id={data.id}
        type="positive"
        value={data.value}
        onChange={data.onChange}
        autoPrompt={data.autoPrompt}
        onAutoPromptChange={data.onAutoPromptChange}
        typingText={data.typingText}
        active={data.active}
        className="w-[500px]"
      />
      {/* 4-directional handles */}
      <Handle type="source" position={Position.Top} id="top" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Left} id="left" className="!w-2 !h-2 !bg-transparent !border-0" />
    </div>
  )
}

export function InpaintingParamsFlowNode({ data }: NodeProps) {
  return (
    <div className="relative">
      <InpaintingParamsNodeComponent
        id={data.id}
        params={data.params}
        onParamChange={data.onParamChange}
        active={data.active}
      />
      {/* 4-directional target handles */}
      <Handle type="target" position={Position.Top} id="target-top" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="target" position={Position.Right} id="target-right" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="target" position={Position.Left} id="target-left" className="!w-2 !h-2 !bg-transparent !border-0" />

      {/* 4-directional source handles */}
      <Handle type="source" position={Position.Top} id="source-top" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Right} id="source-right" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Left} id="source-left" className="!w-2 !h-2 !bg-transparent !border-0" />
    </div>
  )
}

export function GenerationControlFlowNode({ data }: NodeProps) {
  return (
    <div className="relative">
      <GenerationControlNodeComponent
        id={data.id}
        count={data.count}
        parallel={data.parallel}
        seed={data.seed}
        onCountChange={data.onCountChange}
        onParallelChange={data.onParallelChange}
        onSeedChange={data.onSeedChange}
        onGenerate={data.onGenerate}
        onStop={data.onStop}
        isGenerating={data.isGenerating}
        disabled={data.disabled}
        active={data.active}
      />
      {/* 4-directional target handles */}
      <Handle type="target" position={Position.Top} id="target-top" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="target" position={Position.Right} id="target-right" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="target" position={Position.Left} id="target-left" className="!w-2 !h-2 !bg-transparent !border-0" />

      {/* 4-directional source handles */}
      <Handle type="source" position={Position.Top} id="source-top" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Right} id="source-right" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Left} id="source-left" className="!w-2 !h-2 !bg-transparent !border-0" />
    </div>
  )
}

export function ResultsFlowNode({ data }: NodeProps) {
  return (
    <div className="relative">
      <ResultsNodeComponent
        id={data.id}
        results={data.results}
        count={data.count}
        onExpand={data.onExpand}
        onDownload={data.onDownload}
        active={data.active}
      />
      {/* 4-directional target handles */}
      <Handle type="target" position={Position.Top} id="target-top" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="target" position={Position.Right} id="target-right" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="target" position={Position.Left} id="target-left" className="!w-2 !h-2 !bg-transparent !border-0" />
    </div>
  )
}
