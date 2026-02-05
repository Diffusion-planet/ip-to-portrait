'use client'

import React from 'react'

export default function PipelineDiagramPage() {
  return (
    <div className="min-h-screen bg-black p-8 flex items-center justify-center">
      <div className="w-full max-w-5xl">
        {/* Title */}
        <h1 className="text-xl font-semibold text-[#FFFDF5] text-center mb-8 tracking-tight">
          Face Inpainting Pipeline
        </h1>

        {/* Main Grid Layout - Two columns with center adapter section */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">

          {/* Left Column - Input & Preprocessing */}
          <div className="space-y-3">
            {/* Stage 1: Inputs */}
            <div className="flex gap-3">
              <CompactNode title="Reference" visual={<ImageVisual />} desc="배경/포즈" />
              <CompactNode title="Face" visual={<FaceVisual />} desc="정체성" />
              <CompactNode title="Prompt" visual={<PromptVisual />} desc="텍스트 가이드" />
            </div>

            <Arrow />

            {/* Stage 2: Preprocessing */}
            <CompactNode
              title="Face Detection"
              subtitle="InsightFace"
              visual={<DetectionVisual />}
              wide
              desc="얼굴 위치 및 랜드마크 감지"
            />

            <Arrow />

            <CompactNode
              title="Face Parsing"
              subtitle="BiSeNet"
              visual={<ParsingVisual />}
              wide
              desc="얼굴/머리카락/목 영역 분할"
            />

            <Arrow />

            <CompactNode
              title="Mask Generation"
              visual={<MaskVisual />}
              wide
              desc="인페인팅 마스크 생성 (블러/확장)"
            />

            <Arrow />

            <CompactNode
              title="Embedding Extraction"
              subtitle="InsightFace + CLIP"
              visual={<EmbeddingVisual />}
              wide
              desc="512D 얼굴 + 257x1280 이미지 임베딩"
            />

            {/* Info bullets - Parameters */}
            <div className="pt-3 pl-2 space-y-1">
              <Bullet text="Face Strength: 0.0 ~ 1.5" />
              <Bullet text="Guidance Scale: 1 ~ 20" />
              <Bullet text="Inference Steps: 1 ~ 100" />
              <Bullet text="Face Swap Strength: 0 ~ 100%" />
              <Bullet text="Face Enhance Strength: 0 ~ 100%" />
            </div>
          </div>

          {/* Center Column - Adapter Modes */}
          <div className="flex flex-col items-center justify-center h-full pt-8">
            <div className="text-xs text-[#FFFDF5]/70 uppercase tracking-wider mb-3">IP-Adapter Mode</div>
            <div className="space-y-1.5">
              <MiniChip label="Simple" sub="No Adapter" />
              <MiniChip label="Standard" sub="CLIP Only" />
              <MiniChip label="FaceID" sub="InsightFace" />
              <MiniChip label="FaceID Plus v2" sub="Dual Embedding" highlight badge="권장" />
              <MiniChip label="CLIP Blend" sub="Weighted" />
            </div>

            <div className="mt-6 text-xs text-[#FFFDF5]/70 uppercase tracking-wider mb-3">Face Swap</div>
            <div className="space-y-1.5">
              <MiniChip label="InsightFace 128" sub="inswapper_128" highlight badge="권장" />
              <MiniChip label="Ghost" sub="AEI-Net (실험)" />
            </div>
          </div>

          {/* Right Column - Generation & Post-Processing & Output */}
          <div className="space-y-3">
            {/* Stage 3: Generation */}
            <CompactNode
              title="IP-Adapter Injection"
              subtitle="FaceID Plus v2"
              visual={<AdapterVisual />}
              wide
              desc="얼굴 정체성을 SDXL에 주입"
            />

            <Arrow />

            <CompactNode
              title="RealVisXL V4.0 Inpainting"
              subtitle="SDXL 기반"
              visual={<DiffusionVisual />}
              wide
              desc="마스크 영역 재생성"
            />

            <Arrow />

            {/* Stage 4: Post-Processing */}
            <CompactNode
              title="Face Swap"
              subtitle="InsightFace 128"
              visual={<SwapVisual />}
              wide
              desc="생성된 얼굴을 소스 얼굴로 교체"
              badge="권장"
            />

            <Arrow />

            <CompactNode
              title="Refinement"
              subtitle="선택적"
              visual={<RefineVisual />}
              wide
              desc="Face Swap 경계 블렌딩"
              optional
            />

            <Arrow />

            <CompactNode
              title="Face Enhance"
              subtitle="GFPGAN v1.4"
              visual={<EnhanceVisual />}
              wide
              desc="얼굴 화질 향상/복원"
              badge="권장"
            />

            <Arrow />

            {/* Stage 5: Output */}
            <CompactNode
              title="Output"
              visual={<OutputVisual />}
              wide
              desc="최종 합성 결과"
            />
          </div>

        </div>

        {/* Bottom Flow Summary */}
        <div className="flex justify-center items-center gap-3 mt-6 text-xs text-[#FFFDF5]/50">
          <FlowBadge label="1. INPUT" />
          <span className="text-[#FFFDF5]/30">→</span>
          <FlowBadge label="2. PREPROCESS" />
          <span className="text-[#FFFDF5]/30">→</span>
          <FlowBadge label="3. GENERATE" />
          <span className="text-[#FFFDF5]/30">→</span>
          <FlowBadge label="4. POST-PROCESS" />
          <span className="text-[#FFFDF5]/30">→</span>
          <FlowBadge label="5. OUTPUT" />
        </div>
      </div>
    </div>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[9px] text-[#FFFDF5]/60">
      <div className="w-1 h-1 rounded-full bg-[#FFFDF5]/40" />
      {text}
    </div>
  )
}

function FlowBadge({ label }: { label: string }) {
  return (
    <span className="px-2 py-0.5 rounded bg-[#FFFDF5]/[0.08] text-[#FFFDF5]/60 border border-[#FFFDF5]/[0.1]">
      {label}
    </span>
  )
}

function MiniChip({ label, sub, highlight = false, badge }: { label: string; sub: string; highlight?: boolean; badge?: string }) {
  return (
    <div className={`
      relative overflow-hidden
      px-3 py-2 rounded-xl text-center min-w-[120px]
      backdrop-blur-xl
      ${highlight
        ? 'bg-[#FFFDF5]/[0.08] border border-[#FFFDF5]/25 shadow-[0_2px_12px_rgba(255,253,245,0.1)]'
        : 'bg-[#FFFDF5]/[0.04] border border-[#FFFDF5]/[0.1]'}
    `}>
      {/* Top shine */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FFFDF5]/20 to-transparent" />

      {/* Gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: highlight
          ? 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, transparent 50%, rgba(59,130,246,0.05) 100%)'
          : 'linear-gradient(135deg, rgba(255,253,245,0.05) 0%, transparent 50%)'
      }} />

      {badge && (
        <div className="relative z-[1] text-[8px] text-green-400/80 uppercase tracking-wider mb-1 font-medium">
          {badge}
        </div>
      )}
      <div className={`relative z-[1] text-xs font-medium ${highlight ? 'text-[#FFFDF5]' : 'text-[#FFFDF5]/90'}`}>
        {label}
      </div>
      <div className="relative z-[1] text-[10px] text-[#FFFDF5]/60">{sub}</div>
    </div>
  )
}

function Arrow() {
  return (
    <div className="flex justify-center">
      <div className="flex flex-col items-center">
        <div className="w-[1px] h-3 bg-[#FFFDF5]/30" />
        <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-[#FFFDF5]/30" />
      </div>
    </div>
  )
}

// Compact Node - Liquid Glass Style
function CompactNode({ title, subtitle, visual, wide = false, desc, badge, optional }: {
  title: string
  subtitle?: string
  visual: React.ReactNode
  wide?: boolean
  desc?: string
  badge?: string
  optional?: boolean
}) {
  return (
    <div className={`
      relative overflow-hidden rounded-xl
      bg-[#FFFDF5]/[0.04] border backdrop-blur-xl
      shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,253,245,0.08),inset_0_-1px_1px_rgba(0,0,0,0.1)]
      ${wide ? 'w-full' : 'flex-1'}
      ${optional ? 'border-dashed border-[#FFFDF5]/[0.15] opacity-70' : 'border-[#FFFDF5]/[0.1]'}
    `}>
      {/* Top edge shine */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FFFDF5]/30 to-transparent z-10" />

      {/* Gradient glow */}
      <div className="absolute inset-0 pointer-events-none z-[1]" style={{
        background: 'linear-gradient(135deg, rgba(255,253,245,0.08) 0%, transparent 40%, transparent 60%, rgba(255,253,245,0.03) 100%)'
      }} />

      {/* Header */}
      <div className="relative z-[2] flex items-center gap-2 px-3 py-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#FFFDF5]/70" />
        <span className="text-xs text-[#FFFDF5] font-medium">{title}</span>
        {subtitle && <span className="text-[10px] text-[#FFFDF5]/60 ml-auto mr-1">{subtitle}</span>}
        {badge && (
          <span className="px-1.5 py-0.5 rounded text-[7px] bg-green-500/80 text-white font-medium shrink-0">
            {badge}
          </span>
        )}
        {optional && (
          <span className="px-1.5 py-0.5 rounded text-[7px] bg-[#FFFDF5]/20 text-[#FFFDF5]/70 font-medium shrink-0">
            선택
          </span>
        )}
      </div>

      {/* Visual */}
      <div className="relative z-[2] px-3 pb-3">
        <div className="bg-[#0a0a0a] rounded-lg p-3 flex flex-col items-center justify-center gap-2">
          {visual}
          {desc && <p className="text-[10px] text-[#FFFDF5]/50 text-center">{desc}</p>}
        </div>
      </div>
    </div>
  )
}

// Visual Components with Color Accents
function ImageVisual() {
  return (
    <div className="w-14 h-10 rounded border border-[#FFFDF5]/20 bg-[#0a0a0a] relative overflow-hidden">
      {/* Landscape - blue */}
      <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-blue-500/30 to-transparent" />
      {/* Sun - orange */}
      <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-orange-400/70" />
    </div>
  )
}

function FaceVisual() {
  return (
    <div className="w-14 h-10 rounded border border-[#FFFDF5]/20 bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-6 h-7 rounded-[50%] border border-[#FFFDF5]/25 relative bg-[#FFFDF5]/5">
        {/* Eyes - cyan */}
        <div className="absolute top-2 left-1 w-1 h-0.5 rounded-full bg-cyan-400/80" />
        <div className="absolute top-2 right-1 w-1 h-0.5 rounded-full bg-cyan-400/80" />
      </div>
    </div>
  )
}

function PromptVisual() {
  return (
    <div className="w-14 h-10 rounded border border-[#FFFDF5]/20 bg-[#0a0a0a] p-1.5 flex flex-col justify-center gap-0.5">
      {/* Text lines - purple */}
      <div className="w-full h-1 rounded-full bg-purple-400/50" />
      <div className="w-3/4 h-1 rounded-full bg-purple-400/30" />
      <div className="w-1/2 h-1 rounded-full bg-purple-400/20" />
    </div>
  )
}

function DetectionVisual() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className="w-5 h-6 rounded-[40%] border border-[#FFFDF5]/15 bg-[#0a0a0a]" />
        {/* Corner brackets - green */}
        <div className="absolute -top-0.5 -left-0.5 w-1.5 h-1.5 border-l border-t border-green-400/80" />
        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 border-r border-t border-green-400/80" />
        <div className="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 border-l border-b border-green-400/80" />
        <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 border-r border-b border-green-400/80" />
      </div>
      <div className="text-[#FFFDF5]/40 text-xs">→</div>
      <div className="w-5 h-6 rounded-[40%] border border-dashed border-green-400/40 relative">
        {/* Landmarks - green dots */}
        <div className="absolute top-1.5 left-1 w-0.5 h-0.5 rounded-full bg-green-400/70" />
        <div className="absolute top-1.5 right-1 w-0.5 h-0.5 rounded-full bg-green-400/70" />
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-0.5 h-0.5 rounded-full bg-green-400/50" />
      </div>
    </div>
  )
}

