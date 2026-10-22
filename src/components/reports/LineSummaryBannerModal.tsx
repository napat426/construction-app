'use client'

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  X,
  Download,
  Copy,
  Sparkles,
  Upload,
  Image as ImageIcon,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Edit2,
  Eye,
  Layers,
  Scissors,
  Type,
  Columns,
} from 'lucide-react'
import { toBlob, toPng } from 'html-to-image'
import type {
  Project,
  WBSTask,
  ProjectMilestone,
  ContractAmendment,
  Inspection,
} from '@/lib/types'
import { computeProjectExtension } from '@/lib/scheduler'
import { compressImage } from '@/lib/image'

interface LineSummaryBannerModalProps {
  isOpen: boolean
  onClose: () => void
  project: Project
  tasks?: WBSTask[]
  milestones?: ProjectMilestone[]
  amendments?: ContractAmendment[]
  inspections?: Inspection[]
  actualProgress: number
  plannedProgress: number
  initialPhotos?: { url: string; caption?: string }[]
}

interface WorkCategory {
  id: string
  icon: string
  title: string
  bullets: string[]
}

const COMMON_ICONS = ['🛠️', '⚡', '🏗️', '🏢', '🧱', '💧', '🚗', '📋', '⚙️', '🌳']

// Clean verbose BOQ/WBS descriptions into concise executive summaries
function cleanTaskName(rawName: string): string {
  return rawName
    .replace(/^งาน\s*/, '') // Remove redundant "งาน" at start
    .replace(/\s*และอุปกรณ์ประกอบ.*$/i, '')
    .replace(/\s*และอุปกรณ์.*$/i, '')
    .replace(/\s*ทั้งหมด.*$/i, '')
    .replace(/\s*ตามแบบรูปรายการ.*$/i, '')
    .replace(/\s*ตามแบบ.*$/i, '')
    .replace(/\s*และงานอื่นๆ\s*ที่เกี่ยวข้อง.*$/i, '')
    .replace(/\s*และงานอื่นๆ.*$/i, '')
    .replace(/\s*รายการที่\s*\d+(\.\d+)*/g, '')
    .trim()
}

function formatThaiDateShort(date: Date | string | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return '—'
    const day = d.getDate()
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    ]
    const m = thaiMonths[d.getMonth()]
    const y = (d.getFullYear() + 543).toString().slice(-2)
    return `${day} ${m} ${y}`
  } catch {
    return '—'
  }
}

