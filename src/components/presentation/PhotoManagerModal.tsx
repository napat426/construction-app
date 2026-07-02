'use client'

import { useState, useRef } from 'react'
import type { Project, Inspection } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { X, Upload, CheckCircle2, Image as ImageIcon, Loader2 } from 'lucide-react'

interface Props {
  projectId: string
  project: Project
  inspections: Inspection[]
  selectedUrls: string[]
  onSave: (urls: string[]) => void
  onClose: () => void
}

export function PhotoManagerModal({ projectId, project, inspections, selectedUrls, onSave, onClose }: Props) {
  // Combine all photos from inspections
  const [allPhotos, setAllPhotos] = useState<{ url: string, date: string, inspectionId: string }[]>(() => {
    const list: { url: string, date: string, inspectionId: string }[] = []
    inspections.forEach(i => {
      if (i.photo_urls) {
        i.photo_urls.forEach(url => {
          list.push({ url, date: i.created_at, inspectionId: i.id })
        })
      }
    })
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  })

  const [selected, setSelected] = useState<Set<string>>(new Set(selectedUrls))
  const [isUploading, setIsUploading] = useState(false)
  const [search, setSearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleToggle = (url: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  const handleDelete = async (url: string, inspectionId: string) => {
    if (!confirm('ยืนยันการลบรูปภาพนี้?')) return

    try {
      // 1. Delete from Supabase Storage
      const urlObj = new URL(url)
      const path = urlObj.pathname.split('/public/inspection-photos/')[1]
      if (path) {
        await supabase.storage.from('inspection-photos').remove([path])
      }

      // 2. Update database (remove from photo_urls array in that inspection)
      const inspection = inspections.find(i => i.id === inspectionId)
      if (inspection) {
        const updatedUrls = (inspection.photo_urls || []).filter(u => u !== url)
        await supabase.from('inspections').update({ photo_urls: updatedUrls }).eq('id', inspectionId)
      }

      // 3. Update local state
      setAllPhotos(prev => prev.filter(p => p.url !== url))
      setSelected(prev => {
        const next = new Set(prev)
        next.delete(url)
        return next
      })
    } catch (err) {
      console.error('Failed to delete photo', err)
      alert('เกิดข้อผิดพลาดในการลบรูปภาพ')
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
      
      // If we don't have an inspection to attach to, we should create a dummy one or attach to the latest.
      // Let's attach to the latest inspection, or create one if none exist.
      let targetInspectionId = inspections.length > 0 ? inspections[0].id : null
      
      if (!targetInspectionId) {
        // Create dummy inspection
        const { data: newInsp } = await supabase.from('inspections').insert({
          project_id: projectId,
          inspection_no: `INSP-${Date.now()}`,
          title: 'รูปภาพเพิ่มเติมจากการนำเสนอ',
          work_type: 'อื่นๆ',
          status: 'approved',
          photo_urls: []
        }).select().single()
        if (newInsp) targetInspectionId = newInsp.id
      }

      if (!targetInspectionId) throw new Error("No inspection available")

      const filePath = `${projectId}/${targetInspectionId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('inspection-photos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('inspection-photos')
        .getPublicUrl(filePath)

      // Update DB
      const targetInsp = inspections.find(i => i.id === targetInspectionId)
      const currentUrls = targetInsp?.photo_urls || []
      const updatedUrls = [...currentUrls, publicUrl]
      
      await supabase.from('inspections').update({ photo_urls: updatedUrls }).eq('id', targetInspectionId)

      // Update local state
      setAllPhotos(prev => [{ url: publicUrl, date: new Date().toISOString(), inspectionId: targetInspectionId! }, ...prev])
      setSelected(prev => new Set([...prev, publicUrl]))
      
    } catch (err) {
      console.error('Upload error', err)
      alert('เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = () => {
    // Return array of selected urls
    onSave(Array.from(selected))
  }

  const filteredPhotos = allPhotos.filter(p => p.url.toLowerCase().includes(search.toLowerCase()) || p.date.includes(search))

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#14142a] w-[900px] max-w-full h-[80vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-[#1c1c34]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1c1c34] flex justify-between items-center bg-slate-50 dark:bg-[#0a0a14]">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ImageIcon className="text-primary-600" /> จัดการรูปภาพหน้างาน
            </h2>
            <p className="text-xs text-slate-500 mt-1">โครงการ {project.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full hover:bg-slate-200 dark:hover:bg-[#1c1c34] transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-[#1c1c34] flex gap-4 items-center">
          <input
            type="text"
            placeholder="ค้นหารูป..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 text-sm border border-slate-200 dark:border-[#252548] rounded-xl bg-slate-50 dark:bg-[#0a0a14] outline-none focus:border-primary-500"
          />
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleUpload} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#1c1c34] dark:hover:bg-[#252548] text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            เพิ่มรูปใหม่
          </button>
        </div>

        {/* Photo Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-[#0d0d1c]">
          {filteredPhotos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <ImageIcon size={48} className="mb-4 opacity-20" />
              <p>ยังไม่มีรูปภาพในโครงการนี้</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {filteredPhotos.map(photo => {
                const isSelected = selected.has(photo.url)
                return (
                  <div key={photo.url} className={`relative group rounded-xl overflow-hidden border-2 transition-all ${isSelected ? 'border-primary-500' : 'border-slate-200 dark:border-[#252548]'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={photo.url} 
                      alt="Inspection" 
                      className="w-full aspect-[4/3] object-cover cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(photo.url, '_blank')}
                    />
                    
                    {/* Overlays */}
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-white text-[10px]">{new Date(photo.date).toLocaleDateString('th-TH')}</p>
                    </div>

                    <button
                      onClick={() => handleToggle(photo.url)}
                      className={`absolute top-2 left-2 p-1.5 rounded-full backdrop-blur-sm transition-colors ${isSelected ? 'bg-primary-500 text-white' : 'bg-black/20 text-white/50 hover:bg-black/40'}`}
                    >
                      <CheckCircle2 size={20} fill={isSelected ? "currentColor" : "none"} className={isSelected ? 'text-white' : ''} />
                    </button>

                    <button
                      onClick={() => handleDelete(photo.url, photo.inspectionId)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/20 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-[#1c1c34] flex justify-between items-center bg-white dark:bg-[#14142a]">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            เลือกแล้ว <span className="font-bold text-primary-600 dark:text-primary-400">{selected.size}</span> รูป <span className="text-xs opacity-70">(จะแสดงในสไลด์สูงสุด 4 รูปแรก)</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1c1c34] rounded-xl transition-colors">
              ยกเลิก
            </button>
            <button onClick={handleSave} className="px-6 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors shadow-lg shadow-primary-500/20">
              บันทึก
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
