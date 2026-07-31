'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Loader2, HardHat, ListChecks, ChevronRight } from 'lucide-react'
import { AdminChecklistMasterModal } from '@/components/AdminChecklistMasterModal'

export function AdminSettingsClient({ initialSettings }: { initialSettings: Record<string, string> }) {
  const [settings, setSettings] = useState(initialSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false)
  const [masterCount, setMasterCount] = useState(37)

  const [workGroups, setWorkGroups] = useState<string[]>(() => {
    try {
      const val = initialSettings['work_groups']
      if (val) {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {}
    return ['งานงบลงทุนเร่งด่วน', 'งานแผนสนับสนุน']
  })

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

  const saveWorkGroups = async (updated: string[]) => {
    setWorkGroups(updated)
    setIsSaving(true)
    try {
      const serialized = JSON.stringify(updated)
      const { data } = await supabase.from('system_settings').select('id').eq('key', 'work_groups').single()
      if (data) {
        await supabase.from('system_settings').update({ value: serialized }).eq('key', 'work_groups')
      } else {
        await supabase.from('system_settings').insert({ key: 'work_groups', value: serialized })
      }
      setSettings(prev => ({ ...prev, work_groups: serialized }))
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddWorkGroup = () => {
    const trimmed = newGroupName.trim()
    if (!trimmed) return
    if (workGroups.includes(trimmed)) return
    const updated = [...workGroups, trimmed]
    saveWorkGroups(updated)
    setNewGroupName('')
  }

  const handleDeleteWorkGroup = (groupToDelete: string) => {
    const updated = workGroups.filter(g => g !== groupToDelete)
    saveWorkGroups(updated)
  }

  return (
    <div className="bg-white dark:bg-[#14142a] rounded-xl shadow-sm border border-slate-200 dark:border-[#252548] p-6 space-y-8">
      <div>
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

      <hr className="border-slate-200 dark:border-[#252548]" />

      {/* ── MASTER CHECKLIST MANAGEMENT SECTION ── */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">จัดการ Master Checklist ตรวจรับงาน</h3>
        <p className="text-xs text-slate-400 mb-4">เพิ่ม ลบ หรือแก้ไขหัวข้อตรวจรับงานก่อสร้างมาตรฐาน สำหรับใช้ร่วมกันในทุกโครงการ</p>

        <button
          onClick={() => setIsChecklistModalOpen(true)}
          className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-[#1a1a36] hover:bg-slate-100 dark:hover:bg-[#202042] border border-slate-200 dark:border-[#252548] rounded-2xl transition-all w-full text-left cursor-pointer group shadow-xs"
        >
          <div className="p-3.5 bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-2xl group-hover:scale-105 transition-transform">
            <ListChecks size={28} />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              เปิดศูนย์ตั้งค่า Master Checklist
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold">
                {masterCount} รายการในระบบ
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              คลิกที่นี่เพื่อเปิดหน้าต่างปรับแต่งหัวข้อตรวจรับ เพิ่ม ลด หรือแก้ไขคำอธิบายเกณฑ์การตรวจรับงานแบบเต็มระบบ
            </p>
          </div>
          <ChevronRight size={22} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
        </button>

        <AdminChecklistMasterModal
          isOpen={isChecklistModalOpen}
          onClose={() => setIsChecklistModalOpen(false)}
          onCountUpdate={(count) => setMasterCount(count)}
        />
      </div>

      <hr className="border-slate-200 dark:border-[#252548]" />

      {/* ── WORK GROUPS MANAGEMENT SECTION ── */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">จัดการกลุ่มงาน (Work Groups)</h3>
        <p className="text-xs text-slate-400 mb-4">เพิ่ม ลบ หรือแก้ไขกลุ่มงานต่างๆ เพื่อระบุประเภทงานสำหรับโครงการก่อสร้าง</p>

        {isSaving && (
          <div className="flex items-center gap-2 text-xs font-bold text-primary-500 mb-3">
            <Loader2 className="animate-spin" size={14} />
            กำลังบันทึกข้อมูลตั้งค่ากลุ่มงาน...
          </div>
        )}

        <div className="space-y-4">
          {/* Add new work group input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="เพิ่มชื่อกลุ่มงานใหม่..."
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddWorkGroup()
              }}
              className="input-base text-sm font-semibold flex-1"
            />
            <button
              onClick={handleAddWorkGroup}
              disabled={isSaving}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-sm transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus size={16} /> เพิ่มกลุ่มงาน
            </button>
          </div>

          {/* List of current work groups */}
          <div className="border border-slate-100 dark:border-[#252548] rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-[#252548]">
            {workGroups.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400 dark:text-slate-500 italic">
                ยังไม่มีการระบุกลุ่มงาน
              </div>
            ) : (
              workGroups.map((group) => (
                <div key={group} className="flex items-center justify-between p-3.5 hover:bg-slate-50/50 dark:hover:bg-[#1a1a36]/20 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary-500" />
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{group}</span>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteWorkGroup(group)}
                    disabled={isSaving}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-500/5 transition-all cursor-pointer"
                    title="ลบกลุ่มงาน"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <hr className="border-slate-200 dark:border-[#252548]" />

      {/* ── LINE NOTIFICATION SETTINGS SECTION ── */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2">
          <span>💬 ระบบแจ้งเตือนทาง LINE Notification (Morning Briefing & Red Flag Alerts)</span>
        </h3>
        <p className="text-xs text-slate-400 mb-5">
          ตั้งค่า LINE Token กลาง, กำหนดเวลาส่งสรุปงานประจำวัน (Morning Briefing) และกำหนดเกณฑ์วิกฤตเตือนภัย (Red Zone Alert)
        </p>

        <div className="space-y-6">
          {/* Global Token Input & Test Button */}
          <div className="p-4 bg-slate-50 dark:bg-[#1c1c38] rounded-xl border border-slate-200 dark:border-[#252548] space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
              LINE Token กลางของระบบ (LINE Notify Token)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="กรอก LINE Token กลาง (เช่น Bearer Token จาก LINE Notify / Messaging API)"
                value={settings['line_global_token'] || ''}
                onChange={(e) => setSettings((prev) => ({ ...prev, line_global_token: e.target.value }))}
                onBlur={async (e) => {
                  setIsSaving(true)
                  try {
                    const key = 'line_global_token'
                    const val = e.target.value
                    const { data } = await supabase.from('system_settings').select('id').eq('key', key).single()
                    if (data) await supabase.from('system_settings').update({ value: val }).eq('key', key)
                    else await supabase.from('system_settings').insert({ key, value: val })
                  } catch {}
                  setIsSaving(false)
                }}
                className="input-base text-xs font-mono flex-1"
              />
              <button
                type="button"
                onClick={async () => {
                  const token = settings['line_global_token']
                  if (!token) {
                    alert('กรุณากรอก LINE Token ก่อนกดทดลองส่ง')
                    return
                  }
                  setIsSaving(true)
                  try {
                    const res = await fetch('/api/cron/line-briefing', { method: 'POST' })
                    const resJson = await res.json()
                    if (resJson.success) {
                      alert(`✅ ทดลองส่ง LINE เรียบร้อยแล้ว!\nส่งสำเร็จ: ${resJson.message}`)
                    } else {
                      alert(`❌ เกิดข้อผิดพลาด: ${resJson.error || resJson.message}`)
                    }
                  } catch (err: any) {
                    alert(`❌ ส่งข้อผิดพลาด: ${err.message}`)
                  } finally {
                    setIsSaving(false)
                  }
                }}
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                📲 ทดลองส่ง LINE Briefing
              </button>
            </div>
          </div>

          {/* Morning Briefing Scheduled Settings */}
          <div className="p-4 bg-slate-50 dark:bg-[#1c1c38] rounded-xl border border-slate-200 dark:border-[#252548] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-sm">🌅 1. Scheduled Morning Briefing (สรุปงานประจำวัน 08:00 น.)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  ส่งรายงานสรุป % Planned, % Actual, CPI/SPI, คนงาน และสภาพอากาศเข้ากลุ่ม LINE ตามเวลาที่กำหนด
                </p>
              </div>
              <button
                onClick={() => handleToggle('line_cron_enabled')}
                disabled={isSaving}
                className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-50 ${settings['line_cron_enabled'] !== 'false' ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings['line_cron_enabled'] !== 'false' ? 'translate-x-6' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60 dark:border-[#252548]">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">เวลาส่งประจำวัน (24 ชม.)</label>
                <input
                  type="text"
                  value={settings['line_cron_time'] || '08:00'}
                  onChange={(e) => setSettings((prev) => ({ ...prev, line_cron_time: e.target.value }))}
                  onBlur={async (e) => {
                    const key = 'line_cron_time'
                    const val = e.target.value
                    const { data } = await supabase.from('system_settings').select('id').eq('key', key).single()
                    if (data) await supabase.from('system_settings').update({ value: val }).eq('key', key)
                    else await supabase.from('system_settings').insert({ key, value: val })
                  }}
                  className="input-base text-xs font-bold w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">ความถี่ในการส่ง</label>
                <div className="text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40 p-2 rounded-lg border border-primary-200/50">
                  📅 ส่งทุกวัน (Daily Schedule) ผ่าน Vercel Cron / Scheduler
                </div>
              </div>
            </div>
          </div>

          {/* Threshold-Based Red Flag Warning Settings */}
          <div className="p-4 bg-slate-50 dark:bg-[#1c1c38] rounded-xl border border-slate-200 dark:border-[#252548] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-sm">🚨 2. Threshold-Based LINE Alert (เตือนภัยวิกฤต Red Zone)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  ส่งการแจ้งเตือน Real-time เมื่อพบโครงการเข้าขั้นวิกฤต (จำกัดสูงสุด 1 ครั้ง/วัน/โครงการ ป้องกันสแปม)
                </p>
              </div>
              <button
                onClick={() => handleToggle('line_alert_enabled')}
                disabled={isSaving}
                className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-50 ${settings['line_alert_enabled'] !== 'false' ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings['line_alert_enabled'] !== 'false' ? 'translate-x-6' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200/60 dark:border-[#252548]">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">เกณฑ์วิกฤต SPI (ต่ำกว่า)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings['line_alert_spi_threshold'] || '0.90'}
                  onChange={(e) => setSettings((prev) => ({ ...prev, line_alert_spi_threshold: e.target.value }))}
                  onBlur={async (e) => {
                    const key = 'line_alert_spi_threshold'
                    const val = e.target.value
                    const { data } = await supabase.from('system_settings').select('id').eq('key', key).single()
                    if (data) await supabase.from('system_settings').update({ value: val }).eq('key', key)
                    else await supabase.from('system_settings').insert({ key, value: val })
                  }}
                  className="input-base text-xs font-bold w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">เกณฑ์วิกฤต CPI (ต่ำกว่า)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings['line_alert_cpi_threshold'] || '0.90'}
                  onChange={(e) => setSettings((prev) => ({ ...prev, line_alert_cpi_threshold: e.target.value }))}
                  onBlur={async (e) => {
                    const key = 'line_alert_cpi_threshold'
                    const val = e.target.value
                    const { data } = await supabase.from('system_settings').select('id').eq('key', key).single()
                    if (data) await supabase.from('system_settings').update({ value: val }).eq('key', key)
                    else await supabase.from('system_settings').insert({ key, value: val })
                  }}
                  className="input-base text-xs font-bold w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">% ล่าช้ากว่าแผนสะสม (เกินกว่า %)</label>
                <input
                  type="number"
                  step="0.5"
                  value={settings['line_alert_diff_threshold'] || '5'}
                  onChange={(e) => setSettings((prev) => ({ ...prev, line_alert_diff_threshold: e.target.value }))}
                  onBlur={async (e) => {
                    const key = 'line_alert_diff_threshold'
                    const val = e.target.value
                    const { data } = await supabase.from('system_settings').select('id').eq('key', key).single()
                    if (data) await supabase.from('system_settings').update({ value: val }).eq('key', key)
                    else await supabase.from('system_settings').insert({ key, value: val })
                  }}
                  className="input-base text-xs font-bold w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
