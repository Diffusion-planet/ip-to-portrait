'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon, GithubIcon } from '@/components/icons'

interface AboutUsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface TeamMember {
  name: string
  nameKo: string
  role?: string
  github: string
  avatar: string
}

const teamMembers: TeamMember[] = [
  {
    name: 'Jiyeon Hong',
    nameKo: '홍지연',
    role: 'Team Lead',
    github: 'hongjiyeon56',
    avatar: 'https://avatars.githubusercontent.com/hongjiyeon56',
  },
  {
    name: 'Byungkun Lim',
    nameKo: '임병건',
    github: 'byungkun0823',
    avatar: 'https://avatars.githubusercontent.com/byungkun0823',
  },
  {
    name: 'Seongmin Lee',
    nameKo: '이성민',
    github: 'danlee-dev',
    avatar: 'https://avatars.githubusercontent.com/danlee-dev',
  },
  {
    name: 'Seoyeon Choi',
    nameKo: '최서연',
    github: 'seoyeon-eo',
    avatar: 'https://avatars.githubusercontent.com/seoyeon-eo',
  },
]

export function AboutUsModal({ isOpen, onClose }: AboutUsModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="about-modal-glass relative w-full max-w-2xl mx-4 rounded-[24px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">About Diffusion Planet</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#888] hover:text-white hover:bg-white/5 transition-colors"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Project Description */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-white/80">Project</h3>
            <p className="text-sm text-[#888] leading-relaxed">
              Diffusion Planet is an SDXL Inpainting-based face synthesis pipeline that precisely replaces
              only the face region in a background image while preserving 100% of the background.
            </p>
          </div>

          {/* Key Features */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-white/80">Key Features</h3>
            <ul className="space-y-2 text-sm text-[#888]">
              <li className="flex items-start gap-2">
                <span className="text-accent-green mt-0.5">-</span>
                <span>Perfect background preservation with inpainting masks</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent-green mt-0.5">-</span>
                <span>Identity preservation with IP-Adapter FaceID Plus v2</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent-green mt-0.5">-</span>
                <span>Hair style reflection via CLIP image embeddings</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent-green mt-0.5">-</span>
                <span>Precise masking with BiSeNet face parsing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent-green mt-0.5">-</span>
                <span>Auto-prompt generation with Gemini Vision</span>
              </li>
            </ul>
          </div>

          {/* Tech Stack */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-white/80">Tech Stack</h3>
            <div className="flex flex-wrap gap-2">
              {['SDXL Inpainting', 'IP-Adapter', 'InsightFace', 'BiSeNet', 'CLIP ViT-H', 'Gemini Vision'].map((tech) => (
                <span
                  key={tech}
                  className="px-2.5 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-[#aaa]"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Team */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white/80">Team</h3>
            <div className="grid grid-cols-2 gap-3">
              {teamMembers.map((member) => (
                <a
                  key={member.github}
                  href={`https://github.com/${member.github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all group"
                >
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-10 h-10 rounded-full bg-[#2a2a2a]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {member.nameKo}
                      {member.role && (
                        <span className="ml-2 text-xs text-accent-green">({member.role})</span>
                      )}
                    </p>
                    <p className="text-xs text-[#666] truncate flex items-center gap-1">
                      <GithubIcon size={12} />
                      @{member.github}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* License */}
          <div className="pt-4 border-t border-white/5">
            <p className="text-xs text-[#666] text-center">
              Diffusion Planet - MIT License
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
