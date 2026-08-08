'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Pencil, Type, Trash2, Eraser, Minus, Save, Loader2 } from 'lucide-react'

interface Stroke {
  points: { x: number; y: number; pressure: number }[]
  color: string
  width: number
  tool: 'pen' | 'eraser'
}

interface NoteEditorProps {
  noteId: string
  title: string
  content: string | null
  drawingData: string | null
  color: string
  canEdit: boolean
  onSave: (data: { title?: string; content?: string; drawing_data?: string }) => Promise<void>
  onClose: () => void
}

const PEN_COLORS = ['#1a1a1a', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']
const PEN_WIDTHS = [2, 4, 6, 10]

export function NoteEditor({ noteId, title, content, drawingData, color, canEdit, onSave, onClose }: NoteEditorProps) {
  const [activeMode, setActiveMode] = useState<'text' | 'draw'>('text')
  const [noteTitle, setNoteTitle] = useState(title)
  const [noteContent, setNoteContent] = useState(content || '')
  const [isSaving, setIsSaving] = useState(false)
  const [savedLabel, setSavedLabel] = useState('')

  // Drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>(() => {
    try { return drawingData ? JSON.parse(drawingData) : [] } catch { return [] }
  })
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [penColor, setPenColor] = useState('#1a1a1a')
  const [penWidth, setPenWidth] = useState(3)
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen')

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Canvas drawing ─────────────────────────────────────────────────────────
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return
      ctx.beginPath()
      ctx.strokeStyle = stroke.tool === 'eraser' ? 'rgba(0,0,0,1)' : stroke.color
      ctx.lineWidth = stroke.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
      } else {
        ctx.globalCompositeOperation = 'source-over'
      }
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        const p = stroke.points[i]
        const prev = stroke.points[i - 1]
        const mx = (prev.x + p.x) / 2
        const my = (prev.y + p.y) / 2
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my)
      }
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
    })
  }, [strokes])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.parentElement?.getBoundingClientRect()
    if (rect) {
      canvas.width = rect.width
      canvas.height = rect.height
    }
    redrawCanvas()
  }, [redrawCanvas, activeMode])

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canEdit) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const pos = getPos(e)
    const stroke: Stroke = {
      points: [pos],
      color: penColor,
      width: activeTool === 'eraser' ? penWidth * 4 : penWidth,
      tool: activeTool,
    }
    setCurrentStroke(stroke)
    setIsDrawing(true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStroke || !canEdit) return
    const pos = getPos(e)
    const updated = { ...currentStroke, points: [...currentStroke.points, pos] }
    setCurrentStroke(updated)
    // Live draw
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pts = updated.points
    if (pts.length < 2) return
    const last = pts[pts.length - 2]
    const curr = pts[pts.length - 1]
    ctx.beginPath()
    ctx.strokeStyle = activeTool === 'eraser' ? 'rgba(0,0,0,1)' : penColor
    ctx.lineWidth = updated.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(curr.x, curr.y)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
  }

  const handlePointerUp = () => {
    if (!currentStroke || !canEdit) return
    setStrokes((prev) => [...prev, currentStroke])
    setCurrentStroke(null)
    setIsDrawing(false)
    triggerAutoSave()
  }

  const clearCanvas = () => {
    setStrokes([])
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
    triggerAutoSave()
  }

  const undoStroke = () => {
    setStrokes((prev) => {
      const next = prev.slice(0, -1)
      return next
    })
    triggerAutoSave()
  }

  // ─── Auto save ──────────────────────────────────────────────────────────────
  const triggerAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      await doSave()
    }, 2000)
  }, [noteTitle, noteContent, strokes]) // eslint-disable-line

  const doSave = async () => {
    setIsSaving(true)
    try {
      await onSave({
        title: noteTitle,
        content: noteContent,
        drawing_data: JSON.stringify(strokes),
      })
      setSavedLabel('บันทึกแล้ว')
      setTimeout(() => setSavedLabel(''), 2000)
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Title + save indicator */}
      <div className="flex items-center gap-3 mb-4">
        <input
          className="flex-1 text-xl font-bold bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder-slate-400"
          value={noteTitle}
          onChange={(e) => { setNoteTitle(e.target.value); triggerAutoSave() }}
          placeholder="ชื่อโน้ต..."
          disabled={!canEdit}
        />
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {isSaving && <Loader2 size={14} className="animate-spin" />}
          {savedLabel && <span className="text-green-500">{savedLabel}</span>}
        </div>
        {canEdit && (
          <button
            onClick={doSave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Save size={13} /> บันทึก
          </button>
        )}
      </div>

      {/* Mode toggle */}
      {canEdit && (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setActiveMode('text')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeMode === 'text'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-[#1e1e38] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#252548]'
            }`}
          >
            <Type size={14} /> พิมพ์ข้อความ
          </button>
          <button
            onClick={() => setActiveMode('draw')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeMode === 'draw'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-[#1e1e38] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#252548]'
            }`}
          >
            <Pencil size={14} /> เขียนมือ
          </button>
        </div>
      )}

      {/* Text mode */}
      {activeMode === 'text' && (
        <textarea
          className="flex-1 w-full resize-none bg-transparent border-none outline-none text-slate-700 dark:text-slate-200 text-sm leading-relaxed placeholder-slate-300 dark:placeholder-slate-600"
          value={noteContent}
          onChange={(e) => { setNoteContent(e.target.value); triggerAutoSave() }}
          placeholder={canEdit ? 'เริ่มพิมพ์โน้ตที่นี่...' : '(ไม่มีเนื้อหา)'}
          disabled={!canEdit}
        />
      )}

      {/* Drawing mode */}
      {activeMode === 'draw' && (
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          {canEdit && (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Tool */}
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTool('pen')}
                  title="ปากกา"
                  className={`p-1.5 rounded-lg transition-all ${activeTool === 'pen' ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-[#1e1e38] text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setActiveTool('eraser')}
                  title="ยางลบ"
                  className={`p-1.5 rounded-lg transition-all ${activeTool === 'eraser' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-[#1e1e38] text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                >
                  <Eraser size={14} />
                </button>
              </div>
              {/* Pen colors */}
              <div className="flex gap-1">
                {PEN_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setPenColor(c); setActiveTool('pen') }}
                    className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${penColor === c && activeTool === 'pen' ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              {/* Pen widths */}
              <div className="flex items-center gap-1">
                {PEN_WIDTHS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setPenWidth(w)}
                    className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${penWidth === w ? 'bg-primary-600' : 'bg-slate-100 dark:bg-[#1e1e38] hover:bg-slate-200'}`}
                  >
                    <div
                      className="rounded-full bg-slate-700 dark:bg-slate-200"
                      style={{ width: Math.min(w * 2, 18), height: Math.min(w * 2, 18) }}
                    />
                  </button>
                ))}
              </div>
              {/* Undo / Clear */}
              <div className="flex gap-1 ml-auto">
                <button
                  onClick={undoStroke}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#1e1e38] text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all text-xs font-medium"
                  title="เลิกทำ"
                >
                  ↩
                </button>
                <button
                  onClick={clearCanvas}
                  className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 transition-all"
                  title="ล้างทั้งหมด"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )}

          <div className="relative flex-1 border border-slate-200 dark:border-[#252548] rounded-xl overflow-hidden bg-white dark:bg-[#13132a]"
            style={{ minHeight: 300, cursor: canEdit ? (activeTool === 'eraser' ? 'cell' : 'crosshair') : 'default' }}
          >
            {strokes.length === 0 && !isDrawing && canEdit && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-slate-300 dark:text-slate-600">
                  <Pencil size={40} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">วาดด้วยเมาส์หรือ Apple Pencil</p>
                </div>
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="w-full h-full touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              style={{ touchAction: 'none' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
