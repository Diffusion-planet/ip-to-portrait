'use client'

import React from 'react'

export default function PipelineDiagramPage() {
  return (
    <div className="min-h-screen bg-black p-8 flex items-center justify-center">
      <div className="w-full max-w-4xl">
        {/* Title */}
        <h1 className="text-xl font-semibold text-white text-center mb-8 tracking-tight">
          Face Inpainting Pipeline
        </h1>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">

          {/* Left Column - Input & Processing */}
          <div className="space-y-3">
            {/* Inputs */}
            <div className="flex gap-3">
              <CompactNode title="Reference" visual={<ImageVisual />} desc="Target background" />
              <CompactNode title="Face" visual={<FaceVisual />} desc="Source identity" />
              <CompactNode title="Prompt" visual={<PromptVisual />} desc="Text description" />
            </div>

            <Arrow />

            {/* Detection & Parsing */}
            <CompactNode title="Face Detection" subtitle="OpenCV / MediaPipe" visual={<DetectionVisual />} wide desc="Locate face region and landmarks" />

            <Arrow />

            <CompactNode title="Face Parsing" subtitle="BiSeNet" visual={<ParsingVisual />} wide desc="Segment face, hair, neck regions" />

            <Arrow />

            <CompactNode title="Mask Generation" visual={<MaskVisual />} wide desc="Create binary mask with blur/expand" />
          </div>

          {/* Center Column - Adapter Modes */}
          <div className="flex flex-col items-center justify-center h-full pt-8">
            <div className="text-xs text-white/70 uppercase tracking-wider mb-3">Adapter</div>
            <div className="space-y-1.5">
              <MiniChip label="Standard" sub="CLIP" />
              <MiniChip label="FaceID" sub="InsightFace" />
              <MiniChip label="FaceID Plus v2" sub="Dual" highlight badge="Recommended" />
              <MiniChip label="CLIP Blend" sub="Weighted" />
            </div>
          </div>

          {/* Right Column - Generation & Output */}
          <div className="space-y-3">
            {/* IP-Adapter */}
            <CompactNode title="IP-Adapter" subtitle="Identity Injection" visual={<AdapterVisual />} wide desc="Inject face identity into model" />

            <Arrow />

            {/* SDXL */}
            <CompactNode title="SDXL Inpainting" subtitle="Diffusion" visual={<DiffusionVisual />} wide desc="Generate face with diffusion" />

            <Arrow />

            {/* Output */}
            <CompactNode title="Output" visual={<OutputVisual />} wide desc="Final swapped result" />

            {/* Info bullets */}
            <div className="pt-2 pl-2 space-y-1">
              <Bullet text="Face strength: 0-1.5" />
              <Bullet text="Guidance: 1-20" />
              <Bullet text="Steps: 1-100" />
              <Bullet text="Stop at: early stop for more prompt influence" />
            </div>
          </div>

        </div>

        {/* Bottom Flow Indicators */}
        <div className="flex justify-center items-center gap-3 mt-6 text-xs text-white/50">
          <span>Input</span>
          <span className="text-white/30">-&gt;</span>
          <span>Process</span>
          <span className="text-white/30">-&gt;</span>
          <span>Adapt</span>
          <span className="text-white/30">-&gt;</span>
          <span>Generate</span>
          <span className="text-white/30">-&gt;</span>
          <span>Output</span>
        </div>
      </div>
    </div>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[9px] text-white/60">
      <div className="w-1 h-1 rounded-full bg-white/40" />
      {text}
    </div>
  )
}

