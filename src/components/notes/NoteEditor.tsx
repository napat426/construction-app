'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Pencil, Trash2, Eraser, Save, Loader2, Maximize2, Minimize2, Image as ImageIcon, Folder } from 'lucide-react'

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
  folder: string
  folders: string[]
  canEdit: boolean
  onSave: (data: { title?: string; content?: string; drawing_data?: string; folder?: string }) => Promise<void>
  onClose: () => void
}

const PEN_COLORS = ['#1a1a1a', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']
const PEN_WIDTHS = [2, 4, 6, 10]

export function NoteEditor({
  noteId,
  title,
  content,
  drawingData,
  color,
  folder,
  folders,
  canEdit,
  onSave,
  onClose,
}: NoteEditorProps) {
  const [noteTitle, setNoteTitle] = useState(title)
  const [noteContent, setNoteContent] = useState(content || '')
  const [noteFolder, setNoteFolder] = useState(folder)
  const [isSaving, setIsSaving] = useState(false)
  const [savedLabel, setSavedLabel] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Parse strokes and background image from unified drawingData JSON object
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)
  const [bgImageEl, setBgImageEl] = useState<HTMLImageElement | null>(null)

  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [penColor, setPenColor] = useState('#1a1a1a')
  const [penWidth, setPenWidth] = useState(3)
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Sync props to local state ─────────────────────────────────────────────
  useEffect(() => {
    setNoteTitle(title)
  }, [title])

  useEffect(() => {
    setNoteContent(content || '')
  }, [content])

  useEffect(() => {
    setNoteFolder(folder)
  }, [folder])

  useEffect(() => {
    try {
      if (drawingData) {
        const parsed = JSON.parse(drawingData)
        if (Array.isArray(parsed)) {
          setStrokes(parsed)
          setBackgroundImage(null)
        } else if (parsed) {
          setStrokes(parsed.strokes || [])
          setBackgroundImage(parsed.backgroundImage || null)
        }
      } else {
        setStrokes([])
        setBackgroundImage(null)
      }
    } catch {
      setStrokes([])
      setBackgroundImage(null)
    }
  }, [drawingData])

  // Load image element when background image string changes
  useEffect(() => {
    if (backgroundImage) {
      const img = new Image()
      img.src = backgroundImage
      img.onload = () => {
        setBgImageEl(img)
      }
    } else {
      setBgImageEl(null)
    }
  }, [backgroundImage])

  // ─── Canvas drawing ─────────────────────────────────────────────────────────
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 1. Draw background image if loaded
    if (bgImageEl) {
      const scale = Math.min(canvas.width / bgImageEl.width, canvas.height / bgImageEl.height)
      const x = (canvas.width - bgImageEl.width * scale) / 2
      const y = (canvas.height - bgImageEl.height * scale) / 2
      ctx.drawImage(bgImageEl, x, y, bgImageEl.width * scale, bgImageEl.height * scale)
    }

    // 2. Draw all saved strokes
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
  }, [strokes, bgImageEl])

  // Resize canvas handler
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.parentElement?.getBoundingClientRect()
    if (rect) {
      canvas.width = rect.width
      canvas.height = rect.height
      redrawCanvas()
    }
  }, [redrawCanvas])

  useEffect(() => {
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [resizeCanvas, isFullscreen])

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
    
    // Live drawing on canvas
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
    if (!confirm('ล้างภาพวาดและรูปพื้นหลังทั้งหมดใช่หรือไม่?')) return
    setStrokes([])
    setBackgroundImage(null)
    setBgImageEl(null)
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
    triggerAutoSave()
  }

  const undoStroke = () => {
    setStrokes((prev) => prev.slice(0, -1))
    triggerAutoSave()
  }

  // Handle uploading and resizing of images to fit the note budget
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        // Compress/resize to max 1200px width/height to save DB space
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 1200
        const MAX_HEIGHT = 1200
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75)
        setBackgroundImage(compressedBase64)
        triggerAutoSave()
      }
    }
    reader.readAsDataURL(file)
  }

  // ─── Auto save ──────────────────────────────────────────────────────────────
  const triggerAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      await doSave()
    }, 1500)
  }, [noteTitle, noteContent, noteFolder, strokes, backgroundImage]) // eslint-disable-line

  const doSave = async () => {
    setIsSaving(true)
    try {
      await onSave({
        title: noteTitle,
        content: noteContent,
        folder: noteFolder,
        drawing_data: JSON.stringify({
          strokes,
          backgroundImage,
        }),
      })
      setSavedLabel('บันทึกแล้ว')
      setTimeout(() => setSavedLabel(''), 2000)
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-[#13132a] ${
        isFullscreen ? 'fixed inset-0 z-[100] p-6' : 'relative'
      }`}
    >
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#1c1c34] mb-4">
        {/* Title */}
        <input
          className="text-lg font-extrabold bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder-slate-400 min-w-[200px] flex-1 font-sans"
          value={noteTitle}
          onChange={(e) => {
            setNoteTitle(e.target.value)
            triggerAutoSave()
          }}
          placeholder="ชื่อโน้ต..."
          disabled={!canEdit}
        />

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Folder select */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#1e1e38] px-2 py-1 rounded-xl text-xs text-slate-600 dark:text-slate-300">
            <Folder size={12} />
            <select
              value={noteFolder}
              onChange={(e) => {
                setNoteFolder(e.target.value)
                triggerAutoSave()
              }}
              disabled={!canEdit}
              className="bg-transparent border-none outline-none font-semibold cursor-pointer"
            >
              {folders.map((f) => (
                <option key={f} value={f} className="text-slate-800 dark:text-white dark:bg-[#13132a]">
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Auto save indicator */}
          <div className="flex items-center gap-1 text-xs text-slate-400">
            {isSaving && <Loader2 size={13} className="animate-spin" />}
            {savedLabel && <span className="text-green-500 font-medium">{savedLabel}</span>}
          </div>

          {/* Fullscreen toggle button */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-[#1e1e38] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#252548] transition-all"
            title={isFullscreen ? 'ลดขนาดจอ' : 'ขยายเต็มหน้าจอ'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {canEdit && (
            <button
              onClick={doSave}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
            >
              <Save size={13} /> บันทึก
            </button>
          )}
        </div>
      </div>

      {/* Unified Paper Canvas Layout */}
      <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1 bg-[#fbfbfd] dark:bg-[#070716] border border-slate-200 dark:border-[#1c1c34] rounded-2xl p-5 shadow-inner">
        
        {/* Text Section (Top half of the paper sheet) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">พิมพ์ข้อความบันทึก</label>
          <textarea
            className="w-full min-h-[140px] bg-transparent border-none outline-none resize-none text-slate-800 dark:text-slate-200 text-sm leading-relaxed placeholder-slate-400 dark:placeholder-slate-600 focus:ring-0 focus:border-0"
            value={noteContent}
            onChange={(e) => {
              setNoteContent(e.target.value)
              triggerAutoSave()
            }}
            placeholder={canEdit ? 'เริ่มพิมพ์เนื้อหาของโน้ตที่นี่...' : '(ไม่มีข้อความ)'}
            disabled={!canEdit}
          />
        </div>

        {/* Unified Divider (Notepad Tearing Line) */}
        <div className="border-t border-dashed border-slate-200 dark:border-slate-800 my-1" />

        {/* Drawing Section (Bottom half of the paper sheet) */}
        <div className="flex-1 flex flex-col gap-2 min-h-[380px]">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">วาดเขียนหรือแนบรูปภาพอธิบาย</label>
            
            {canEdit && (
              <div className="flex items-center gap-3 flex-wrap">
                {/* Photo upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-[#1e1e38] text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 border border-slate-200 dark:border-[#252548] text-xs font-semibold transition-all shadow-xs"
                  title="แนบรูปถ่ายหน้างานเพื่อวาดเขียนอธิบายช่าง"
                >
                  <ImageIcon size={12} /> แนบรูปภาพ
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />

                {/* Tool toggle */}
                <div className="flex gap-1 bg-white dark:bg-[#1e1e38] p-0.5 rounded-lg border border-slate-200 dark:border-[#252548] shadow-xs">
                  <button
                    onClick={() => setActiveTool('pen')}
                    className={`p-1 rounded-md transition-all ${
                      activeTool === 'pen' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                    title="ปากกา"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => setActiveTool('eraser')}
                    className={`p-1 rounded-md transition-all ${
                      activeTool === 'eraser' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                    title="ยางลบ"
                  >
                    <Eraser size={12} />
                  </button>
                </div>

                {/* Pen colors */}
                <div className="flex gap-1 bg-white dark:bg-[#1e1e38] p-1 rounded-lg border border-slate-200 dark:border-[#252548]">
                  {PEN_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setPenColor(c)
                        setActiveTool('pen')
                      }}
                      className={`w-3.5 h-3.5 rounded-full border border-white/50 transition-transform hover:scale-110 ${
                        penColor === c && activeTool === 'pen' ? 'ring-2 ring-primary-500 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                {/* Undo / Clear */}
                <div className="flex gap-1">
                  <button
                    onClick={undoStroke}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-[#1e1e38] border border-slate-200 dark:border-[#252548] hover:bg-slate-50 text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-all shadow-xs"
                    title="ย้อนกลับ"
                  >
                    ย้อนกลับ
                  </button>
                  <button
                    onClick={clearCanvas}
                    className="p-1 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 transition-all border border-red-100 dark:border-red-900/30"
                    title="ล้างทั้งหมด"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Canvas container */}
          <div
            className="relative flex-1 border border-slate-200 dark:border-[#1c1c34] rounded-2xl overflow-hidden bg-white dark:bg-[#060613]"
            style={{ minHeight: 350, cursor: canEdit ? (activeTool === 'eraser' ? 'cell' : 'crosshair') : 'default' }}
          >
            {strokes.length === 0 && !isDrawing && !backgroundImage && canEdit && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center">
                <Pencil size={20} className="text-slate-300 dark:text-slate-700 mb-1" />
                <p className="text-[11px] text-slate-400 dark:text-slate-600">วาดเขียนจดโน้ต หรือแนบรูปภาพอธิบายหน้างานได้ที่นี่</p>
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
      </div>
    </div>
  )
}
