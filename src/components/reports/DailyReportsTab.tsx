'use client'

import { useState, useTransition } from 'react'
import {
  FileClock,
  Plus,
  Trash2,
  CalendarDays,
  CloudSun,
  ThermometerSun,
  Users,
  Wrench,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Printer,
  X,
  UploadCloud,
  CheckCircle2
} from 'lucide-react'
import type { Project, DailyReport, ResourceItem, ReportPhoto } from '@/lib/types'
import { createDailyReport, updateDailyReport, deleteDailyReport, updateDailyReportsOrder, uploadReportPhoto } from '@/app/actions/reports'

import type { UserSession } from '@/lib/auth'

interface Props {
  project: Project
  data: DailyReport[]
  user?: UserSession | null
}

export function DailyReportsTab({ project, data, user }: Props) {
  const [items, setItems] = useState<DailyReport[]>(data)
  const [selectedId, setSelectedId] = useState<string | null>(data.length > 0 ? data[0].id : null)
  const [isPending, startTransition] = useTransition()
  const [isCreating, setIsCreating] = useState(false)

  if (JSON.stringify(data) !== JSON.stringify(items) && !isPending) {
    setItems(data)
    if (!selectedId && data.length > 0) setSelectedId(data[0].id)
  }

  const selectedItem = items.find(i => i.id === selectedId) || null

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === items.length - 1) return

    const newItems = [...items]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const temp = newItems[index]
    newItems[index] = newItems[swapIndex]
    newItems[swapIndex] = temp

    const updates = newItems.map((item, idx) => ({ id: item.id, sort_order: idx + 1 }))
    setItems(newItems)
    startTransition(async () => {
      await updateDailyReportsOrder(project.id, updates)
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('ลบรายงานประจำวันนี้ออกจากระบบ?')) return
    startTransition(async () => {
      await deleteDailyReport(id, project.id)
      if (selectedId === id) setSelectedId(null)
    })
  }

  const handleCreateNew = () => {
    setIsCreating(true)
    setSelectedId(null)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex h-[calc(100vh-180px)] gap-4 print:h-auto print:block">
      
      {/* ── Left Sidebar (List) ── */}
      <div className="w-1/3 min-w-[300px] flex flex-col gap-3 print:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">รายงานประจำวัน</h2>
          {user && (user.role === 'admin' || user.role === 'editor') && (
            <button
              onClick={handleCreateNew}
              className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 transition-colors shadow-sm shadow-primary-500/20 cursor-pointer"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {items.length === 0 && !isCreating ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-[#14142a] rounded-2xl border border-slate-200 dark:border-[#252548]">
              <FileClock size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs font-bold text-slate-500">ยังไม่มีรายงานประจำวัน</p>
            </div>
          ) : (
            <>
              {isCreating && (
                <div className="p-3 rounded-xl border-2 border-primary-500 bg-primary-50 dark:bg-primary-500/10 cursor-pointer">
                  <p className="text-sm font-bold text-primary-700 dark:text-primary-400">📝 กำลังสร้างรายงานใหม่...</p>
                </div>
              )}
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => { setSelectedId(item.id); setIsCreating(false); }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                    selectedId === item.id
                      ? 'border-primary-500 bg-white dark:bg-[#1e1e38] shadow-sm ring-1 ring-primary-500/20'
                      : 'border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); handleMove(idx, 'up'); }} disabled={idx === 0 || isPending} className="p-1 text-slate-300 hover:text-primary-500 disabled:opacity-30"><ArrowUp size={12}/></button>
                    <button onClick={(e) => { e.stopPropagation(); handleMove(idx, 'down'); }} disabled={idx === items.length-1 || isPending} className="p-1 text-slate-300 hover:text-primary-500 disabled:opacity-30"><ArrowDown size={12}/></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                      {item.report_date ? new Date(item.report_date).toLocaleDateString('th-TH', { dateStyle: 'long'}) : 'ไม่ระบุวันที่'}
                    </p>
                    <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
                      สภาพอากาศ: {item.weather || '-'}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Right Content (Form & Print Layout) ── */}
      <div className="flex-1 bg-white dark:bg-[#14142a] rounded-2xl border border-slate-200 dark:border-[#252548] overflow-hidden flex flex-col print:border-none print:bg-transparent">
        {(selectedItem || isCreating) ? (
          <DailyReportForm 
            key={isCreating ? 'new' : selectedItem?.id}
            project={project}
            item={isCreating ? null : selectedItem}
            onClose={() => setIsCreating(false)}
            onDelete={handleDelete}
            onPrint={handlePrint}
            user={user}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 print:hidden">
            <FileClock size={48} className="mb-4 opacity-20" />
            <p className="font-bold">เลือกรายงานเพื่อดูหรือแก้ไขข้อมูล</p>
          </div>
        )}
      </div>

    </div>
  )
}

