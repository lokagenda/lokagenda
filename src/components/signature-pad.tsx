'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'

interface SignaturePadProps {
  onSave: (dataUrl: string) => void
  width?: number
  height?: number
  label?: string
}

export function SignaturePad({
  onSave,
  width = 400,
  height = 200,
  label = 'Assinatura',
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [savedImage, setSavedImage] = useState<string | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width, height })

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const containerWidth = container.clientWidth
    const scaledWidth = Math.min(width, containerWidth - 2)
    const scaledHeight = Math.round((scaledWidth / width) * height)

    setCanvasSize({ width: scaledWidth, height: scaledHeight })

    const dpr = window.devicePixelRatio || 1
    canvas.width = scaledWidth * dpr
    canvas.height = scaledHeight * dpr
    canvas.style.width = `${scaledWidth}px`
    canvas.style.height = `${scaledHeight}px`

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 2
      ctx.strokeStyle = '#000'
    }
  }, [width, height])

  useEffect(() => {
    setupCanvas()

    const handleResize = () => setupCanvas()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [setupCanvas])

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0]
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    setHasContent(true)
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  function stopDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    setIsDrawing(false)
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasContent(false)
    setSavedImage(null)
  }

  function saveSignature() {
    const canvas = canvasRef.current
    if (!canvas) return

    const dataUrl = canvas.toDataURL('image/png')
    setSavedImage(dataUrl)
    onSave(dataUrl)
  }

  if (savedImage) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
        <div className="rounded-lg border border-green-300 bg-white p-2 dark:border-green-700 dark:bg-zinc-900">
          <img
            src={savedImage}
            alt={label}
            className="mx-auto"
            style={{ maxWidth: canvasSize.width, maxHeight: canvasSize.height }}
          />
        </div>
        <Button variant="outline" size="sm" onClick={clearCanvas}>
          Refazer Assinatura
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <canvas
        ref={canvasRef}
        className="cursor-crosshair rounded-lg border border-zinc-300 bg-white touch-none dark:border-zinc-700 dark:bg-zinc-950"
        style={{ width: canvasSize.width, height: canvasSize.height }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Desenhe sua assinatura acima
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clearCanvas} disabled={!hasContent}>
          Limpar
        </Button>
        <Button size="sm" onClick={saveSignature} disabled={!hasContent}>
          Salvar
        </Button>
      </div>
    </div>
  )
}