export function LineSummaryBannerModal({
  isOpen,
  onClose,
  project,
  tasks = [],
  milestones = [],
  amendments = [],
  inspections = [],
  actualProgress,
  plannedProgress,
  initialPhotos = [],
}: LineSummaryBannerModalProps) {
  const bannerRef = useRef<HTMLDivElement>(null)

  // Contract extension and end date
  const ext = useMemo(() => computeProjectExtension(project, amendments), [project, amendments])
  const currentEndDate = ext.newEndDate || (project.end_date ? new Date(project.end_date) : null)
  const isExtended = ext.totalAmendmentDays > 0 || amendments.length > 0

  // 1. Configurable Banner State
  const [title, setTitle] = useState<string>(() => {
    const pName = project.name || 'โครงการก่อสร้าง'
    return pName.startsWith('งาน') || pName.startsWith('โครงการ')
      ? `รายงานสถานะ${pName}`
      : `รายงานสถานะการก่อสร้าง ${pName}`
  })

  // Font size adjustments (User control: ย่อ/ขยาย ตัวอักษร)
  const [titleFontSize, setTitleFontSize] = useState<number>(18) // 11px to 28px
  const [bulletFontSize, setBulletFontSize] = useState<number>(9.5) // 7px to 14px
  const [columnRatio, setColumnRatio] = useState<'auto' | 'equal' | 'wide-left'>('auto')

  const [progressVal, setProgressVal] = useState<number>(() => {
    return Number((actualProgress || 0).toFixed(1))
  })

  const [progressLabel, setProgressLabel] = useState<string>('ผลงานสะสม(ร้อยละ)')

  const [contractEndLabel, setContractEndLabel] = useState<string>(() => {
    return isExtended ? 'ขยายสัญญากำหนดสิ้นสุด' : 'กำหนดสิ้นสุดสัญญา'
  })

  const [contractEndDateStr, setContractEndDateStr] = useState<string>(() => {
    return formatThaiDateShort(currentEndDate)
  })

  // 2. Photos State: [Left Vertical, Bottom-Left Horizontal, Bottom-Right Horizontal]
  const [photos, setPhotos] = useState<string[]>(['', '', ''])

  // Gather all available inspection photos
  const availableInspectionPhotos = useMemo(() => {
    const list: { url: string; title: string; inspection_no: string }[] = []
    inspections.forEach(ins => {
      (ins.photo_urls || []).forEach(pStr => {
        if (!pStr) return
        const parts = pStr.split('|||')
        const rawUrl = parts[0]?.trim()
        const customCaption = parts[1]?.trim()
        if (rawUrl) {
          list.push({
            url: rawUrl,
            title: customCaption || ins.title || ins.inspection_no || 'ภาพงาน',
            inspection_no: ins.inspection_no || '—',
          })
        }
      })
    })
    return list
  }, [inspections])

  // Initialize photos from initialPhotos or availableInspectionPhotos
  useEffect(() => {
    const initialUrls: string[] = ['', '', '']
    let idx = 0

    // Try initialPhotos first
    for (const p of initialPhotos) {
      if (p.url && idx < 3) {
        initialUrls[idx] = p.url
        idx++
      }
    }

    // Fill remaining with available inspection photos
    if (idx < 3) {
      for (const ip of availableInspectionPhotos) {
        if (!initialUrls.includes(ip.url) && idx < 3) {
          initialUrls[idx] = ip.url
          idx++
        }
      }
    }

    setPhotos(initialUrls)
  }, [initialPhotos, availableInspectionPhotos])

  // 3. Work Categories State (Civil, Electrical, Overall, etc.)
  const autoDraftCategories = useCallback((): WorkCategory[] => {
    const civilKeywords = ['โครงสร้าง', 'คสล', 'ฐานราก', 'เสา', 'คาน', 'พื้น', 'อาคาร', 'หลังคา', 'ผนัง', 'ประตู', 'หน้าต่าง', 'ทาสี', 'ถนน', 'ลาน', 'รั้ว', 'ท่อ', 'ระบายน้ำ', 'ดิน', 'เตรียมพื้นที่']
    const elecKeywords = ['ไฟฟ้า', 'เคเบิล', 'สายไฟ', 'หม้อแปลง', 'rmu', 'ground', 'ล่อฟ้า', 'ตู้', 'mdb', 'ส่องสว่าง', 'โคมไฟ', 'วงจร', 'สื่อสาร', 'cctv']

    const civilTasks: WBSTask[] = []
    const elecTasks: WBSTask[] = []
    const generalTasks: WBSTask[] = []

    tasks.forEach(t => {
      const name = (t.name || '').toLowerCase()
      const isCivil = civilKeywords.some(k => name.includes(k))
      const isElec = elecKeywords.some(k => name.includes(k))

      if (isElec) {
        elecTasks.push(t)
      } else if (isCivil) {
        civilTasks.push(t)
      } else {
        generalTasks.push(t)
      }
    })

    // Helper to format bullet with clean concise text
    const toBullet = (t: WBSTask) => {
      const shortName = cleanTaskName(t.name)
      const prog = t.actual_progress ?? 0
      if (prog === 100) {
        return `${shortName} แล้วเสร็จ 100%`
      } else if (prog > 0) {
        return `${shortName} แล้วเสร็จ ${prog}%`
      } else {
        return `${shortName} (เตรียมเข้าดำเนินการ)`
      }
    }

    // If project has distinct civil AND electrical works
    if (civilTasks.length > 0 && elecTasks.length > 0) {
      return [
        {
          id: 'cat-civil',
          icon: '🛠️',
          title: 'งานโยธา',
          bullets: civilTasks.slice(0, 7).map(toBullet),
        },
        {
          id: 'cat-elec',
          icon: '⚡',
          title: 'งานไฟฟ้า',
          bullets: elecTasks.slice(0, 7).map(toBullet),
        },
      ]
    }

    // If only civil or mostly one discipline
    if (civilTasks.length > 0) {
      return [
        {
          id: 'cat-civil',
          icon: '🛠️',
          title: 'งานโยธาและโครงสร้าง',
          bullets: civilTasks.slice(0, 7).map(toBullet),
        },
        {
          id: 'cat-arch',
          icon: '🏢',
          title: 'งานสถาปัตยกรรมและภูมิทัศน์',
          bullets: generalTasks.length > 0
            ? generalTasks.slice(0, 7).map(toBullet)
            : ['งานเก็บรายละเอียดความเรียบร้อย แล้วเสร็จ 100%'],
        },
      ]
    }

    // General fallback: Single or two general summaries
    if (tasks.length > 0) {
      return [
        {
          id: 'cat-main',
          icon: '🏗️',
          title: 'ภาพรวมงานก่อสร้าง',
          bullets: tasks.slice(0, 7).map(toBullet),
        },
      ]
    }

    // Default template matching reference
    return [
      {
        id: 'cat-civil',
        icon: '🛠️',
        title: 'งานโยธา',
        bullets: [
          'อาคารรับรองและ ห้องน้ำ แล้วเสร็จ 90%',
          'อาคารไฟฟ้า แล้วเสร็จ 95%',
          'หลังคาลานอัดประจุ แล้วเสร็จ 100%',
          'งาน Duct bank 100%',
          'งานลานคอนกรีต 95%',
          'งานท่อระบบระบายน้ำ 85%',
          'งานรั้วคาวบอย 80% งานทางเท้า 30%',
        ],
      },
      {
        id: 'cat-elec',
        icon: '⚡',
        title: 'งานไฟฟ้า',
        bullets: [
          'จัดทำ Ground Grid แล้วเสร็จ 100%',
          'งานสายเคเบิลไฟฟ้าแรงสูง ตู้ RMU ติดตั้งและทดสอบเรียบร้อยแล้ว ติดตั้งมิเตอร์ไฟฟ้า แล้วเสร็จ 100%',
          'งานสายเคเบิลไฟฟ้าแรงต่ำจ่ายไฟให้ ตู้ชาร์ต ลากสายแล้วเสร็จ',
          'ตู้ MDB ติดตั้งแล้ว อยู่ระหว่างงานเข้าหัวสาย',
        ],
      },
    ]
  }, [tasks])

  const [categories, setCategories] = useState<WorkCategory[]>(() => autoDraftCategories())

  // Reset to auto draft if opened
  const handleResetDraft = () => {
    setCategories(autoDraftCategories())
    setProgressVal(Number((actualProgress || 0).toFixed(1)))
    setContractEndDateStr(formatThaiDateShort(currentEndDate))
  }

  // 4. Photo Picker Modal State
  const [activePhotoSlot, setActivePhotoSlot] = useState<number | null>(null)
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleOpenPhotoPicker = (slotIdx: number) => {
    setActivePhotoSlot(slotIdx)
    setIsPhotoPickerOpen(true)
  }

  const handleSelectPhoto = (url: string) => {
    if (activePhotoSlot !== null) {
      const next = [...photos]
      next[activePhotoSlot] = url
      setPhotos(next)
    }
    setIsPhotoPickerOpen(false)
    setActivePhotoSlot(null)
  }

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || activePhotoSlot === null) return

    setIsUploading(true)
    try {
      const compressed = await compressImage(file, 1600, 0.85)
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        if (dataUrl) {
          const next = [...photos]
          next[activePhotoSlot] = dataUrl
          setPhotos(next)
        }
        setIsUploading(false)
        setIsPhotoPickerOpen(false)
        setActivePhotoSlot(null)
      }
      reader.readAsDataURL(compressed)
    } catch (err) {
      console.error('Error uploading photo:', err)
      setIsUploading(false)
    }
  }

  const handleRemovePhoto = (slotIdx: number) => {
    const next = [...photos]
    next[slotIdx] = ''
    setPhotos(next)
  }

  // Category manipulation
  const handleAddCategory = () => {
    if (categories.length >= 3) return
    const newCat: WorkCategory = {
      id: `cat-${Date.now()}`,
      icon: '📋',
      title: 'งานเพิ่มเติม',
      bullets: ['รายการงานความก้าวหน้า 100%'],
    }
    setCategories([...categories, newCat])
  }

  const handleRemoveCategory = (id: string) => {
    if (categories.length <= 1) return
    setCategories(categories.filter(c => c.id !== id))
  }

  const handleCategoryTitleChange = (id: string, val: string) => {
    setCategories(categories.map(c => c.id === id ? { ...c, title: val } : c))
  }

  const handleCategoryIconChange = (id: string, val: string) => {
    setCategories(categories.map(c => c.id === id ? { ...c, icon: val } : c))
  }

  const handleBulletsChange = (id: string, text: string) => {
    const lines = text.split('\n').filter(l => l.trim().length > 0)
    setCategories(categories.map(c => c.id === id ? { ...c, bullets: lines } : c))
  }

  // Auto clean bullets for a specific category
  const handleCleanCategoryBullets = (id: string) => {
    setCategories(categories.map(c => {
      if (c.id !== id) return c
      const cleaned = c.bullets.map(b => {
        const progMatch = b.match(/(แล้วเสร็จ\s*\d+(?:\.\d+)?%|\(เตรียมเข้าดำเนินการ\)|อยู่ระหว่าง.+|\d+(?:\.\d+)?%)$/)
        const progText = progMatch ? progMatch[0] : ''
        const main = progText ? b.replace(progText, '').trim() : b
        const cleanedMain = cleanTaskName(main)
        return progText ? `${cleanedMain} ${progText}` : cleanedMain
      })
      return { ...c, bullets: cleaned }
    }))
  }

  // Grid layout calculation for categories
  const resolvedGridColumns = useMemo(() => {
    if (categories.length === 1) return '1fr'
    if (categories.length === 3) return '1fr 1fr 1fr'

    // Exactly 2 categories
    if (columnRatio === 'equal') return '1fr 1fr'
    if (columnRatio === 'wide-left') return '1.6fr 1fr'

    // 'auto' mode: if cat 1 has significantly more items than cat 2
    const len1 = categories[0]?.bullets?.length || 0
    const len2 = categories[1]?.bullets?.length || 0
    if (len1 >= 5 && len2 <= 2) return '1.6fr 1fr'
    if (len2 >= 5 && len1 <= 2) return '1fr 1.6fr'
    return '1fr 1fr'
  }, [categories, columnRatio])

  // Export handlers
  const [isExporting, setIsExporting] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  const handleDownloadImage = async () => {
    if (!bannerRef.current) return
    setIsExporting(true)
    try {
      const dataUrl = await toPng(bannerRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      })
      const link = document.createElement('a')
      const sanitizedName = (project.name || 'project').replace(/[/\\?%*:|"<>]/g, '_')
      link.download = `Status_Summary_${sanitizedName}_16x9.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Error exporting image:', err)
      alert('เกิดข้อผิดพลาดในการดาวน์โหลดรูปภาพ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsExporting(false)
    }
  }

  const handleCopyImage = async () => {
    if (!bannerRef.current) return
    setIsExporting(true)
    try {
      const blob = await toBlob(bannerRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      })
      if (blob && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ])
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 3500)
      } else {
        // Fallback to download
        handleDownloadImage()
      }
    } catch (err) {
      console.error('Clipboard copy error:', err)
      handleDownloadImage()
    } finally {
      setIsExporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-[1440px] flex flex-col max-h-[95vh] shadow-2xl overflow-hidden text-white">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/70 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Type size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">สร้างการ์ดสรุปสถานะโครงการ 16:9 สำหรับส่ง LINE</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  สัดส่วน 16:9 (Full HD)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                สามารถปรับขนาดตัวอักษร, ตัดทอนคำให้กระชับ, คัดเลือกรูปภาพ 3 รูป และสรุปความก้าวหน้าตามหมวดงานได้อิสระ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {copySuccess && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-bold animate-fade-in">
                <Check size={14} /> คัดลอกรูปแล้ว! กด Ctrl+V ใน LINE ได้ทันที
              </span>
            )}

            <button
              type="button"
              onClick={handleCopyImage}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              title="คัดลอกรูปภาพลง Clipboard เพื่อนำไปกดวาง (Ctrl+V) ในแชท LINE ได้ทันที"
            >
              <Copy size={14} />
              <span>{isExporting ? 'กำลังประมวลผล...' : '📋 คัดลอกรูปส่ง LINE (Ctrl+V)'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-primary-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download size={14} />
              <span>💾 ดาวน์โหลดรูปภาพ (PNG)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: Two Columns (Left: Controls, Right: Live 16:9 Canvas Preview) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          
          {/* Left Panel: Controls */}
          <div className="w-full lg:w-[440px] flex-shrink-0 bg-slate-900/90 border-r border-slate-800 p-4.5 overflow-y-auto space-y-4">
            
            {/* Action Bar */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Edit2 size={13} className="text-cyan-400" />
                ตั้งค่าข้อความและขนาดอักษร
              </span>
              <button
                type="button"
                onClick={handleResetDraft}
                className="flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                title="ดึงข้อมูลจาก WBS และสัญญามาสร้างข้อความอัตโนมัติ"
              >
                <Sparkles size={12} />
                <span>✨ รีเซ็ตตาม WBS</span>
              </button>
            </div>

            {/* Title & Font Size Controls */}
            <div className="space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-400">
                    หัวข้อรายงาน (Title)
                  </label>

                  {/* Title font size zoom controls */}
                  <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                    <span className="text-[10px] text-slate-400 font-bold">ขนาดหัวข้อ:</span>
                    <button
                      type="button"
                      onClick={() => setTitleFontSize(prev => Math.max(11, prev - 1))}
                      className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold flex items-center justify-center cursor-pointer transition-colors"
                      title="ย่อขนาดตัวอักษรหัวข้อ (A-)"
                    >
                      A-
                    </button>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold w-6 text-center">{titleFontSize}px</span>
                    <button
                      type="button"
                      onClick={() => setTitleFontSize(prev => Math.min(26, prev + 1))}
                      className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold flex items-center justify-center cursor-pointer transition-colors"
                      title="ขยายขนาดตัวอักษรหัวข้อ (A+)"
                    >
                      A+
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                  placeholder="เช่น รายงานสถานะการก่อสร้าง..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    ผลงานสะสม (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={progressVal}
                    onChange={(e) => setProgressVal(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    ป้ายหัวข้อผลงาน
                  </label>
                  <input
                    type="text"
                    value={progressLabel}
                    onChange={(e) => setProgressLabel(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    ป้ายกำหนดสัญญา
                  </label>
                  <input
                    type="text"
                    value={contractEndLabel}
                    onChange={(e) => setContractEndLabel(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    วันสิ้นสุดสัญญา
                  </label>
                  <input
                    type="text"
                    value={contractEndDateStr}
                    onChange={(e) => setContractEndDateStr(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Photo Slots Controls */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <ImageIcon size={13} className="text-cyan-400" />
                  รูปภาพประกอบ (3 รูป)
                </span>
                <span className="text-[10px] text-slate-500">1 แนวตั้ง + 2 แนวนอน</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'รูป 1: ซ้าย (แนวตั้ง)', idx: 0, isTall: true },
                  { label: 'รูป 2: ขวาล่าง (ซ้าย)', idx: 1, isTall: false },
                  { label: 'รูป 3: ขวาล่าง (ขวา)', idx: 2, isTall: false },
                ].map(({ label, idx, isTall }) => (
                  <div key={idx} className="flex flex-col gap-1">
                    <div
                      onClick={() => handleOpenPhotoPicker(idx)}
                      className={`relative rounded-xl border-2 border-dashed ${
                        photos[idx]
                          ? 'border-cyan-500/50 bg-slate-800'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                      } ${isTall ? 'h-20' : 'h-14'} flex flex-col items-center justify-center overflow-hidden cursor-pointer group transition-all`}
                    >
                      {photos[idx] ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photos[idx]}
                            alt={label}
                            crossOrigin="anonymous"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] font-bold">
                            เปลี่ยนรูป
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemovePhoto(idx)
                            }}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="ลบรูปนี้"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-1">
                          <ImageIcon size={15} className="mx-auto text-slate-500 mb-0.5" />
                          <span className="text-[9px] text-slate-400 block font-bold">+ เลือกรูป</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-400 text-center font-medium truncate">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Work Categories Controls */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Layers size={13} className="text-cyan-400" />
                  หมวดงาน ({categories.length} หมวด)
                </span>

                <div className="flex items-center gap-1.5">
                  {/* Bullets Font Size Control (ย่อ/ขยาย ขนาดรายการงาน) */}
                  <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                    <span className="text-[10px] text-slate-400 font-bold">ขนาดรายการ:</span>
                    <button
                      type="button"
                      onClick={() => setBulletFontSize(prev => Math.max(7, Number((prev - 0.5).toFixed(1))))}
                      className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold flex items-center justify-center cursor-pointer transition-colors"
                      title="ย่อขนาดตัวอักษรรายการงาน (A-)"
                    >
                      A-
                    </button>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold w-6 text-center">{bulletFontSize}px</span>
                    <button
                      type="button"
                      onClick={() => setBulletFontSize(prev => Math.min(13, Number((prev + 0.5).toFixed(1))))}
                      className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold flex items-center justify-center cursor-pointer transition-colors"
                      title="ขยายขนาดตัวอักษรรายการงาน (A+)"
                    >
                      A+
                    </button>
                  </div>

                  {categories.length < 3 && (
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>เพิ่มหมวด</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Column width ratio selector if 2 categories */}
              {categories.length === 2 && (
                <div className="flex items-center justify-between text-[10px] bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/60">
                  <span className="text-slate-400 font-bold flex items-center gap-1">
                    <Columns size={12} className="text-cyan-400" /> สัดส่วนคอลัมน์:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setColumnRatio('auto')}
                      className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                        columnRatio === 'auto'
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                      title="ปรับความกว้างอัตโนมัติตามจำนวนรายการข้อความ"
                    >
                      อัตโนมัติ
                    </button>
                    <button
                      type="button"
                      onClick={() => setColumnRatio('wide-left')}
                      className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                        columnRatio === 'wide-left'
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                      title="ให้หมวดซ้ายกว้าง 65% (เหมาะสำหรับหมวดซ้ายที่มีหลายข้อ)"
                    >
                      ซ้ายกว้าง (65:35)
                    </button>
                    <button
                      type="button"
                      onClick={() => setColumnRatio('equal')}
                      className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                        columnRatio === 'equal'
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                      title="แบ่งพื้นที่เท่ากัน 50:50"
                    >
                      เท่ากัน (50:50)
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {/* Icon selector */}
                        <select
                          value={cat.icon}
                          onChange={(e) => handleCategoryIconChange(cat.id, e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                        >
                          {COMMON_ICONS.map((ic) => (
                            <option key={ic} value={ic}>
                              {ic}
                            </option>
                          ))}
                        </select>

                        {/* Title input */}
                        <input
                          type="text"
                          value={cat.title}
                          onChange={(e) => handleCategoryTitleChange(cat.id, e.target.value)}
                          className="flex-1 min-w-0 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-bold focus:outline-none focus:border-cyan-500"
                          placeholder="ชื่อหมวดงาน เช่น งานโยธา"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Clean verbose wording button */}
                        <button
                          type="button"
                          onClick={() => handleCleanCategoryBullets(cat.id)}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-700 hover:bg-cyan-600 text-cyan-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                          title="ตัดคำยาวเยิ่นเย้อออกอัตโนมัติ เช่น 'และอุปกรณ์ประกอบ', 'ตามแบบรูปรายการ' ให้ข้อความกระชับ"
                        >
                          <Scissors size={11} />
                          <span>ตัดคำให้กระชับ</span>
                        </button>

                        {categories.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCategory(cat.id)}
                            className="w-6 h-6 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                            title="ลบหมวดนี้ออก (หากไม่มีงานด้านนี้)"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span>รายการความก้าวหน้า (บรรทัดละ 1 ข้อ)</span>
                        <span className="text-cyan-400 font-bold">{cat.bullets.length} ข้อความ</span>
                      </div>
                      <textarea
                        rows={Math.min(7, Math.max(3, cat.bullets.length))}
                        value={cat.bullets.join('\n')}
                        onChange={(e) => handleBulletsChange(cat.id, e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500 leading-relaxed font-sans"
                        placeholder="พิมพ์รายการงานในหมวดนี้ เช่น&#10;• อาคารรับรอง แล้วเสร็จ 90%&#10;• งานท่อระบายน้ำ 85%"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Panel: Live 16:9 Canvas Preview */}
          <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-3 lg:p-6 overflow-y-auto">
            <div className="w-full max-w-[1020px] flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span className="flex items-center gap-1.5">
                  <Eye size={13} className="text-cyan-400" />
                  ตัวอย่างรูปภาพจริงขนาด 16:9 (พร้อมส่งเข้า LINE)
                </span>
                <span className="text-[11px] text-slate-500">
                  เรนเดอร์ขนาดความละเอียดสูง 1920 × 1080 px
                </span>
              </div>

              {/* ── THE 16:9 BANNER CANVAS CONTAINER ── */}
              <div className="w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-white">
                <div
                  ref={bannerRef}
                  id="line-summary-banner-16-9"
                  style={{
                    aspectRatio: '16 / 9',
                    width: '100%',
                    backgroundColor: '#e6f4fa',
                    boxSizing: 'border-box',
                    padding: '16px 20px 16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    fontFamily: `'Sarabun', -apple-system, BlinkMacSystemFont, sans-serif`,
                    color: '#0f172a',
                    userSelect: 'none',
                  }}
                >
                  {/* ── Top Header Row ── */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                      flexShrink: 0,
                      gap: '10px',
                    }}
                  >
                    {/* Left: Project Title (Fully visible, wraps gracefully up to 2 lines, adjustable font size) */}
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        padding: '6px 16px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                        border: '1.5px solid #bae6fd',
                        display: 'flex',
                        alignItems: 'center',
                        maxWidth: '65%',
                        flex: '1 1 auto',
                        minHeight: '44px',
                      }}
                    >
                      <h1
                        style={{
                          margin: 0,
                          fontSize: `clamp(11px, ${titleFontSize * 0.12}vw, ${titleFontSize}px)`,
                          fontWeight: 800,
                          color: '#0369a1',
                          letterSpacing: '-0.01em',
                          lineHeight: 1.25,
                          wordBreak: 'break-word',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                        title={title}
                      >
                        {title}
                      </h1>
                    </div>

                    {/* Right: Badges */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'stretch',
                        gap: '8px',
                        flexShrink: 0,
                      }}
                    >
                      {/* Badge 1: Progress (Orange) */}
                      <div
                        style={{
                          backgroundColor: '#f59e0b',
                          borderRadius: '12px',
                          padding: '4px 16px',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(245,158,11,0.25)',
                          minWidth: '105px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 'clamp(8px, 1.1vw, 11px)',
                            fontWeight: 700,
                            color: '#0c4a6e',
                            lineHeight: 1.2,
                          }}
                        >
                          {progressLabel}
                        </div>
                        <div
                          style={{
                            fontSize: 'clamp(16px, 2.4vw, 26px)',
                            fontWeight: 900,
                            color: '#0c4a6e',
                            lineHeight: 1.1,
                          }}
                        >
                          {progressVal.toFixed(1)}%
                        </div>
                      </div>

                      {/* Badge 2: Contract End Date (Deep Blue) */}
                      <div
                        style={{
                          backgroundColor: '#0369a1',
                          borderRadius: '12px',
                          padding: '4px 16px',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(3,105,161,0.25)',
                          minWidth: '120px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 'clamp(8px, 1.1vw, 11px)',
                            fontWeight: 700,
                            color: '#e0f2fe',
                            lineHeight: 1.2,
                          }}
                        >
                          {contractEndLabel}
                        </div>
                        <div
                          style={{
                            fontSize: 'clamp(14px, 2.1vw, 22px)',
                            fontWeight: 900,
                            color: '#ffffff',
                            lineHeight: 1.1,
                          }}
                        >
                          {contractEndDateStr}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Main Content Grid (16:9 Split) ── */}
                  <div
                    style={{
                      flex: 1,
                      display: 'grid',
                      gridTemplateColumns: '37% 63%',
                      gap: '12px',
                      minHeight: 0,
                    }}
                  >
                    {/* Left Column: Tall Vertical Photo Slot 1 */}
                    <div
                      style={{
                        height: '100%',
                        borderRadius: '14px',
                        overflow: 'hidden',
                        backgroundColor: '#cbd5e1',
                        boxShadow: '0 3px 8px rgba(0,0,0,0.08)',
                        border: '2px solid #ffffff',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {photos[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photos[0]}
                          alt="ภาพหลักโครงการ"
                          crossOrigin="anonymous"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', color: '#64748b' }}>
                          <span style={{ fontSize: '28px', display: 'block', marginBottom: '4px' }}>📷</span>
                          <span style={{ fontSize: '11px', fontWeight: 600 }}>คลิกเลือกรูปภาพหลัก (แนวตั้ง)</span>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Top Category Cards + Bottom 2 Photos */}
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        minHeight: 0,
                      }}
                    >
                      {/* Top Half: Work Category Cards (Supports natural wrapping, NO ellipsis cutoffs) */}
                      <div
                        style={{
                          flex: 1,
                          display: 'grid',
                          gridTemplateColumns: resolvedGridColumns,
                          gap: '10px',
                          minHeight: 0,
                        }}
                      >
                        {categories.map((cat) => (
                          <div
                            key={cat.id}
                            style={{
                              backgroundColor: '#ffffff',
                              borderRadius: '14px',
                              padding: '8px 12px',
                              border: '1.5px solid #bae6fd',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: 'hidden',
                            }}
                          >
                            {/* Category Header */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                marginBottom: '5px',
                                paddingBottom: '3px',
                                borderBottom: '1px solid #f0f9ff',
                                flexShrink: 0,
                              }}
                            >
                              <span style={{ fontSize: 'clamp(12px, 1.4vw, 16px)' }}>{cat.icon}</span>
                              <h3
                                style={{
                                  margin: 0,
                                  fontSize: 'clamp(11px, 1.3vw, 15px)',
                                  fontWeight: 800,
                                  color: '#0369a1',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {cat.title}
                              </h3>
                            </div>

                            {/* Bullets List: Wraps text naturally with NO ellipsis, bold progress highlight */}
                            <div
                              style={{
                                flex: 1,
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: cat.bullets.length >= 7 ? '2px' : '4px',
                                justifyContent: 'flex-start',
                              }}
                            >
                              {cat.bullets.slice(0, 8).map((b, bIdx) => {
                                // Extract trailing progress (e.g. "แล้วเสร็จ 100%", "แล้วเสร็จ 50%", "(เตรียมเข้าดำเนินการ)")
                                const progRegex = /(แล้วเสร็จ\s*\d+(?:\.\d+)?%|\(เตรียมเข้าดำเนินการ\)|อยู่ระหว่าง.+|\d+(?:\.\d+)?%)$/
                                const progMatch = b.match(progRegex)
                                const progText = progMatch ? progMatch[0] : ''
                                const mainText = progText ? b.replace(progRegex, '').trim() : b

                                return (
                                  <div
                                    key={bIdx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: '4px',
                                      fontSize: `clamp(6.8px, ${bulletFontSize * 0.1}vw, ${bulletFontSize}px)`,
                                      color: '#1e293b',
                                      lineHeight: 1.25,
                                      fontWeight: 500,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: '4px',
                                        height: '4px',
                                        borderRadius: '50%',
                                        backgroundColor: '#0284c7',
                                        flexShrink: 0,
                                        marginTop: '4.5px',
                                      }}
                                    />
                                    <div
                                      style={{
                                        flex: 1,
                                        minWidth: 0,
                                        wordBreak: 'break-word',
                                        whiteSpace: 'normal',
                                      }}
                                    >
                                      <span>{mainText} </span>
                                      {progText && (
                                        <span
                                          style={{
                                            fontWeight: 700,
                                            color: progText.includes('100%')
                                              ? '#059669'
                                              : progText.includes('%')
                                              ? '#0284c7'
                                              : '#d97706',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {progText}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Bottom Half: 2 Horizontal Photos */}
                      <div
                        style={{
                          height: '46%',
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '10px',
                          minHeight: 0,
                        }}
                      >
                        {/* Slot 2: Bottom Center Photo */}
                        <div
                          style={{
                            height: '100%',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            backgroundColor: '#cbd5e1',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                            border: '2px solid #ffffff',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {photos[1] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photos[1]}
                              alt="ภาพมุมกว้าง 1"
                              crossOrigin="anonymous"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                          ) : (
                            <div style={{ textAlign: 'center', color: '#64748b' }}>
                              <span style={{ fontSize: '20px', display: 'block' }}>📷</span>
                              <span style={{ fontSize: '9px', fontWeight: 600 }}>เลือกรูปมุมกว้าง 1</span>
                            </div>
                          )}
                        </div>

                        {/* Slot 3: Bottom Right Photo */}
                        <div
                          style={{
                            height: '100%',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            backgroundColor: '#cbd5e1',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                            border: '2px solid #ffffff',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {photos[2] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photos[2]}
                              alt="ภาพมุมกว้าง 2"
                              crossOrigin="anonymous"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                          ) : (
                            <div style={{ textAlign: 'center', color: '#64748b' }}>
                              <span style={{ fontSize: '20px', display: 'block' }}>📷</span>
                              <span style={{ fontSize: '9px', fontWeight: 600 }}>เลือกรูปมุมกว้าง 2</span>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>

              {/* Tips & Shortcuts below preview */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-2 pt-0.5">
                <span>💡 คลิกปุ่ม <strong>&apos;📋 คัดลอกรูปส่ง LINE&apos;</strong> ด้านบน แล้วเปิดแชท LINE กด <strong>Ctrl+V</strong> เพื่อส่งได้ทันที!</span>
                <span>อัตราส่วน 16:9 • ปรับขยาย A+ / ย่อ A- ได้ทุกข้อความ</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ── Photo Picker Sub-Modal ── */}
      {isPhotoPickerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-white">
            
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <ImageIcon size={16} className="text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  เลือกรูปภาพสำหรับช่องที่ {activePhotoSlot !== null ? activePhotoSlot + 1 : 1}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPhotoPickerOpen(false)
                  setActivePhotoSlot(null)
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 bg-slate-950/30 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                หรืออัปโหลดรูปภาพใหม่จากคอมพิวเตอร์ของคุณ
              </span>
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm">
                <Upload size={13} />
                <span>{isUploading ? 'กำลังอัปโหลด...' : '📁 เลือกไฟล์จากคอมพิวเตอร์'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadPhoto}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex-1 p-4 overflow-y-auto min-h-0">
              <div className="text-xs font-bold text-slate-400 mb-2.5">
                ภาพจากใบตรวจสอบคุณภาพของโครงการ ({availableInspectionPhotos.length} รูป):
              </div>

              {availableInspectionPhotos.length === 0 ? (
                <div className="text-center py-10 bg-slate-800/40 rounded-xl border border-dashed border-slate-700">
                  <ImageIcon size={24} className="mx-auto text-slate-500 mb-2" />
                  <p className="text-xs text-slate-400">ยังไม่มีรูปภาพในใบขอตรวจคุณภาพ</p>
                  <p className="text-[11px] text-slate-500 mt-1">สามารถกดปุ่ม &apos;เลือกไฟล์จากคอมพิวเตอร์&apos; ด้านบนเพื่ออัปโหลดได้เลย</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {availableInspectionPhotos.map((p, pIdx) => (
                    <div
                      key={pIdx}
                      onClick={() => handleSelectPhoto(p.url)}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-800 hover:border-cyan-400 transition-all cursor-pointer shadow-xs"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={p.title}
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 text-left">
                        <span className="text-[10px] font-bold text-white truncate block">
                          {p.title}
                        </span>
                        <span className="text-[9px] text-cyan-300 truncate block">
                          {p.inspection_no}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsPhotoPickerOpen(false)
                  setActivePhotoSlot(null)
                }}
                className="px-4 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
