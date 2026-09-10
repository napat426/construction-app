'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Loader2, HardHat, ListChecks, ChevronRight, Settings, ArrowUp, ArrowDown, RotateCcw, X, CalendarRange } from 'lucide-react'
import { AdminChecklistMasterModal } from '@/components/AdminChecklistMasterModal'
import { LineGroupSettingsModal } from '@/components/LineGroupSettingsModal'
import type { LineChannelTarget } from '@/lib/line'

interface DefaultWbsItem {
  wbs_no: string
  name: string
  duration: number | string
  predecessors: string | null
}

const FALLBACK_DEFAULT_WBS_TASKS: DefaultWbsItem[] = [
  { wbs_no: '1', name: 'งานเตรียมพื้นที่ รื้อถอน เสาเข็ม', duration: 10, predecessors: null },
  { wbs_no: '2', name: 'งานโครงสร้างฐานราก เสาตอม่อ และคานคอดิน', duration: 14, predecessors: '1' },
  { wbs_no: '3', name: 'งานโครงสร้าง คสล. ชั้น 1', duration: 14, predecessors: '2' },
  { wbs_no: '4', name: 'งานโครงสร้าง คสล. ชั้น 2', duration: 14, predecessors: '3' },
  { wbs_no: '5', name: 'งานโครงสร้างหลังคา และมุงหลังคา', duration: 14, predecessors: '4' },
  { wbs_no: '6', name: 'งานก่ออิฐ กรีดผนังฝังท่อร้อยสาย และจับเซี้ยมฉาบปูน', duration: 14, predecessors: '5' },
  { wbs_no: '7', name: 'งานระบบท่อเมนและสุขาภิบาล (ถังบำบัด/บ่อพัก/ท่อระบายน้ำ)', duration: 10, predecessors: '6' },
  { wbs_no: '8', name: 'งานผิวพื้น ปรับระดับ และปูกระเบื้อง', duration: 14, predecessors: '7' },
  { wbs_no: '9', name: 'งานฝ้าเพดาน และงานระบบร้อยสายบนฝ้า', duration: 10, predecessors: '8' },
  { wbs_no: '10', name: 'งานติดตั้งประตู หน้าต่าง ราวบันได และอุปกรณ์ประกอบ', duration: 10, predecessors: '9' },
  { wbs_no: '11', name: 'งานติดตั้งสุขภัณฑ์ ดวงโคม ตู้ระบบ ทาสี และเก็บความเรียบร้อย', duration: 14, predecessors: '10' }
]

