'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Save, Loader2, Plus, Trash2 } from 'lucide-react'
import { updateProjectBaseline } from '@/app/actions/projects'
import { saveMilestones } from '@/app/actions/milestones'
import dynamic from 'next/dynamic'
import { AmendmentForm } from './AmendmentForm'
import type { Project, ProjectMilestone, ContractAmendment } from '@/lib/types'

const DocumentManager = dynamic(() => import('./ai/DocumentManager').then(mod => mod.DocumentManager), { ssr: false })

interface EditBaselineModalProps {
  project: Project
  milestones: ProjectMilestone[]
  amendments: ContractAmendment[]
  onClose: () => void
  workGroups: string[]
}

export function EditBaselineModal({ project, milestones, amendments, onClose, workGroups }: EditBaselineModalProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState(project.start_date || '')
  const [endDate, setEndDate] = useState(project.end_date || '')

  const hasDateError = !!(startDate && endDate && new Date(startDate) >= new Date(endDate))

  const [localMilestones, setLocalMilestones] = useState<ProjectMilestone[]>(
    milestones.length > 0
      ? milestones
      : [
          { milestone_no: 1, name: 'งวดที่ 1', work_scope: '', amount: 0, is_paid: false, payment_date: null, expected_payment_date: null },
          { milestone_no: 2, name: 'งวดที่ 2', work_scope: '', amount: 0, is_paid: false, payment_date: null, expected_payment_date: null },
          { milestone_no: 3, name: 'งวดที่ 3', work_scope: '', amount: 0, is_paid: false, payment_date: null, expected_payment_date: null }
        ]
  )

  const [supervisors, setSupervisors] = useState<string[]>(() => {
    if (project.supervisor) {
      const list = project.supervisor.split(',').map(s => s.trim()).filter(Boolean)
      if (list.length > 0) return list
    }
    return ['']
  })

  const [committeeMembers, setCommitteeMembers] = useState<string[]>(() => {
    let list: string[] = []
    try {
      if (project.inspection_committee) {
        const parsed = JSON.parse(project.inspection_committee)
        if (Array.isArray(parsed)) {
          list = parsed.filter(Boolean)
        } else {
          list = project.inspection_committee.split(',').map(s => s.trim()).filter(Boolean)
        }
      }
    } catch (e) {
      if (project.inspection_committee) {
        list = project.inspection_committee.split('\n').map(s => s.trim()).filter(Boolean)
      }
    }
    return list.length > 0 ? list : ['', '', '']
  })

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, loading])

  const handleAddMilestone = () => {
    setLocalMilestones([
      ...localMilestones,
      {
        milestone_no: localMilestones.length + 1,
        name: `งวดที่ ${localMilestones.length + 1}`,
        work_scope: '',
        amount: 0,
        is_paid: false,
        payment_date: null,
        expected_payment_date: null
      }
    ])
  }

  const handleUpdateMilestone = (index: number, key: keyof ProjectMilestone, value: any) => {
    const updated = [...localMilestones]
    updated[index] = {
      ...updated[index],
      [key]: value
    }
    if (key === 'is_paid' && !value) {
      updated[index].payment_date = null
    }
    setLocalMilestones(updated)
  }

  const handleRemoveMilestone = (index: number) => {
    const updated = localMilestones.filter((_, idx) => idx !== index)
    const reindexed = updated.map((m, idx) => ({
      ...m,
      milestone_no: idx + 1,
      name: `งวดที่ ${idx + 1}`
    }))
    setLocalMilestones(reindexed)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)

    // Call projects update baseline action
    const resProject = await updateProjectBaseline(project.id, null, formData)
    if (resProject?.error) {
      setError(resProject.error)
      setLoading(false)
      return
    }

    // Call save milestones action
    const resMilestones = await saveMilestones(project.id, localMilestones)
    if (resMilestones?.error) {
      setError(resMilestones.error)
      setLoading(false)
      return
    }

    setLoading(false)
    onClose()
  }

  const inputCls = 'input-base font-medium'
  const labelCls = 'block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl animate-scale-in bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] shadow-2xl">
        {/* Modal header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white dark:bg-[#13132a] border-b border-slate-100 dark:border-[#1e1e38]">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">แก้ไขข้อมูลและ Baseline โครงการ</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{project.name}</p>
          </div>
          <button
            id="close-baseline-modal"
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e1e38] transition-all duration-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="name">ชื่อโครงการ *</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={project.name}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelCls}>ผู้ควบคุมงาน *</label>
              <input type="hidden" name="supervisor" value={supervisors.filter(Boolean).join(', ')} />
              {supervisors.map((sup, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={sup}
                    onChange={(e) => {
                      const updated = [...supervisors]
                      updated[idx] = e.target.value
                      setSupervisors(updated)
                    }}
                    placeholder={`ผู้ควบคุมงานคนที่ ${idx + 1}`}
                    className={inputCls}
                  />
                  {supervisors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSupervisors(supervisors.filter((_, i) => i !== idx))}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="ลบ"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSupervisors([...supervisors, ''])}
                className="text-xs text-primary-600 dark:text-primary-400 font-bold self-start mt-1 hover:underline"
              >
                + เพิ่มผู้ควบคุมงาน
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className={labelCls} htmlFor="location">สถานที่ก่อสร้าง</label>
              <input
                id="location"
                name="location"
                type="text"
                defaultValue={project.location || ''}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="status">สถานะโครงการ</label>
              <select id="status" name="status" defaultValue={project.status} className={inputCls}>
                <option value="ออกแบบ สำรวจ ประมาณการ">1. ออกแบบ สำรวจ ประมาณการ</option>
                <option value="จัดซื้อจัดจ้าง">2. จัดซื้อจัดจ้าง</option>
                <option value="รอดำเนินการ">3. รอดำเนินการ</option>
                <option value="กำลังดำเนินการ">4. กำลังดำเนินการ</option>
                <option value="ระงับ">5. ระงับ</option>
                <option value="เสร็จสิ้น">6. เสร็จสิ้น</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="wbs_no">หมายเลขงาน (WBS)</label>
              <input
                id="wbs_no"
                name="wbs_no"
                type="text"
                defaultValue={project.wbs_no || ''}
                placeholder="เช่น WBS-1002"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="work_group">กลุ่มงาน (Work Group)</label>
              <select id="work_group" name="work_group" defaultValue={project.work_group || ''} className={inputCls}>
                <option value="">-- ไม่ระบุกลุ่มงาน --</option>
                {workGroups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="description">รายละเอียดโครงการ</label>
            <textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={project.description || ''}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-3">
              <label className={labelCls}>คณะกรรมการตรวจรับพัสดุ</label>
              <input
                type="hidden"
                name="inspection_committee"
                value={JSON.stringify(committeeMembers.map(m => m.trim()).filter(Boolean))}
              />
              <div className="space-y-2">
                {committeeMembers.map((member, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={member}
                      placeholder={`กรรมการคนที่ ${idx + 1}`}
                      onChange={(e) => {
                        const updated = [...committeeMembers]
                        updated[idx] = e.target.value
                        setCommitteeMembers(updated)
                      }}
                      className={inputCls}
                    />
                    {committeeMembers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCommitteeMembers(committeeMembers.filter((_, i) => i !== idx))
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 rounded border border-slate-200 dark:border-[#252548] hover:bg-red-500/5 transition-all flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setCommitteeMembers([...committeeMembers, ''])}
                  className="text-xs text-primary-600 dark:text-primary-400 font-bold hover:underline flex items-center gap-1 mt-1.5"
                >
                  <Plus size={12} /> เพิ่มกรรมการตรวจรับ
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelCls} htmlFor="contractor">ผู้รับจ้าง / คู่สัญญา</label>
                <input
                  id="contractor"
                  name="contractor"
                  type="text"
                  defaultValue={project.contractor || ''}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="contract_no">เลขที่สัญญา</label>
                <input
                  id="contract_no"
                  name="contract_no"
                  type="text"
                  defaultValue={project.contract_no || ''}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="line_token">💬 LINE Token เฉพาะโครงการ</label>
                <input
                  id="line_token"
                  name="line_token"
                  type="password"
                  placeholder="เว้นว่างไว้เพื่อใช้ Token กลาง"
                  defaultValue={(project as any).line_token || ''}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100 dark:border-[#1e1e38]" />
          <h3 className="text-sm font-bold text-primary-600 dark:text-primary-400">ค่า Baseline โครงการ</h3>

          {/* วันที่เริ่ม/สิ้นสุด */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls} htmlFor="start_date">วันที่เริ่มต้น (Start Date)</label>
              <input
                id="start_date"
                name="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="end_date">วันที่สิ้นสุดสัญญา (Contract End Date)</label>
              <input
                id="end_date"
                name="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputCls}
              />
              {hasDateError && (
                <p className="text-red-500 text-[10px] font-bold mt-1.5 leading-tight">
                  วันสิ้นสุดสัญญาต้องมาหลังวันเริ่มต้น
                </p>
              )}
            </div>
            <div>
              <label className={labelCls} htmlFor="penalty_rate">ค่าปรับต่อวันล่าช้า (บาท)</label>
              <input
                id="penalty_rate"
                name="penalty_rate"
                type="number"
                min="0"
                step="100"
                defaultValue={project.penalty_rate || 0}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="budget">งบประมาณทั้งหมด (บาท)</label>
              <input
                id="budget"
                name="budget"
                type="number"
                min="0"
                step="10000"
                defaultValue={project.budget || ''}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="opening_pr">ยอดเปิด PR (บาท)</label>
              <input
                id="opening_pr"
                name="opening_pr"
                type="number"
                min="0"
                step="10000"
                defaultValue={project.opening_pr || 0}
                className={inputCls}
              />
            </div>
          </div>

          <hr className="border-slate-100 dark:border-[#1e1e38]" />
          
          {/* งวดงาน & การจ่ายเงิน */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-primary-600 dark:text-primary-400">งวดงาน & การจ่ายเงิน</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                Payment Milestones — ติ๊ก "ส่งแล้ว" + วันที่ → สร้างเส้น AC (สีส้ม) และคำนวณ % เบิกจ่ายอัตโนมัติ
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddMilestone}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors"
            >
              <Plus size={13} />
              เพิ่มงวด
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 dark:border-[#1e1e38] rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#14142a] text-slate-400 dark:text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100 dark:border-[#1e1e38]">
                  <th className="p-3 w-24">งวด</th>
                  <th className="p-3">ครอบคลุมงาน</th>
                  <th className="p-3 w-36">มูลค่างวด (฿)</th>
                  <th className="p-3 w-32">สถานะการเงิน</th>
                  <th className="p-3 w-32">คาดการณ์เบิกจ่าย</th>
                  <th className="p-3 w-32">จ่ายจริง</th>
                  <th className="p-3 w-28">จ่ายสะสม</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1e1e38]">
                {localMilestones.map((m, idx) => {
                  const isPaid = m.status === 'Paid' || m.is_paid
                  let cumSum = 0
                  for (let j = 0; j <= idx; j++) {
                    const isJPaid = localMilestones[j].status === 'Paid' || localMilestones[j].is_paid
                    if (isJPaid) {
                      cumSum += Number(localMilestones[j].amount) || 0
                    }
                  }
                  const cumDisplay = isPaid ? `฿ ${cumSum.toLocaleString()}` : '—'

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-[#14142a]/30">
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                        งวดที่ {idx + 1}
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          placeholder="ครอบคลุมงาน..."
                          value={m.work_scope || ''}
                          onChange={(e) => handleUpdateMilestone(idx, 'work_scope', e.target.value)}
                          className="w-full bg-transparent border-0 focus:ring-0 p-0 text-slate-950 dark:text-white placeholder-slate-400 focus:outline-none"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={m.amount || ''}
                          onChange={(e) => handleUpdateMilestone(idx, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border-0 focus:ring-0 p-0 text-slate-950 dark:text-white placeholder-slate-400 font-mono font-bold focus:outline-none"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={m.status || (m.is_paid ? 'Paid' : 'Pending')}
                          onChange={(e) => {
                            const newStatus = e.target.value
                            const isPaidNow = newStatus === 'Paid'
                            const updated = [...localMilestones]
                            updated[idx] = {
                              ...updated[idx],
                              status: newStatus,
                              is_paid: isPaidNow,
                              payment_date: isPaidNow ? updated[idx].payment_date || new Date().toISOString().split('T')[0] : null
                            }
                            setLocalMilestones(updated)
                          }}
                          className="w-full bg-transparent border-0 focus:ring-0 p-0 text-slate-950 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
                        >
                          <option value="Pending" className="text-slate-800 dark:text-white dark:bg-[#13132a]">1. รอดำเนินการ</option>
                          <option value="PR" className="text-slate-800 dark:text-white dark:bg-[#13132a]">2. ขออนุมัติจัดจ้าง (PR)</option>
                          <option value="PO" className="text-slate-800 dark:text-white dark:bg-[#13132a]">3. ทำสัญญาแล้ว (PO)</option>
                          <option value="GR" className="text-slate-800 dark:text-white dark:bg-[#13132a]">4. ตรวจรับมอบแล้ว (GR)</option>
                          <option value="IR" className="text-slate-800 dark:text-white dark:bg-[#13132a]">5. ตั้งหนี้แจ้งหนี้ (IR)</option>
                          <option value="Paid" className="text-slate-800 dark:text-white dark:bg-[#13132a]">6. จ่ายเงินแล้ว (Paid)</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="date"
                          value={m.expected_payment_date || ''}
                          disabled={isPaid}
                          onChange={(e) => handleUpdateMilestone(idx, 'expected_payment_date', e.target.value)}
                          className="w-full bg-transparent border-0 focus:ring-0 p-0 text-slate-950 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs focus:outline-none"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="date"
                          value={m.payment_date || ''}
                          disabled={!isPaid}
                          onChange={(e) => handleUpdateMilestone(idx, 'payment_date', e.target.value)}
                          className="w-full bg-transparent border-0 focus:ring-0 p-0 text-slate-950 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs focus:outline-none"
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-500 dark:text-slate-400">
                        {cumDisplay}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveMilestone(idx)}
                          className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <AmendmentForm project={project} amendments={amendments} />

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-[#1e1e38]">
            <button
              id="cancel-edit"
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#252548] hover:bg-slate-50 dark:hover:bg-[#1e1e38] transition-all duration-200 disabled:opacity-50"
            >
              ยกเลิก
            </button>
             <button
              id="submit-edit"
              type="submit"
              disabled={loading || hasDateError}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold text-white btn-primary disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save size={15} />
                  บันทึก Baseline
                </>
              )}
            </button>
          </div>
        </form>

        {/* Project Contract Documents (RAG) */}
        <div className="px-6 pb-6 border-t border-slate-100 dark:border-[#1e1e38] pt-5">
          <DocumentManager scope="project" selectedProjectId={project.id} readOnly={true} />
        </div>
      </div>
    </div>
  )
}
