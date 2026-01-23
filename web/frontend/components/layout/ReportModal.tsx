'use client'

import { useState } from 'react'
import { CloseIcon, DownloadIcon, CopyIcon, ShareIcon } from '@/components/icons'
import jsPDF from 'jspdf'

interface ReportData {
  faceImageUrl?: string
  referenceImageUrl?: string
  resultUrls: string[]
  prompt: string
  params: {
    seed: number
    steps: number
    guidanceScale: number
    denoiseStrength: number
    faceStrength: number
    stopAt: number
    maskBlur: number
    maskExpand: number
    maskPadding: number
    includeHair: boolean
    includeNeck: boolean
    adapterMode: string
    faceBlendWeight?: number
    hairBlendWeight?: number
  }
  generatedAt?: Date
}

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  data: ReportData
}

// Helper to load image as base64 with dimensions
interface ImageData {
  data: string
  width: number
  height: number
  aspectRatio: number
}

const loadImageAsBase64 = (url: string): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        resolve({
          data: canvas.toDataURL('image/jpeg', 0.85),
          width: img.width,
          height: img.height,
          aspectRatio: img.width / img.height,
        })
      } else {
        reject(new Error('Failed to get canvas context'))
      }
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}

// Format date in English
const formatDateEnglish = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }
  return date.toLocaleString('en-US', options)
}