export function AdminSettingsClient({
  initialSettings,
  projects = [],
}: {
  initialSettings: Record<string, string>
  projects?: { id: string; name: string; status: string; supervisor?: string | null }[]
}) {
  const [settings, setSettings] = useState(initialSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false)
  const [isWbsModalOpen, setIsWbsModalOpen] = useState(false)
  const [masterCount, setMasterCount] = useState(37)
  const [activeModalChannel, setActiveModalChannel] = useState<LineChannelTarget | null>(null)

  const [wbsTasks, setWbsTasks] = useState<DefaultWbsItem[]>(() => {
    try {
      const val = initialSettings['default_wbs_tasks']
      if (val) {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return FALLBACK_DEFAULT_WBS_TASKS
  })
  const [newWbsName, setNewWbsName] = useState('')
  const [newWbsDuration, setNewWbsDuration] = useState('14')
  const [isWbsSaving, setIsWbsSaving] = useState(false)

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

  const [slotDay, setSlotDay] = useState('Mon')
  const [slotTime, setSlotTime] = useState('08:30')
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelToken, setNewChannelToken] = useState('')

  const ALL_DAYS = [
    { id: 'Mon', label: 'จันทร์' },
    { id: 'Tue', label: 'อังคาร' },
    { id: 'Wed', label: 'พุธ' },
    { id: 'Thu', label: 'พฤหัสบดี' },
    { id: 'Fri', label: 'ศุกร์' },
    { id: 'Sat', label: 'เสาร์' },
    { id: 'Sun', label: 'อาทิตย์' },
  ]

  const DAY_LABEL_MAP: Record<string, string> = {
    Mon: 'วันจันทร์',
    Tue: 'วันอังคาร',
    Wed: 'วันพุธ',
    Thu: 'วันพฤหัสบดี',
    Fri: 'วันศุกร์',
    Sat: 'วันเสาร์',
    Sun: 'วันอาทิตย์',
    All: 'ทุกวัน',
  }

  const getScheduleSlots = (): { day: string; time: string }[] => {
    try {
      const val = settings['line_cron_schedule']
      if (val) {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return [
      { day: 'Mon', time: '08:30' },
      { day: 'Wed', time: '13:00' },
    ]
  }

  const getLineChannels = (): {
    id: string
    name: string
    token: string
    enabled: boolean
    project_ids?: string[] | 'all'
    cron_enabled?: boolean
    cron_schedule?: { day: string; time: string }[]
    alert_enabled?: boolean
    alert_day?: string
    alert_time?: string
  }[] => {
    try {
      const val = settings['line_channels']
      if (val) {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    if (settings['line_global_token']) {
      return [
        {
          id: 'default_ch',
          name: 'กลุ่มแจ้งเตือนหลัก (Main Group)',
          token: settings['line_global_token'],
          enabled: true,
          project_ids: 'all',
          cron_enabled: true,
          cron_schedule: [{ day: 'Mon', time: '08:30' }],
          alert_enabled: true,
          alert_day: 'Tue',
          alert_time: '09:00',
        },
      ]
    }
    return []
  }

  const saveSettingKey = async (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setIsSaving(true)
    try {
      const { data, error } = await supabase.from('system_settings').select('id').eq('key', key).maybeSingle()
      if (data) {
        await supabase.from('system_settings').update({ value }).eq('key', key)
      } else {
        await supabase.from('system_settings').insert({ key, value })
      }
    } catch (e) {
      console.error('Error in saveSettingKey:', e)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggle = async (key: string) => {
    const newVal = settings[key] === 'true' ? 'false' : 'true'
    setSettings(prev => ({ ...prev, [key]: newVal }))
    
    setIsSaving(true)
    try {
      const { data, error } = await supabase.from('system_settings').select('id').eq('key', key).maybeSingle()
      if (data) {
        await supabase.from('system_settings').update({ value: newVal }).eq('key', key)
      } else {
        await supabase.from('system_settings').insert({ key, value: newVal })
      }
    } catch (e) {
      console.error('Error in handleToggle:', e)
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

  const saveWbsTasks = async (updated: DefaultWbsItem[]) => {
    const normalized = updated.map(item => ({
      ...item,
      duration: Math.max(1, parseInt(String(item.duration), 10) || 1)
    }))
    setWbsTasks(normalized)
    setIsWbsSaving(true)
    try {
      const serialized = JSON.stringify(normalized)
      const { data } = await supabase.from('system_settings').select('id').eq('key', 'default_wbs_tasks').maybeSingle()
      if (data) {
        await supabase.from('system_settings').update({ value: serialized }).eq('key', 'default_wbs_tasks')
      } else {
        await supabase.from('system_settings').insert({ key: 'default_wbs_tasks', value: serialized })
      }
      setSettings(prev => ({ ...prev, default_wbs_tasks: serialized }))
    } catch (e) {
      console.error('Error saving default_wbs_tasks:', e)
    } finally {
      setIsWbsSaving(false)
    }
  }

  const handleMoveWbsTask = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= wbsTasks.length) return
    const newItems = [...wbsTasks]
    const temp = newItems[index]
    newItems[index] = newItems[targetIndex]
    newItems[targetIndex] = temp

    const resequenced = newItems.map((item, i) => ({
      ...item,
      wbs_no: String(i + 1),
      predecessors: i === 0 ? null : String(i)
    }))
    saveWbsTasks(resequenced)
  }

  const handleDeleteWbsTask = (index: number) => {
    const filtered = wbsTasks.filter((_, i) => i !== index)
    const resequenced = filtered.map((item, i) => ({
      ...item,
      wbs_no: String(i + 1),
      predecessors: i === 0 ? null : String(i)
    }))
    saveWbsTasks(resequenced)
  }

  const handleAddWbsTask = () => {
    const trimmed = newWbsName.trim()
    if (!trimmed) return
    const dur = parseInt(newWbsDuration, 10) || 10
    const newItem: DefaultWbsItem = {
      wbs_no: String(wbsTasks.length + 1),
      name: trimmed,
      duration: dur,
      predecessors: wbsTasks.length === 0 ? null : String(wbsTasks.length)
    }
    const updated = [...wbsTasks, newItem]
    saveWbsTasks(updated)
    setNewWbsName('')
    setNewWbsDuration('14')
  }

  const handleUpdateWbsTask = (index: number, field: 'name' | 'duration', value: any) => {
    setWbsTasks(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const handleBlurSaveWbs = () => {
    saveWbsTasks(wbsTasks)
  }

  const handleResetWbsTasks = () => {
    if (confirm('คุณต้องการรีเซ็ตค่าตั้งต้นแผนงาน WBS กลับเป็น 11 รายการมาตรฐานใช่หรือไม่?')) {
      saveWbsTasks(FALLBACK_DEFAULT_WBS_TASKS)
    }
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

      {/* ── DEFAULT WBS TASKS MANAGEMENT SECTION (TRIGGER BUTTON + POPUP MODAL) ── */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
            เทมเพลตแผนงานเริ่มต้น (Default WBS Plan)
          </h3>
          <p className="text-xs text-slate-400">
            ตั้งค่ารายการกิจกรรมและจำนวนวันเริ่มต้นสำหรับการสร้างโครงการใหม่
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsWbsModalOpen(true)}
          className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-[#1a1a36] hover:bg-slate-100 dark:hover:bg-[#202042] border border-slate-200 dark:border-[#252548] rounded-2xl transition-all w-full text-left cursor-pointer group shadow-xs"
        >
          <div className="p-3.5 bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-2xl group-hover:scale-105 transition-transform">
            <CalendarRange size={28} />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              เปิดศูนย์ตั้งค่าแผนงาน WBS เริ่มต้น
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold">
                {wbsTasks.length} กิจกรรมตั้งต้น
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              คลิกที่นี่เพื่อเปิดหน้าต่างจัดการรายการกิจกรรม WBS เริ่มต้น ปรับชื่อ ระยะเวลากิจกรรม เพิ่ม/ลบ และสลับลำดับขึ้น-ลง
            </p>
          </div>
          <ChevronRight size={22} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Modal Popup */}
        {isWbsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#14142a] border border-slate-200 dark:border-[#252548] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-[#252548] bg-slate-50/50 dark:bg-[#1a1a36]/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-xl">
                    <CalendarRange size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                      จัดการค่าตั้งต้นแผนงาน WBS
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold">
                        {wbsTasks.length} รายการ
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      รายการกิจกรรมเริ่มต้นที่จะถูกนำไปสร้างแผนงานอัตโนมัติเมื่อเพิ่มโครงการใหม่
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetWbsTasks}
                    disabled={isWbsSaving}
                    className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-[#252548] rounded-xl hover:bg-slate-100 dark:hover:bg-[#1e1e38] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="รีเซ็ตกลับเป็น 11 รายการมาตรฐาน"
                  >
                    <RotateCcw size={13} />
                    <span className="hidden sm:inline">คืนค่า 11 รายการมาตรฐาน</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsWbsModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1e1e38] rounded-xl transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                {isWbsSaving && (
                  <div className="flex items-center gap-2 text-xs font-bold text-primary-500 py-1">
                    <Loader2 className="animate-spin" size={14} />
                    กำลังบันทึกค่าตั้งต้นแผนงาน WBS...
                  </div>
                )}

                {/* Add new default task input */}
                <div className="flex flex-wrap sm:flex-nowrap gap-2 bg-slate-50 dark:bg-[#1a1a36]/50 p-3 rounded-xl border border-slate-200 dark:border-[#252548]">
                  <input
                    type="text"
                    placeholder="พิมพ์ชื่อกิจกรรมตั้งต้นใหม่..."
                    value={newWbsName}
                    onChange={e => setNewWbsName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddWbsTask()
                    }}
                    className="input-base text-sm font-semibold flex-1 min-w-[200px]"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      placeholder="วัน"
                      value={newWbsDuration}
                      onChange={e => setNewWbsDuration(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddWbsTask()
                      }}
                      className="input-base text-sm font-semibold w-20 text-center font-mono"
                      title="ระยะเวลา (วัน)"
                    />
                    <span className="text-xs text-slate-400 font-bold whitespace-nowrap">วัน</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddWbsTask}
                    disabled={isWbsSaving || !newWbsName.trim()}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Plus size={16} /> เพิ่มกิจกรรม
                  </button>
                </div>

                {/* List of default tasks */}
                <div className="border border-slate-200 dark:border-[#252548] rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-[#252548] bg-white dark:bg-[#14142a]">
                  {wbsTasks.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400 italic">
                      ยังไม่มีรายการกิจกรรมตั้งต้น (คลิกปุ่ม &quot;คืนค่า 11 รายการมาตรฐาน&quot; เพื่อโหลดรายการแนะนำ)
                    </div>
                  ) : (
                    wbsTasks.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2.5 sm:p-3 hover:bg-slate-50/70 dark:hover:bg-[#1a1a36]/30 transition-colors"
                      >
                        {/* Reorder Buttons */}
                        <div className="flex flex-col items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveWbsTask(idx, 'up')}
                            disabled={idx === 0 || isWbsSaving}
                            className="p-1 text-slate-300 hover:text-primary-500 disabled:opacity-20 transition-colors cursor-pointer"
                            title="เลื่อนขึ้น"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveWbsTask(idx, 'down')}
                            disabled={idx === wbsTasks.length - 1 || isWbsSaving}
                            className="p-1 text-slate-300 hover:text-primary-500 disabled:opacity-20 transition-colors cursor-pointer"
                            title="เลื่อนลง"
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>

                        {/* Index / WBS No Badge */}
                        <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#1e1e38] text-slate-600 dark:text-slate-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>

                        {/* Task Name Input (Inline editable) */}
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => handleUpdateWbsTask(idx, 'name', e.target.value)}
                          onBlur={handleBlurSaveWbs}
                          className="input-base text-xs sm:text-sm font-semibold flex-1 min-w-0"
                          placeholder="ชื่อกิจกรรม..."
                        />

                        {/* Duration Input */}
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            min="1"
                            value={item.duration}
                            onChange={e => handleUpdateWbsTask(idx, 'duration', e.target.value)}
                            onBlur={handleBlurSaveWbs}
                            className="input-base text-xs sm:text-sm font-mono text-center w-16 sm:w-20"
                            title="ระยะเวลา (วัน)"
                          />
                          <span className="text-[11px] text-slate-400 font-bold hidden sm:inline">วัน</span>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteWbsTask(idx)}
                          disabled={isWbsSaving}
                          className="p-1.5 text-slate-300 hover:text-red-500 rounded hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                          title="ลบรายการนี้"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-[#252548] bg-slate-50/50 dark:bg-[#1a1a36]/50 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setIsWbsModalOpen(false)}
                  className="px-5 py-2 text-sm font-bold bg-slate-200 hover:bg-slate-300 dark:bg-[#202042] dark:hover:bg-[#282854] text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        )}
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
          {/* Multi-Channel & Multi-Group Notification Targets Manager */}
          <div className="p-4 bg-slate-50 dark:bg-[#1c1c38] rounded-xl border border-slate-200 dark:border-[#252548] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1.5">
                  <span>📱 จัดการช่องทาง & กลุ่มแจ้งเตือน LINE (Multi-Channel Group Targets)</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  แยกเพิ่มกลุ่มแจ้งเตือนและตั้งชื่อแต่ละกลุ่มได้อย่างอิสระ (เช่น กลุ่มผู้บริหาร, กลุ่มวิศวกรสนาม, กลุ่มที่ปรึกษา)
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const channels = getLineChannels()
                  const activeChannels = channels.filter(c => c.enabled && c.token)
                  if (activeChannels.length === 0 && !settings['line_global_token']) {
                    alert('กรุณาเพิ่มกลุ่มแจ้งเตือนอย่างน้อย 1 กลุ่มพร้อมกรอก Token ก่อนกดทดลองส่ง')
                    return
                  }
                  setIsSaving(true)
                  try {
                    const res = await fetch('/api/cron/line-briefing', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ token: settings['line_global_token'] || '' }),
                    })
                    const resJson = await res.json()
                    if (resJson.success) {
                      alert(`✅ ทดลองส่ง LINE กระจายทุกกลุ่มเรียบร้อยแล้ว!\n${resJson.message}`)
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
                📲 ทดลองส่งกระจายทุกกลุ่ม
              </button>
            </div>

            {/* Configured Channels List */}
            <div className="space-y-4 pt-2 border-t border-slate-200/60 dark:border-[#252548]">
              {getLineChannels().length === 0 ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-medium">
                  ⚠️ ยังไม่มีกลุ่มแจ้งเตือนในระบบ กรุณากรอกชื่อกลุ่มและ LINE Token ด้านล่างเพื่อเริ่มใช้งาน
                </div>
              ) : (
                getLineChannels().map((ch, idx) => {
                  const selectedProjects = ch.project_ids === 'all' || !ch.project_ids ? 'all' : ch.project_ids

                  return (
                    <div
                      key={ch.id || idx}
                      className="p-4 bg-white dark:bg-[#13132a] rounded-2xl border border-slate-200 dark:border-[#252548] space-y-3.5 shadow-xs"
                    >
                      {/* Title & Enable Switch & Delete */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-[#202042]">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-base">👥</span>
                          <input
                            type="text"
                            value={ch.name}
                            onChange={(e) => {
                              const updated = [...getLineChannels()]
                              updated[idx].name = e.target.value
                              saveSettingKey('line_channels', JSON.stringify(updated))
                            }}
                            className="font-bold text-sm text-slate-900 dark:text-white bg-transparent border-b border-slate-200 dark:border-[#252548] focus:border-primary-500 focus:outline-none px-1.5 py-0.5 flex-1"
                            placeholder="ชื่อกลุ่ม เช่น กลุ่มผู้บริหาร"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...getLineChannels()]
                              updated[idx].enabled = !updated[idx].enabled
                              saveSettingKey('line_channels', JSON.stringify(updated))
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                              ch.enabled
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {ch.enabled ? '🟢 เปิดส่ง' : '🔴 ปิดส่ง'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const updated = getLineChannels().filter((_, i) => i !== idx)
                              saveSettingKey('line_channels', JSON.stringify(updated))
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="ลบกลุ่มนี้"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Token Input */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                          🔑 LINE Token ประจำกลุ่ม (ChannelAccessToken|GroupId)
                        </label>
                        <input
                          type="password"
                          value={ch.token}
                          onChange={(e) => {
                            const updated = [...getLineChannels()]
                            updated[idx].token = e.target.value
                            saveSettingKey('line_channels', JSON.stringify(updated))
                          }}
                          placeholder="วาง LINE Token ของกลุ่มนี้"
                          className="input-base text-xs font-mono w-full py-1.5"
                        />
                      </div>

                      {/* 3 Control Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-[#202042]">
                        <button
                          type="button"
                          onClick={() => setActiveModalChannel(ch)}
                          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Settings size={14} /> ⚙️ ตั้งค่าและกำหนดเงื่อนไขกลุ่มนี้
                        </button>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* ปุ่ม 1: ทดสอบการเชื่อมต่อ */}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!ch.token) {
                                alert('กรุณากรอก Token สำหรับกลุ่มนี้ก่อนทดลองส่ง')
                                return
                              }
                              setIsSaving(true)
                              try {
                                const res = await fetch('/api/admin/line-channel/dispatch', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ channelId: ch.id, mode: 'test' }),
                                })
                                const resJson = await res.json()
                                if (resJson.success) {
                                  alert(`✅ ${resJson.message}`)
                                } else {
                                  alert(`❌ ทดสอบไม่สำเร็จ: ${resJson.error}`)
                                }
                              } catch (e: any) {
                                alert(`❌ ข้อผิดพลาด: ${e.message}`)
                              } finally {
                                setIsSaving(false)
                              }
                            }}
                            disabled={isSaving}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            📡 1. ทดสอบการเชื่อมต่อ
                          </button>

                          {/* ปุ่ม 2: ส่งสรุปตอนนี้เลย */}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!ch.token) {
                                alert('กรุณากรอก Token สำหรับกลุ่มนี้ก่อนสั่งส่ง')
                                return
                              }
                              const confirmSend = confirm(`คุณต้องการส่งสรุปรายงานโครงการเข้ากลุ่ม "${ch.name}" ทันทีตอนนี้เลยใช่หรือไม่?`)
                              if (!confirmSend) return

                              setIsSaving(true)
                              try {
                                const res = await fetch('/api/admin/line-channel/dispatch', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ channelId: ch.id, mode: 'send_now' }),
                                })
                                const resJson = await res.json()
                                if (resJson.success) {
                                  alert(`🎉 ${resJson.message}`)
                                } else {
                                  alert(`❌ ไม่สามารถส่งสรุปได้: ${resJson.error}`)
                                }
                              } catch (e: any) {
                                alert(`❌ ข้อผิดพลาด: ${e.message}`)
                              } finally {
                                setIsSaving(false)
                              }
                            }}
                            disabled={isSaving}
                            className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            🚀 2. ส่งสรุปตอนนี้เลย
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}

              {/* Add New Channel Form */}
              <div className="p-3 bg-slate-100/70 dark:bg-[#181832] rounded-xl border border-slate-200/80 dark:border-[#252548] space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  ➕ เพิ่มช่องทาง / กลุ่มแจ้งเตือนใหม่:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="ชื่อกลุ่ม เช่น กลุ่มผู้บริหาร / กลุ่มวิศวกรสนาม"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    className="input-base text-xs font-bold py-1.5"
                  />
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="LINE Token ประจำกลุ่ม"
                      value={newChannelToken}
                      onChange={(e) => setNewChannelToken(e.target.value)}
                      className="input-base text-xs font-mono flex-1 py-1.5"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newChannelName.trim() || !newChannelToken.trim()) {
                          alert('กรุณากรอกทั้งชื่อกลุ่มและ LINE Token')
                          return
                        }
                        const current = getLineChannels()
                        const newCh = {
                          id: `ch_${Date.now()}`,
                          name: newChannelName.trim(),
                          token: newChannelToken.trim(),
                          enabled: true,
                          project_ids: 'all',
                        }
                        const updated = [...current, newCh]
                        saveSettingKey('line_channels', JSON.stringify(updated))
                        saveSettingKey('line_global_token', newChannelToken.trim())
                        setNewChannelName('')
                        setNewChannelToken('')
                      }}
                      className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus size={14} /> เพิ่มกลุ่มนี้
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Render Per-Group Settings Modal */}
      <LineGroupSettingsModal
        isOpen={!!activeModalChannel}
        onClose={() => setActiveModalChannel(null)}
        channel={activeModalChannel}
        projects={projects}
        onSave={async (updatedChannel) => {
          const currentChannels = getLineChannels()
          const channelIndex = currentChannels.findIndex((c) => c.id === updatedChannel.id)

          let updatedChannelsList: LineChannelTarget[] = []
          if (channelIndex >= 0) {
            updatedChannelsList = [...currentChannels]
            updatedChannelsList[channelIndex] = updatedChannel
          } else {
            updatedChannelsList = [...currentChannels, updatedChannel]
          }

          await saveSettingKey('line_channels', JSON.stringify(updatedChannelsList))
        }}
      />
    </div>
  )
}