function ParsingVisual() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-6 rounded-[40%] border border-[#FFFDF5]/15 bg-[#0a0a0a]" />
      <div className="text-[#FFFDF5]/40 text-xs">→</div>
      <div className="relative w-5 h-6">
        {/* Hair - yellow */}
        <div className="absolute top-0 left-0.5 right-0.5 h-2 rounded-t-full bg-yellow-500/50 border-t border-l border-r border-yellow-500/60" />
        {/* Face - pink */}
        <div className="absolute top-1.5 left-0 right-0 bottom-0 rounded-[40%] bg-pink-400/35 border border-pink-400/50" />
      </div>
    </div>
  )
}

function MaskVisual() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-6 rounded border border-[#FFFDF5]/15 bg-[#0a0a0a] relative">
        <div className="absolute inset-1 rounded-[40%] bg-[#FFFDF5]/10" />
      </div>
      <div className="text-[#FFFDF5]/40 text-xs">→</div>
      <div className="w-8 h-6 rounded border border-[#FFFDF5]/15 bg-black relative">
        <div className="absolute inset-1 rounded-[40%] bg-[#FFFDF5]/90" style={{ filter: 'blur(1px)' }} />
      </div>
    </div>
  )
}

function EmbeddingVisual() {
  return (
    <div className="flex items-center gap-2">
      {/* Face embedding - blue */}
      <div className="flex flex-col items-center">
        <div className="w-4 h-6 rounded bg-blue-500/40 border border-blue-500/50" />
        <span className="text-[7px] text-[#FFFDF5]/40">512D</span>
      </div>
      <div className="text-[#FFFDF5]/50 text-sm">+</div>
      {/* CLIP embedding - purple */}
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 rounded bg-purple-500/40 border border-purple-500/50" />
        <span className="text-[7px] text-[#FFFDF5]/40">257×1280</span>
      </div>
    </div>
  )
}