export function ReportModal({ isOpen, onClose, data }: ReportModalProps) {
  const [isExporting, setIsExporting] = useState(false)

  if (!isOpen) return null

  const formatParam = (key: string, value: any) => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') return value.toFixed(2).replace(/\.?0+$/, '')
    return value
  }

  const paramLabels: Record<string, string> = {
    seed: 'Seed',
    steps: 'Steps',
    guidanceScale: 'CFG Scale',
    denoiseStrength: 'Denoise Strength',
    faceStrength: 'Face Strength',
    stopAt: 'Stop At',
    maskBlur: 'Mask Blur',
    maskExpand: 'Mask Expand',
    maskPadding: 'Mask Padding',
    includeHair: 'Include Hair',
    includeNeck: 'Include Neck',
    adapterMode: 'Adapter Mode',
    faceBlendWeight: 'Face Blend Weight',
    hairBlendWeight: 'Hair Blend Weight',
  }

  const handleCopyText = () => {
    const command = generateCLICommand()
    navigator.clipboard.writeText(command)
  }

  const generateCLICommand = () => {
    const params = data.params
    const args: string[] = ['python inpainting-pipeline.py']

    // Positional arguments (using placeholders since we don't have actual paths)
    args.push('<background_image>')
    args.push('<face_image>')

    // Prompt
    if (data.prompt) {
      // Escape quotes in prompt
      const escapedPrompt = data.prompt.replace(/"/g, '\\"')
      args.push(`--prompt "${escapedPrompt}"`)
    }

    // Numeric parameters
    if (params.faceStrength !== 0.85) {
      args.push(`--face-strength ${params.faceStrength}`)
    }
    if (params.denoiseStrength !== 0.92) {
      args.push(`--denoising ${params.denoiseStrength}`)
    }
    if (params.steps !== 50) {
      args.push(`--steps ${params.steps}`)
    }
    if (params.guidanceScale !== 7.5) {
      args.push(`--guidance ${params.guidanceScale}`)
    }
    if (params.maskExpand !== 0.3) {
      args.push(`--mask-expand ${params.maskExpand}`)
    }
    if (params.maskBlur !== 15) {
      args.push(`--mask-blur ${params.maskBlur}`)
    }
    if (params.maskPadding !== 0) {
      args.push(`--mask-padding ${params.maskPadding}`)
    }

    // Seed
    if (params.seed && params.seed !== -1) {
      args.push(`--seed ${params.seed}`)
    }

    // Adapter mode flags
    if (params.adapterMode === 'faceid') {
      args.push('--use-faceid')
    } else if (params.adapterMode === 'faceid_plus') {
      args.push('--use-faceid-plus')
    } else if (params.adapterMode === 'clip_blend') {
      args.push('--use-clip-blend')
      if (params.faceBlendWeight && params.faceBlendWeight !== 0.6) {
        args.push(`--face-blend-weight ${params.faceBlendWeight}`)
      }
      if (params.hairBlendWeight && params.hairBlendWeight !== 0.4) {
        args.push(`--hair-blend-weight ${params.hairBlendWeight}`)
      }
    }

    // FaceID stop-at
    if ((params.adapterMode === 'faceid' || params.adapterMode === 'faceid_plus') && params.stopAt !== 1.0) {
      args.push(`--stop-at ${params.stopAt}`)
    }

    // Mask options
    if (!params.includeHair) {
      args.push('--no-hair')
    }
    if (params.includeNeck) {
      args.push('--include-neck')
    }

    return args.join(' \\\n  ')
  }

  const generateTextReport = () => {
    const lines = [
      '=== Face Inpainting Report ===',
      '',
      `Generated: ${data.generatedAt?.toLocaleString() || new Date().toLocaleString()}`,
      '',
      '--- Prompt ---',
      data.prompt || '(No prompt)',
      '',
      '--- Parameters ---',
      ...Object.entries(data.params).map(([key, value]) =>
        `${paramLabels[key] || key}: ${formatParam(key, value)}`
      ),
      '',
      '--- Results ---',
      `Total outputs: ${data.resultUrls.length}`,
    ]
    return lines.join('\n')
  }

  const handleShare = async () => {
    const text = generateTextReport()
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Face Inpainting Report',
          text: text,
        })
      } catch (e) {
        handleCopyText()
      }
    } else {
      handleCopyText()
    }
  }

  const handleDownloadPDF = async () => {
    if (isExporting) return

    setIsExporting(true)
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      const contentWidth = pageWidth - margin * 2
      let yPos = margin

      // Colors
      const titleColor: [number, number, number] = [40, 40, 40]
      const textColor: [number, number, number] = [60, 60, 60]
      const labelColor: [number, number, number] = [120, 120, 120]
      const lineColor: [number, number, number] = [220, 220, 220]

      // Helper function to check page break
      const checkPageBreak = (requiredHeight: number) => {
        if (yPos + requiredHeight > pageHeight - margin) {
          pdf.addPage()
          yPos = margin
          return true
        }
        return false
      }

      // Title
      pdf.setFontSize(24)
      pdf.setTextColor(...titleColor)
      pdf.text('Face Inpainting Report', margin, yPos)
      yPos += 10

      // Subtitle / Date
      pdf.setFontSize(10)
      pdf.setTextColor(...labelColor)
      const dateStr = formatDateEnglish(data.generatedAt || new Date())
      pdf.text(`Generated: ${dateStr}`, margin, yPos)
      yPos += 15

      // Divider
      pdf.setDrawColor(...lineColor)
      pdf.line(margin, yPos, pageWidth - margin, yPos)
      yPos += 10

      // Input Images Section
      pdf.setFontSize(14)
      pdf.setTextColor(...titleColor)
      pdf.text('Input Images', margin, yPos)
      yPos += 8

      const inputImageHeight = 45
      let inputImagesX = margin

      // Load and add face image
      if (data.faceImageUrl) {
        try {
          const faceImg = await loadImageAsBase64(data.faceImageUrl)
          const faceWidth = inputImageHeight * faceImg.aspectRatio
          pdf.addImage(faceImg.data, 'JPEG', inputImagesX, yPos, faceWidth, inputImageHeight)

          // Label
          pdf.setFontSize(9)
          pdf.setTextColor(...labelColor)
          pdf.text('Face Image', inputImagesX + faceWidth / 2, yPos + inputImageHeight + 5, { align: 'center' })

          inputImagesX += faceWidth + 10
        } catch (e) {
          console.error('Failed to load face image:', e)
        }
      }

      // Load and add reference image
      if (data.referenceImageUrl) {
        try {
          const refImg = await loadImageAsBase64(data.referenceImageUrl)
          const refWidth = inputImageHeight * refImg.aspectRatio
          pdf.addImage(refImg.data, 'JPEG', inputImagesX, yPos, refWidth, inputImageHeight)

          // Label
          pdf.setFontSize(9)
          pdf.setTextColor(...labelColor)
          pdf.text('Reference Image', inputImagesX + refWidth / 2, yPos + inputImageHeight + 5, { align: 'center' })
        } catch (e) {
          console.error('Failed to load reference image:', e)
        }
      }

      yPos += inputImageHeight + 15

      // Prompt Section
      checkPageBreak(40)
      pdf.setFontSize(14)
      pdf.setTextColor(...titleColor)
      pdf.text('Prompt', margin, yPos)
      yPos += 8

      // Prompt box
      pdf.setFillColor(248, 248, 248)
      const promptText = data.prompt || '(No prompt provided)'
      const promptLines = pdf.splitTextToSize(promptText, contentWidth - 10)
      const promptBoxHeight = Math.max(promptLines.length * 5 + 10, 20)

      pdf.roundedRect(margin, yPos, contentWidth, promptBoxHeight, 2, 2, 'F')

      pdf.setFontSize(10)
      pdf.setTextColor(...textColor)
      pdf.text(promptLines, margin + 5, yPos + 7)
      yPos += promptBoxHeight + 10

      // Parameters Section
      checkPageBreak(60)
      pdf.setFontSize(14)
      pdf.setTextColor(...titleColor)
      pdf.text('Parameters', margin, yPos)
      yPos += 8

      // Parameters table
      pdf.setFillColor(248, 248, 248)
      const paramEntries = Object.entries(data.params)
      const colWidth = contentWidth / 3
      const rowHeight = 8
      const totalRows = Math.ceil(paramEntries.length / 3)
      const tableHeight = totalRows * rowHeight + 6

      pdf.roundedRect(margin, yPos, contentWidth, tableHeight, 2, 2, 'F')

      pdf.setFontSize(9)
      paramEntries.forEach(([key, value], index) => {
        const col = index % 3
        const row = Math.floor(index / 3)
        const x = margin + 5 + col * colWidth
        const y = yPos + 6 + row * rowHeight

        // Label
        pdf.setTextColor(...labelColor)
        pdf.text(paramLabels[key] || key, x, y)

        // Value
        pdf.setTextColor(...textColor)
        pdf.text(String(formatParam(key, value)), x + colWidth - 25, y)
      })
      yPos += tableHeight + 15

      // Output Images Section
      if (data.resultUrls.length > 0) {
        checkPageBreak(30)
        pdf.setFontSize(14)
        pdf.setTextColor(...titleColor)
        pdf.text(`Output Images (${data.resultUrls.length})`, margin, yPos)
        yPos += 10

        const outputImageHeight = 55
        const imageGap = 8

        // Load all images first to get their dimensions
        const loadedImages: (ImageData | null)[] = []
        for (const url of data.resultUrls) {
          try {
            const img = await loadImageAsBase64(url)
            loadedImages.push(img)
          } catch (e) {
            console.error('Failed to load output image:', e)
            loadedImages.push(null)
          }
        }

        // Render images row by row
        let currentX = margin
        let rowStartIndex = 0

        for (let i = 0; i < loadedImages.length; i++) {
          const img = loadedImages[i]
          const imgWidth = img ? outputImageHeight * img.aspectRatio : outputImageHeight

          // Check if this image fits in current row
          if (currentX + imgWidth > pageWidth - margin && i > rowStartIndex) {
            // Move to next row
            yPos += outputImageHeight + 12
            currentX = margin
            rowStartIndex = i
            checkPageBreak(outputImageHeight + 15)
          }

          if (img) {
            pdf.addImage(img.data, 'JPEG', currentX, yPos, imgWidth, outputImageHeight)

            // Number label
            pdf.setFontSize(8)
            pdf.setTextColor(...labelColor)
            pdf.text(`#${i + 1}`, currentX + imgWidth / 2, yPos + outputImageHeight + 4, { align: 'center' })
          } else {
            // Draw placeholder
            pdf.setDrawColor(...lineColor)
            pdf.rect(currentX, yPos, imgWidth, outputImageHeight)
            pdf.setFontSize(8)
            pdf.setTextColor(...labelColor)
            pdf.text('Failed', currentX + imgWidth / 2, yPos + outputImageHeight / 2, { align: 'center' })
          }

          currentX += imgWidth + imageGap
        }

        // Account for last row
        yPos += outputImageHeight + 15
      }

      // Footer
      checkPageBreak(20)
      pdf.setDrawColor(...lineColor)
      pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)

      pdf.setFontSize(8)
      pdf.setTextColor(...labelColor)
      pdf.text('Generated with Face Inpainting Pipeline', pageWidth / 2, pageHeight - 10, { align: 'center' })

      // Save PDF
      pdf.save(`face-inpainting-report-${Date.now()}.pdf`)
    } catch (error) {
      console.error('Failed to export PDF:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - Liquid Glass Effect */}
      <div className="report-modal-glass relative w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col rounded-[24px]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 relative z-10">
          <h2 className="text-lg font-medium text-white">Generation Report</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="p-2 rounded-lg text-[#888] hover:text-white hover:bg-white/5 transition-colors"
              title="Copy as Text"
            >
              <CopyIcon size={18} />
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className={`p-2 rounded-lg transition-colors ${
                isExporting
                  ? 'text-[#444] cursor-wait'
                  : 'text-[#888] hover:text-white hover:bg-white/5'
              }`}
              title="Download PDF"
            >
              <DownloadIcon size={18} />
            </button>
            <button
              onClick={handleShare}
              className="p-2 rounded-lg text-[#888] hover:text-white hover:bg-white/5 transition-colors"
              title="Share"
            >
              <ShareIcon size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[#888] hover:text-white hover:bg-white/5 transition-colors"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 relative z-10">
          {/* Title for PDF */}
          <h1 className="text-xl font-bold text-white mb-2">Face Inpainting Report</h1>
          <p className="text-xs text-[#666] mb-6">
            {data.generatedAt?.toLocaleString() || new Date().toLocaleString()}
          </p>

          {/* Input Images */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-[#888] mb-3">Input Images</h3>
            <div className="flex gap-4">
              {data.faceImageUrl && (
                <div className="flex flex-col items-center">
                  <img
                    src={data.faceImageUrl}
                    alt="Face"
                    className="w-32 h-32 object-cover rounded-lg border border-white/10"
                    crossOrigin="anonymous"
                  />
                  <span className="text-xs text-[#666] mt-2">Face</span>
                </div>
              )}
              {data.referenceImageUrl && (
                <div className="flex flex-col items-center">
                  <img
                    src={data.referenceImageUrl}
                    alt="Reference"
                    className="w-32 h-32 object-cover rounded-lg border border-white/10"
                    crossOrigin="anonymous"
                  />
                  <span className="text-xs text-[#666] mt-2">Reference</span>
                </div>
              )}
            </div>
          </section>

          {/* Prompt */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-[#888] mb-3">Prompt</h3>
            <div className="bg-[#242424] rounded-lg p-4 border border-white/5">
              <p className="text-sm text-[#ccc] whitespace-pre-wrap">
                {data.prompt || '(No prompt provided)'}
              </p>
            </div>
          </section>

          {/* Parameters */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-[#888] mb-3">Parameters</h3>
            <div className="bg-[#242424] rounded-lg p-4 border border-white/5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(data.params).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-xs text-[#666]">{paramLabels[key] || key}</span>
                    <span className="text-xs text-[#ccc] font-mono">
                      {formatParam(key, value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Output Images */}
          {data.resultUrls.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-[#888] mb-3">
                Output Images ({data.resultUrls.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {data.resultUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Result ${index + 1}`}
                      className="w-full aspect-square object-cover rounded-lg border border-white/10"
                      crossOrigin="anonymous"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
                      #{index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 text-center relative z-10">
          <p className="text-xs text-[#555]">
            Generated with Face Inpainting Pipeline
          </p>
        </div>
      </div>

      {/* Loading overlay */}
      {isExporting && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
          <div className="bg-[#242424] rounded-lg px-6 py-4 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-white text-sm">Generating PDF...</span>
          </div>
        </div>
      )}
    </div>
  )
}
