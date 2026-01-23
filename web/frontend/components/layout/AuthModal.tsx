'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon, MailIcon, LockIcon, UserIcon } from '@/components/icons'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess: (user: { id: string; email: string; name: string }) => void
}

type AuthMode = 'login' | 'signup'

export function AuthModal({ isOpen, onClose, onLoginSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setIsLoading(false)
          return
        }

        const res = await fetch('http://localhost:8008/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.detail || 'Registration failed')
        }

        // Auto login after signup
        setMode('login')
        setError('')
      }

      const res = await fetch('http://localhost:8008/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Login failed')
      }

      const data = await res.json()
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.setItem('token', data.token)
      onLoginSuccess(data.user)
      onClose()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setName('')
    setConfirmPassword('')
    setError('')
  }

  const switchMode = (newMode: AuthMode) => {
    resetForm()
    setMode(newMode)
  }

  if (!isOpen || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - Liquid Glass Effect */}
      <div className="auth-modal-glass relative w-full max-w-md overflow-hidden rounded-[24px]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="text-xl font-semibold text-white">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#888] hover:text-white hover:bg-white/5 transition-colors"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {mode === 'signup' && (
            <div className="space-y-2">
              <label className="text-sm text-[#888]">Name</label>
              <div className="relative">
                <UserIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666]" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="w-full pl-12 pr-4 py-3 rounded-[14px] bg-black/30 border border-[rgba(255,255,255,0.08)] text-white placeholder-[#666] focus:border-[rgba(255,255,255,0.2)] focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm text-[#888]">Email</label>
            <div className="relative">
              <MailIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full pl-12 pr-4 py-3 rounded-[14px] bg-black/30 border border-[rgba(255,255,255,0.08)] text-white placeholder-[#666] focus:border-[rgba(255,255,255,0.2)] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-[#888]">Password</label>
            <div className="relative">
              <LockIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                minLength={6}
                className="w-full pl-12 pr-4 py-3 rounded-[14px] bg-black/30 border border-[rgba(255,255,255,0.08)] text-white placeholder-[#666] focus:border-[rgba(255,255,255,0.2)] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div className="space-y-2">
              <label className="text-sm text-[#888]">Confirm Password</label>
              <div className="relative">
                <LockIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666]" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  required
                  minLength={6}
                  className="w-full pl-12 pr-4 py-3 rounded-[14px] bg-black/30 border border-[rgba(255,255,255,0.08)] text-white placeholder-[#666] focus:border-[rgba(255,255,255,0.2)] focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-[14px] bg-[#22c55e] text-black font-medium hover:brightness-110 active:brightness-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>

          {/* Switch Mode */}
          <div className="text-center text-sm">
            <span className="text-[#666]">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            </span>
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
              className="text-[#22c55e] hover:underline"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
