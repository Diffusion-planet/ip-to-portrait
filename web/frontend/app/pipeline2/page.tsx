'use client'

import React from 'react'

export default function SimplifiedPipelinePage() {
  return (
    <div className="min-h-screen bg-black p-4 flex items-center justify-center">
      {/* Fixed size container - outer cream border */}
      <div className="w-[266px] h-[400px] relative bg-[#FFFAE4] flex flex-col">
        {/* Top decorative area - Retro Pattern Bar */}
        <div className="bg-[#FFFAE4] shrink-0" style={{ height: '28px' }}>
          <RetroPatternBar />
        </div>

        {/* Inner dark container */}
        <div className="flex-1 mx-[3px] bg-[#0a0a0a] flex flex-col overflow-hidden">

          {/* Main content area */}
          <div className="flex-1 flex flex-col px-2 py-1 min-h-0">
            {/* Title - Green color */}
            <h1 className="text-[9px] font-bold text-[#01B14A] text-center mb-1 tracking-[0.15em] uppercase shrink-0">
              Face Inpainting Pipeline
            </h1>

            {/* Vertical Flow - 5 Stages */}
            <div className="flex-1 flex flex-col justify-between min-h-0">
              {/* 1. Input */}
              <PipelineNode title="1. Input" desc="Source Materials">
                <div className="flex items-center justify-center gap-2">
                  <InputIcon type="image" label="Ref" />
                  <InputIcon type="face" label="Face" />
                  <InputIcon type="text" label="Prompt" />
                </div>
              </PipelineNode>

              <VerticalArrow />

              {/* 2. Preprocessing */}
              <PipelineNode title="2. Preprocessing" desc="Detection & Parsing">
                <div className="flex items-center justify-center gap-1">
                  <AnalysisStep icon={<DetectIcon />} label="Detect" model="InsightFace" />
                  <MiniArrow />
                  <AnalysisStep icon={<ParseIcon />} label="Parse" model="BiSeNet" />
                  <MiniArrow />
                  <AnalysisStep icon={<MaskIcon />} label="Mask" />
                </div>
              </PipelineNode>

              <VerticalArrow />

              {/* 3. Generation */}
              <PipelineNode title="3. Generation" desc="IP-Adapter + RealVisXL">
                <div className="flex items-center justify-center gap-1.5">
                  <div className="flex flex-col items-center">
                    <div className="w-4 h-4 rounded-full border border-[#01B14A]/50 bg-[#01B14A]/25 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-[#01B14A]/70" />
                    </div>
                    <span className="text-[4px] text-[#FFFAE4]/80">FaceID+v2</span>
                  </div>
                  <span className="text-[#01B14A]/80 text-[8px] font-bold">+</span>
                  <div className="flex flex-col items-center">
                    <NoiseBox />
                    <span className="text-[4px] text-[#FFFAE4]/80">Noise</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-[2px]">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-[2px] h-2 rounded-full" style={{
                          backgroundColor: `rgba(1,177,74,${0.25 + i * 0.2})`
                        }} />
                      ))}
                    </div>
                    <span className="text-[4px] text-[#FFFAE4]/80">Diffuse</span>
                  </div>
                  <span className="text-[#01B14A]/80 text-[8px] font-bold">=</span>
                  <div className="flex flex-col items-center">
                    <ResultBox />
                    <span className="text-[4px] text-[#FFFAE4]/80">Generated</span>
                  </div>
                </div>
              </PipelineNode>

              <VerticalArrow />

              {/* 4. Post-Processing */}
              <PipelineNode title="4. Post-Processing" desc="Swap + Enhance">
                <div className="flex items-center justify-center gap-1">
                  <AnalysisStep icon={<SwapIcon />} label="Swap" model="InsightFace" />
                  <MiniArrow />
                  <AnalysisStep icon={<RefineIcon />} label="Refine" model="Optional" optional />
                  <MiniArrow />
                  <AnalysisStep icon={<EnhanceIcon />} label="Enhance" model="GFPGAN" />
                </div>
              </PipelineNode>

              <VerticalArrow />

              {/* 5. Output */}
              <PipelineNode title="5. Output" desc="Final Result">
                <div className="flex items-center justify-center">
                  <div className="relative w-7 h-4 rounded border border-[#01B14A]/60 bg-[#01B14A]/20 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#01B14A]/30 to-transparent" />
                    <div className="absolute bottom-0 right-0.5">
                      <svg width="7" height="7" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-6" stroke="#01B14A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>
              </PipelineNode>
            </div>
          </div>

        </div>

        {/* Bottom section - thin bar with model names */}
        <div className="bg-[#FFFAE4] mx-[3px] mb-[3px] px-2 py-[2px] shrink-0">
          <div className="flex items-center justify-center gap-[4px]">
            <span className="text-[4px] text-[#0a0a0a] font-bold tracking-wide">INSIGHTFACE</span>
            <span className="text-[3px] text-[#0a0a0a]/30">|</span>
            <span className="text-[4px] text-[#0a0a0a] font-bold tracking-wide">BISENET</span>
            <span className="text-[3px] text-[#0a0a0a]/30">|</span>
            <span className="text-[4px] text-[#0a0a0a] font-bold tracking-wide">IP-ADAPTER</span>
            <span className="text-[3px] text-[#0a0a0a]/30">|</span>
            <span className="text-[4px] text-[#0a0a0a] font-bold tracking-wide">REALVISXL</span>
            <span className="text-[3px] text-[#0a0a0a]/30">|</span>
            <span className="text-[4px] text-[#0a0a0a] font-bold tracking-wide">GFPGAN</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PipelineNode({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-[#FFFAE4]/[0.04] border border-[#FFFAE4]/[0.1] backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,250,228,0.08),inset_0_-1px_1px_rgba(0,0,0,0.1)]">
      {/* Top edge shine */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FFFAE4]/30 to-transparent z-10" />

      {/* Subtle linear gradient */}
      <div className="absolute inset-0 pointer-events-none z-[1]" style={{
        background: 'linear-gradient(135deg, rgba(255,250,228,0.1) 0%, transparent 40%, transparent 60%, rgba(255,250,228,0.03) 100%)'
      }} />

      <div className="relative z-[2] px-1.5 py-0.5">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[7px] text-[#FFFAE4] font-bold">{title}</span>
          <span className="text-[5px] text-[#FFFAE4]/50">{desc}</span>
        </div>
        {children}
      </div>
    </div>
  )
}

function InputIcon({ type, label }: { type: 'image' | 'face' | 'text'; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-6 h-5 rounded border border-[#FFFAE4]/30 bg-[#FFFAE4]/10 flex items-center justify-center overflow-hidden">
        {type === 'image' && (
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            {/* Landscape */}
            <rect x="0" y="6" width="16" height="6" fill="rgba(255,250,228,0.25)" />
            {/* Sun - green accent */}
            <circle cx="12" cy="3" r="2" fill="rgba(1,177,74,0.7)" />
          </svg>
        )}
        {type === 'face' && (
          <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
            <ellipse cx="6" cy="7" rx="4" ry="5" fill="rgba(255,250,228,0.15)" stroke="rgba(255,250,228,0.4)" strokeWidth="0.5" />
            {/* Eyes - green */}
            <circle cx="4" cy="6" r="0.8" fill="rgba(1,177,74,0.9)" />
            <circle cx="8" cy="6" r="0.8" fill="rgba(1,177,74,0.9)" />
          </svg>
        )}
        {type === 'text' && (
          <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
            {/* Text lines */}
            <rect x="1" y="2" width="12" height="1.5" rx="0.75" fill="rgba(255,250,228,0.5)" />
            <rect x="1" y="5" width="8" height="1.5" rx="0.75" fill="rgba(255,250,228,0.35)" />
          </svg>
        )}
      </div>
      <span className="text-[5px] text-[#FFFAE4]/80 font-medium">{label}</span>
    </div>
  )
}

function AnalysisStep({ icon, label, model, optional }: { icon: React.ReactNode; label: string; model?: string; optional?: boolean }) {
  return (
    <div className={`flex flex-col items-center ${optional ? 'opacity-60' : ''}`}>
      <div className={`w-5 h-5 rounded border bg-[#FFFAE4]/10 flex items-center justify-center overflow-hidden ${optional ? 'border-dashed border-[#FFFAE4]/20' : 'border-[#FFFAE4]/25'}`}>
        {icon}
      </div>
      <span className="text-[5px] text-[#FFFAE4]/80">{label}</span>
      {model && <span className="text-[3px] text-[#FFFAE4]/40">{model}</span>}
    </div>
  )
}

function DetectIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="block">
      {/* Face oval */}
      <ellipse cx="6" cy="6" rx="2.5" ry="3" fill="rgba(255,250,228,0.3)" />
      {/* Corner brackets - green */}
      <path d="M1.5 1.5 L1.5 3.5 M1.5 1.5 L3.5 1.5" stroke="rgba(1,177,74,0.9)" strokeWidth="1" strokeLinecap="round" />
      <path d="M10.5 1.5 L10.5 3.5 M10.5 1.5 L8.5 1.5" stroke="rgba(1,177,74,0.9)" strokeWidth="1" strokeLinecap="round" />
      <path d="M1.5 10.5 L1.5 8.5 M1.5 10.5 L3.5 10.5" stroke="rgba(1,177,74,0.9)" strokeWidth="1" strokeLinecap="round" />
      <path d="M10.5 10.5 L10.5 8.5 M10.5 10.5 L8.5 10.5" stroke="rgba(1,177,74,0.9)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

function ParseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="block">
      {/* Hair region - cream */}
      <path d="M3 5 Q3 1.5 6 1.5 Q9 1.5 9 5" fill="rgba(255,250,228,0.5)" />
      {/* Face region - lighter cream */}
      <ellipse cx="6" cy="7" rx="3" ry="3.5" fill="rgba(255,250,228,0.3)" />
    </svg>
  )
}

function MaskIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="block">
      {/* Dark background */}
      <rect x="1" y="1" width="10" height="10" rx="1" fill="#0a0a0a" stroke="rgba(255,250,228,0.3)" strokeWidth="0.5" />
      {/* White mask shape */}
      <ellipse cx="6" cy="6" rx="2.5" ry="3" fill="rgba(255,250,228,0.9)" />
    </svg>
  )
}

function SwapIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="block">
      {/* Original face */}
      <ellipse cx="3.5" cy="6" rx="2" ry="2.5" fill="rgba(255,250,228,0.2)" stroke="rgba(255,250,228,0.4)" strokeWidth="0.5" />
      {/* Swapped face - green tint */}
      <ellipse cx="8.5" cy="6" rx="2" ry="2.5" fill="rgba(1,177,74,0.25)" stroke="rgba(1,177,74,0.6)" strokeWidth="0.5" />
      {/* Swap arrows - green */}
      <path d="M5 4 L7 4" stroke="rgba(1,177,74,0.9)" strokeWidth="0.8" />
      <path d="M7 8 L5 8" stroke="rgba(1,177,74,0.9)" strokeWidth="0.8" />
    </svg>
  )
}

function RefineIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="block">
      {/* Dashed border rectangle */}
      <rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="none" stroke="rgba(255,250,228,0.5)" strokeWidth="0.8" strokeDasharray="1.5 1" />
      {/* Inner face shape */}
      <ellipse cx="6" cy="6" rx="2" ry="2.5" fill="rgba(255,250,228,0.2)" />
    </svg>
  )
}

function EnhanceIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="block">
      {/* Sparkle effect - green */}
      <path d="M6 1.5 L6 3.5 M6 8.5 L6 10.5" stroke="rgba(1,177,74,0.8)" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M1.5 6 L3.5 6 M8.5 6 L10.5 6" stroke="rgba(1,177,74,0.8)" strokeWidth="0.8" strokeLinecap="round" />
      {/* Center glow */}
      <circle cx="6" cy="6" r="2" fill="rgba(1,177,74,0.35)" />
      {/* Corner sparkles */}
      <circle cx="3" cy="3" r="0.5" fill="rgba(1,177,74,0.7)" />
      <circle cx="9" cy="3" r="0.5" fill="rgba(1,177,74,0.7)" />
      <circle cx="3" cy="9" r="0.5" fill="rgba(1,177,74,0.7)" />
      <circle cx="9" cy="9" r="0.5" fill="rgba(1,177,74,0.7)" />
    </svg>
  )
}

