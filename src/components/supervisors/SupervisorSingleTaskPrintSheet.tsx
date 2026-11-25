'use client'

import React from 'react'
import type { SupervisorTask, SupervisorTaskGroup, Project } from '@/lib/types'

interface Props {
  task: SupervisorTask
  group?: SupervisorTaskGroup
  project?: Project | null
  supervisorName: string
  avatarUrl?: string | null
}

function formatThaiDate(dateStr?: string | null): string {
  if (!dateStr) return 'ไม่ได้ระบุ'
  try {
    const clean = dateStr.split('T')[0]
    const parts = clean.split('-')
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ]
    if (parts.length === 3) {
      const [y, m, d] = parts
      const yearNum = parseInt(y, 10)
      const beYear = yearNum > 2400 ? yearNum : yearNum + 543
      const monthIdx = parseInt(m, 10) - 1
      return `${parseInt(d, 10)} ${thaiMonths[monthIdx] || m} ${beYear}`
    }
    const dt = new Date(dateStr)
    if (isNaN(dt.getTime())) return dateStr
    const d = dt.getDate()
    const m = thaiMonths[dt.getMonth()]
    const y = dt.getFullYear() + 543
    return `${d} ${m} ${y}`
  } catch {
    return dateStr || 'ไม่ได้ระบุ'
  }
}

