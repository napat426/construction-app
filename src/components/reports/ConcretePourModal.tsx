'use client'

import { useState, useRef, useEffect, useActionState } from 'react'
import { X, Plus, Upload, Trash2, Loader2, Save } from 'lucide-react'
import { createConcretePour, updateConcretePour } from '@/app/actions/concrete'
import type { ConcretePour, WBSTask, ActionState } from '@/lib/types'
import { uploadReportPhoto } from '@/app/actions/reports'

interface Props {
  project_id: string
  tasks: WBSTask[]
  initialData?: ConcretePour | null
  existingPoursCount: number
  onClose: () => void
}

const INITIAL_STATE: ActionState = null

// Helper for inputs without leading zero
function parseInputNumber(val: string) {
  if (val === '') return ''
  // Strip leading zeros unless it's just '0' or starts with '0.'
  if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
    val = val.replace(/^0+/, '')
    if (val === '') val = '0'
  }
  return val
}

export function ConcretePourModal({ project_id, tasks, initialData, existingPoursCount, onClose }: Props) {
  const [state, formAction, pending] = useActionState(
    initialData 
      ? updateConcretePour.bind(null, initialData.id, project_id)
      : createConcretePour.bind(null, project_id),
    INITIAL_STATE
  )
  
  const formRef = useRef<HTMLFormElement>(null)

  const [pourNo, setPourNo] = useState(initialData?.pour_no || `CP-${String(existingPoursCount + 1).padStart(3, '0')}`)
  const [photos, setPhotos] = useState<string[]>(initialData?.photos || [])
  const [uploading, setUploading] = useState(false)
  
  // States for numbers to avoid leading zeros and allow empty
  const [volume, setVolume] = useState(initialData?.volume?.toString() || '')
  const [slumpSpec, setSlumpSpec] = useState(initialData?.slump_spec?.toString() || '')
  const [slumpActual, setSlumpActual] = useState(initialData?.slump_actual?.toString() || '')
  const [cubeSamples, setCubeSamples] = useState(initialData?.cube_samples?.toString() || '')

  useEffect(() => {
    if (state?.success) onClose()
  }, [state, onClose])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setUploading(true)
    
    const newUrls: string[] = []
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i]
      const res = await uploadReportPhoto(file)
      if (res.url) {
        newUrls.push(res.url)
      }
    }
    
    setPhotos([...photos, ...newUrls])
    setUploading(false)
  }

  const removePhoto = (idx: number) => {
    setPhotos(photos.filter((_, i) => i !== idx))
  }

  const inputCls = 'input-base font-medium'
  const labelCls = 'block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop bg-slate-900/80">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl animate-scale-in bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1e1e38] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {initialData ? 'แก้ไขรายการเทคอนกรีต' : 'เพิ่มรายการเทคอนกรีต'}
            </h2>
          </div>
          <button onClick={onClose} disabled={pending} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1e38]">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {state?.error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl font-medium border border-red-100 dark:border-red-900/30">
              {state.error}
            </div>
          )}

          <form action={formAction} ref={formRef} className="space-y-6">
            <input type="hidden" name="photos" value={JSON.stringify(photos)} />
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>เลขที่การเท *</label>
                <input name="pour_no" value={pourNo} onChange={e => setPourNo(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>วันที่เท *</label>
                <input type="date" name="pour_date" required defaultValue={initialData?.pour_date} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>เชื่อมโยงกับงาน WBS</label>
                <select name="wbs_task_id" defaultValue={initialData?.wbs_task_id || ''} className={inputCls}>
                  <option value="">-- ไม่ระบุ --</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.wbs_no} {t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>ส่วนโครงสร้าง</label>
                <input name="structure_element" placeholder="เช่น เสา C1-C8 ชั้น 2" defaultValue={initialData?.structure_element || ''} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>กำลังอัด (Concrete Grade)</label>
                <input name="concrete_grade" placeholder="เช่น 240 ksc" defaultValue={initialData?.concrete_grade || ''} className={inputCls} list="grade-options" />
                <datalist id="grade-options">
                  <option value="180 ksc" />
                  <option value="210 ksc" />
                  <option value="240 ksc" />
                  <option value="280 ksc" />
                  <option value="320 ksc" />
                  <option value="350 ksc" />
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>ปริมาณ (ลบ.ม.)</label>
                <input name="volume" type="number" step="0.01" value={volume} onChange={e => setVolume(parseInputNumber(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>สลัมป์สเปก (ซม.)</label>
                <input name="slump_spec" type="number" step="0.1" value={slumpSpec} onChange={e => setSlumpSpec(parseInputNumber(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>สลัมป์จริง (ซม.)</label>
                <input name="slump_actual" type="number" step="0.1" value={slumpActual} onChange={e => setSlumpActual(parseInputNumber(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>จำนวนลูกปูน (ก้อน)</label>
                <input name="cube_samples" type="number" value={cubeSamples} onChange={e => setCubeSamples(parseInputNumber(e.target.value))} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>โรงงาน/ผู้ผลิตปูน</label>
                <input name="supplier" defaultValue={initialData?.supplier || ''} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>เลขที่บิลปูน</label>
                <input name="ticket_no" defaultValue={initialData?.ticket_no || ''} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>เวลาเริ่มเท</label>
                <input name="pour_start_time" type="time" defaultValue={initialData?.pour_start_time || ''} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>เวลาเทเสร็จ</label>
                <input name="pour_end_time" type="time" defaultValue={initialData?.pour_end_time || ''} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>สภาพอากาศ</label>
                <input name="weather" placeholder="เช่น แดดจัด, ฝนตกปรอยๆ" defaultValue={initialData?.weather || ''} className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>รูปถ่าย (บิลปูน / หน้างาน)</label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {photos.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                    <img src={url} alt="Photo" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                
                <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  {uploading ? (
                    <Loader2 size={24} className="text-primary-500 animate-spin mb-1" />
                  ) : (
                    <Upload size={24} className="text-slate-400 mb-1" />
                  )}
                  <span className="text-[10px] text-slate-500 font-medium">เพิ่มรูปภาพ</span>
                  <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" disabled={uploading} />
                </label>
              </div>
            </div>

            <div>
              <label className={labelCls}>หมายเหตุ</label>
              <textarea name="note" defaultValue={initialData?.note || ''} rows={3} className={inputCls + " resize-none"} />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-[#1e1e38]">
              <button type="button" onClick={onClose} disabled={pending} className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1e1e38] rounded-xl transition-colors">
                ยกเลิก
              </button>
              <button type="submit" disabled={pending || uploading} className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl btn-primary cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed">
                {pending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                <span>บันทึกข้อมูล</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
