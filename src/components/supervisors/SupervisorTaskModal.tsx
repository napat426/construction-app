'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, Plus, Trash2, ImagePlus, AlertTriangle, Sparkles, Loader2, Upload } from 'lucide-react'
import type { SupervisorTask, SupervisorTaskGroup, Project } from '@/lib/types'
import { uploadReportPhoto } from '@/app/actions/reports'

interface Props {
  initialTask?: Partial<SupervisorTask> | null
  groups: SupervisorTaskGroup[]
  projects: Project[]
  supervisor: string
  defaultGroupId?: string
  onClose: () => void
  onSave: (task: Partial<SupervisorTask> & { supervisor: string; title: string; group_id: string }) => Promise<void>
}

export function SupervisorTaskModal({
  initialTask,
  groups,
  projects,
  supervisor,
  defaultGroupId,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState(initialTask?.title || '')
  const [groupId, setGroupId] = useState(initialTask?.group_id || defaultGroupId || (groups[0]?.id || ''))
  const [description, setDescription] = useState(initialTask?.description || '')
  const [startDate, setStartDate] = useState(initialTask?.start_date || new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(initialTask?.due_date || new Date().toISOString().split('T')[0])
  const [completedDate, setCompletedDate] = useState(
    initialTask?.completed_date || new Date().toISOString().split('T')[0]
  )
  const [status, setStatus] = useState<any>(initialTask?.status || 'completed')
  const [hasIssue, setHasIssue] = useState(Boolean(initialTask?.has_issue))
  const [issueDetail, setIssueDetail] = useState(initialTask?.issue_detail || '')
  const [issueSolution, setIssueSolution] = useState(initialTask?.issue_solution || '')
  const [relatedProjectId, setRelatedProjectId] = useState(initialTask?.related_project_id || '')
  const [photoUrls, setPhotoUrls] = useState<string[]>(initialTask?.photo_urls || [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [error, setError] = useState('')

  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea to fit all text dynamically
  useEffect(() => {
    if (descriptionRef.current) {
      descriptionRef.current.style.height = 'auto'
      descriptionRef.current.style.height = `${Math.max(90, descriptionRef.current.scrollHeight)}px`
    }
  }, [description])

  const handleFileUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return
    setIsUploadingPhotos(true)
    setError('')
    try {
      const fileArray = Array.from(files)
      const uploadPromises = fileArray.map(async (file) => {
        try {
          const res = await uploadReportPhoto(file)
          if (res.url) return res.url
        } catch (e) {
          console.warn('Upload to storage failed, falling back to base64:', e)
        }
        // Fallback to base64 DataURL if storage upload encounters network/bucket issue
        return new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (event) => resolve(event.target?.result as string)
          reader.readAsDataURL(file)
        })
      })

      const uploaded = await Promise.all(uploadPromises)
      setPhotoUrls((prev) => [...prev, ...uploaded.filter(Boolean)])
    } catch (err: any) {
      setError(err.message || 'อัปโหลดรูปภาพไม่สำเร็จ')
    } finally {
      setIsUploadingPhotos(false)
    }
  }

  const handleRemovePhoto = (idx: number) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  const handleAnalyzeWithAI = async () => {
    if (photoUrls.length === 0) {
      setError('กรุณาอัปโหลดรูปถ่ายหน้างานอย่างน้อย 1 รูป ก่อนให้ AI วิเคราะห์')
      return
    }

    if (title.trim() || description.trim()) {
      const ok = confirm(
        'มีข้อความอยู่ในช่อง "ชื่องาน" หรือ "รายละเอียดผลการดำเนินงาน" อยู่แล้ว\n\nต้องการให้ AI วิเคราะห์รูปภาพแล้วกรอกข้อมูลทับของเดิมหรือไม่?'
      )
      if (!ok) return
    }

    setIsAnalyzingAI(true)
    setError('')
    setAiMessage('')

    try {
      const selectedGroup = groups.find((g) => g.id === groupId)
      const selectedProject = projects.find((p) => p.id === relatedProjectId)

      const res = await fetch('/api/ai/analyze-supervisor-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photos: photoUrls,
          supervisor,
          groupName: selectedGroup?.name,
          relatedProjectName: selectedProject?.name,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพด้วย AI')
      }

      if (data.data) {
        const { title: aiTitle, description: aiDesc, has_issue, issue_detail, issue_solution } = data.data
        if (aiTitle) setTitle(aiTitle)
        if (aiDesc) setDescription(aiDesc)
        if (has_issue) {
          setHasIssue(true)
          if (issue_detail) setIssueDetail(issue_detail)
          if (issue_solution) setIssueSolution(issue_solution)
        }
        setAiMessage('✨ AI วิเคราะห์รูปภาพและกรอก ชื่องาน และ รายละเอียดผลการดำเนินงาน ให้เรียบร้อยแล้ว!')
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ AI')
    } finally {
      setIsAnalyzingAI(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('กรุณาระบุชื่องาน')
      return
    }
    if (!groupId) {
      setError('กรุณาเลือกกลุ่มงาน')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await onSave({
        id: initialTask?.id,
        supervisor,
        group_id: groupId,
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate || null,
        due_date: dueDate || null,
        completed_date: completedDate || null,
        status,
        has_issue: hasIssue,
        issue_detail: hasIssue ? issueDetail.trim() : null,
        issue_solution: hasIssue ? issueSolution.trim() : null,
        related_project_id: relatedProjectId || null,
        photo_urls: photoUrls,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-[#121226] border border-slate-200 dark:border-[#252548] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#202042] flex items-center justify-between bg-slate-50/70 dark:bg-[#16162e]">
          <div>
            <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider block">
              {supervisor}
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {initialTask?.id ? '✏️ แก้ไขภารกิจย่อย' : '➕ บันทึกภารกิจย่อยใหม่'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-[#202042] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 font-semibold">
              ⚠️ {error}
            </div>
          )}

          {aiMessage && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/25 rounded-xl text-xs text-purple-700 dark:text-purple-300 font-semibold flex items-center gap-2">
              <Sparkles size={16} className="text-purple-500 shrink-0" />
              <span>{aiMessage}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              ชื่องาน / ภารกิจที่ปฏิบัติ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น สำรวจระดับดินและแนวเขต กฟส.อ้อมน้อย (2 วัน)"
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 font-medium"
            />
          </div>

          {/* Group and Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                กลุ่มงาน <span className="text-red-500">*</span>
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 font-medium"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    📁 {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                สถานะงาน
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 font-medium"
              >
                <option value="completed">✅ สำเร็จแล้ว</option>
                <option value="in_progress">⏳ กำลังดำเนินการ</option>
                <option value="delayed">⚠️ ล่าช้ากว่ากำหนด</option>
                <option value="pending">⏸️ รอดำเนินการ</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">วันที่เริ่มทำ</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">กำหนดเสร็จ</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">วันที่เสร็จจริง</label>
              <input
                type="date"
                value={completedDate}
                onChange={(e) => setCompletedDate(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                รายละเอียดผลการดำเนินงาน
              </label>
              <span className="text-[10px] text-slate-400">
                (ขยายขนาดตามข้อความอัตโนมัติ)
              </span>
            </div>
            <textarea
              ref={descriptionRef}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                if (descriptionRef.current) {
                  descriptionRef.current.style.height = 'auto'
                  descriptionRef.current.style.height = `${Math.max(90, descriptionRef.current.scrollHeight)}px`
                }
              }}
              placeholder="สรุปผลการสำรวจ สิ่งที่ได้ หรือผลสัมฤทธิ์ของงาน..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 font-normal leading-relaxed overflow-hidden transition-[height] duration-100 resize-y min-h-[90px]"
            />
          </div>

          {/* Issue Section Toggle */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#252548] bg-slate-50/50 dark:bg-[#16162e]">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200 select-none">
              <input
                type="checkbox"
                checked={hasIssue}
                onChange={(e) => setHasIssue(e.target.checked)}
                className="rounded border-slate-300 text-amber-500 focus:ring-amber-400 w-4 h-4"
              />
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <AlertTriangle size={14} /> งานนี้มีปัญหาอุปสรรคหน้างาน (ใช้บันทึกเหตุผลความล่าช้า)
              </span>
            </label>

            {hasIssue && (
              <div className="mt-3 space-y-2.5 pt-2.5 border-t border-slate-200 dark:border-[#252548]">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-0.5">
                    ปัญหาที่พบ (เช่น เจ้าของที่ดินคัดค้านแนวหมุด, ฝนตกหนักน้ำท่วมขัง)
                  </label>
                  <input
                    type="text"
                    value={issueDetail}
                    onChange={(e) => setIssueDetail(e.target.value)}
                    placeholder="ระบุปัญหาอุปสรรค..."
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-0.5">
                    💡 แนวทางแก้ไข / การดำเนินการที่ทำไปแล้ว
                  </label>
                  <input
                    type="text"
                    value={issueSolution}
                    onChange={(e) => setIssueSolution(e.target.value)}
                    placeholder="เช่น นัดเจรจาร่วมกับนิติกร, ปรับระดับแนวท่อใหม่..."
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Photo Upload Section */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-[#252548] bg-slate-50/50 dark:bg-[#16162e] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ImagePlus size={15} className="text-primary-500" />
                <span>ภาพถ่ายหน้างาน (อัปโหลดจากเครื่อง/มือถือ)</span>
              </label>
              {photoUrls.length > 0 && (
                <span className="text-[11px] font-bold text-primary-600 dark:text-primary-400">
                  อัปโหลดแล้ว {photoUrls.length} รูป
                </span>
              )}
            </div>

            {/* Drag & Drop Upload Zone */}
            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                isDragging
                  ? 'border-primary-500 bg-primary-100/40 dark:bg-primary-950/50 scale-[1.01]'
                  : 'border-slate-300 dark:border-[#2c2c54] hover:border-primary-500 dark:hover:border-primary-400 bg-white dark:bg-[#131328] hover:bg-primary-50/20'
              }`}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files) handleFileUpload(e.target.files)
                }}
                className="hidden"
                disabled={isUploadingPhotos}
              />
              {isUploadingPhotos ? (
                <div className="flex flex-col items-center gap-2 py-2">
                  <Loader2 size={24} className="animate-spin text-primary-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    กำลังอัปโหลดรูปภาพ...
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-[#1f1f3d] text-primary-600 dark:text-primary-400 flex items-center justify-center shadow-xs">
                    <Upload size={22} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      คลิกเพื่อเลือกรูปภาพจากเครื่อง หรือลากรูปมาวางที่นี่
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      รองรับไฟล์ภาพ JPG, PNG, WEBP (เลือกได้หลายรูปพร้อมกัน)
                    </p>
                  </div>
                </div>
              )}
            </label>

            {/* Photos Preview Thumbnails */}
            {photoUrls.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>รูปภาพที่เลือก ({photoUrls.length} รูป):</span>
                  <button
                    type="button"
                    onClick={() => setPhotoUrls([])}
                    className="text-rose-500 hover:underline font-semibold cursor-pointer"
                  >
                    ลบทั้งหมด
                  </button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {photoUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-[#252548] group shadow-2xs"
                    >
                      <img src={url} alt={`preview ${idx}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="ลบรูปนี้"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Vision Auto-fill Button */}
            <div className="pt-1">
              <button
                type="button"
                disabled={isAnalyzingAI || isUploadingPhotos || photoUrls.length === 0}
                onClick={handleAnalyzeWithAI}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isAnalyzingAI ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-purple-200" />
                    <span>AI กำลังวิเคราะห์รูปภาพเพื่อเขียนชื่องาน & รายละเอียด...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} className="text-amber-300" />
                    <span>✨ วิเคราะห์รูปด้วย AI เพื่อกรอก ชื่องาน และ รายละเอียดผลงาน อัตโนมัติ</span>
                  </>
                )}
              </button>
              {photoUrls.length === 0 ? (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 text-center">
                  💡 อัปโหลดรูปถ่ายหน้างานด้านบนก่อน จากนั้นกดปุ่มนี้เพื่อให้ AI วิเคราะห์และกรอกข้อมูลให้อัตโนมัติ
                </p>
              ) : (
                <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 text-center font-medium">
                  ⚡ มี {photoUrls.length} รูปพร้อมให้ AI วิเคราะห์แล้ว กดปุ่มด้านบนได้เลย!
                </p>
              )}
            </div>
          </div>

          {/* Related Project (Optional) */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              🏢 เชื่อมโยงกับโครงการก่อสร้างหลัก (ถ้ามี)
            </label>
            <select
              value={relatedProjectId}
              onChange={(e) => setRelatedProjectId(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#181834] text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 font-medium"
            >
              <option value="">-- ไม่เชื่อมโยง (เป็นงานเฉพาะกิจภายนอก) --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Footer Submit Button */}
          <div className="pt-3 border-t border-slate-100 dark:border-[#202042] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#252548] text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold cursor-pointer shadow-sm transition-all"
            >
              {isSubmitting ? 'กำลังบันทึก...' : '💾 บันทึกภารกิจ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
