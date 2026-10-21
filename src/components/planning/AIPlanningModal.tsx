'use client'

import React, { useState, useMemo } from 'react'
import {
  X,
  Sparkles,
  FileText,
  Upload,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronRight,
  Loader2,
  Trash2,
  Download,
  FileSpreadsheet,
  Edit2,
  Plus,
  ArrowLeft,
  Check,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import type { Project, ProjectMilestone } from '@/lib/types'

interface Props {
  project: Project
  isOpen: boolean
  onClose: () => void
  onSavePlan: (milestones: ProjectMilestone[], tasks: any[], mode: 'replace' | 'append') => Promise<void>
}

interface UploadedFileItem {
  file: File
  name: string
  size: number
  mimeType: string
  base64?: string
  textPreview?: string
}

export function AIPlanningModal({ project, isOpen, onClose, onSavePlan }: Props) {
  // Step: 'input' | 'preview'
  const [step, setStep] = useState<'input' | 'preview'>('input')

  // Control Parameters (Defaults from project)
  const initialBudget = project?.budget || 0
  const [contractAmount, setContractAmount] = useState<number>(initialBudget)
  const [startDate, setStartDate] = useState<string>(project?.start_date || '')
  const [endDate, setEndDate] = useState<string>(project?.end_date || '')

  // Calculate default duration in days
  const initialDays = useMemo(() => {
    if (project?.start_date && project?.end_date) {
      const s = new Date(project.start_date)
      const e = new Date(project.end_date)
      const diffTime = Math.abs(e.getTime() - s.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
      return diffDays > 0 ? diffDays : 180
    }
    return 180
  }, [project?.start_date, project?.end_date])

  const [durationDays, setDurationDays] = useState<number>(initialDays)

  // Input Mode for Zone 1 (BOQ / ปร.5 / ปร.6)
  const [boqInputType, setBoqInputType] = useState<'file' | 'text'>('file')
  const [boqFiles, setBoqFiles] = useState<UploadedFileItem[]>([])
  const [boqText, setBoqText] = useState('')

  // Input Mode for Zone 2 (งวดงานท้ายสัญญา)
  const [milestoneInputType, setMilestoneInputType] = useState<'file' | 'text'>('file')
  const [milestoneFiles, setMilestoneFiles] = useState<UploadedFileItem[]>([])
  const [milestoneText, setMilestoneText] = useState('')

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [processStatus, setProcessStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // Preview Data
  const [generatedMilestones, setGeneratedMilestones] = useState<any[]>([])
  const [generatedTasks, setGeneratedTasks] = useState<any[]>([])
  const [activePreviewTab, setActivePreviewTab] = useState<'milestones' | 'tasks'>('milestones')
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace')
  const [isSaving, setIsSaving] = useState(false)

  if (!isOpen) return null

  // File to base64 helper
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1] || ''
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // Handle file addition for BOQ
  const handleAddBoqFiles = async (files: FileList | null) => {
    if (!files) return
    setError(null)
    const newItems: UploadedFileItem[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        // If Excel file, parse text preview with XLSX
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const buffer = await file.arrayBuffer()
          const wb = XLSX.read(buffer, { type: 'array' })
          let extracted = ''
          wb.SheetNames.forEach((s) => {
            const ws = wb.Sheets[s]
            extracted += `\n--- แผ่นงาน: ${s} ---\n`
            extracted += XLSX.utils.sheet_to_csv(ws)
          })
          newItems.push({
            file,
            name: file.name,
            size: file.size,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            textPreview: extracted.slice(0, 5000),
          })
        } else {
          const b64 = await readFileAsBase64(file)
          newItems.push({
            file,
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/pdf',
            base64: b64,
          })
        }
      } catch (err: any) {
        console.error('Error reading BOQ file:', err)
      }
    }
    setBoqFiles((prev) => [...prev, ...newItems])
  }

  // Handle file addition for Milestones
  const handleAddMilestoneFiles = async (files: FileList | null) => {
    if (!files) return
    setError(null)
    const newItems: UploadedFileItem[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const buffer = await file.arrayBuffer()
          const wb = XLSX.read(buffer, { type: 'array' })
          let extracted = ''
          wb.SheetNames.forEach((s) => {
            const ws = wb.Sheets[s]
            extracted += `\n--- แผ่นงาน: ${s} ---\n`
            extracted += XLSX.utils.sheet_to_csv(ws)
          })
          newItems.push({
            file,
            name: file.name,
            size: file.size,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            textPreview: extracted.slice(0, 5000),
          })
        } else {
          const b64 = await readFileAsBase64(file)
          newItems.push({
            file,
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/pdf',
            base64: b64,
          })
        }
      } catch (err: any) {
        console.error('Error reading milestone file:', err)
      }
    }
    setMilestoneFiles((prev) => [...prev, ...newItems])
  }

  // Run AI Analysis
  const handleGenerateAI = async () => {
    // Validate inputs
    const hasBoq = boqFiles.length > 0 || (boqText && boqText.trim().length > 0)
    const hasMilestone = milestoneFiles.length > 0 || (milestoneText && milestoneText.trim().length > 0)

    if (!hasBoq && !hasMilestone) {
      setError('กรุณาอัปโหลดเอกสารหรือระบุข้อมูลอย่างน้อย 1 ช่อง (ปร.5/ปร.6 หรือ ตารางงวดงาน)')
      return
    }

    if (contractAmount <= 0) {
      setError('กรุณาระบุวงเงินจ้างก่อสร้างที่ถูกต้อง (มากกว่า 0 บาท)')
      return
    }

    if (durationDays <= 0) {
      setError('กรุณาระบุระยะเวลาก่อสร้าง (มากกว่า 0 วัน)')
      return
    }

    setIsProcessing(true)
    setError(null)
    setProcessStatus('กำลังเตรียมข้อมูลเอกสาร ปร.5 และ ตารางงวดงาน...')

    try {
      // Aggregate texts including any text extracted from Excel files
      let combinedBoqText = boqText || ''
      boqFiles.forEach((f) => {
        if (f.textPreview) combinedBoqText += `\n[ไฟล์ ${f.name}]:\n${f.textPreview}\n`
      })

      let combinedMilestoneText = milestoneText || ''
      milestoneFiles.forEach((f) => {
        if (f.textPreview) combinedMilestoneText += `\n[ไฟล์ ${f.name}]:\n${f.textPreview}\n`
      })

      // Send payload
      setProcessStatus('AI กำลังวิเคราะห์สัดส่วนมูลค่าหมวดงานและผูกแผนงาน WBS...')

      const payload = {
        projectName: project?.name || 'โครงการ',
        contractAmount,
        durationDays,
        startDate,
        endDate,
        boqText: combinedBoqText,
        boqFiles: boqFiles.filter((f) => f.base64).map((f) => ({ name: f.name, mimeType: f.mimeType, base64: f.base64 })),
        milestoneText: combinedMilestoneText,
        milestoneFiles: milestoneFiles.filter((f) => f.base64).map((f) => ({ name: f.name, mimeType: f.mimeType, base64: f.base64 })),
      }

      const res = await fetch('/api/ai/parse-contract-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const raw = await res.text()
      let data: any = null
      try {
        data = JSON.parse(raw)
      } catch {
        throw new Error(res.status === 504 ? 'ระบบ AI ใช้เวลาประมวลผลเกินกำหนด กรุณาลองใหม่อีกครั้ง' : 'เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง')
      }

      if (!res.ok || data?.error) {
        throw new Error(data?.error || `เกิดข้อผิดพลาดในการประมวลผล (HTTP ${res.status})`)
      }

      if (data?.data) {
        setGeneratedMilestones(data.data.milestones || [])
        setGeneratedTasks(data.data.tasks || [])
        setStep('preview')
      }
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการวิเคราะห์ด้วย AI')
    } finally {
      setIsProcessing(false)
      setProcessStatus('')
    }
  }

  // Preview Totals
  const totalMilestonesAmount = useMemo(() => {
    return generatedMilestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
  }, [generatedMilestones])

  const totalTasksCost = useMemo(() => {
    return generatedTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0)
  }, [generatedTasks])

  const totalTasksDuration = useMemo(() => {
    return generatedTasks.reduce((sum, t) => sum + (Number(t.duration) || 0), 0)
  }, [generatedTasks])

  // Export generated preview to Excel
  const handleExportPreviewToExcel = () => {
    const wb = XLSX.utils.book_new()

    // Sheet 1: Milestones
    const milestoneRows = generatedMilestones.map((m) => ({
      'งวดที่': m.milestone_no,
      'ชื่องวดงาน': m.name,
      'ขอบเขตงานที่ต้องส่งมอบ': m.work_scope,
      'สัดส่วน (%)': m.percentage,
      'ยอดเงินงวด (บาท)': m.amount,
      'กำหนดส่งมอบสะสม (วัน)': m.expected_days,
    }))
    const wsM = XLSX.utils.json_to_sheet(milestoneRows)
    XLSX.utils.book_append_sheet(wb, wsM, 'งวดงาน (Milestones)')

    // Sheet 2: WBS Tasks
    const taskRows = generatedTasks.map((t) => ({
      'รหัส WBS': t.wbs_no,
      'ชื่องานกิจกรรม': t.name,
      'งวดงานที่ผูก': `งวดที่ ${t.milestone_no}`,
      'ระยะเวลา (วัน)': t.duration,
      'มูลค่างาน (บาท)': t.cost,
      'งานก่อนหน้า (Predecessors)': t.predecessors || '',
    }))
    const wsT = XLSX.utils.json_to_sheet(taskRows)
    XLSX.utils.book_append_sheet(wb, wsT, 'แผนงาน WBS (Tasks)')

    const safeName = (project.name || 'project').replace(/[\\/:*?"<>|]/g, '_')
    XLSX.writeFile(wb, `แผนงานและงวดงาน_AI_${safeName}.xlsx`)
  }

  // Confirm and Save
  const handleConfirmSave = async () => {
    setIsSaving(true)
    setError(null)
    try {
      // Format milestones to match ProjectMilestone type
      const formattedMilestones: ProjectMilestone[] = generatedMilestones.map((m, idx) => ({
        id: `ms-${Date.now()}-${idx}`,
        project_id: project.id,
        milestone_no: m.milestone_no || idx + 1,
        name: m.name || `งวดที่ ${idx + 1}`,
        work_scope: m.work_scope || '',
        amount: Number(m.amount) || 0,
        is_paid: false,
        payment_date: null,
        expected_payment_date: null,
        status: 'Pending',
        created_at: new Date().toISOString(),
      }))

      // Format tasks
      const formattedTasks = generatedTasks.map((t) => ({
        wbs_no: t.wbs_no,
        name: t.name,
        duration: Number(t.duration) || 7,
        cost: Number(t.cost) || 0,
        predecessors: t.predecessors || null,
      }))

      await onSavePlan(formattedMilestones, formattedTasks, importMode)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกแผนงาน')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#121226] border border-slate-200 dark:border-[#252548] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#202042] flex items-center justify-between bg-slate-50/80 dark:bg-[#16162e]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles size={18} className="text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>AI สร้างแผนงาน WBS และงวดงานอัตโนมัติ</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  ปร.5 / ปร.6 + งวดงาน
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                โครงการ: <span className="font-semibold text-slate-700 dark:text-slate-200">{project.name}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing || isSaving}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-[#202042] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-2 animate-shake">
              <AlertTriangle size={16} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 1: INPUT PARAMETERS & UPLOAD ZONES                     */}
          {/* ============================================================ */}
          {step === 'input' && (
            <div className="space-y-5">
              {/* Top Banner: Control Parameters (เงิน & เวลา) */}
              <div className="p-4 bg-slate-50 dark:bg-[#16162e] rounded-2xl border border-slate-200 dark:border-[#252548] space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign size={15} className="text-emerald-500" />
                    <span>ข้อมูลควบคุมหลัก (เพื่อความสัมพันธ์ เงิน - เวลา - งวดงาน)</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      💰 วงเงินจ้างก่อสร้าง (บาท) *
                    </label>
                    <input
                      type="number"
                      value={contractAmount || ''}
                      onChange={(e) => setContractAmount(Number(e.target.value) || 0)}
                      placeholder="เช่น 15000000"
                      className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      ยอดปัจจุบัน: ฿{(contractAmount || 0).toLocaleString('th-TH')}
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      ⏱️ ระยะเวลาก่อสร้างตามสัญญา (วัน) *
                    </label>
                    <input
                      type="number"
                      value={durationDays || ''}
                      onChange={(e) => setDurationDays(Number(e.target.value) || 0)}
                      placeholder="เช่น 180"
                      className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      ใช้เกลี่ยระยะเวลากิจกรรม WBS ทั้งโครงการ
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        📅 วันเริ่มสัญญา
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full text-xs px-2 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white focus:outline-none focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        📅 สิ้นสุดสัญญา
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full text-xs px-2 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white focus:outline-none focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Two Separate Upload Zones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ZONE 1: BOQ / ปร.5 / ปร.6 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#16162e] flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-black flex items-center justify-center">
                          1
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          เอกสาร ปร.5 / ปร.6 (สรุปหมวดงาน)
                        </h4>
                      </div>
                      <div className="flex rounded-lg bg-slate-100 dark:bg-[#202042] p-0.5 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setBoqInputType('file')}
                          className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                            boqInputType === 'file' ? 'bg-white dark:bg-[#121226] text-primary-600 shadow-2xs' : 'text-slate-500'
                          }`}
                        >
                          อัปโหลดไฟล์
                        </button>
                        <button
                          type="button"
                          onClick={() => setBoqInputType('text')}
                          className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                            boqInputType === 'text' ? 'bg-white dark:bg-[#121226] text-primary-600 shadow-2xs' : 'text-slate-500'
                          }`}
                        >
                          แปะข้อความ
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      ใบสรุปหมวดงาน (1–3 หน้า) เพื่อวิเคราะห์สัดส่วนมูลค่าหมวด โครงสร้าง, สถาปัตย์, ระบบ
                    </p>
                  </div>

                  {boqInputType === 'file' ? (
                    <div className="space-y-2">
                      <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-200 dark:border-[#252548] hover:border-blue-500 rounded-xl cursor-pointer bg-slate-50/50 dark:bg-[#181834] transition-all">
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.xlsx,.xls,.doc,.docx,image/*"
                          onChange={(e) => handleAddBoqFiles(e.target.files)}
                          className="hidden"
                        />
                        <Upload size={20} className="text-blue-500 mb-1" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          รองรับ PDF, Excel, Word, ภาพถ่าย (1–3 หน้า)
                        </span>
                      </label>

                      {boqFiles.length > 0 && (
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {boqFiles.map((f, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-[#1f1f3d] text-xs"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <FileText size={13} className="text-blue-500 shrink-0" />
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{f.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setBoqFiles((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-slate-400 hover:text-red-500 p-0.5 cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <textarea
                        value={boqText}
                        onChange={(e) => setBoqText(e.target.value)}
                        placeholder="วางข้อความตาราง ปร.5 / ปร.6 เช่น หมวดที่ 1 งานโครงสร้าง 4,500,000 บาท หมวดที่ 2 งานสถาปัตยกรรม..."
                        className="w-full h-32 p-3 text-xs rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>

                {/* ZONE 2: MILESTONES / งวดงาน */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#16162e] flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 text-xs font-black flex items-center justify-center">
                          2
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          ตารางงวดงานท้ายสัญญา (เงื่อนไขส่งมอบ)
                        </h4>
                      </div>
                      <div className="flex rounded-lg bg-slate-100 dark:bg-[#202042] p-0.5 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setMilestoneInputType('file')}
                          className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                            milestoneInputType === 'file' ? 'bg-white dark:bg-[#121226] text-primary-600 shadow-2xs' : 'text-slate-500'
                          }`}
                        >
                          อัปโหลดไฟล์
                        </button>
                        <button
                          type="button"
                          onClick={() => setMilestoneInputType('text')}
                          className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                            milestoneInputType === 'text' ? 'bg-white dark:bg-[#121226] text-primary-600 shadow-2xs' : 'text-slate-500'
                          }`}
                        >
                          แปะข้อความ
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      ตารางงวดงาน 1 ถึง N พร้อมเงื่อนไขการส่งมอบเงินและงาน (ปกติมี 1–3 หน้า)
                    </p>
                  </div>

                  {milestoneInputType === 'file' ? (
                    <div className="space-y-2">
                      <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-200 dark:border-[#252548] hover:border-purple-500 rounded-xl cursor-pointer bg-slate-50/50 dark:bg-[#181834] transition-all">
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.xlsx,.xls,.doc,.docx,image/*"
                          onChange={(e) => handleAddMilestoneFiles(e.target.files)}
                          className="hidden"
                        />
                        <Upload size={20} className="text-purple-500 mb-1" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          รองรับ PDF, Word, Excel, ภาพถ่าย (1–3 หน้า)
                        </span>
                      </label>

                      {milestoneFiles.length > 0 && (
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {milestoneFiles.map((f, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-[#1f1f3d] text-xs"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <FileText size={13} className="text-purple-500 shrink-0" />
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{f.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setMilestoneFiles((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-slate-400 hover:text-red-500 p-0.5 cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <textarea
                        value={milestoneText}
                        onChange={(e) => setMilestoneText(e.target.value)}
                        placeholder="วางข้อความตารางงวดงาน เช่น งวดที่ 1 จ่าย 10% เมื่อผู้รับจ้างเทคอนกรีตฐานรากเสร็จ งวดที่ 2 จ่าย 15%..."
                        className="w-full h-32 p-3 text-xs rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 2: PREVIEW & VERIFICATION TABBED VIEW                   */}
          {/* ============================================================ */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary Metric Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#16162e] border border-slate-200 dark:border-[#252548]">
                  <span className="text-[10px] font-bold text-slate-400 block">ยอดรวมงวดงาน</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    ฿{totalMilestonesAmount.toLocaleString('th-TH')}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {totalMilestonesAmount === contractAmount ? '✅ ตรงกับวงเงิน 100%' : '⚠️ ปรับแต่งยอดเงิน'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#16162e] border border-slate-200 dark:border-[#252548]">
                  <span className="text-[10px] font-bold text-slate-400 block">จำนวนงวดงาน</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                    {generatedMilestones.length} งวด
                  </span>
                  <span className="text-[10px] text-slate-500 block">ตามเงื่อนไขสัญญา</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#16162e] border border-slate-200 dark:border-[#252548]">
                  <span className="text-[10px] font-bold text-slate-400 block">กิจกรรม WBS ย่อย</span>
                  <span className="text-sm font-black text-primary-600 dark:text-primary-400 font-mono">
                    {generatedTasks.length} รายการ
                  </span>
                  <span className="text-[10px] text-slate-500 block">แตกกิจกรรมตามงวด</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#16162e] border border-slate-200 dark:border-[#252548]">
                  <span className="text-[10px] font-bold text-slate-400 block">กรอบเวลาสัญญา</span>
                  <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">
                    {durationDays} วัน
                  </span>
                  <span className="text-[10px] text-slate-500 block">เกลี่ยระยะเวลาเหมาะสม</span>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#252548] pb-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('milestones')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                      activePreviewTab === 'milestones'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1a1a38]'
                    }`}
                  >
                    <Layers size={13} />
                    <span>ตารางงวดงาน ({generatedMilestones.length} งวด)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('tasks')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                      activePreviewTab === 'tasks'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1a1a38]'
                    }`}
                  >
                    <Calendar size={13} />
                    <span>แผนงานกิจกรรม WBS ({generatedTasks.length} รายการ)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleExportPreviewToExcel}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#181834] border border-slate-200 dark:border-[#252548] hover:bg-slate-50 rounded-lg flex items-center gap-1 cursor-pointer"
                  title="ดาวน์โหลดเป็นไฟล์ Excel"
                >
                  <FileSpreadsheet size={13} className="text-emerald-500" />
                  <span>โหลด Excel</span>
                </button>
              </div>

              {/* TAB 1: MILESTONES PREVIEW */}
              {activePreviewTab === 'milestones' && (
                <div className="border border-slate-200 dark:border-[#252548] rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-[#1a1a36] text-slate-500 dark:text-slate-400 font-bold sticky top-0 border-b border-slate-200 dark:border-[#252548]">
                      <tr>
                        <th className="py-2.5 px-3 w-16 text-center">งวดที่</th>
                        <th className="py-2.5 px-3 w-32">ชื่องวด</th>
                        <th className="py-2.5 px-3">ขอบเขตงานที่ส่งมอบตามสัญญา</th>
                        <th className="py-2.5 px-3 w-20 text-center">% เงิน</th>
                        <th className="py-2.5 px-3 w-32 text-right">ยอดเงิน (บาท)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#202040] bg-white dark:bg-[#14142a]">
                      {generatedMilestones.map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-[#1a1a36]/30">
                          <td className="py-2 px-3 text-center font-bold text-purple-600 font-mono">
                            {m.milestone_no}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {m.name}
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                            {m.work_scope}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">
                            {m.percentage}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ฿{(Number(m.amount) || 0).toLocaleString('th-TH')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: TASKS PREVIEW */}
              {activePreviewTab === 'tasks' && (
                <div className="border border-slate-200 dark:border-[#252548] rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-[#1a1a36] text-slate-500 dark:text-slate-400 font-bold sticky top-0 border-b border-slate-200 dark:border-[#252548]">
                      <tr>
                        <th className="py-2.5 px-3 w-16 text-center">WBS</th>
                        <th className="py-2.5 px-3">รายการกิจกรรมก่อสร้าง</th>
                        <th className="py-2.5 px-3 w-24 text-center">งวดงาน</th>
                        <th className="py-2.5 px-3 w-24 text-center">ระยะเวลา</th>
                        <th className="py-2.5 px-3 w-32 text-right">มูลค่างาน (บาท)</th>
                        <th className="py-2.5 px-3 w-28 text-center">งานก่อนหน้า</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#202040] bg-white dark:bg-[#14142a]">
                      {generatedTasks.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-[#1a1a36]/30">
                          <td className="py-2 px-3 text-center font-bold font-mono text-slate-600 dark:text-slate-400">
                            {t.wbs_no}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {t.name}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 font-bold text-[10px]">
                              งวด {t.milestone_no}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-600 dark:text-slate-300">
                            {t.duration} วัน
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-primary-600 dark:text-primary-400">
                            {t.cost > 0 ? `฿${Number(t.cost).toLocaleString('th-TH')}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-500">
                            {t.predecessors || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Mode choice */}
              <div className="p-3 bg-slate-50 dark:bg-[#16162e] rounded-xl border border-slate-200 dark:border-[#252548] flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  รูปแบบการบันทึก:
                </span>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-purple-600"
                    />
                    <span>แทนที่แผนงานเดิมทั้งหมด (แนะนำ)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-purple-600"
                    />
                    <span>เพิ่มต่อท้ายแผนงานเดิม</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-[#202042] bg-slate-50/70 dark:bg-[#16162e] flex items-center justify-between">
          {step === 'input' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#252548] text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-purple-200" />
                    <span>{processStatus || 'กำลังประมวลผลด้วย AI...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} className="text-amber-300" />
                    <span>วิเคราะห์และสร้างแผนงานด้วย AI</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('input')}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#252548] text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={13} /> ย้อนกลับไปแก้ไข
              </button>

              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-emerald-200" />
                    <span>กำลังบันทึกแผนงานและงวดงาน...</span>
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    <span>ยืนยันบันทึกงวดงาน & แผนงาน WBS เข้าระบบ</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