function MiniArrow() {
  return <span className="text-[8px] text-[#FFFAE4]/80 font-bold">→</span>
}

function NoiseBox() {
  return (
    <div className="w-5 h-5 rounded border border-[#FFFAE4]/30 bg-[#FFFAE4]/10 flex items-center justify-center">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        {[0, 1, 2].map(row =>
          [0, 1, 2].map(col => (
            <circle
              key={`${row}-${col}`}
              cx={2 + col * 4}
              cy={2 + row * 4}
              r="1"
              fill="rgba(255,250,228,0.6)"
            />
          ))
        )}
      </svg>
    </div>
  )
}

function ResultBox() {
  return (
    <div className="w-5 h-5 rounded border border-[#01B14A]/50 bg-gradient-to-br from-[#01B14A]/30 to-[#01B14A]/15 flex items-center justify-center overflow-hidden">
      <div className="w-full h-full bg-gradient-to-br from-[#01B14A]/20 to-transparent" />
    </div>
  )
}

function RetroPatternBar() {
  // 점 그리드 생성 - 오른쪽으로 갈수록 점 개수가 줄어듦 (랜덤하게 빠짐)
  const rows = 5
  const cols = 32
  const dotSize = 3
  const gap = 2
  const startX = 82 // 다이아몬드, 크로스 패턴 이후 시작점

  // seeded random for consistent rendering
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
  }

  const dots: { x: number; y: number }[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // 오른쪽으로 갈수록 점이 나타날 확률이 높아짐 (흰색 영역 감소)
      const probability = Math.min(1, (col / cols) * 1.5) // 왼쪽: 점 적음(흰색 많음), 오른쪽: 점 많음(흰색 적음)
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
      viewBox="0 0 260 28"
      xmlns="http://www.w3.org/2000/svg"
      style={{ shapeRendering: 'crispEdges' }}
      preserveAspectRatio="xMinYMid slice"
    >
      {/* 1. Diamonds (3개) - green color */}
      <g fill="#01B14A">
        {[0, 1, 2].map((i) => (
          <rect key={i} x={6 + i * 14} y={10} width={8} height={8} transform={`rotate(45 ${10 + i * 14} 14)`} />
        ))}
      </g>

      {/* 2. Cross/Plus patterns (2개) - green color */}
      {[0, 1].map((i) => (
        <g key={i} fill="#01B14A">
          <rect x={52 + i * 16} y={6} width={3} height={3} />
          <rect x={52 + i * 16} y={19} width={3} height={3} />
          <rect x={46 + i * 16} y={12} width={3} height={3} />
          <rect x={58 + i * 16} y={12} width={3} height={3} />
        </g>
      ))}

      {/* 3. 점 그리드 - dark color on cream background */}
      <g fill="#0a0a0a">
        {dots.map((dot, i) => (
          <rect key={i} x={dot.x} y={dot.y} width={dotSize} height={dotSize} />
        ))}
      </g>
    </svg>
  )
}

function VerticalArrow() {
  return (
    <div className="flex justify-center">
      <div className="flex flex-col items-center">
        <div className="w-[1px] h-1 bg-[#FFFAE4]/40" />
        <div className="w-0 h-0 border-l-[2px] border-r-[2px] border-t-[3px] border-l-transparent border-r-transparent border-t-[#FFFAE4]/40" />
      </div>
    </div>
  )
}