function DailyReportForm({ 
  project, 
  item, 
  onClose,
  onDelete,
  onPrint,
  user
}: { 
  project: Project
  item: DailyReport | null
  onClose: () => void
  onDelete: (id: string) => void
  onPrint: () => void
  user?: UserSession | null
}) {
  const [isPending, startTransition] = useTransition()
  
  // Local state for dynamic arrays
  const [manpower, setManpower] = useState<ResourceItem[]>(item?.manpower || [])
  const [machinery, setMachinery] = useState<ResourceItem[]>(item?.machinery || [])
  const [photos, setPhotos] = useState<ReportPhoto[]>(item?.photos || [])
  
  const [uploading, setUploading] = useState(false)

  // Sync state if item changes
  useState(() => {
    setManpower(item?.manpower || [])
    setMachinery(item?.machinery || [])
    setPhotos(item?.photos || [])
  }) // Just initial, but actually we need an effect or key remount. 
  // For simplicity, React will remount if we change key, so we should ensure the parent passes key={item.id}

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    if (photos.length >= 4) {
      alert("เพิ่มรูปภาพได้สูงสุด 4 รูปเท่านั้น")
      return
    }
    const rawFile = e.target.files[0]
    setUploading(true)
    try {
      const { compressImage } = await import('@/lib/image')
      const file = await compressImage(rawFile)
      const res = await uploadReportPhoto(file)
      if (res.url) {
        setPhotos(prev => [...prev, { url: res.url!, caption: '' }].slice(0, 4))
      }
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    
    const payload = {
      report_date: fd.get('report_date') || null,
      weather: fd.get('weather') || null,
      temperature: fd.get('temperature') || null,
      work_done: fd.get('work_done') || null,
      issues: fd.get('issues') || null,
      manpower,
      machinery,
      photos
    }

    startTransition(async () => {
      if (item) {
        await updateDailyReport(item.id, project.id, payload)
      } else {
        await createDailyReport(project.id, payload)
        onClose()
      }
    })
  }

  const labelCls = 'text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5'
  const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/40'

  return (
    <>
      <style type="text/css" media="print">{`
        @page { size: portrait; margin: 0.6cm; }
        
        /* Force paper white background and black text */
        html, body {
          background-color: white !important;
          background: white !important;
          color: #0f172a !important;
        }
        
        div, form, section, main, article, table, tr, td, th {
          background-color: white !important;
          background: white !important;
          color: #0f172a !important;
          border-color: #cbd5e1 !important;
        }

        p, span, label, input, textarea, h1, h2, h3, h4, th, td, select {
          font-size: 11px !important;
          color: #0f172a !important;
        }

        form { font-size: 11px !important; }
        textarea { max-height: 60px !important; overflow: hidden !important; }
        h1 { font-size: 16px !important; }
        h2 { font-size: 13px !important; }
      `}</style>
      <form onSubmit={handleSubmit} className="flex flex-col h-full print:block">
      
      {/* Header Toolbar (Hidden in Print) */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#1e1e38] print:hidden">
        <h3 className="text-base font-black text-slate-900 dark:text-white">
          {item ? 'แก้ไขรายงานประจำวัน' : 'สร้างรายงานประจำวันใหม่'}
        </h3>
        <div className="flex items-center gap-2">
          {item && user && (
            <button type="button" onClick={onPrint} className="btn-secondary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border-slate-200 cursor-pointer">
              <Printer size={14} /> พิมพ์รายงาน
            </button>
          )}
          {item && user && (user.role === 'admin' || user.role === 'editor') && (
            <button type="button" onClick={() => onDelete(item.id)} disabled={isPending} className="btn-secondary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 text-red-500 hover:bg-red-50 border-slate-200 cursor-pointer">
              <Trash2 size={14} /> ลบ
            </button>
          )}
          {user && (user.role === 'admin' || user.role === 'editor') && (
            <button type="submit" disabled={isPending || uploading} className="btn-primary px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer">
              <CheckCircle2 size={14} /> บันทึก
            </button>
          )}
        </div>
      </div>

      {/* Form Content (Scrollable on screen) */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 print:overflow-visible print:p-0 print:space-y-3">
        
        {/* --- PRINT HEADER --- */}
        <div className="hidden print:block text-center border-b-2 border-black pb-2 mb-3">
          <h1 className="text-xl font-black mb-0">รายงานประจำวัน (Daily Report)</h1>
          <h2 className="text-sm font-bold">โครงการ: {project.name}</h2>
          <div className="flex justify-between mt-2 text-xs font-medium">
            <span>วันที่: {item?.report_date ? new Date(item.report_date).toLocaleDateString('th-TH', { dateStyle: 'long' }) : '-'}</span>
            <span>ผู้ควบคุมงาน: {project.supervisor || '-'}</span>
          </div>
        </div>
        {/* -------------------- */}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}><CalendarDays size={12} className="inline mr-1" /> วันที่รายงาน</label>
            <input name="report_date" type="date" defaultValue={item?.report_date || ''} className={`${inputCls} print:border-none print:p-0 print:bg-transparent`} required />
          </div>
          <div>
            <label className={labelCls}><CloudSun size={12} className="inline mr-1" /> สภาพอากาศ</label>
            <input name="weather" type="text" defaultValue={item?.weather || ''} className={`${inputCls} print:border-none print:p-0 print:bg-transparent`} placeholder="เช่น แดดจัด, ฝนตก" />
          </div>
          <div>
            <label className={labelCls}><ThermometerSun size={12} className="inline mr-1" /> อุณหภูมิ</label>
            <input name="temperature" type="text" defaultValue={item?.temperature || ''} className={`${inputCls} print:border-none print:p-0 print:bg-transparent`} placeholder="เช่น 34°C" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-2">
          {/* Manpower */}
          <div className="bg-slate-50 dark:bg-[#1a1a32] p-4 rounded-xl border border-slate-200 dark:border-[#252548] print:border-black print:bg-transparent">
            <div className="flex items-center justify-between mb-3">
              <label className={`${labelCls} mb-0`}><Users size={12} className="inline mr-1" /> กำลังคน (Manpower)</label>
              <button type="button" onClick={() => setManpower([...manpower, { name: '', quantity: '' }])} className="text-primary-600 text-[10px] font-bold hover:underline print:hidden">+ เพิ่ม</button>
            </div>
            <div className="space-y-2">
              {manpower.map((mp, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={mp.name} onChange={e => { const n = [...manpower]; n[i].name = e.target.value; setManpower(n); }} placeholder="ประเภทช่าง" className={`${inputCls} py-1 px-2 text-xs print:border-none print:p-0 print:bg-transparent`} />
                  <input value={mp.quantity} onChange={e => { const n = [...manpower]; n[i].quantity = e.target.value; setManpower(n); }} placeholder="จำนวน" className={`${inputCls} py-1 px-2 text-xs w-20 text-center print:border-none print:p-0 print:bg-transparent`} />
                  <button type="button" onClick={() => setManpower(manpower.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 print:hidden"><X size={14} /></button>
                </div>
              ))}
              {manpower.length === 0 && <p className="text-xs text-slate-400 italic">ไม่มีข้อมูลกำลังคน</p>}
            </div>
          </div>

          {/* Machinery */}
          <div className="bg-slate-50 dark:bg-[#1a1a32] p-4 rounded-xl border border-slate-200 dark:border-[#252548] print:border-black print:bg-transparent">
            <div className="flex items-center justify-between mb-3">
              <label className={`${labelCls} mb-0`}><Wrench size={12} className="inline mr-1" /> เครื่องจักร (Machinery)</label>
              <button type="button" onClick={() => setMachinery([...machinery, { name: '', quantity: '' }])} className="text-primary-600 text-[10px] font-bold hover:underline print:hidden">+ เพิ่ม</button>
            </div>
            <div className="space-y-2">
              {machinery.map((mc, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={mc.name} onChange={e => { const n = [...machinery]; n[i].name = e.target.value; setMachinery(n); }} placeholder="ประเภทเครื่องจักร" className={`${inputCls} py-1 px-2 text-xs print:border-none print:p-0 print:bg-transparent`} />
                  <input value={mc.quantity} onChange={e => { const n = [...machinery]; n[i].quantity = e.target.value; setMachinery(n); }} placeholder="จำนวน" className={`${inputCls} py-1 px-2 text-xs w-20 text-center print:border-none print:p-0 print:bg-transparent`} />
                  <button type="button" onClick={() => setMachinery(machinery.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 print:hidden"><X size={14} /></button>
                </div>
              ))}
              {machinery.length === 0 && <p className="text-xs text-slate-400 italic">ไม่มีข้อมูลเครื่องจักร</p>}
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>รายละเอียดงานที่ทำ (Work Done)</label>
          <textarea name="work_done" rows={4} defaultValue={item?.work_done || ''} className={`${inputCls} print:border-none print:p-0 print:bg-transparent print:text-[10px]`} placeholder="ระบุความคืบหน้างาน..." />
        </div>

        <div>
          <label className={labelCls}>ปัญหา / อุปสรรค (Issues)</label>
          <textarea name="issues" rows={2} defaultValue={item?.issues || ''} className={`${inputCls} print:border-none print:p-0 print:bg-transparent print:text-[10px]`} placeholder="หากไม่มีให้เว้นว่าง หรือขีด -" />
        </div>

        {/* Photos */}
        <div className="print:mt-2 print:page-break-inside-avoid">
          <div className="flex items-center justify-between mb-2">
            <label className={`${labelCls} mb-0`}><ImageIcon size={12} className="inline mr-1" /> รูปภาพการทำงาน (สูงสุด 4 รูป)</label>
          </div>
          
          <div className="grid grid-cols-2 gap-4 print:gap-2">
            {[0, 1, 2, 3].map((i) => {
              const photo = photos[i];
              if (!photo && !(user && (user.role === 'admin' || user.role === 'editor'))) {
                return null;
              }
              return (
                <div key={i} className="border border-slate-200 dark:border-[#252548] rounded-xl overflow-hidden print:border-black print:rounded-none flex flex-col aspect-video print:aspect-[4/3]">
                  {photo ? (
                    <>
                      <div className="relative flex-1 bg-slate-100 dark:bg-[#1a1a32]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt="work progress" className="w-full h-full object-cover" />
                        {user && (user.role === 'admin' || user.role === 'editor') && (
                          <button type="button" onClick={() => {
                            const n = [...photos];
                            n.splice(i, 1);
                            setPhotos(n);
                          }} className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center print:hidden hover:bg-red-500 transition-colors cursor-pointer">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <div className="p-2 bg-white dark:bg-[#1e1e38] print:bg-transparent border-t border-slate-200 dark:border-[#252548] print:border-black">
                        <input 
                          value={photo.caption} 
                          disabled={!(user && (user.role === 'admin' || user.role === 'editor'))}
                          onChange={e => { const n = [...photos]; n[i].caption = e.target.value; setPhotos(n); }} 
                          placeholder="คำบรรยายภาพ..." 
                          className="w-full text-xs outline-none bg-transparent dark:text-slate-200 placeholder:text-slate-400 print:text-black print:placeholder-transparent" 
                        />
                      </div>
                    </>
                  ) : (
                    <label className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-[#14142a] hover:bg-slate-100 dark:hover:bg-[#1e1e38] cursor-pointer transition-colors print:bg-transparent print:hidden">
                      {uploading ? (
                        <span className="text-xs text-slate-400 font-bold">กำลังอัปโหลด...</span>
                      ) : (
                        <>
                          <ImageIcon size={24} className="text-slate-300 mb-2" />
                          <span className="text-xs text-slate-400 font-bold">+ เพิ่มรูปภาพที่ {i + 1}</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
      </form>
    </>
  )
}
