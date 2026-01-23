'use client'

import { useState, useEffect, useRef } from 'react'
import {
  PlayIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  MoreDotsIcon,
  UserIcon,
  LogoutIcon,
} from '@/components/icons'
import { AuthModal } from './AuthModal'
import { AboutUsModal } from './AboutUsModal'

interface User {
  id: string
  email: string
  name: string
}

interface TopBarProps {
  projectName?: string
  onMenuClick?: () => void
  onShare?: () => void
  onMakePublic?: () => void
  isConnected?: boolean
  onProjectNameChange?: (name: string) => void
  onReset?: () => void
  onHistoryPrevious?: () => void
  onHistoryNext?: () => void
  canGoPrevious?: boolean
  canGoNext?: boolean
  onGenerate?: () => void
  canGenerate?: boolean
  isGenerating?: boolean
}

export function TopBar({
  projectName = 'Black bear',
  onMenuClick,
  onShare,
  onMakePublic,
  isConnected = false,
  onProjectNameChange,
  onReset,
  onHistoryPrevious,
  onHistoryNext,
  canGoPrevious = false,
  canGoNext = false,
  onGenerate,
  canGenerate = false,
  isGenerating = false,
}: TopBarProps) {
  const [activeMenu, setActiveMenu] = useState('workflow')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState(projectName)
  const [user, setUser] = useState<User | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setEditName(projectName)
  }, [projectName])

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (e) {
        localStorage.removeItem('user')
      }
    }
  }, [])

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:8008/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (e) {
      // Ignore errors
    }
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    setUser(null)
    setShowUserMenu(false)
  }

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser)
    setShowAuthModal(false)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <header className="relative h-14 px-4 flex items-center justify-between bg-transparent">
      {/* Left Section */}
      <div className="flex items-center gap-8">
        {/* Logo */}
        <div className="w-8 h-8 flex items-center justify-center">
          <img src="/logo.svg" alt="Diffusion Planet" className="w-full h-full object-contain" />
        </div>

        {/* Navigation Menu */}
        <nav className="flex items-center gap-6">
          {['Workflow', 'About Us'].map((item) => (
            <button
              key={item}
              className={`text-sm transition-colors ${
                activeMenu === item.toLowerCase().replace(' ', '-')
                  ? 'text-white'
                  : 'text-[#888] hover:text-white'
              }`}
              onClick={() => {
                if (item === 'About Us') {
                  setShowAboutModal(true)
                } else {
                  setActiveMenu(item.toLowerCase().replace(' ', '-'))
                }
              }}
            >
              {item}
            </button>
          ))}
        </nav>
      </div>

      {/* Center Section - Project Tab */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <button
          onClick={onHistoryPrevious}
          disabled={!canGoPrevious}
          className="p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Previous history"
        >
          <ChevronLeftIcon size={16} />
        </button>

        <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)]">
          {isEditingName ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => {
                setIsEditingName(false)
                if (editName.trim() && editName !== projectName) {
                  onProjectNameChange?.(editName.trim())
                } else {
                  setEditName(projectName)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingName(false)
                  if (editName.trim() && editName !== projectName) {
                    onProjectNameChange?.(editName.trim())
                  } else {
                    setEditName(projectName)
                  }
                } else if (e.key === 'Escape') {
                  setIsEditingName(false)
                  setEditName(projectName)
                }
              }}
              autoFocus
              className="text-sm text-white bg-transparent outline-none border-none w-[200px]"
            />
          ) : (
            <span
              className="text-sm text-white cursor-text"
              onClick={() => setIsEditingName(true)}
            >
              {projectName}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setEditName('')
              setIsEditingName(true)
            }}
            className="p-0.5 rounded hover:bg-white/10 text-[#666] hover:text-white transition-colors"
            title="Clear title"
          >
            <CloseIcon size={12} />
          </button>
        </div>

        <button
          onClick={onHistoryNext}
          disabled={!canGoNext}
          className="p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next history"
        >
          <ChevronRightIcon size={16} />
        </button>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Connection Status */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
          isConnected ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-accent-green' : 'bg-accent-red'}`} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>

        {/* More Options */}
        <button className="p-2 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors">
          <MoreDotsIcon size={16} />
        </button>

        {/* Queue Button */}
        <button
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={isGenerating ? 'Generating...' : canGenerate ? 'Start generation' : 'Upload images first'}
        >
          <PlayIcon size={14} className={isGenerating ? 'text-[#666]' : 'text-accent-green'} />
          <span className="text-sm">{isGenerating ? 'Running...' : 'Queue'}</span>
          <ChevronDownIcon size={14} className="text-[#666]" />
        </button>

        {/* User Profile */}
        <div className="relative" ref={userMenuRef}>
          {user ? (
            <>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="profile-avatar-glass w-9 h-9 rounded-full flex items-center justify-center text-white/90 text-sm font-medium transition-all"
                title={user.name}
              >
                <span className="relative z-10">{getInitials(user.name)}</span>
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <>
                  {/* Invisible backdrop to catch outside clicks */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="user-menu-glass absolute top-full right-0 mt-2 w-56 rounded-[16px] overflow-hidden z-50">
                    <div className="p-4 border-b border-white/10">
                      <p className="text-sm font-medium text-white truncate">{user.name}</p>
                      <p className="text-xs text-[#888] truncate">{user.email}</p>
                    </div>
                    <div className="p-2">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#888] hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <LogoutIcon size={16} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#888] hover:text-white hover:border-[rgba(255,255,255,0.15)] transition-all"
              title="Sign In"
            >
              <UserIcon size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* About Us Modal */}
      <AboutUsModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
    </header>
  )
}
