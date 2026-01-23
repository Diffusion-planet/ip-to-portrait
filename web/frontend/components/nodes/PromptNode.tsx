'use client'

import { useState, useEffect } from 'react'
import { NodeBox, Port } from './NodeBox'
import { TextArea, Button, UserLabel, Toggle } from '@/components/ui'
import { SparkleIcon } from '@/components/icons'

interface PromptNodeProps {
  id: string
  type: 'positive' | 'negative'
  value: string
  onChange: (value: string) => void
  onPortClick?: (portId: string, type: 'input' | 'output') => void
  onGenerate?: () => void
  selected?: boolean
  userName?: string
  userColor?: 'yellow' | 'pink' | 'blue' | 'green'
  className?: string
  autoPrompt?: boolean
  onAutoPromptChange?: (value: boolean) => void
  typingText?: string
}

export function PromptNode({
  id,
  type,
  value,
  onChange,
  onPortClick,
  onGenerate,
  selected,
  userName,
  userColor = 'yellow',
  className,
  autoPrompt = false,
  onAutoPromptChange,
  typingText,
}: PromptNodeProps) {
  const isPositive = type === 'positive'
  const [displayText, setDisplayText] = useState(value)
  const [isTyping, setIsTyping] = useState(false)

  // Typing effect when typingText changes
  useEffect(() => {
    if (typingText && typingText !== value) {
      setIsTyping(true)
      setDisplayText('')

      let currentIndex = 0
      const interval = setInterval(() => {
        if (currentIndex < typingText.length) {
          setDisplayText(typingText.slice(0, currentIndex + 1))
          currentIndex++
        } else {
          setIsTyping(false)
          onChange(typingText)
          clearInterval(interval)
        }
      }, 30)

      return () => clearInterval(interval)
    }
  }, [typingText])

  // Update display text when value changes externally (not from typing)
  useEffect(() => {
    if (!isTyping) {
      setDisplayText(value)
    }
  }, [value, isTyping])

  const outputPorts: Port[] = [
    {
      id: type,
      label: type,
      color: isPositive ? 'green' : 'red',
      type: 'output',
    },
  ]

  return (
    <NodeBox
      id={id}
      title={isPositive ? 'Positive' : 'Negative'}
      outputPorts={outputPorts}
      onPortClick={onPortClick}
      selected={selected}
      className={className}
      headerRight={
        isPositive && onGenerate ? (
          <Button
            variant="primary"
            size="sm"
            onClick={onGenerate}
            className="flex items-center gap-1.5"
          >
            <SparkleIcon size={12} />
            Generate
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {isPositive && onAutoPromptChange && (
          <div className="flex items-center justify-between">
            <span className="text-2xl text-text-secondary">Auto Generate</span>
            <Toggle checked={autoPrompt} onChange={onAutoPromptChange} />
          </div>
        )}
        <p className="text-2xl text-text-secondary leading-relaxed">
          {isPositive
            ? 'A black bear with a pink snout, minimalist style, soft gradients, clear blue sky'
            : 'No text, unnecessary details, background objects, other animals or people.'}
        </p>
        <TextArea
          value={displayText}
          onChange={(e) => {
            setDisplayText(e.target.value)
            onChange(e.target.value)
          }}
          placeholder={
            isPositive
              ? autoPrompt
                ? 'Prompt will be auto-generated...'
                : 'Type what you want to get'
              : 'Type what do not you want to get'
          }
          className={`min-h-[120px] text-2xl leading-relaxed ${isTyping ? 'typing-cursor' : ''}`}
          disabled={isPositive && autoPrompt && isTyping}
        />
        {userName && (
          <div className="flex justify-end">
            <UserLabel name={userName} color={userColor} />
          </div>
        )}
      </div>
    </NodeBox>
  )
}
