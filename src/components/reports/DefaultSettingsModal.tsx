'use client'

import { useState, useEffect, useTransition } from 'react'
import { X, Plus, Trash2, MapPin, Loader2 } from 'lucide-react'
import { getDailyDefaults, upsertDailyDefaults } from '@/app/actions/reports'
import type { ResourceItem } from '@/lib/types'

interface DefaultSettingsModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
}

export function DefaultSettingsModal({ projectId, isOpen, onClose }: DefaultSettingsModalProps) {
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [locationName, setLocationName] = useState('')
  const [manpower, setManpower] = useState<ResourceItem[]>([])
  const [machinery, setMachinery] = useState<ResourceItem[]>([])
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      setError('')
      getDailyDefaults(projectId).then(res => {
        if (res.error) {
          setError(res.error)
        } else if (res.data) {
          setLat(res.data.latitude?.toString() || '')
          setLng(res.data.longitude?.toString() || '')
          setLocationName(res.data.location_name || '')
          
          // Map DB defaults to standard ResourceItem structures
          const rawManpower = res.data.manpower_defaults || []
          const mappedManpower = rawManpower.map((m: any) => ({
            name: m.name || m.trade || '',
            quantity: (m.quantity || m.count || '0').toString()
          }))
          setManpower(mappedManpower)

          const rawMachinery = res.data.machinery_defaults || []
          const mappedMachinery = rawMachinery.map((m: any) => ({
            name: m.name || '',
            quantity: (m.quantity || m.count || '0').toString()
          }))
          setMachinery(mappedMachinery)
        }
        setIsLoading(false)
      })
    }
  }, [isOpen, projectId])

  const handleSave = () => {
    setError('')
    const payload = {
      latitude: lat ? parseFloat(lat) : null,
      longitude: lng ? parseFloat(lng) : null,
      location_name: locationName,
      manpower_defaults: manpower.filter(m => m.name && parseFloat(String(m.quantity)) > 0),
      machinery_defaults: machinery.filter(m => m.name && parseFloat(String(m.quantity)) > 0)
    }

    startTransition(async () => {
      const res = await upsertDailyDefaults(projectId, payload)
      if (res.error) {
        setError(res.error)
      } else {
        onClose()
      }
    })
  }

  // Manpower Helpers
  const addManpowerRow = () => {
    setManpower([...manpower, { name: '', quantity: '1' }])
  }

  const removeManpowerRow = (idx: number) => {
    setManpower(manpower.filter((_, i) => i !== idx))
  }

  const updateManpowerRow = (idx: number, field: keyof ResourceItem, val: any) => {
    const updated = [...manpower]
    updated[idx] = { ...updated[idx], [field]: val }
    setManpower(updated)
  }

  // Machinery Helpers
  const addMachineryRow = () => {
    setMachinery([...machinery, { name: '', quantity: '1' }])
  }

  const removeMachineryRow = (idx: number) => {
    setMachinery(machinery.filter((_, i) => i !== idx))
  }

  const updateMachineryRow = (idx: number, field: keyof ResourceItem, val: any) => {
    const updated = [...machinery]
    updated[idx] = { ...updated[idx], [field]: val }
    setMachinery(updated)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#14142a] border border-slate-200 dark:border-[#252548] w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
              <MapPin size={20} />
            </span>
            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">⚙ ตั้งค่า Default รายงานประจำวัน</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">กำหนดค่าเริ่มต้นสำหรับรายงานประจำวันอัตโนมัติ</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-200">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="animate-spin text-primary-500" size={36} />
              <p className="text-sm font-semibold text-slate-500">กำลังโหลดค่าเริ่มต้น...</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-4 rounded-2xl bg-red-500/10 text-red-500 text-sm font-semibold">
                  ⚠️ {error}
                </div>
              )}

              {/* Coordinates Section */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <MapPin size={16} className="text-primary-500" />
                  พิกัดโครงการ (สำหรับดึงข้อมูลสภาพอากาศ)
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-1">ชื่อสถานที่</label>
                    <input 
                      type="text" 
                      value={locationName} 
                      onChange={e => setLocationName(e.target.value)}
                      placeholder="เช่น นนทบุรี"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-1">Latitude</label>
                    <input 
                      type="number" 
                      step="any"
                      value={lat} 
                      onChange={e => setLat(e.target.value)}
                      placeholder="เช่น 13.8584"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-1">Longitude</label>
                    <input 
                      type="number" 
                      step="any"
                      value={lng} 
                      onChange={e => setLng(e.target.value)}
                      placeholder="เช่น 100.5218"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Manpower Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">บุคลากรเริ่มต้น (Manpower Defaults)</h4>
                  <button 
                    onClick={addManpowerRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-500/10 text-primary-500 hover:bg-primary-500/25 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Plus size={14} /> เพิ่มประเภท
                  </button>
                </div>
                <div className="space-y-2">
                  {manpower.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">ยังไม่มีการกำหนดกำลังพลเริ่มต้น</p>
                  ) : (
                    manpower.map((m, idx) => (
                      <div key={idx} className="flex gap-3 items-center">
                        <input 
                          type="text" 
                          placeholder="ชื่อตำแหน่ง/ประเภทช่าง เช่น ช่างปูน" 
                          value={m.name}
                          onChange={e => updateManpowerRow(idx, 'name', e.target.value)}
                          className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <input 
                          type="number" 
                          placeholder="จำนวน" 
                          value={m.quantity}
                          onChange={e => updateManpowerRow(idx, 'quantity', e.target.value)}
                          className="w-[80px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="text-sm font-bold text-slate-400">คน</span>
                        <button 
                          onClick={() => removeManpowerRow(idx)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Machinery Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">เครื่องจักรเริ่มต้น (Machinery Defaults)</h4>
                  <button 
                    onClick={addMachineryRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-500/10 text-primary-500 hover:bg-primary-500/25 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Plus size={14} /> เพิ่มประเภท
                  </button>
                </div>
                <div className="space-y-2">
                  {machinery.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">ยังไม่มีการกำหนดเครื่องจักรเริ่มต้น</p>
                  ) : (
                    machinery.map((m, idx) => (
                      <div key={idx} className="flex gap-3 items-center">
                        <input 
                          type="text" 
                          placeholder="ชื่อเครื่องจักร เช่น รถเครน 25 ตัน" 
                          value={m.name}
                          onChange={e => updateMachineryRow(idx, 'name', e.target.value)}
                          className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <input 
                          type="number" 
                          placeholder="จำนวน" 
                          value={m.quantity}
                          onChange={e => updateMachineryRow(idx, 'quantity', e.target.value)}
                          className="w-[80px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="text-sm font-bold text-slate-400">คัน/เครื่อง</span>
                        <button 
                          onClick={() => removeMachineryRow(idx)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-white/5">
          <button 
            onClick={onClose} 
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-bold transition-all disabled:opacity-50 cursor-pointer text-slate-700 dark:text-slate-300"
          >
            ยกเลิก
          </button>
          <button 
            onClick={handleSave} 
            disabled={isPending || isLoading}
            className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            {isPending && <Loader2 className="animate-spin" size={16} />}
            บันทึกค่าเริ่มต้น
          </button>
        </div>

      </div>
    </div>
  )
}