function MiniChip({ label, sub, highlight = false, badge }: { label: string; sub: string; highlight?: boolean; badge?: string }) {
  return (
    <div className={`
      relative overflow-hidden
      px-3 py-2 rounded-xl text-center
      backdrop-blur-xl
      ${highlight
        ? 'bg-white/[0.08] border border-white/25 shadow-[0_2px_12px_rgba(255,255,255,0.1)]'
        : 'bg-white/[0.04] border border-white/[0.1]'}
    `}>
      {/* Top shine */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(circle at 20% 30%, rgba(236, 72, 153, 0.05) 0%, transparent 20%),
          radial-gradient(circle at 80% 50%, rgba(59, 130, 246, 0.05) 0%, transparent 20%)
        `
      }} />

      {badge && <div className="relative z-[1] text-[8px] text-white/60 uppercase tracking-wider mb-1">{badge}</div>}
      <div className={`relative z-[1] text-xs font-medium ${highlight ? 'text-white' : 'text-white/90'}`}>{label}</div>
      <div className="relative z-[1] text-[10px] text-white/60">{sub}</div>
    </div>
  )
}

function Arrow() {
  return (
    <div className="flex justify-center">
      <div className="flex flex-col items-center">
        <div className="w-[1px] h-3 bg-white/30" />
        <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-white/30" />
      </div>
    </div>
  )
}

// Compact Node
function CompactNode({ title, subtitle, visual, wide = false, desc }: {
  title: string
  subtitle?: string
  visual: React.ReactNode
  wide?: boolean
  desc?: string
}) {
  return (
    <div className={`
      relative overflow-hidden rounded-xl
      bg-white/[0.04] border border-white/[0.1]
      backdrop-blur-xl
      shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.1)]
      ${wide ? 'w-full' : 'flex-1'}
    `}>
      {/* Top edge shine */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent z-10" />

      {/* Gradient glow */}
      <div className="absolute inset-0 pointer-events-none z-[1]" style={{
        background: `
          radial-gradient(circle at 10% 30%, rgba(236, 72, 153, 0.08) 0%, rgba(139, 92, 246, 0.06) 15%, transparent 25%),
          radial-gradient(circle at 90% 40%, rgba(59, 130, 246, 0.08) 0%, rgba(96, 165, 250, 0.05) 15%, transparent 25%),
          linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 40%, transparent 60%, rgba(255, 255, 255, 0.03) 100%)
        `
      }} />

      {/* Header */}
      <div className="relative z-[2] flex items-center gap-2 px-3 py-2">
        <div className="w-1.5 h-1.5 rounded-full bg-white/70" />
        <span className="text-xs text-white font-medium">{title}</span>
        {subtitle && <span className="text-[10px] text-white/60 ml-auto">{subtitle}</span>}
      </div>

      {/* Visual */}
      <div className="relative z-[2] px-3 pb-3">
        <div className="bg-[#1a1a1a] rounded-lg p-3 flex flex-col items-center justify-center gap-2">
          {visual}
          {desc && <p className="text-[10px] text-white/50 text-center">{desc}</p>}
        </div>
      </div>
    </div>
  )
}

// Visual Components - Smaller versions
function ImageVisual() {
  return (
    <div className="w-14 h-10 rounded border border-white/20 bg-[#1a1a1a] relative overflow-hidden">
      <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white/15 to-transparent" />
      <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-white/20" />
    </div>
  )
}

function FaceVisual() {
  return (
    <div className="w-14 h-10 rounded border border-white/20 bg-[#1a1a1a] flex items-center justify-center">
      <div className="w-6 h-7 rounded-[50%] border border-white/25 relative">
        <div className="absolute top-2 left-1 w-1 h-0.5 rounded-full bg-white/40" />
        <div className="absolute top-2 right-1 w-1 h-0.5 rounded-full bg-white/40" />
      </div>
    </div>
  )
}

function DetectionVisual() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className="w-5 h-6 rounded-[40%] border border-white/15 bg-[#1a1a1a]" />
        <div className="absolute -top-0.5 -left-0.5 w-1.5 h-1.5 border-l border-t border-white/40" />
        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 border-r border-t border-white/40" />
        <div className="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 border-l border-b border-white/40" />
        <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 border-r border-b border-white/40" />
      </div>
      <div className="text-white/40 text-xs">-&gt;</div>
      <div className="w-5 h-6 rounded-[40%] border border-dashed border-white/20 relative">
        <div className="absolute top-1.5 left-1 w-0.5 h-0.5 rounded-full bg-white/40" />
        <div className="absolute top-1.5 right-1 w-0.5 h-0.5 rounded-full bg-white/40" />
      </div>
    </div>
  )
}

function ParsingVisual() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-6 rounded-[40%] border border-white/15 bg-[#1a1a1a]" />
      <div className="text-white/40 text-xs">-&gt;</div>
      <div className="relative w-5 h-6">
        <div className="absolute top-0 left-0.5 right-0.5 h-2 rounded-t-full bg-white/10 border-t border-l border-r border-white/20" />
        <div className="absolute top-1.5 left-0 right-0 bottom-0 rounded-[40%] bg-white/5 border border-white/15" />
      </div>
    </div>
  )
}

function MaskVisual() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-6 rounded border border-white/15 bg-[#1a1a1a] relative">
        <div className="absolute inset-1 rounded-[40%] bg-white/5" />
      </div>
      <div className="text-white/40 text-xs">-&gt;</div>
      <div className="w-8 h-6 rounded border border-white/15 bg-black relative">
        <div className="absolute inset-1 rounded-[40%] bg-white/80" style={{ filter: 'blur(1px)' }} />
      </div>
    </div>
  )
}

function AdapterVisual() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-full border border-white/25 bg-[#1a1a1a]" />
      <div className="text-white/50 text-sm">+</div>
      <div className="w-6 h-5 rounded border border-white/25 bg-[#1a1a1a]" />
      <div className="text-white/50 text-sm">=</div>
      <div className="w-6 h-5 rounded border border-white/35 bg-white/5" />
    </div>
  )
}

function DiffusionVisual() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-1">
        <div className="w-6 h-5 rounded border border-white/15 bg-[#1a1a1a] relative overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute w-0.5 h-0.5 rounded-full bg-white/20"
              style={{ left: `${(i % 3) * 30 + 15}%`, top: `${Math.floor(i / 3) * 40 + 20}%` }} />
          ))}
        </div>
        <div className="text-xs text-white/40">~</div>
        <div className="w-6 h-5 rounded border border-white/20 bg-[#1a1a1a] relative">
          <div className="absolute inset-0.5 rounded bg-gradient-to-br from-white/10 to-white/5" />
        </div>
      </div>
      {/* Stop At progress bar */}
      <div className="w-full flex items-center gap-1">
        <div className="flex-1 h-1 bg-white/10 rounded-full relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[70%] bg-white/30 rounded-full" />
          <div className="absolute right-[30%] top-1/2 -translate-y-1/2 w-0.5 h-2 bg-white/50" />
        </div>
        <span className="text-[7px] text-white/40">stop</span>
      </div>
    </div>
  )
}

function OutputVisual() {
  return (
    <div className="w-10 h-8 rounded border border-white/25 bg-[#1a1a1a] flex items-center justify-center">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 6l3 3 5-6" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function PromptVisual() {
  return (
    <div className="w-14 h-10 rounded border border-white/20 bg-[#1a1a1a] p-1.5 flex flex-col justify-center gap-0.5">
      <div className="w-full h-1 rounded-full bg-white/15" />
      <div className="w-3/4 h-1 rounded-full bg-white/10" />
      <div className="w-1/2 h-1 rounded-full bg-white/10" />
    </div>
  )
}
