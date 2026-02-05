'use client'

import React from 'react'

export default function SimplifiedPipelinePage() {
  return (
    <div className="min-h-screen bg-black p-4 flex items-center justify-center">
      {/* Outer cream frame */}
      <div className="relative bg-[#FFFAE4] p-[3px] pt-0">
        {/* Top decorative area */}
        <div className="bg-[#FFFAE4]" style={{ height: '28px', width: '266px' }}>
          <RetroPatternBar />
        </div>

        {/* Inner dark container - 260x303 */}
        <div className="bg-[#0a0a0a] flex flex-col" style={{ width: '260px', height: '303px' }}>
          {/* Title */}
          <div className="text-center pt-1.5 pb-1 shrink-0">
            <h1 className="text-[9px] font-bold text-[#01B14A] tracking-[0.1em] uppercase">
              Face Inpainting Pipeline
            </h1>
            <p className="text-[4px] text-[#FFFAE4]/40 mt-0.5">SDXL + IP-Adapter FaceID Plus v2</p>
          </div>

          {/* Pipeline stages */}
          <div className="flex-1 px-2 flex flex-col gap-[3px]">
            {/* 1. INPUT */}
            <StageBox title="1. INPUT" subtitle="Source Materials">
              <div className="flex items-center justify-center gap-4">
                <InputIcon type="image" label="Reference" sub="배경/포즈" />
                <InputIcon type="face" label="Face" sub="정체성" />
                <InputIcon type="prompt" label="Prompt" sub="Gemini" />
              </div>
            </StageBox>

            <Arrow />

            {/* 2. PREPROCESSING */}
            <StageBox title="2. PREPROCESSING" subtitle="Detection & Embedding">
              <div className="flex items-center justify-center gap-1">
                <ProcessStep label="Detect" model="InsightFace" />
                <span className="text-[5px] text-[#01B14A]/50">→</span>
                <ProcessStep label="Parse" model="BiSeNet" />
                <span className="text-[5px] text-[#01B14A]/50">→</span>
                <ProcessStep label="Mask" />
                <span className="text-[5px] text-[#01B14A]/50">→</span>
                <ProcessStep label="Embed" model="CLIP" />
              </div>
            </StageBox>

            <Arrow />

            {/* 3. GENERATION */}
            <StageBox title="3. GENERATION" subtitle="RealVisXL Diffusion">
              <div className="flex items-center justify-center gap-1">
                <GenElement type="faceid" label="FaceID+v2" />
                <span className="text-[6px] text-[#01B14A]/60 font-bold">+</span>
                <GenElement type="noise" label="Noise" />
                <span className="text-[6px] text-[#01B14A]/60 font-bold">→</span>
                <GenElement type="diffuse" label="Diffuse" />
                <span className="text-[6px] text-[#01B14A]/60 font-bold">=</span>
                <GenElement type="result" label="Output" />
              </div>
            </StageBox>

            <Arrow />

            {/* 4. POST-PROCESSING */}
            <StageBox title="4. POST-PROCESSING" subtitle="Enhance Quality">
              <div className="flex items-center justify-center gap-1.5">
                <PostStep label="Face Swap" model="inswapper" active />
                <span className="text-[5px] text-[#01B14A]/50">→</span>
                <PostStep label="Refine" model="Optional" dim />
                <span className="text-[5px] text-[#01B14A]/50">→</span>
                <PostStep label="Enhance" model="GFPGAN" active />
              </div>
            </StageBox>

            <Arrow />

            {/* 5. OUTPUT */}
            <StageBox title="5. OUTPUT" subtitle="Final Result" highlight>
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 rounded bg-[#01B14A]/20 border border-[#01B14A]/40 flex items-center justify-center">
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-6" stroke="#01B14A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-[4px] text-[#FFFAE4]/70 leading-tight">
                  <div>배경 100% 보존</div>
                  <div>얼굴 정체성 유지</div>
                </div>
              </div>
            </StageBox>
          </div>

          {/* Bottom bar */}
          <div className="shrink-0 px-2 py-1 border-t border-[#FFFAE4]/10 flex justify-between items-center">
            <div className="text-[3px] text-[#FFFAE4]/25 tracking-wider">InsightFace · BiSeNet · CLIP</div>
            <div className="text-[3px] tracking-wider">
              <span className="text-[#01B14A]/50">RealVisXL</span>
              <span className="text-[#FFFAE4]/25"> · GFPGAN</span>
            </div>
          </div>
        </div>

        {/* Bottom cream bar */}
        <div className="bg-[#FFFAE4] h-[3px]" style={{ width: '266px' }} />
      </div>
    </div>
  )
}

// Liquid Glass Stage Box - Compact
function StageBox({ title, subtitle, children, highlight }: {
  title: string
  subtitle: string
  children: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div className={`
      relative overflow-hidden rounded p-1.5
      backdrop-blur-xl
      shadow-[0_2px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,250,228,0.06),inset_0_-1px_1px_rgba(0,0,0,0.1)]
      ${highlight
        ? 'bg-[#01B14A]/10 border border-[#01B14A]/30'
        : 'bg-[#FFFAE4]/[0.04] border border-[#FFFAE4]/[0.12]'}
    `}>
      {/* Top edge shine */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FFFAE4]/25 to-transparent z-10" />

      {/* Gradient glow */}
      <div className="absolute inset-0 pointer-events-none z-[1]" style={{
        background: highlight
          ? 'linear-gradient(135deg, rgba(1,177,74,0.08) 0%, transparent 40%, transparent 60%, rgba(1,177,74,0.02) 100%)'
          : 'linear-gradient(135deg, rgba(255,250,228,0.06) 0%, transparent 40%, transparent 60%, rgba(255,250,228,0.02) 100%)'
      }} />

      {/* Header */}
      <div className="relative z-[2] flex items-center justify-between mb-1">
        <span className="text-[5px] font-bold text-[#FFFAE4]">{title}</span>
        <span className={`text-[4px] ${highlight ? 'text-[#01B14A]/60' : 'text-[#FFFAE4]/30'}`}>{subtitle}</span>
      </div>

      {/* Content */}
      <div className="relative z-[2]">
        {children}
      </div>
    </div>
  )
}

function InputIcon({ type, label, sub }: { type: 'image' | 'face' | 'prompt'; label: string; sub: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-6 h-5 rounded bg-[#FFFAE4]/[0.06] border border-[#FFFAE4]/15 flex items-center justify-center">
        {type === 'image' && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="2" width="10" height="8" rx="1" stroke="#FFFAE4" strokeWidth="0.75" strokeOpacity="0.5" />
            <circle cx="4" cy="5" r="1" fill="#01B14A" fillOpacity="0.6" />
            <path d="M1 9l3-3 2 2 4-4" stroke="#01B14A" strokeWidth="0.75" strokeOpacity="0.5" />
          </svg>
        )}
        {type === 'face' && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <ellipse cx="6" cy="6" rx="4" ry="5" stroke="#FFFAE4" strokeWidth="0.75" strokeOpacity="0.5" />
            <circle cx="4" cy="5" r="0.5" fill="#01B14A" fillOpacity="0.7" />
            <circle cx="8" cy="5" r="0.5" fill="#01B14A" fillOpacity="0.7" />
            <path d="M4.5 8c.5.5 2.5.5 3 0" stroke="#FFFAE4" strokeWidth="0.5" strokeOpacity="0.4" strokeLinecap="round" />
          </svg>
        )}
        {type === 'prompt' && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <rect x="2" y="3" width="8" height="1" rx="0.5" fill="#FFFAE4" fillOpacity="0.4" />
            <rect x="2" y="5.5" width="6" height="1" rx="0.5" fill="#01B14A" fillOpacity="0.5" />
            <rect x="2" y="8" width="4" height="1" rx="0.5" fill="#FFFAE4" fillOpacity="0.25" />
          </svg>
        )}
      </div>
      <span className="text-[4px] text-[#FFFAE4]/70 mt-0.5">{label}</span>
      <span className="text-[3px] text-[#FFFAE4]/30">{sub}</span>
    </div>
  )
}

