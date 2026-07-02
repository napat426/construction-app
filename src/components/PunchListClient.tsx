'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  ClipboardCheck,
  Plus,
  Trash2,
  Image as ImageIcon,
  Save,
  Printer,
  ChevronDown,
  ChevronUp,
  Download,
  Undo,
  RotateCcw,
  Circle,
  MoveRight,
  Edit3,
  Type,
  GripVertical
} from 'lucide-react'
import type { Project, PunchList, PunchItem, PunchPhoto, PunchItemCategory, PunchItemStatus } from '@/lib/types'
import { updatePunchList, deletePunchList, createPunchList } from '@/app/actions/punchlist'
import type { UserSession } from '@/lib/auth'

interface Props {
  project: Project
  initialPunchLists: PunchList[]
  initialPunchItems: PunchItem[]
  user?: UserSession | null
}

const CATEGORIES: PunchItemCategory[] = ['โครงสร้าง', 'สถาปัตย์', 'งานระบบ', 'ความปลอดภัย', 'อื่นๆ']
const STATUSES: PunchItemStatus[] = ['open', 'in_progress', 'done', 'rejected']

const STATUS_META: Record<PunchItemStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-red-500/10 text-red-600 border-red-500/20' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  done: { label: 'Done', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  rejected: { label: 'Rejected', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
}

interface DrawItem {
  type: 'free' | 'circle' | 'arrow' | 'text'
  color: string
  points?: { x: number; y: number }[]
  startX?: number
  startY?: number
  endX?: number
  endY?: number
  text?: string
  x?: number
  y?: number
}

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        
        const MAX_WIDTH = 1280
        const MAX_HEIGHT = 1280
        
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
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6)
        resolve(dataUrl)
      }
      img.onerror = (error) => reject(error)
    }
    reader.onerror = (error) => reject(error)
  })
}