function AdapterVisual() {
  return (
    <div className="flex items-center gap-2">
      {/* Face ID - blue */}
      <div className="w-5 h-5 rounded-full border border-blue-400/50 bg-blue-500/30" />
      <div className="text-[#FFFDF5]/50 text-sm">+</div>
      {/* CLIP - purple */}
      <div className="w-6 h-5 rounded border border-purple-400/50 bg-purple-500/30" />
      <div className="text-[#FFFDF5]/50 text-sm">=</div>
      {/* Fused - teal */}
      <div className="w-6 h-5 rounded border border-teal-400/50 bg-teal-500/25" />
    </div>
  )
}

function DiffusionVisual() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-1">
        {/* Noise */}
        <div className="w-6 h-5 rounded border border-[#FFFDF5]/15 bg-[#0a0a0a] relative overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute w-0.5 h-0.5 rounded-full bg-[#FFFDF5]/20"
              style={{ left: `${(i % 3) * 30 + 15}%`, top: `${Math.floor(i / 3) * 40 + 20}%` }} />
          ))}
        </div>
        <div className="text-xs text-cyan-400/60">~</div>
        {/* Result - teal gradient */}
        <div className="w-6 h-5 rounded border border-teal-400/40 bg-gradient-to-br from-teal-500/25 to-cyan-500/15" />
      </div>
      {/* Steps indicator */}
      <div className="w-full flex items-center gap-1">
        <div className="flex-1 h-1 bg-[#FFFDF5]/10 rounded-full relative overflow-hidden">
          {/* Progress - purple to cyan gradient */}
          <div className="absolute left-0 top-0 bottom-0 w-[70%] bg-gradient-to-r from-purple-500/50 to-cyan-500/50 rounded-full" />
        </div>
        <span className="text-[7px] text-[#FFFDF5]/40">steps</span>
      </div>
    </div>
  )
}