function ProcessStep({ label, model }: { label: string; model?: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-4 h-4 rounded-full bg-[#FFFAE4]/[0.08] border border-[#FFFAE4]/20 flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-[#01B14A]/50" />
      </div>
      <span className="text-[4px] text-[#FFFAE4]/60 mt-0.5">{label}</span>
      {model && <span className="text-[3px] text-[#FFFAE4]/25">{model}</span>}
    </div>
  )
}

function GenElement({ type, label }: { type: 'faceid' | 'noise' | 'diffuse' | 'result'; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-4 h-4 rounded flex items-center justify-center ${
        type === 'faceid' ? 'rounded-full bg-[#01B14A]/20 border border-[#01B14A]/40' :
        type === 'noise' ? 'bg-[#FFFAE4]/[0.08] border border-[#FFFAE4]/20' :
        type === 'diffuse' ? 'bg-transparent' :
        'bg-[#01B14A]/25 border border-[#01B14A]/50'
      }`}>
        {type === 'faceid' && <div className="w-2 h-2 rounded-full bg-[#01B14A]/60" />}
        {type === 'noise' && (
          <div className="grid grid-cols-2 gap-[1px]">
            {[...Array(4)].map((_, i) => <div key={i} className="w-0.5 h-0.5 bg-[#FFFAE4]/40 rounded-[1px]" />)}
          </div>
        )}
        {type === 'diffuse' && (
          <div className="flex gap-[1px]">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-[1.5px] h-2.5 rounded-full" style={{ backgroundColor: `rgba(1,177,74,${0.3 + i * 0.25})` }} />
            ))}
          </div>
        )}
        {type === 'result' && (
          <svg width="6" height="6" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-6" stroke="#01B14A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-[3px] text-[#FFFAE4]/50 mt-0.5">{label}</span>
    </div>
  )
}

function PostStep({ label, model, active, dim }: { label: string; model?: string; active?: boolean; dim?: boolean }) {
  return (
    <div className={`flex flex-col items-center ${dim ? 'opacity-40' : ''}`}>
      <div className={`relative w-4 h-4 rounded flex items-center justify-center ${
        active ? 'bg-[#01B14A]/15 border border-[#01B14A]/40' : 'bg-[#FFFAE4]/[0.06] border border-dashed border-[#FFFAE4]/15'
      }`}>
        {active && <div className="w-1.5 h-1.5 rounded-full bg-[#01B14A]/60" />}
        {!active && <div className="w-1.5 h-1.5 rounded-full bg-[#FFFAE4]/20" />}
      </div>
      <span className={`text-[4px] mt-0.5 ${active ? 'text-[#01B14A]/70' : 'text-[#FFFAE4]/40'}`}>{label}</span>
      {model && <span className="text-[3px] text-[#FFFAE4]/25">{model}</span>}
    </div>
  )
}

function Arrow() {
  return (
    <div className="flex justify-center shrink-0 py-[1px]">
      <svg width="6" height="6" viewBox="0 0 12 12" fill="none">
        <path d="M6 2v8M3 7l3 3 3-3" stroke="#01B14A" strokeWidth="1" strokeOpacity="0.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function RetroPatternBar() {
  const rows = 5
  const cols = 32
  const dotSize = 3
  const gap = 2
  const startX = 82

  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
  }

  const dots: { x: number; y: number }[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const probability = Math.min(1, (col / cols) * 1.5)
      const rand = seededRandom(row * cols + col + 42)

      if (rand < probability) {
        dots.push({
          x: startX + col * (dotSize + gap),
          y: 4 + row * (dotSize + gap),
        })
      }
    }
  }

  return (
    <svg
      width="100%"
      height="28"
      viewBox="0 0 266 28"
      xmlns="http://www.w3.org/2000/svg"
      style={{ shapeRendering: 'crispEdges' }}
      preserveAspectRatio="xMinYMid slice"
    >
      <g fill="#01B14A">
        {[0, 1, 2].map((i) => (
          <rect key={i} x={6 + i * 14} y={10} width={8} height={8} transform={`rotate(45 ${10 + i * 14} 14)`} />
        ))}
      </g>
      {[0, 1].map((i) => (
        <g key={i} fill="#01B14A">
          <rect x={52 + i * 16} y={6} width={3} height={3} />
          <rect x={52 + i * 16} y={19} width={3} height={3} />
          <rect x={46 + i * 16} y={12} width={3} height={3} />
          <rect x={58 + i * 16} y={12} width={3} height={3} />
        </g>
      ))}
      <g fill="#0a0a0a">
        {dots.map((dot, i) => (
          <rect key={i} x={dot.x} y={dot.y} width={dotSize} height={dotSize} />
        ))}
      </g>
    </svg>
  )
}