export function PunchListClient({ project, initialPunchLists, initialPunchItems, user }: Props) {
  const [punchLists, setPunchLists] = useState<PunchList[]>(initialPunchLists)
  const [punchItems, setPunchItems] = useState<PunchItem[]>(initialPunchItems)

  const [selectedListId, setSelectedListId] = useState<string | null>(
    initialPunchLists.length > 0 ? initialPunchLists[0].id : null
  )

  // Edit states for current selected list
  const [headerTitle, setHeaderTitle] = useState('')
  const [headerPlNumber, setHeaderPlNumber] = useState('')
  const [headerIssuedBy, setHeaderIssuedBy] = useState('')
  const [headerIssuedTo, setHeaderIssuedTo] = useState('')
  const [headerDueDate, setHeaderDueDate] = useState('')
  const [headerStatus, setHeaderStatus] = useState<'open' | 'closed'>('open')

  const [activeItems, setActiveItems] = useState<PunchItem[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(null)

  // Drag and drop sorting states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // Markup Modal states
  const [showMarkupModal, setShowMarkupModal] = useState(false)
  const [markupItemIndex, setMarkupItemIndex] = useState<number | null>(null)
  const [markupPhotoIndex, setMarkupPhotoIndex] = useState<number | null>(null)
  const [drawingTool, setDrawingTool] = useState<'free' | 'circle' | 'arrow' | 'text'>('free')
  const [drawingColor, setDrawingColor] = useState<string>('#ef4444') // Default red
  const [drawHistory, setDrawHistory] = useState<DrawItem[]>([])
  const [isDrawing, setIsDrawing] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const textInputRef = useRef<HTMLInputElement | null>(null)

  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null)
  const [textInputValue, setTextInputValue] = useState('')

  // Toast / Status state
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success')

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(msg)
    setToastType(type)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const selectedList = useMemo(() => {
    return punchLists.find((pl) => pl.id === selectedListId) || null
  }, [punchLists, selectedListId])

  // Sync edits when selected list changes
  useEffect(() => {
    if (selectedList) {
      setHeaderTitle(selectedList.title || '')
      setHeaderPlNumber(selectedList.pl_number || '')
      setHeaderIssuedBy(selectedList.issued_by || '')
      setHeaderIssuedTo(selectedList.issued_to || '')
      setHeaderDueDate(selectedList.due_date || '')
      setHeaderStatus(selectedList.status || 'open')

      const filteredItems = punchItems
        .filter((item) => item.punch_list_id === selectedList.id)
        .sort((a, b) => a.sequence - b.sequence)
      setActiveItems(filteredItems)
      setIsDirty(false)
      setExpandedItemIndex(null)
    } else {
      setHeaderTitle('')
      setHeaderPlNumber('')
      setHeaderIssuedBy('')
      setHeaderIssuedTo('')
      setHeaderDueDate('')
      setHeaderStatus('open')
      setActiveItems([])
      setIsDirty(false)
      setExpandedItemIndex(null)
    }
  }, [selectedListId, punchLists, punchItems])

  // Create new list handler
  const handleCreateList = async () => {
    const res = await createPunchList(project.id)
    if (res.error) {
      showToast(res.error, 'error')
    } else if (res.data) {
      setPunchLists((prev) => [...prev, res.data!])
      setSelectedListId(res.data!.id)
      showToast('สร้าง Punch List ใหม่สำเร็จ', 'success')
    }
  }

  // Delete list handler
  const handleDeleteList = async () => {
    if (!selectedListId) return
    if (!confirm('คุณแน่ใจว่าต้องการลบ Punch List นี้และรายการข้อบกพร่องทั้งหมด?')) return

    const res = await deletePunchList(selectedListId)
    if (res.error) {
      showToast(res.error, 'error')
    } else {
      const remaining = punchLists.filter((pl) => pl.id !== selectedListId)
      setPunchLists(remaining)
      setSelectedListId(remaining.length > 0 ? remaining[0].id : null)
      showToast('ลบ Punch List เรียบร้อยแล้ว', 'success')
    }
  }

  // Add Item to table
  const handleAddItem = () => {
    const newItem: PunchItem = {
      id: `temp-${Date.now()}`,
      punch_list_id: selectedListId || '',
      sequence: activeItems.length + 1,
      location: '',
      category: 'อื่นๆ',
      description: '',
      photos: [],
      assignee: '',
      due_date: '',
      status: 'open',
      closed_date: '',
      remark: '',
      created_at: new Date().toISOString(),
    }
    setActiveItems((prev) => [...prev, newItem])
    setIsDirty(true)
    setExpandedItemIndex(activeItems.length) // Auto expand the newly added item
  }

  // Delete Item from table
  const handleDeleteItem = (index: number) => {
    setActiveItems((prev) => {
      const updated = prev.filter((_, idx) => idx !== index)
      return updated.map((item, idx) => ({ ...item, sequence: idx + 1 }))
    })
    setIsDirty(true)
    if (expandedItemIndex === index) {
      setExpandedItemIndex(null)
    } else if (expandedItemIndex !== null && expandedItemIndex > index) {
      setExpandedItemIndex(expandedItemIndex - 1)
    }
  }

  // Edit item inline
  const handleEditItemField = (index: number, field: keyof PunchItem, value: any) => {
    setActiveItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
    setIsDirty(true)
  }

  // Save active Punch List edits
  const handleSaveList = async () => {
    if (!selectedListId) return

    const res = await updatePunchList(
      selectedListId,
      {
        pl_number: headerPlNumber,
        title: headerTitle,
        issued_by: headerIssuedBy,
        issued_to: headerIssuedTo,
        due_date: headerDueDate || null,
        status: headerStatus,
      },
      activeItems
    )

    if (res.error) {
      showToast(res.error, 'error')
    } else {
      // Sync local state
      setPunchLists((prev) =>
        prev.map((pl) => (pl.id === selectedListId ? res.header! : pl))
      )
      // Sync punch items list
      setPunchItems((prev) => {
        const withoutActive = prev.filter((item) => item.punch_list_id !== selectedListId)
        // Fetch new items from state with generated sequences
        const savedItems = activeItems.map((item, idx) => ({
          ...item,
          punch_list_id: selectedListId,
          sequence: idx + 1,
        }))
        return [...withoutActive, ...savedItems]
      })

      if (res.autoClosed) {
        showToast('🎉 บันทึกสำเร็จ — ปิดการทำงาน Punch List อัตโนมัติเนื่องจากทุกรายการเสร็จสิ้น!', 'success')
        setHeaderStatus('closed')
      } else {
        showToast('บันทึกข้อมูล Punch List สำเร็จ', 'success')
      }
      setIsDirty(false)
    }
  }

  // Excel/CSV Export
  const handleExportCSV = () => {
    if (activeItems.length === 0) {
      showToast('ไม่มีรายการข้อบกพร่องให้ดาวน์โหลด', 'info')
      return
    }

    const headers = [
      'ลำดับ',
      'ตำแหน่ง',
      'ประเภท',
      'คำอธิบาย',
      'ผู้รับผิดชอบ',
      'กำหนดเสร็จ',
      'สถานะ',
      'ความเห็นผู้รับเหมา',
      'วันที่ตอบกลับ',
      'หมายเหตุ',
    ]

    const rows = activeItems.map((item) => [
      item.sequence,
      item.location,
      item.category,
      item.description,
      item.assignee || '',
      item.due_date || '',
      STATUS_META[item.status]?.label || item.status,
      item.contractor_response || '',
      item.response_date || '',
      item.remark || '',
    ])

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `${headerPlNumber || 'punch_list'}_export.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // HTML5 Drag and Drop Sorting Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const reorderedItems = [...activeItems]
    const [draggedItem] = reorderedItems.splice(draggedIndex, 1)
    reorderedItems.splice(index, 0, draggedItem)

    // Update sequence
    const updated = reorderedItems.map((item, idx) => ({ ...item, sequence: idx + 1 }))
    setActiveItems(updated)
    setDraggedIndex(null)
    setIsDirty(true)
  }

  // Add photos locally to a punch item
  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>, itemIndex: number) => {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      try {
        const compressedBase64 = await compressImage(file)
        setActiveItems((prev) => {
          const updated = [...prev]
          const item = updated[itemIndex]
          const existingPhotos = item.photos || []
          item.photos = [...existingPhotos, { src: compressedBase64, caption: '', markup_src: null }]
          return updated
        })
        setIsDirty(true)
      } catch (err) {
        console.error('Failed to compress image:', err)
      }
    }
  }

  // Remove photo from active item list
  const handleRemovePhoto = (itemIndex: number, photoIndex: number) => {
    if (!confirm('คุณแน่ใจว่าต้องการลบรูปภาพนี้?')) return
    setActiveItems((prev) => {
      const updated = [...prev]
      const item = updated[itemIndex]
      item.photos = item.photos.filter((_, idx) => idx !== photoIndex)
      return updated
    })
    setIsDirty(true)
  }

  // Edit photo caption
  const handleEditPhotoCaption = (itemIndex: number, photoIndex: number, caption: string) => {
    setActiveItems((prev) => {
      const updated = [...prev]
      const item = updated[itemIndex]
      const updatedPhotos = [...item.photos]
      updatedPhotos[photoIndex] = { ...updatedPhotos[photoIndex], caption }
      item.photos = updatedPhotos
      return updated
    })
    setIsDirty(true)
  }

  // --- CANVAS MARKUP DRAWING CODE ---

  const handleOpenMarkup = (itemIndex: number, photoIndex: number) => {
    setMarkupItemIndex(itemIndex)
    setMarkupPhotoIndex(photoIndex)
    setDrawHistory([])
    setShowMarkupModal(true)
  }

  useEffect(() => {
    if (!showMarkupModal || markupItemIndex === null || markupPhotoIndex === null) return

    const item = activeItems[markupItemIndex]
    const photo = item.photos[markupPhotoIndex]
    if (!photo) return

    const img = new Image()
    img.src = photo.src
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Set canvas size matching the image display size bound to a max size
      const maxW = Math.min(window.innerWidth - 60, 800)
      const maxH = Math.min(window.innerHeight - 250, 500)
      let w = img.naturalWidth || 800
      let h = img.naturalHeight || 600

      const scale = Math.min(maxW / w, maxH / h)
      canvas.width = w * scale
      canvas.height = h * scale

      // Draw background image directly onto canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
  }, [showMarkupModal, markupItemIndex, markupPhotoIndex])

  // Canvas Mouse / Pointer Event Drawing Logic
  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  // Draw current path helper
  const drawAllElements = (ctx: CanvasRenderingContext2D, items: DrawItem[]) => {
    const canvas = canvasRef.current
    if (!canvas || !markupItemIndex || !markupPhotoIndex) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Redraw image first
    const item = activeItems[markupItemIndex]
    const photo = item.photos[markupPhotoIndex]
    if (!photo) return

    const img = new Image()
    img.src = photo.src
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // Draw all completed elements
    items.forEach((elem) => {
      ctx.strokeStyle = elem.color
      ctx.fillStyle = elem.color
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (elem.type === 'free' && elem.points && elem.points.length > 0) {
        ctx.beginPath()
        ctx.moveTo(elem.points[0].x, elem.points[0].y)
        for (let i = 1; i < elem.points.length; i++) {
          ctx.lineTo(elem.points[i].x, elem.points[i].y)
        }
        ctx.stroke()
      } else if (elem.type === 'circle' && elem.startX !== undefined && elem.startY !== undefined && elem.endX !== undefined && elem.endY !== undefined) {
        ctx.beginPath()
        const rx = Math.abs(elem.endX - elem.startX) / 2
        const ry = Math.abs(elem.endY - elem.startY) / 2
        const cx = (elem.startX + elem.endX) / 2
        const cy = (elem.startY + elem.endY) / 2
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI)
        ctx.stroke()
      } else if (elem.type === 'arrow' && elem.startX !== undefined && elem.startY !== undefined && elem.endX !== undefined && elem.endY !== undefined) {
        // Draw main arrow line
        ctx.beginPath()
        ctx.moveTo(elem.startX, elem.startY)
        ctx.lineTo(elem.endX, elem.endY)
        ctx.stroke()

        // Draw arrowhead
        const angle = Math.atan2(elem.endY - elem.startY, elem.endX - elem.startX)
        ctx.beginPath()
        ctx.moveTo(elem.endX, elem.endY)
        ctx.lineTo(
          elem.endX - 15 * Math.cos(angle - Math.PI / 6),
          elem.endY - 15 * Math.sin(angle - Math.PI / 6)
        )
        ctx.lineTo(
          elem.endX - 15 * Math.cos(angle + Math.PI / 6),
          elem.endY - 15 * Math.sin(angle + Math.PI / 6)
        )
        ctx.closePath()
        ctx.fill()
      } else if (elem.type === 'text' && elem.x !== undefined && elem.y !== undefined && elem.text) {
        ctx.font = 'bold 16px sans-serif'
        ctx.fillText(elem.text, elem.x, elem.y)
      }
    })
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasMousePos(e)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (drawingTool === 'text') {
      setTextInputPos(pos)
      setTextInputValue('')
      setTimeout(() => textInputRef.current?.focus(), 50)
      return
    }

    setIsDrawing(true)

    if (drawingTool === 'free') {
      const newItem: DrawItem = {
        type: 'free',
        color: drawingColor,
        points: [pos],
      }
      setDrawHistory((prev) => [...prev, newItem].slice(-10))
    } else if (drawingTool === 'circle' || drawingTool === 'arrow') {
      const newItem: DrawItem = {
        type: drawingTool,
        color: drawingColor,
        startX: pos.x,
        startY: pos.y,
        endX: pos.x,
        endY: pos.y,
      }
      setDrawHistory((prev) => [...prev, newItem].slice(-10))
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const pos = getCanvasMousePos(e)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setDrawHistory((prev) => {
      if (prev.length === 0) return prev
      const updated = [...prev]
      const current = { ...updated[updated.length - 1] }

      if (current.type === 'free' && current.points) {
        current.points = [...current.points, pos]
      } else if (current.type === 'circle' || current.type === 'arrow') {
        current.endX = pos.x
        current.endY = pos.y
      }

      updated[updated.length - 1] = current
      drawAllElements(ctx, updated)
      return updated
    })
  }

  const handleCanvasMouseUp = () => {
    setIsDrawing(false)
  }

  // Draw typed text onto canvas
  const handleSaveTextElement = () => {
    if (!textInputPos || !textInputValue.trim()) {
      setTextInputPos(null)
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const newTextItem: DrawItem = {
      type: 'text',
      color: drawingColor,
      x: textInputPos.x,
      y: textInputPos.y,
      text: textInputValue,
    }

    const newHistory = [...drawHistory, newTextItem].slice(-10)
    setDrawHistory(newHistory)
    drawAllElements(ctx, newHistory)

    setTextInputPos(null)
    setTextInputValue('')
  }

  const handleUndo = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const popped = drawHistory.slice(0, -1)
    setDrawHistory(popped)
    drawAllElements(ctx, popped)
  }

  const handleClearDrawing = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setDrawHistory([])
    drawAllElements(ctx, [])
  }

  // Save the drawn canvas as transparent markup base64
  const handleSaveMarkup = () => {
    const canvas = canvasRef.current
    if (!canvas || markupItemIndex === null || markupPhotoIndex === null) return

    // Create a temporary canvas of the exact same size to export ONLY the markup drawings (transparent background!)
    // This allows overlaying on top of the original high-quality image cleanly.
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const tempCtx = tempCanvas.getContext('2d')

    if (tempCtx) {
      // Draw everything EXCEPT the image onto temp canvas
      drawAllElements(tempCtx, drawHistory)
      // Remove image drawing by overriding it
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
      
      // Draw elements again directly onto clean transparent context
      drawHistory.forEach((elem) => {
        tempCtx.strokeStyle = elem.color
        tempCtx.fillStyle = elem.color
        tempCtx.lineWidth = 3
        tempCtx.lineCap = 'round'
        tempCtx.lineJoin = 'round'

        if (elem.type === 'free' && elem.points && elem.points.length > 0) {
          tempCtx.beginPath()
          tempCtx.moveTo(elem.points[0].x, elem.points[0].y)
          for (let i = 1; i < elem.points.length; i++) {
            tempCtx.lineTo(elem.points[i].x, elem.points[i].y)
          }
          tempCtx.stroke()
        } else if (elem.type === 'circle' && elem.startX !== undefined && elem.startY !== undefined && elem.endX !== undefined && elem.endY !== undefined) {
          tempCtx.beginPath()
          const rx = Math.abs(elem.endX - elem.startX) / 2
          const ry = Math.abs(elem.endY - elem.startY) / 2
          const cx = (elem.startX + elem.endX) / 2
          const cy = (elem.startY + elem.endY) / 2
          tempCtx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI)
          tempCtx.stroke()
        } else if (elem.type === 'arrow' && elem.startX !== undefined && elem.startY !== undefined && elem.endX !== undefined && elem.endY !== undefined) {
          tempCtx.beginPath()
          tempCtx.moveTo(elem.startX, elem.startY)
          tempCtx.lineTo(elem.endX, elem.endY)
          tempCtx.stroke()

          const angle = Math.atan2(elem.endY - elem.startY, elem.endX - elem.startX)
          tempCtx.beginPath()
          tempCtx.moveTo(elem.endX, elem.endY)
          tempCtx.lineTo(
            elem.endX - 15 * Math.cos(angle - Math.PI / 6),
            elem.endY - 15 * Math.sin(angle - Math.PI / 6)
          )
          tempCtx.lineTo(
            elem.endX - 15 * Math.cos(angle + Math.PI / 6),
            elem.endY - 15 * Math.sin(angle + Math.PI / 6)
          )
          tempCtx.closePath()
          tempCtx.fill()
        } else if (elem.type === 'text' && elem.x !== undefined && elem.y !== undefined && elem.text) {
          tempCtx.font = 'bold 16px sans-serif'
          tempCtx.fillText(elem.text, elem.x, elem.y)
        }
      })
    }

    const markupBase64 = tempCanvas.toDataURL('image/png')

    // Save to state
    setActiveItems((prev) => {
      const updated = [...prev]
      const item = updated[markupItemIndex]
      const updatedPhotos = [...item.photos]
      updatedPhotos[markupPhotoIndex] = {
        ...updatedPhotos[markupPhotoIndex],
        markup_src: markupBase64,
      }
      item.photos = updatedPhotos
      return updated
    })

    setIsDirty(true)
    setShowMarkupModal(false)
    showToast('บันทึกรูปวาดข้อบกพร่องสำเร็จ', 'success')
  }

  // --- PRINT COMPONENT SETUP ---
  const handleTriggerPrint = () => {
    window.print()
  }

  // Calculate statistics
  const stats = useMemo(() => {
    const total = activeItems.length
    const open = activeItems.filter((i) => i.status === 'open').length
    const progress = activeItems.filter((i) => i.status === 'in_progress').length
    const done = activeItems.filter((i) => i.status === 'done').length
    const rejected = activeItems.filter((i) => i.status === 'rejected').length
    const pct = total > 0 ? Math.round(((done + rejected) / total) * 100) : 0

    return { total, open, progress, done, rejected, pct }
  }, [activeItems])

  // Split active items into chunks of 4 for pagination (each page = 4 items + their photos)
  const itemChunks = useMemo(() => {
    const chunks: PunchItem[][] = []
    for (let i = 0; i < activeItems.length; i += 4) {
      chunks.push(activeItems.slice(i, i + 4))
    }
    return chunks
  }, [activeItems])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
      <style jsx global>{`
        @media print {
          /* Print Stylesheet conforming to A4 Portrait specs */
          header, nav, aside, footer, .no-print, .btn-secondary, button {
            display: none !important;
          }
          /* Reset parent layout containers for print to prevent clipping */
          html, body, main, .flex, .flex-col, .min-h-screen, .overflow-hidden {
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            background: white !important;
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-layout {
            display: block !important;
            background: white !important;
            background-color: white !important;
          }
          .print-layout .flex {
            display: flex !important;
          }
          .print-layout .grid {
            display: grid !important;
          }
          .print-page-container {
            background: white !important;
            background-color: white !important;
            padding: 20px !important;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print-header {
            border-bottom: 2px solid #000;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-bottom: 30px;
            background: white !important;
            background-color: white !important;
          }
          th, td {
            border: 1px solid #475569 !important;
            padding: 6px 4px !important;
            font-size: 9px !important;
            background: white !important;
            background-color: white !important;
          }
          .page-break {
            page-break-before: always !important;
          }
          .photo-evidence-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 15px !important;
            margin-top: 15px;
            background: white !important;
          }
          .evidence-photo-box {
            border: 1px solid #cbd5e1 !important;
            padding: 8px !important;
            border-radius: 4px;
            page-break-inside: avoid;
            background: white !important;
            background-color: white !important;
          }
          .evidence-img-container {
            position: relative !important;
            width: 100% !important;
            height: 180px !important;
            background: white !important;
            background-color: white !important;
            overflow: hidden;
          }
          /* Force colors on printed elements */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* --- TOAST --- */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div className={`px-5 py-3.5 rounded-xl shadow-lg border text-xs font-bold text-white ${
            toastType === 'success' ? 'bg-emerald-600 border-emerald-500' :
            toastType === 'error' ? 'bg-red-600 border-red-500' :
            'bg-slate-700 border-slate-600'
          }`}>
            {toastMessage}
          </div>
        </div>
      )}

      {/* --- PRINT ONLY A4 REPORT VIEW --- */}
      {selectedList && (
        <div className="hidden print-layout w-full text-slate-800">
          {itemChunks.map((pageChunk, chunkIdx) => (
            <div key={chunkIdx} className={`print-page-container ${chunkIdx > 0 ? 'page-break' : ''}`}>
              <div className="print-header flex items-center justify-between">
                <div>
                  <h1 className="text-sm font-black uppercase tracking-wider">Punch List Report (รายงานข้อบกพร่องงาน)</h1>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">โครงการ: {project.name}</p>
                </div>
                <div className="text-right text-xs font-mono">
                  <p className="font-bold">เลขที่เอกสาร: {headerPlNumber} (หน้า {chunkIdx + 1} / {itemChunks.length})</p>
                  <p className="text-slate-500">วันที่: {selectedList.created_at ? new Date(selectedList.created_at).toLocaleDateString('th-TH') : '-'}</p>
                </div>
              </div>

              {chunkIdx === 0 ? (
                <div className="mb-6 text-[10px] border-b pb-2">
                  <p><strong>หัวข้อ:</strong> {headerTitle}</p>
                </div>
              ) : (
                <div className="mb-4 text-[10px] text-slate-500 italic border-b pb-2">
                  หัวข้อ: {headerTitle}
                </div>
              )}

              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 font-bold text-left">
                    <th className="w-10 text-center">ลำดับ</th>
                    <th className="w-28">ตำแหน่ง</th>
                    <th className="w-20">ประเภท</th>
                    <th>รายละเอียดข้อบกพร่อง</th>
                    <th className="w-24 text-center">วันที่บันทึกข้อมูล</th>
                    <th className="w-16 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pageChunk.map((item) => (
                    <tr key={item.id}>
                      <td className="text-center font-mono">{item.sequence}</td>
                      <td>{item.location}</td>
                      <td>{item.category}</td>
                      <td>{item.description}</td>
                      <td className="text-center font-mono">{item.created_at ? new Date(item.created_at).toLocaleDateString('th-TH') : '-'}</td>
                      <td className="text-center font-bold">
                        {STATUS_META[item.status]?.label || item.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {pageChunk.some(i => i.photos && i.photos.length > 0) && (
                <div className="mt-4">
                  <h2 className="text-[10px] font-black uppercase tracking-wider mb-2 border-b pb-1">ภาพประกอบหลักฐานข้อบกพร่อง (Evidence Photos)</h2>
                  <div className="photo-evidence-grid">
                    {pageChunk.flatMap((item) =>
                      (item.photos || []).map((photo, pIdx) => (
                        <div key={`${item.id}-${pIdx}`} className="evidence-photo-box">
                          <div className="evidence-img-container">
                            <img
                              src={photo.src}
                              alt="evidence"
                              className="absolute inset-0 w-full h-full object-contain"
                            />
                            {photo.markup_src && (
                              <img
                                src={photo.markup_src}
                                alt="markup overlay"
                                className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none"
                              />
                            )}
                          </div>
                          <div className="mt-1.5 text-[8px] font-bold text-slate-700 leading-tight">
                            <p className="font-black">รายการที่ {item.sequence} — {item.location || 'ไม่ระบุตำแหน่ง'}</p>
                            <p className="text-slate-500 font-normal mt-0.5">
                              คำอธิบาย: {photo.caption || item.description || 'ไม่มีคำอธิบายเพิ่มเติม'}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* --- PANEL LEFT: PUNCH LIST CARDS --- */}
      <div className="lg:col-span-4 space-y-4 no-print">
        <div className="card rounded-2xl p-4 border border-slate-200 dark:border-[#1c1c34] bg-white dark:bg-[#14142a] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">รายการตรวจรับงาน (Punch Lists)</span>
            {user && (user.role === 'admin' || user.role === 'editor') && (
              <button
                onClick={handleCreateList}
                className="px-2.5 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus size={12} /> สร้างใหม่
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {punchLists.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                ไม่มีข้อมูลรายการตรวจรับ
              </div>
            ) : (
              punchLists.map((pl) => {
                const listItems = punchItems.filter((i) => i.punch_list_id === pl.id)
                const listDone = listItems.filter((i) => i.status === 'done' || i.status === 'rejected').length
                const pct = listItems.length > 0 ? Math.round((listDone / listItems.length) * 100) : 0
                const isSelected = selectedListId === pl.id

                return (
                  <div
                    key={pl.id}
                    onClick={() => setSelectedListId(pl.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50/20 dark:bg-primary-950/15'
                        : 'border-slate-200 hover:border-slate-300 dark:border-[#252548] dark:hover:border-[#333366] bg-slate-50/50 dark:bg-[#1b1b36]/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono font-bold text-slate-400 group-hover:text-primary-600 transition-colors">
                        {pl.pl_number}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                        pl.status === 'closed'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-red-500/10 text-red-600'
                      }`}>
                        {pl.status}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate pr-4">
                      {pl.title || 'ไม่มีชื่อรายการ'}
                    </h4>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 mt-3 font-medium">
                      <span>{listItems.length} รายการ</span>
                      <span>คืบหน้า {pct}%</span>
                    </div>

                    {/* mini progress indicator strip */}
                    <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* --- PANEL RIGHT: EDIT FORM & DETAILED TABLE --- */}
      <div className="lg:col-span-8 space-y-4 no-print">
        {selectedList ? (
          <div className="space-y-4">
            {/* Header Details Card */}
            <div className="card rounded-2xl p-5 border border-slate-200 dark:border-[#1c1c34] bg-white dark:bg-[#14142a] shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#252548] pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardCheck size={18} className="text-primary-500" />
                    รายละเอียดเอกสารตรวจสอบ
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="btn-secondary px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border-slate-200 cursor-pointer"
                  >
                    <Download size={14} /> Export CSV
                  </button>
                  <button
                    onClick={handleTriggerPrint}
                    className="btn-secondary px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border-slate-200 cursor-pointer"
                  >
                    <Printer size={14} /> พิมพ์รายงาน
                  </button>
                  {user && (user.role === 'admin' || user.role === 'editor') && (
                    <>
                      <button
                        onClick={handleSaveList}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer text-white ${
                          isDirty
                            ? 'bg-emerald-600 hover:bg-emerald-700 animate-pulse'
                            : 'bg-slate-400 cursor-not-allowed'
                        }`}
                        disabled={!isDirty}
                      >
                        <Save size={14} /> บันทึกข้อมูล
                      </button>
                      <button
                        onClick={handleDeleteList}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-red-600 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Grid Header Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* document number */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-400">เลขที่เอกสาร</label>
                  <input
                    type="text"
                    value={headerPlNumber}
                    onChange={(e) => {
                      setHeaderPlNumber(e.target.value)
                      setIsDirty(true)
                    }}
                    className="input-text rounded-xl"
                    placeholder="เช่น PL-001"
                  />
                </div>

                {/* document title */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-400">ชื่อหัวข้อตรวจสอบ</label>
                  <input
                    type="text"
                    value={headerTitle}
                    onChange={(e) => {
                      setHeaderTitle(e.target.value)
                      setIsDirty(true)
                    }}
                    className="input-text rounded-xl"
                    placeholder="เช่น ตรวจรับงานโครงสร้างงวด 1"
                  />
                </div>
              </div>
            </div>

            {/* Stats KPI Strip */}
            <div className="grid grid-cols-4 gap-3 text-center print:hidden">
              <div className="p-3 bg-slate-50 dark:bg-[#1a1a32]/30 border border-slate-200 dark:border-[#252548] rounded-2xl">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">ทั้งหมด</span>
                <span className="text-base font-black mt-1 block text-slate-800 dark:text-white">{stats.total}</span>
              </div>
              <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-2xl">
                <span className="text-[9px] font-black text-red-500 uppercase tracking-wider block">Open</span>
                <span className="text-base font-black mt-1 block text-red-600">{stats.open}</span>
              </div>
              <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider block">In Progress</span>
                <span className="text-base font-black mt-1 block text-blue-600">{stats.progress}</span>
              </div>
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider block">Done</span>
                <span className="text-base font-black mt-1 block text-emerald-600">{stats.done}</span>
              </div>
            </div>

            {/* Items List Table Card */}
            <div className="card rounded-2xl p-5 border border-slate-200 dark:border-[#1c1c34] bg-white dark:bg-[#14142a] shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">รายการข้อบกพร่องที่พบ (Punch Items)</span>
                {user && (user.role === 'admin' || user.role === 'editor') && (
                  <button
                    onClick={handleAddItem}
                    className="px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus size={14} /> เพิ่มรายการ
                  </button>
                )}
              </div>

              {activeItems.length === 0 ? (
                <div className="text-center py-20 text-slate-400 text-xs">
                  ยังไม่มีรายการข้อบกพร่องในเอกสารนี้ กดปุ่ม "เพิ่มรายการ" ด้านขวาบนเพื่อเริ่มต้น
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse table-layout-auto">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-[#1c1c34] bg-slate-50/50 dark:bg-[#1b1b36]/30 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-2 w-10 text-center">ลาก</th>
                        <th className="py-3 px-2 w-10 text-center">ลำดับ</th>
                        <th className="py-3 px-2 w-32">ตำแหน่ง</th>
                        <th className="py-3 px-2 w-28">ประเภท</th>
                        <th className="py-3 px-2">รายละเอียดความผิดพลาด</th>
                        <th className="py-3 px-2 w-32 text-center">วันที่บันทึกข้อมูล</th>
                        <th className="py-3 px-2 w-28 text-center">สถานะ</th>
                        <th className="py-3 px-2 w-12 text-center">รูป</th>
                        <th className="py-3 px-2 w-10 text-center">ลบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1c1c34] text-xs font-bold text-slate-700 dark:text-slate-300">
                      {activeItems.map((item, index) => {
                        const isExpanded = expandedItemIndex === index
                        return (
                          <>
                            {/* main row */}
                            <tr
                              key={item.id}
                              draggable={user?.role === 'admin' || user?.role === 'editor'}
                              onDragStart={(e) => handleDragStart(e, index)}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDrop={(e) => handleDrop(e, index)}
                              className={`hover:bg-slate-50/50 dark:hover:bg-[#1a1a36]/10 transition-colors ${
                                draggedIndex === index ? 'opacity-40 bg-slate-100' : ''
                              }`}
                            >
                              {/* Drag handle */}
                              <td className="py-3.5 px-2 text-center text-slate-300 cursor-grab active:cursor-grabbing">
                                <GripVertical size={14} className="mx-auto" />
                              </td>

                              {/* Sequence */}
                              <td className="py-3.5 px-2 text-center font-mono font-bold text-slate-400">
                                {item.sequence}
                              </td>

                              {/* Location */}
                              <td className="py-3 px-2">
                                <input
                                  type="text"
                                  value={item.location}
                                  onChange={(e) => handleEditItemField(index, 'location', e.target.value)}
                                  placeholder="เช่น ชั้น 2 ห้อง 201"
                                  className="input-text text-xs p-1"
                                  disabled={!user || (user.role !== 'admin' && user.role !== 'editor')}
                                />
                              </td>

                              {/* Category */}
                              <td className="py-3 px-2">
                                <select
                                  value={item.category}
                                  onChange={(e) => handleEditItemField(index, 'category', e.target.value as PunchItemCategory)}
                                  className="input-text text-xs p-1"
                                  disabled={!user || (user.role !== 'admin' && user.role !== 'editor')}
                                >
                                  {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Description */}
                              <td className="py-3 px-2">
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => handleEditItemField(index, 'description', e.target.value)}
                                  placeholder="คำอธิบายสั้นๆ"
                                  className="input-text text-xs p-1"
                                  disabled={!user || (user.role !== 'admin' && user.role !== 'editor')}
                                />
                              </td>

                              {/* Date Recorded */}
                              <td className="py-3 px-2 font-mono text-slate-500 text-center">
                                {item.created_at ? new Date(item.created_at).toLocaleDateString('th-TH') : '-'}
                              </td>

                              {/* Status */}
                              <td className="py-3 px-2">
                                <select
                                  value={item.status}
                                  onChange={(e) => handleEditItemField(index, 'status', e.target.value as PunchItemStatus)}
                                  className={`input-text text-xs p-1 border font-bold ${STATUS_META[item.status]?.cls}`}
                                >
                                  {STATUSES.map((stat) => (
                                    <option key={stat} value={stat}>
                                      {STATUS_META[stat]?.label}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Photo toggle button */}
                              <td className="py-3 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setExpandedItemIndex(isExpanded ? null : index)}
                                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 relative cursor-pointer"
                                >
                                  <ImageIcon size={15} className="mx-auto" />
                                  {item.photos && item.photos.length > 0 && (
                                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary-500 text-[8px] text-white font-black flex items-center justify-center">
                                      {item.photos.length}
                                    </span>
                                  )}
                                </button>
                              </td>

                              {/* Delete */}
                              <td className="py-3 px-2 text-center">
                                {user && (user.role === 'admin' || user.role === 'editor') ? (
                                  <button
                                    onClick={() => handleDeleteItem(index)}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded cursor-pointer"
                                  >
                                    <Trash2 size={14} className="mx-auto" />
                                  </button>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            </tr>

                            {/* expanded photos accordion section */}
                            {isExpanded && (
                              <tr className="bg-slate-50/50 dark:bg-[#1b1b36]/10">
                                <td colSpan={12} className="p-4">
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-[#252548] pb-2">
                                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                        📸 ภาพประกอบข้อบกพร่อง (รายการที่ {item.sequence})
                                      </span>
                                      {user && (user.role === 'admin' || user.role === 'editor') && (
                                        <label className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] hover:bg-slate-100 dark:hover:bg-[#1a1a36] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer select-none">
                                          <Plus size={12} /> แนบรูปภาพเพิ่ม
                                          <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={(e) => handleAddPhotos(e, index)}
                                            className="hidden"
                                          />
                                        </label>
                                      )}
                                    </div>

                                    {/* Photos mapping grid */}
                                    {(!item.photos || item.photos.length === 0) ? (
                                      <div className="text-center py-6 text-[10px] text-slate-400">
                                        ยังไม่ได้อัปโหลดภาพถ่ายประกอบหลักฐาน
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                        {item.photos.map((photo, photoIndex) => (
                                          <div key={photoIndex} className="p-2 border border-slate-200 dark:border-[#252548] rounded-xl bg-white dark:bg-[#14142a] space-y-2 group relative">
                                            <div className="relative w-full h-32 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 dark:border-[#252548]">
                                              {/* Original Image */}
                                              <img
                                                src={photo.src}
                                                alt="evidence"
                                                className="absolute inset-0 w-full h-full object-contain"
                                              />
                                              {/* Overlay Canvas Markup Image */}
                                              {photo.markup_src && (
                                                <img
                                                  src={photo.markup_src}
                                                  alt="drawn annotations"
                                                  className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none"
                                                />
                                              )}
                                            </div>

                                            {/* Caption input */}
                                            <input
                                              type="text"
                                              value={photo.caption || ''}
                                              onChange={(e) => handleEditPhotoCaption(index, photoIndex, e.target.value)}
                                              placeholder="เพิ่มรายละเอียดใต้ภาพ..."
                                              className="input-text text-[10px] p-1 rounded-lg"
                                            />

                                            <div className="flex items-center gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => handleOpenMarkup(index, photoIndex)}
                                                className="flex-1 px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 text-[9px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                              >
                                                <Edit3 size={10} /> วาดทับรูป
                                              </button>
                                              {user && (user.role === 'admin' || user.role === 'editor') && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemovePhoto(index, photoIndex)}
                                                  className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 text-[9px] font-bold transition-colors cursor-pointer"
                                                >
                                                  ลบรูป
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Remarks field */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 dark:border-[#252548] pt-3 text-xs">
                                      <div className="space-y-1">
                                        <label className="font-bold text-slate-400">หมายเหตุเพิ่มเติม</label>
                                        <textarea
                                          value={item.remark || ''}
                                          onChange={(e) => handleEditItemField(index, 'remark', e.target.value)}
                                          placeholder="ระบุข้อความรายละเอียดเพิ่มเติม..."
                                          className="input-text text-xs p-2.5 rounded-xl h-20"
                                        />
                                      </div>

                                      {/* Done/Rejected closed date */}
                                      {(item.status === 'done' || item.status === 'rejected') && (
                                        <div className="space-y-1">
                                          <label className="font-bold text-slate-400">วันที่ปิดรายการแก้ไข</label>
                                          <input
                                            type="date"
                                            value={item.closed_date || ''}
                                            onChange={(e) => handleEditItemField(index, 'closed_date', e.target.value)}
                                            className="input-text text-xs p-2 rounded-xl font-mono"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card rounded-2xl p-10 border border-slate-200 dark:border-[#1c1c34] bg-white dark:bg-[#14142a] text-center shadow-sm">
            <ClipboardCheck size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3 animate-pulse" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">ยินดีต้อนรับสู่ระบบตรวจสอบงาน Punch List</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              กรุณาเลือกเอกสาร Punch List ที่ด้านซ้ายมือ หรือกดปุ่ม "สร้างใหม่" เพื่อเริ่มต้นบันทึกรายการข้อบกพร่องของโครงการ
            </p>
          </div>
        )}
      </div>

      {/* --- IMAGE MARKUP CANVAS EDITOR MODAL --- */}
      {showMarkupModal && markupItemIndex !== null && markupPhotoIndex !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 no-print select-none">
          <div className="bg-white dark:bg-[#14142a] border border-slate-200 dark:border-[#252548] rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-[#252548] flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                วาดสัญลักษณ์ทับภาพข้อบกพร่อง (Image Markup Annotation)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleClearDrawing}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] text-slate-500 hover:bg-slate-50 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} /> เคลียร์ภาพวาด
                </button>
                <button
                  onClick={handleUndo}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] text-slate-500 hover:bg-slate-50 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  disabled={drawHistory.length === 0}
                >
                  <Undo size={12} /> ย้อนกลับ ({drawHistory.length})
                </button>
              </div>
            </div>

            {/* Editor Canvas Toolbar */}
            <div className="px-5 py-3 border-b border-slate-100 dark:border-[#252548] bg-slate-50/50 dark:bg-[#1a1a36]/20 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {/* Freehand Pen */}
                <button
                  onClick={() => setDrawingTool('free')}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    drawingTool === 'free' ? 'border-primary-500 bg-primary-500/10 text-primary-600' : 'border-slate-200 dark:border-[#252548] text-slate-400'
                  }`}
                  title="ปากกาเขียนอิสระ"
                >
                  <Edit3 size={16} />
                </button>

                {/* Circle Ellipse */}
                <button
                  onClick={() => setDrawingTool('circle')}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    drawingTool === 'circle' ? 'border-primary-500 bg-primary-500/10 text-primary-600' : 'border-slate-200 dark:border-[#252548] text-slate-400'
                  }`}
                  title="วงกลม"
                >
                  <Circle size={16} />
                </button>

                {/* Arrow */}
                <button
                  onClick={() => setDrawingTool('arrow')}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    drawingTool === 'arrow' ? 'border-primary-500 bg-primary-500/10 text-primary-600' : 'border-slate-200 dark:border-[#252548] text-slate-400'
                  }`}
                  title="ลูกศร"
                >
                  <MoveRight size={16} />
                </button>

                {/* Text Tool */}
                <button
                  onClick={() => setDrawingTool('text')}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    drawingTool === 'text' ? 'border-primary-500 bg-primary-500/10 text-primary-600' : 'border-slate-200 dark:border-[#252548] text-slate-400'
                  }`}
                  title="ตัวอักษร"
                >
                  <Type size={16} />
                </button>
              </div>

              {/* Color pickers */}
              <div className="flex items-center gap-2">
                {[
                  { hex: '#ef4444', label: 'แดง' },
                  { hex: '#facc15', label: 'เหลือง' },
                  { hex: '#ffffff', label: 'ขาว' },
                  { hex: '#000000', label: 'ดำ' },
                ].map((col) => (
                  <button
                    key={col.hex}
                    onClick={() => setDrawingColor(col.hex)}
                    className={`w-7 h-7 rounded-full border transition-all cursor-pointer ${
                      drawingColor === col.hex ? 'border-primary-500 scale-110 shadow-md' : 'border-slate-200'
                    }`}
                    style={{ backgroundColor: col.hex }}
                    title={col.label}
                  />
                ))}
              </div>
            </div>

            {/* Canvas editor viewport wrapper */}
            <div
              ref={containerRef}
              className="flex-1 flex items-center justify-center p-6 bg-slate-100 dark:bg-slate-900/50 overflow-auto relative"
            >
              <div className="relative shadow-lg border border-slate-200 dark:border-[#252548]">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  className="cursor-crosshair bg-transparent"
                />

                {/* Text input overlay box when placing text */}
                {textInputPos && (
                  <div
                    className="absolute z-50 flex items-center gap-1.5"
                    style={{
                      left: textInputPos.x,
                      top: textInputPos.y - 12,
                    }}
                  >
                    <input
                      ref={textInputRef}
                      type="text"
                      value={textInputValue}
                      onChange={(e) => setTextInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTextElement()
                        else if (e.key === 'Escape') setTextInputPos(null)
                      }}
                      className="px-2 py-1 rounded bg-white text-black border border-primary-500 text-xs shadow-md w-36 outline-none"
                      placeholder="พิมพ์ข้อความ..."
                    />
                    <button
                      onClick={handleSaveTextElement}
                      className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold shadow cursor-pointer"
                    >
                      ตกลง
                    </button>
                    <button
                      onClick={() => setTextInputPos(null)}
                      className="px-2 py-1 rounded bg-slate-500 text-white text-[10px] font-bold shadow cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Action Controls Footer */}
            <div className="px-5 py-4 border-t border-slate-100 dark:border-[#252548] flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowMarkupModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#252548] text-slate-500 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveMarkup}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer"
              >
                <Save size={14} /> บันทึกภาพเขียน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