function SwapVisual() {
  return (
    <div className="flex items-center gap-2">
      {/* Original */}
      <div className="w-5 h-6 rounded-[40%] border border-[#FFFDF5]/20 bg-[#FFFDF5]/10" />
      {/* Arrow - green */}
      <span className="text-green-400/80 text-sm">↔</span>
      {/* Swapped - green tint */}
      <div className="w-5 h-6 rounded-[40%] border border-green-400/50 bg-green-500/25" />
    </div>
  )
}

function RefineVisual() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-6 rounded border border-[#FFFDF5]/15 bg-[#0a0a0a] relative">
        {/* Face with rough edges */}
        <div className="absolute inset-1 rounded-[40%] border border-dashed border-purple-400/50 bg-purple-500/10" />
      </div>
      <div className="text-purple-400/60 text-xs">→</div>
      <div className="w-8 h-6 rounded border border-purple-400/40 bg-[#0a0a0a] relative">
        {/* Face with smooth edges */}
        <div className="absolute inset-1 rounded-[40%] border border-purple-400/60 bg-purple-500/20" />
      </div>
    </div>
  )
}

function EnhanceVisual() {
  return (
    <div className="flex items-center gap-2">
      {/* Before - dim */}
      <div className="w-5 h-6 rounded-[40%] border border-[#FFFDF5]/20 bg-[#FFFDF5]/10 opacity-50" />
      {/* Sparkle - yellow */}
      <span className="text-yellow-400/90 text-sm">✨</span>
      {/* After - bright yellow tint */}
      <div className="w-5 h-6 rounded-[40%] border border-yellow-400/50 bg-yellow-500/25" />
    </div>
  )
}

function OutputVisual() {
  return (
    <div className="w-12 h-10 rounded-lg border-2 border-green-500/50 bg-[#0a0a0a] flex items-center justify-center">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 8l4 4 6-8" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
