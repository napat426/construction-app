'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export function AdminSettingsClient({ initialSettings }: { initialSettings: Record<string, string> }) {
  const [settings, setSettings] = useState(initialSettings)
  const [isSaving, setIsSaving] = useState(false)

  const handleToggle = async (key: string) => {
    const newVal = settings[key] === 'true' ? 'false' : 'true'
    setSettings(prev => ({ ...prev, [key]: newVal }))
    
    setIsSaving(true)
    try {
      const { data } = await supabase.from('system_settings').select('id').eq('key', key).single()
      if (data) {
        await supabase.from('system_settings').update({ value: newVal }).eq('key', key)
      } else {
        await supabase.from('system_settings').insert({ key, value: newVal })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-[#14142a] rounded-xl shadow-sm border border-slate-200 dark:border-[#252548] p-6">
      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">ตั้งค่าระบบ (System Settings)</h3>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#1a1a36] rounded-lg border border-slate-200 dark:border-[#252548]">
          <div>
            <h4 className="font-bold text-slate-800 dark:text-white">เปิดใช้ระบบเอกสาร AI (OCR)</h4>
            <p className="text-sm text-slate-500">
              แสดงส่วนอัปโหลดและจัดการเอกสารสำหรับดึงข้อความ (OCR) และ Semantic Search ในหน้า AI Assistant
            </p>
          </div>
          <button 
            onClick={() => handleToggle('ai_ocr_enabled')}
            disabled={isSaving}
            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-50 ${settings['ai_ocr_enabled'] === 'true' ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings['ai_ocr_enabled'] === 'true' ? 'translate-x-6' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  )
}
