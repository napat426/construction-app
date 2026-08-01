'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Loader2, Check, Send, Radio } from 'lucide-react'
import type { LineChannelTarget } from '@/lib/line'

interface LineGroupSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  channel: LineChannelTarget | null
  projects: { id: string; name: string; status: string; supervisor?: string | null }[]
  onSave: (updatedChannel: LineChannelTarget) => Promise<void>
}

const ALL_DAYS = [
  { id: 'Mon', label: 'จันทร์' },
  { id: 'Tue', label: 'อังคาร' },
  { id: 'Wed', label: 'พุธ' },
  { id: 'Thu', label: 'พฤหัสบดี' },
  { id: 'Fri', label: 'ศุกร์' },
  { id: 'Sat', label: 'เสาร์' },
  { id: 'Sun', label: 'อาทิตย์' },
]

export function LineGroupSettingsModal({
  isOpen,
  onClose,
  channel,
  projects,
  onSave,
}: LineGroupSettingsModalProps) {
  const [formData, setFormData] = useState<LineChannelTarget | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTestingPing, setIsTestingPing] = useState(false)
  const [isSendingNow, setIsSendingNow] = useState(false)

  const [newSlotDay, setNewSlotDay] = useState('Mon')
  const [newSlotTime, setNewSlotTime] = useState('08:30')

  useEffect(() => {
    if (channel) {
      setFormData({
        ...channel,
        project_ids: channel.project_ids ?? 'all',
        cron_enabled: channel.cron_enabled ?? true,
        cron_schedule: channel.cron_schedule ?? [{ day: 'Mon', time: '08:30' }],
        alert_enabled: channel.alert_enabled ?? true,
        alert_day: channel.alert_day ?? 'Tue',
        alert_time: channel.alert_time ?? '09:00',
        alert_spi_threshold: channel.alert_spi_threshold ?? 0.9,
        alert_cpi_threshold: channel.alert_cpi_threshold ?? 0.9,
        alert_diff_threshold: channel.alert_diff_threshold ?? 5,
      })
    }
  }, [channel])

  if (!isOpen || !formData) return null

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('กรุณากรอกชื่อกลุ่ม')
      return
    }
    if (!formData.token.trim()) {
      alert('กรุณากรอก LINE Token ประจำกลุ่ม')
      return
    }
    setIsSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (e: any) {
      alert(`ไม่สามารถบันทึกได้: ${e.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePingTest = async () => {
    if (!formData.token.trim()) {
      alert('กรุณากรอก LINE Token สำหรับกลุ่มนี้ก่อนทดสอบ')
      return
    }
    setIsTestingPing(true)
    try {
      const res = await fetch('/api/admin/line-channel/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: formData.id, mode: 'test' }),
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
      setIsTestingPing(false)
    }
  }

  const handleSendBriefingNow = async () => {
    if (!formData.token.trim()) {
      alert('กรุณากรอก LINE Token สำหรับกลุ่มนี้ก่อนส่ง')
      return
    }
    const confirmSend = confirm(`คุณต้องการส่งสรุปรายงานโครงการเข้ากลุ่ม "${formData.name}" ทันทีตอนนี้เลยใช่หรือไม่?`)
    if (!confirmSend) return

    setIsSendingNow(true)
    try {
      const res = await fetch('/api/admin/line-channel/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: formData.id, mode: 'send_now' }),
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
      setIsSendingNow(false)
    }
  }

  const isAllProjectsSelected = formData.project_ids === 'all' || !formData.project_ids
  const activeProjectsList = projects.filter((p) => p.status !== 'เสร็จสิ้น')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#14142a] rounded-3xl shadow-2xl border border-slate-200 dark:border-[#252548] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#202042] bg-slate-50/50 dark:bg-[#1a1a36]/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400">
              <Radio size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                ⚙️ ตั้งค่าและกำหนดเงื่อนไขประจำกลุ่ม
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                กลุ่ม: <span className="font-bold text-primary-600 dark:text-primary-400">{formData.name}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: ข้อมูลทั่วไป & LINE Token */}
          <div className="p-4 bg-slate-50 dark:bg-[#1c1c38] rounded-2xl border border-slate-200/80 dark:border-[#252548] space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>📌 1. ข้อมูลกลุ่ม & LINE Token</span>
              </h4>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  formData.enabled
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {formData.enabled ? '🟢 เปิดการส่งในกลุ่มนี้' : '🔴 ปิดการส่งในกลุ่มนี้'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อกลุ่ม (Group Name)
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น กลุ่มผู้บริหาร / กลุ่มวิศวกรสนาม"
                  className="input-base text-xs font-bold w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  LINE Token (ChannelAccessToken|GroupId)
                </label>
                <input
                  type="password"
                  value={formData.token}
                  onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                  placeholder="วาง LINE Token ของกลุ่มนี้"
                  className="input-base text-xs font-mono w-full"
                />
              </div>
            </div>
          </div>

          {/* Section 2: ขอบเขตโครงการ (Project Scope) */}
          <div className="p-4 bg-slate-50 dark:bg-[#1c1c38] rounded-2xl border border-slate-200/80 dark:border-[#252548] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  🏗️ 2. ขอบเขตโครงการที่ส่งเข้ากลุ่มนี้
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  เลือกโครงการที่ต้องการให้ระบบประมวลผลสรุปส่งเข้าแชทกลุ่มนี้
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-[#13132a] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#252548]">
                <input
                  type="checkbox"
                  checked={isAllProjectsSelected}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      project_ids: e.target.checked ? 'all' : [],
                    })
                  }
                  className="rounded text-primary-600"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  ทุกโครงการ (All)
                </span>
              </label>
            </div>

            {!isAllProjectsSelected && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-[#252548]">
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-2">
                  ติ๊กเลือกโครงการเฉพาะสำหรับกลุ่มนี้ ({activeProjectsList.length} โครงการ):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeProjectsList.map((proj) => {
                    const selectedList = Array.isArray(formData.project_ids) ? formData.project_ids : []
                    const isChecked = selectedList.includes(proj.id)

                    return (
                      <label
                        key={proj.id}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-primary-500/10 border-primary-500/40 text-primary-800 dark:text-primary-200 font-bold'
                            : 'bg-white dark:bg-[#13132a] border-slate-200 dark:border-[#252548] text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const updatedList = e.target.checked
                              ? [...selectedList, proj.id]
                              : selectedList.filter((id) => id !== proj.id)
                            setFormData({ ...formData, project_ids: updatedList })
                          }}
                          className="rounded text-primary-600"
                        />
                        <span className="truncate">{proj.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Morning Briefing Schedule */}
          <div className="p-4 bg-slate-50 dark:bg-[#1c1c38] rounded-2xl border border-slate-200/80 dark:border-[#252548] space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  🌅 3. รอบเวลาส่งสรุป Morning Briefing ประจำกลุ่ม
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  ตั้งเวลาส่งสรุปผลงาน S-Curve และ EVM ประจำวันเฉพาะกลุ่มนี้
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, cron_enabled: !formData.cron_enabled })}
                className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  formData.cron_enabled
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {formData.cron_enabled ? '🟢 เปิดอัตโนมัติ' : '🔴 ปิดอัตโนมัติ'}
              </button>
            </div>

            {formData.cron_enabled && (
              <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-[#252548]">
                {/* Active Slots list */}
                <div className="flex flex-wrap items-center gap-2">
                  {(formData.cron_schedule || []).map((slot, sIdx) => (
                    <span
                      key={`${slot.day}-${slot.time}-${sIdx}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 rounded-lg text-xs font-bold"
                    >
                      <span>🗓️ {ALL_DAYS.find((d) => d.id === slot.day)?.label || slot.day} ⏰ {slot.time} น.</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updatedSlots = (formData.cron_schedule || []).filter((_, i) => i !== sIdx)
                          setFormData({ ...formData, cron_schedule: updatedSlots })
                        }}
                        className="hover:text-red-500 p-0.5 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add slot */}
                <div className="flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-[#13132a] rounded-xl border border-slate-200 dark:border-[#252548]">
                  <select
                    value={newSlotDay}
                    onChange={(e) => setNewSlotDay(e.target.value)}
                    className="input-base text-xs font-bold py-1 w-auto"
                  >
                    {ALL_DAYS.map((d) => (
                      <option key={d.id} value={d.id}>
                        วัน{d.label}
                      </option>
                    ))}
                    <option value="All">ทุกวัน</option>
                  </select>

                  <input
                    type="time"
                    value={newSlotTime}
                    onChange={(e) => setNewSlotTime(e.target.value)}
                    className="input-base text-xs font-bold py-1 w-auto max-w-[130px]"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const currentSlots = formData.cron_schedule || []
                      const exists = currentSlots.some((s) => s.day === newSlotDay && s.time === newSlotTime)
                      if (!exists) {
                        setFormData({
                          ...formData,
                          cron_schedule: [...currentSlots, { day: newSlotDay, time: newSlotTime }],
                        })
                      }
                    }}
                    className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus size={14} /> เพิ่มรอบส่ง
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Red Zone Alert Rules */}
          <div className="p-4 bg-slate-50 dark:bg-[#1c1c38] rounded-2xl border border-slate-200/80 dark:border-[#252548] space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  🚨 4. เตือนภัยวิกฤต Red Zone Alert ประจำกลุ่ม
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  กำหนดวัน+เวลา และเกณฑ์วิกฤตที่จะให้เตือนเข้าแชทกลุ่มนี้
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, alert_enabled: !formData.alert_enabled })}
                className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  formData.alert_enabled
                    ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {formData.alert_enabled ? '🟢 เปิดเตือนวิกฤต' : '🔴 ปิดเตือนวิกฤต'}
              </button>
            </div>

            {formData.alert_enabled && (
              <div className="space-y-3.5 pt-2 border-t border-slate-200/60 dark:border-[#252548]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      🗓️ วันที่ส่งเตือนวิกฤต
                    </label>
                    <select
                      value={formData.alert_day || 'Tue'}
                      onChange={(e) => setFormData({ ...formData, alert_day: e.target.value })}
                      className="input-base text-xs font-bold w-full"
                    >
                      {ALL_DAYS.map((d) => (
                        <option key={d.id} value={d.id}>
                          ทุกวัน{d.label}
                        </option>
                      ))}
                      <option value="all">ทุกวัน</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ⏰ เวลาที่ส่งเตือนวิกฤต
                    </label>
                    <input
                      type="time"
                      value={formData.alert_time || '09:00'}
                      onChange={(e) => setFormData({ ...formData, alert_time: e.target.value })}
                      className="input-base text-xs font-bold w-full max-w-[160px]"
                    />
                  </div>
                </div>

                {/* Per-group Threshold Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/60 dark:border-[#252548]">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      เกณฑ์ SPI (ต่ำกว่า)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.alert_spi_threshold ?? 0.9}
                      onChange={(e) =>
                        setFormData({ ...formData, alert_spi_threshold: parseFloat(e.target.value) || 0.9 })
                      }
                      className="input-base text-xs font-bold w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      เกณฑ์ CPI (ต่ำกว่า)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.alert_cpi_threshold ?? 0.9}
                      onChange={(e) =>
                        setFormData({ ...formData, alert_cpi_threshold: parseFloat(e.target.value) || 0.9 })
                      }
                      className="input-base text-xs font-bold w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      % ล่าช้าสะสม (เกินกว่า %)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.alert_diff_threshold ?? 5}
                      onChange={(e) =>
                        setFormData({ ...formData, alert_diff_threshold: parseFloat(e.target.value) || 5 })
                      }
                      className="input-base text-xs font-bold w-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer with 2 Action Buttons + Save */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#202042] bg-slate-50/50 dark:bg-[#1a1a36]/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePingTest}
              disabled={isTestingPing || isSaving}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isTestingPing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              📡 1. ทดสอบการเชื่อมต่อ
            </button>

            <button
              type="button"
              onClick={handleSendBriefingNow}
              disabled={isSendingNow || isSaving}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSendingNow ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              🚀 2. ส่งสรุปตอนนี้เลย
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-300 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              💾 บันทึกตั้งค่ากลุ่มนี้
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
