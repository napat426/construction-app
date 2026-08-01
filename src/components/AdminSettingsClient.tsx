'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Loader2, HardHat, ListChecks, ChevronRight } from 'lucide-react'
import { AdminChecklistMasterModal } from '@/components/AdminChecklistMasterModal'

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
      const { data } = await supabase.from('system_settings').select('id').eq('key', key).single()
      if (data) await supabase.from('system_settings').update({ value }).eq('key', key)
      else await supabase.from('system_settings').insert({ key, value })
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

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

                      {/* Project Scope Selector */}
                      <div className="p-3 bg-slate-50/80 dark:bg-[#1a1a36]/80 rounded-xl border border-slate-100 dark:border-[#252548] space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                            🏗️ เลือกโครงการที่จะแจ้งเตือนเข้ากลุ่มนี้:
                          </label>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-bold cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedProjects === 'all'}
                                onChange={(e) => {
                                  const updated = [...getLineChannels()]
                                  updated[idx].project_ids = e.target.checked ? 'all' : []
                                  saveSettingKey('line_channels', JSON.stringify(updated))
                                }}
                                className="rounded text-primary-600"
                              />
                              ทุกโครงการ (All Projects)
                            </label>
                          </div>
                        </div>

                        {selectedProjects !== 'all' && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {projects.map((proj) => {
                              const isChecked = Array.isArray(selectedProjects) && selectedProjects.includes(proj.id)
                              return (
                                <label
                                  key={proj.id}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
                                    isChecked
                                      ? 'bg-primary-500/10 border-primary-500/30 text-primary-700 dark:text-primary-300 font-bold'
                                      : 'bg-white dark:bg-[#13132a] border-slate-200 dark:border-[#252548] text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const currentList = Array.isArray(ch.project_ids) ? [...ch.project_ids] : []
                                      const updatedList = e.target.checked
                                        ? [...currentList, proj.id]
                                        : currentList.filter((id) => id !== proj.id)
                                      const updated = [...getLineChannels()]
                                      updated[idx].project_ids = updatedList
                                      saveSettingKey('line_channels', JSON.stringify(updated))
                                    }}
                                    className="rounded text-primary-600"
                                  />
                                  <span>{proj.name}</span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* 2 Control Action Buttons */}
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#202042]">
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

          {/* Morning Briefing Scheduled Settings */}
          <div className="p-4 bg-slate-50 dark:bg-[#1c1c38] rounded-xl border border-slate-200 dark:border-[#252548] space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1.5">
                  <span>🌅 1. Scheduled Briefing System (ตั้งค่ารอบส่งผูกวัน + เวลาแบบอิสระ)</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  กำหนดรอบเวลาส่งผูกวันและเวลาได้อย่างอิสระ (เช่น รอบแรกวันจันทร์ 08:30 น., รอบสองวันพุธ 13:00 น.)
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

            <div className="space-y-4 pt-3 border-t border-slate-200/60 dark:border-[#252548]">
              {/* Presets & Active Slots Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  📌 รายการรอบส่งปัจจุบัน (Schedule Slots Matrix)
                </label>
                
                {/* Presets */}
                <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      const daily = ALL_DAYS.map(d => ({ day: d.id, time: '08:00' }))
                      saveSettingKey('line_cron_schedule', JSON.stringify(daily))
                    }}
                    className="px-2 py-0.5 rounded bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300 hover:bg-primary-200 transition-colors"
                  >
                    ทุกวัน 08:00
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const workdays = ALL_DAYS.slice(0, 5).map(d => ({ day: d.id, time: '08:00' }))
                      saveSettingKey('line_cron_schedule', JSON.stringify(workdays))
                    }}
                    className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-300 transition-colors"
                  >
                    จ-ศ 08:00
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const customExample = [
                        { day: 'Mon', time: '08:30' },
                        { day: 'Wed', time: '13:00' },
                      ]
                      saveSettingKey('line_cron_schedule', JSON.stringify(customExample))
                    }}
                    className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200 transition-colors"
                  >
                    ตัวอย่าง: จันทร์ 08:30 + พุธ 13:00
                  </button>
                </div>
              </div>

              {/* List of configured schedule slots */}
              <div className="flex flex-wrap items-center gap-2 min-h-[38px] p-2.5 bg-white dark:bg-[#13132a] rounded-xl border border-slate-200 dark:border-[#252548]">
                {getScheduleSlots().length === 0 ? (
                  <span className="text-xs text-slate-400 italic">ยังไม่มีการตั้งรอบส่ง</span>
                ) : (
                  getScheduleSlots().map((slot, index) => (
                    <span
                      key={`${slot.day}-${slot.time}-${index}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 rounded-lg text-xs font-bold shadow-sm"
                    >
                      <span>🗓️ {DAY_LABEL_MAP[slot.day] || slot.day} ⏰ {slot.time} น.</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = getScheduleSlots().filter((_, i) => i !== index)
                          saveSettingKey('line_cron_schedule', JSON.stringify(updated))
                        }}
                        className="hover:text-red-500 p-0.5 rounded transition-colors cursor-pointer"
                        title="ลบรอบส่งนี้"
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add new Slot Form */}
              <div className="p-3 bg-slate-100/70 dark:bg-[#181832] rounded-xl border border-slate-200/80 dark:border-[#252548] space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  ➕ เพิ่มรอบส่งใหม่ (เลือกวัน + เวลาที่ต้องการ):
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={slotDay}
                    onChange={(e) => setSlotDay(e.target.value)}
                    className="input-base text-xs font-bold w-auto min-w-[120px] py-1.5"
                  >
                    <option value="Mon">วันจันทร์</option>
                    <option value="Tue">วันอังคาร</option>
                    <option value="Wed">วันพุธ</option>
                    <option value="Thu">วันพฤหัสบดี</option>
                    <option value="Fri">วันศุกร์</option>
                    <option value="Sat">วันเสาร์</option>
                    <option value="Sun">วันอาทิตย์</option>
                    <option value="All">ทุกวัน</option>
                  </select>

                  <input
                    type="time"
                    value={slotTime}
                    onChange={(e) => setSlotTime(e.target.value)}
                    className="input-base text-xs font-bold max-w-[130px] py-1.5"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (!slotDay || !slotTime) return
                      const slots = getScheduleSlots()
                      const exists = slots.some((s) => s.day === slotDay && s.time === slotTime)
                      if (!exists) {
                        const updated = [...slots, { day: slotDay, time: slotTime }]
                        saveSettingKey('line_cron_schedule', JSON.stringify(updated))
                      }
                    }}
                    className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus size={14} /> เพิ่มรอบส่งนี้
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Threshold-Based Red Flag Warning Settings */}
          <div className="p-4 bg-slate-50 dark:bg-[#1c1c38] rounded-xl border border-slate-200 dark:border-[#252548] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-sm">🚨 2. Threshold-Based LINE Alert (เตือนภัยวิกฤต Red Zone ประจำสัปดาห์)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  สรุปแจ้งเตือนเฉพาะโครงการที่ติดวิกฤตสัปดาห์ละ 1 ครั้ง โดยสามารถกำหนดวันและเวลาส่งได้เองตามต้องการ
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

            <div className="space-y-4 pt-3 border-t border-slate-200/60 dark:border-[#252548]">
              {/* Day & Time Selection for Red Zone Alert */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    🗓️ วันที่จะส่งเตือนวิกฤตประจำสัปดาห์
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_DAYS.map((day) => {
                      const selectedDay = settings['line_alert_day'] || 'Mon'
                      const isSelected = selectedDay === day.id
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => saveSettingKey('line_alert_day', day.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-red-600 border-red-600 text-white shadow-sm scale-105'
                              : 'bg-white dark:bg-[#13132a] border-slate-200 dark:border-[#252548] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1a1a36]'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}{day.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    ⏰ เวลาที่ส่งเตือนวิกฤต (24 ชม.)
                  </label>
                  <input
                    type="time"
                    value={settings['line_alert_time'] || '09:00'}
                    onChange={(e) => setSettings((prev) => ({ ...prev, line_alert_time: e.target.value }))}
                    onBlur={(e) => saveSettingKey('line_alert_time', e.target.value)}
                    className="input-base text-xs font-bold max-w-[160px]"
                  />
                </div>
              </div>

              {/* Threshold inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200/60 dark:border-[#252548]">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">เกณฑ์วิกฤต SPI (ต่ำกว่า)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings['line_alert_spi_threshold'] || '0.90'}
                    onChange={(e) => setSettings((prev) => ({ ...prev, line_alert_spi_threshold: e.target.value }))}
                    onBlur={(e) => saveSettingKey('line_alert_spi_threshold', e.target.value)}
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
                    onBlur={(e) => saveSettingKey('line_alert_cpi_threshold', e.target.value)}
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
                    onBlur={(e) => saveSettingKey('line_alert_diff_threshold', e.target.value)}
                    className="input-base text-xs font-bold w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