export function SupervisorSingleTaskPrintSheet({
  task,
  group,
  project,
  supervisorName,
  avatarUrl,
}: Props) {
  const photos = task.photo_urls || []
  const printDateStr = new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date())

  const getStatusText = () => {
    switch (task.status) {
      case 'completed':
        return 'สำเร็จแล้ว (Completed)'
      case 'delayed':
        return 'ล่าช้ากว่ากำหนด (Delayed)'
      case 'in_progress':
        return 'กำลังดำเนินการ (In Progress)'
      case 'cancelled':
        return 'ยกเลิก (Cancelled)'
      default:
        return 'รอดำเนินการ (Pending)'
    }
  }

  return (
    <div className="single-task-print-sheet text-slate-900 bg-white">
      {/* ── Top Official Header ── */}
      <div className="border-b-2 border-slate-900 pb-2.5 mb-3 flex items-center justify-between">
        <div>
          <p className="text-[9pt] font-bold text-slate-600 uppercase tracking-wider">
            ระบบบริหารจัดการและควบคุมงานก่อสร้าง (Construction Management System)
          </p>
          <p className="text-[8pt] text-slate-500">
            การไฟฟ้าส่วนภูมิภาค (PEA) · แฟ้มสะสมผลงานการปฏิบัติงานรายบุคคล
          </p>
        </div>
        <div className="text-right text-[8pt] text-slate-500 font-mono">
          <p>วันที่พิมพ์: {printDateStr}</p>
          <p className="text-[7.5pt] text-slate-400">ID: {task.id.slice(0, 8)}</p>
        </div>
      </div>

      {/* ── Document Title ── */}
      <div className="text-center mb-3.5">
        <h1 className="text-[14pt] font-black tracking-tight text-slate-900 leading-tight">
          ใบรายงานผลการปฏิบัติงานรายบุคคล (Individual Work Record)
        </h1>
        <p className="text-[9pt] text-slate-600 font-medium mt-0.5">
          เอกสารสรุปรายละเอียดผลงานและภาพถ่ายประกอบการประเมิน
        </p>
      </div>

      {/* ── Supervisor & Category Profile Bar ── */}
      <div className="border border-slate-300 rounded-lg p-2.5 mb-3 bg-slate-50/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[8.5pt]">
        <div>
          <span className="text-[7.5pt] font-bold text-slate-500 uppercase block">ผู้ปฏิบัติงาน / ควบคุมงาน</span>
          <span className="font-bold text-slate-900 text-[9.5pt]">{supervisorName}</span>
        </div>
        <div>
          <span className="text-[7.5pt] font-bold text-slate-500 uppercase block">หมวดหมู่งาน</span>
          <span className="font-bold text-slate-800">{group?.name || 'งานทั่วไป'}</span>
        </div>
        <div>
          <span className="text-[7.5pt] font-bold text-slate-500 uppercase block">สถานะผลงาน</span>
          <span className={`font-bold ${
            task.status === 'completed'
              ? 'text-emerald-700'
              : task.status === 'delayed'
              ? 'text-rose-700'
              : 'text-amber-700'
          }`}>
            {getStatusText()}
          </span>
        </div>
        <div>
          <span className="text-[7.5pt] font-bold text-slate-500 uppercase block">ปัญหาอุปสรรค</span>
          <span className={`font-bold ${task.has_issue ? 'text-amber-800' : 'text-slate-600'}`}>
            {task.has_issue ? '⚠️ มีปัญหา/อุปสรรค' : '✓ ปกติ ไม่มีอุปสรรค'}
          </span>
        </div>
      </div>

      {/* ── Task Title Box ── */}
      <div className="border-l-4 border-slate-900 pl-3 py-1 mb-3">
        <span className="text-[7.5pt] font-bold uppercase tracking-wider text-slate-500 block">
          ชื่องาน / ภารกิจที่ปฏิบัติ
        </span>
        <h2 className="text-[12pt] font-black text-slate-900 leading-snug">
          {task.title}
        </h2>
      </div>

      {/* ── Timeline & Project Table ── */}
      <table className="w-full border-collapse border border-slate-300 text-[8.5pt] mb-3">
        <tbody>
          <tr className="border-b border-slate-200">
            <td className="bg-slate-100/80 px-2.5 py-1.5 font-bold text-slate-700 w-32 border-r border-slate-200">
              ระยะเวลาปฏิบัติงาน
            </td>
            <td className="px-3 py-1.5">
              <span>เริ่ม: <strong>{formatThaiDate(task.start_date)}</strong></span>
              <span className="mx-2 text-slate-400">|</span>
              <span>กำหนดเสร็จ: <strong>{formatThaiDate(task.due_date)}</strong></span>
              {task.completed_date && (
                <>
                  <span className="mx-2 text-slate-400">|</span>
                  <span className="text-emerald-700 font-bold">
                    เสร็จจริง: {formatThaiDate(task.completed_date)}
                  </span>
                </>
              )}
            </td>
          </tr>
          <tr>
            <td className="bg-slate-100/80 px-2.5 py-1.5 font-bold text-slate-700 border-r border-slate-200">
              โครงการที่เกี่ยวข้อง
            </td>
            <td className="px-3 py-1.5 font-medium text-slate-800">
              {project ? (
                <span>
                  <strong>{project.name}</strong>
                  {project.wbs_no && <span className="text-slate-500 ml-1.5 font-mono text-[8pt]">({project.wbs_no})</span>}
                </span>
              ) : (
                <span className="text-slate-500 italic">ไม่ได้ผูกกับโครงการหลัก (งานเฉพาะกิจ)</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Photo Gallery Section (Adaptive to 1, 2, 3, or 4+ photos) ── */}
      {photos.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[8pt] font-bold text-slate-700 uppercase tracking-wider">
              📸 ภาพถ่ายการปฏิบัติงานหน้างาน ({photos.length} รูป)
            </span>
          </div>
          <div className={`grid gap-2 ${
            photos.length === 1
              ? 'grid-cols-1 max-w-md mx-auto'
              : photos.length === 2
              ? 'grid-cols-2'
              : photos.length === 3
              ? 'grid-cols-3'
              : 'grid-cols-2 sm:grid-cols-4'
          }`}>
            {photos.slice(0, 4).map((url, idx) => (
              <div
                key={idx}
                className="border border-slate-300 rounded-lg overflow-hidden bg-slate-50 flex flex-col"
              >
                <div className={`w-full overflow-hidden bg-slate-100 ${
                  photos.length === 1
                    ? 'h-64'
                    : photos.length === 2
                    ? 'h-44'
                    : photos.length === 3
                    ? 'h-36'
                    : 'h-28'
                }`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`ภาพที่ ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="eager"
                    decoding="sync"
                  />
                </div>
                <div className="py-0.5 px-2 text-center text-[7pt] text-slate-500 bg-white border-t border-slate-200">
                  ภาพที่ {idx + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Description Box ── */}
      {task.description && (
        <div className="border border-slate-300 rounded-lg p-3 mb-3 bg-white">
          <span className="text-[8pt] font-bold text-slate-700 uppercase tracking-wider block mb-1">
            📝 รายละเอียดผลการดำเนินงาน
          </span>
          <p className="text-[8.5pt] text-slate-800 leading-relaxed whitespace-pre-wrap">
            {task.description}
          </p>
        </div>
      )}

      {/* ── Issues and Solutions Box (If applicable) ── */}
      {task.has_issue && (
        <div className="border border-amber-300 rounded-lg p-2.5 mb-3 bg-amber-50/50 text-[8.5pt]">
          <span className="font-bold text-amber-900 block mb-1 text-[8pt]">
            ⚠️ ปัญหาอุปสรรคและการแก้ไข (Issues & Solutions)
          </span>
          {task.issue_detail && (
            <div className="mb-1">
              <span className="font-bold text-slate-600 text-[8pt]">ปัญหาที่พบ: </span>
              <span className="text-amber-950">{task.issue_detail}</span>
            </div>
          )}
          {task.issue_solution && (
            <div>
              <span className="font-bold text-slate-600 text-[8pt]">แนวทางแก้ไข: </span>
              <span className="text-slate-900">{task.issue_solution}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Signatures & Endorsement Block ── */}
      <div className="mt-6 pt-3 border-t border-slate-300 grid grid-cols-2 gap-8 text-[8.5pt] break-inside-avoid">
        {/* Left: Supervisor */}
        <div className="text-center space-y-1">
          <p className="text-slate-500 text-[8pt] mb-4">ผู้รายงาน / ผู้ควบคุมงาน</p>
          <p className="font-bold text-slate-800">ลงชื่อ ............................................................</p>
          <p className="text-slate-800 font-semibold">({supervisorName})</p>
          <p className="text-slate-500 text-[7.5pt]">วันที่ ...... / ...... / ............</p>
        </div>

        {/* Right: Reviewer / Supervisor */}
        <div className="text-center space-y-1">
          <p className="text-slate-500 text-[8pt] mb-4">ผู้ตรวจสอบ / หัวหน้างาน</p>
          <p className="font-bold text-slate-800">ลงชื่อ ............................................................</p>
          <p className="text-slate-800 font-semibold">(............................................................)</p>
          <p className="text-slate-500 text-[7.5pt]">วันที่ ...... / ...... / ............</p>
        </div>
      </div>

      {/* ── Micro Footer ── */}
      <div className="mt-4 pt-2 border-t border-slate-200 text-center text-[7pt] text-slate-400">
        เอกสารนี้จัดทำขึ้นโดยอัตโนมัติจากระบบควบคุมงานก่อสร้าง (Construction Management App) — หน้า 1 / 1
      </div>
    </div>
  )
}
