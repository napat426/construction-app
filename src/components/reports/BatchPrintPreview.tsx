'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Project, DailyReport } from '@/lib/types'
import { getWeatherIcon } from '@/lib/weatherUtils'

interface BatchPrintPreviewProps {
  project: Project
  selectedReports: DailyReport[]
  onClose: () => void
}

export function BatchPrintPreview({ project, selectedReports, onClose }: BatchPrintPreviewProps) {
  const [showSupervisor, setShowSupervisor] = useState(true)
  const [supervisorName, setSupervisorName] = useState(project.supervisor || '')
  const [showSignature, setShowSignature] = useState(true)

  // Helper to chunk photo attachments in groups of 6
  const getPhotoPages = (photos: any[]) => {
    const list = Array.isArray(photos) ? photos : []
    const chunks = []
    for (let i = 0; i < list.length; i += 6) {
      chunks.push(list.slice(i, i + 6))
    }
    return chunks
  }

  const formatPrintDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[100] flex flex-col overflow-y-auto print:absolute print:inset-0 print:bg-white print:z-0 print:overflow-visible">
      {/* Control bar */}
      <div className="bg-slate-800 text-white p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-lg print:hidden sticky top-0 z-10">
        <div>
          <h3 className="font-bold text-lg">🖨 ตัวอย่างก่อนพิมพ์ ({selectedReports.length} วัน)</h3>
          <p className="text-xs text-slate-400">โครงการ: {project.name} | ปรับการจัดหน้าและลดพื้นที่ว่างเพื่อให้ข้อมูล 1 วันพอดี 1 หน้า A4</p>
        </div>
        
        {/* Toggle Options */}
        <div className="flex flex-wrap items-center gap-5 text-sm font-semibold">
          <label className="flex items-center gap-2 cursor-pointer hover:text-purple-300 transition-colors">
            <input 
              type="checkbox" 
              checked={showSupervisor} 
              onChange={e => setShowSupervisor(e.target.checked)}
              className="rounded bg-slate-700 border-slate-600 text-purple-600 focus:ring-purple-500 cursor-pointer w-4 h-4"
            />
            <span>แสดงผู้ควบคุมงาน</span>
          </label>
          
          {showSupervisor && (
            <input 
              type="text"
              value={supervisorName}
              onChange={e => setSupervisorName(e.target.value)}
              placeholder="ชื่อผู้ควบคุมงาน (เว้นว่างไว้ขีดเส้นแทน)"
              className="bg-slate-700 border border-slate-600 text-white text-xs px-3 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 w-52 placeholder-slate-400"
            />
          )}

          <label className="flex items-center gap-2 cursor-pointer hover:text-purple-300 transition-colors">
            <input 
              type="checkbox" 
              checked={showSignature} 
              onChange={e => setShowSignature(e.target.checked)}
              className="rounded bg-slate-700 border-slate-600 text-purple-600 focus:ring-purple-500 cursor-pointer w-4 h-4"
            />
            <span>แสดงช่องเซ็นชื่อ</span>
          </label>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => window.print()}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 font-bold rounded-xl text-sm transition-all shadow-md shadow-purple-500/20 cursor-pointer"
          >
            พิมพ์รายงาน
          </button>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center gap-1.5"
          >
            <X size={16} /> ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* A4 Print Layout container */}
      <div className="flex-1 p-6 flex flex-col items-center gap-6 print:p-0 print:gap-0 print:block bg-slate-100 print:bg-white">
        
        {selectedReports.map((report) => {
          const photoPages = getPhotoPages(report.photos || [])
          
          return (
            <div 
              key={report.id} 
              className="print-day-container w-[210mm] min-h-[297mm] bg-white p-[12mm] border border-slate-300 shadow-xl print:shadow-none print:border-none print:p-0 print:w-full print:min-h-0 print:bg-white flex flex-col justify-between" 
              style={{ pageBreakAfter: 'always' }}
            >
              <div>
                {/* Report Header */}
                <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-end">
                  <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">DAILY CONSTRUCTION REPORT</h1>
                    <h2 className="text-base font-bold text-slate-700">รายงานปฏิบัติงานก่อสร้างประจำวัน</h2>
                    <p className="text-xs font-semibold text-slate-500 mt-1">โครงการ: {project.name}</p>
                    {showSupervisor && (
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        ผู้ควบคุมงาน: {supervisorName ? supervisorName : '___________________________'}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-800">วันที่รายงาน: {formatPrintDate(report.report_date)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      สถานะ: {report.is_confirmed ? '✓ ยืนยันแล้ว' : 'ร่าง (Auto-generated)'}
                    </p>
                  </div>
                </div>

                {/* Grid 1: Weather + Manpower + Machinery (Side-by-side) */}
                <div className="grid grid-cols-3 gap-4 mb-4 items-stretch">
                  
                  {/* Weather card */}
                  <div className="border border-slate-300 rounded-2xl p-3 bg-slate-50/50 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">สภาพอากาศ</span>
                      <span className="text-2xl">{getWeatherIcon(report.weather_code || 0, report.weather || '')}</span>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-black text-slate-900 leading-tight">{report.weather || 'แดดจัด'}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        อุณหภูมิ: {report.temperature || 25}°C | ฝน: {report.precipitation || 0} มม.
                      </p>
                    </div>
                  </div>

                  {/* Manpower Card */}
                  <div className="border border-slate-300 rounded-2xl p-3 bg-slate-50/50 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-1">ข้อมูลกำลังพล (Manpower)</span>
                    <div className="flex-1 flex flex-col justify-center text-xs font-semibold space-y-0.5">
                      {(!report.manpower || report.manpower.length === 0) ? (
                        <p className="text-[10px] text-slate-400 italic text-center my-auto">ไม่มีข้อมูลกำลังพล</p>
                      ) : (
                        report.manpower.map((m: any, idx: number) => (
                          <div key={idx} className="flex justify-between border-b border-slate-200/60 pb-0.5">
                            <span className="text-slate-600 truncate max-w-[90px]">{m.name}</span>
                            <span className="text-slate-900 font-bold flex-shrink-0">{m.quantity} คน</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Machinery Card */}
                  <div className="border border-slate-300 rounded-2xl p-3 bg-slate-50/50 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-1">เครื่องจักร (Machinery)</span>
                    <div className="flex-1 flex flex-col justify-center text-xs font-semibold space-y-0.5">
                      {(!report.machinery || report.machinery.length === 0) ? (
                        <p className="text-[10px] text-slate-400 italic text-center my-auto">ไม่มีการใช้เครื่องจักร</p>
                      ) : (
                        report.machinery.map((m: any, idx: number) => (
                          <div key={idx} className="flex justify-between border-b border-slate-200/60 pb-0.5">
                            <span className="text-slate-600 truncate max-w-[90px]">{m.name}</span>
                            <span className="text-slate-900 font-bold flex-shrink-0">{m.quantity} เครื่อง</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

                {/* Work Done Card */}
                <div className="border border-slate-300 rounded-2xl p-4 mb-4">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-1.5">รายละเอียดความคืบหน้างานวันนี้ (Work Done)</span>
                  <div className="text-xs text-slate-800 whitespace-pre-line leading-relaxed font-semibold">
                    {report.work_done || 'ไม่มีข้อมูลบันทึกความคืบหน้า'}
                  </div>
                </div>

                {/* Issues Card (Always visible, show "-ไม่มี-" if empty) */}
                <div className="border border-slate-300 rounded-2xl p-4 mb-4 bg-red-50/5">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-1.5">ปัญหาและอุปสรรคในการปฏิบัติงาน (Issues & Roadblocks)</span>
                  <div className="text-xs text-slate-800 whitespace-pre-line leading-relaxed font-semibold">
                    {report.issues ? report.issues : '-ไม่มี-'}
                  </div>
                </div>

                {/* Photos Pages (Max 6 per page) - 3 Column Grid (Larger) */}
                {photoPages.length > 0 && photoPages.map((pagePhotos, pageIndex) => (
                  <div key={pageIndex} className={`mt-4 border-t border-slate-200 pt-4 ${pageIndex > 0 ? 'print-new-page' : ''}`}>
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-3">
                      รูปภาพและภาพถ่ายหน้างาน (Photos) {photoPages.length > 1 ? `(หน้าที่ ${pageIndex + 1}/${photoPages.length})` : ''}
                    </span>
                    <div className="grid grid-cols-3 gap-3">
                      {pagePhotos.map((photo: any, idx: number) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="aspect-[4/3] w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50 relative">
                            <img src={photo.url} alt={photo.caption || `Site image ${idx + 1}`} className="object-cover w-full h-full" />
                          </div>
                          {photo.caption && (
                            <p className="text-[9px] text-slate-500 text-center font-bold truncate px-1 mt-0.5">
                              {photo.caption}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Signature Block (Rendered at the bottom of page 1) */}
              {showSignature && (
                <div className="mt-8 flex justify-end text-center text-xs font-bold border-t border-slate-200 pt-4 mb-2">
                  <div className="w-[220px]">
                    <p className="mb-8">ผู้ควบคุมงาน</p>
                    <p className="text-slate-400">________________________</p>
                    <p className="text-[10px] text-slate-600 mt-1.5">
                      ( {supervisorName ? supervisorName : '...........................................'} )
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        })}

      </div>

      <style jsx global>{`
        @page {
          size: A4;
          margin: 8mm 12mm !important;
        }
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .print-day-container {
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            width: 100% !important;
            min-height: calc(297mm - 16mm) !important;
            height: calc(297mm - 16mm) !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
          }
          
          /* Compact print overrides */
          .print-day-container .print-new-page {
            page-break-before: always !important;
            margin-top: 16px !important;
          }
          .print-day-container .mb-4 {
            margin-bottom: 6px !important;
          }
          .print-day-container .p-3 {
            padding: 6px 10px !important;
            border-radius: 8px !important;
          }
          .print-day-container .p-4 {
            padding: 8px 12px !important;
            border-radius: 8px !important;
          }
          .print-day-container .gap-4 {
            gap: 8px !important;
          }
          .print-day-container .mt-4 {
            margin-top: 8px !important;
            padding-top: 8px !important;
          }
          .print-day-container .mt-8 {
            margin-top: 12px !important;
            padding-top: 8px !important;
          }
          .print-day-container .mb-8 {
            margin-bottom: 16px !important;
          }
          .print-day-container .pb-3 {
            padding-bottom: 4px !important;
            margin-bottom: 8px !important;
          }
          
          /* Scale down photos for printing */
          .print-day-container .grid-cols-3 .aspect-\[4\/3\] {
            height: 90px !important;
            border-radius: 8px !important;
          }
          
          /* Header compacting */
          .print-day-container h1 {
            font-size: 16px !important;
          }
          .print-day-container h2 {
            font-size: 11px !important;
          }
          .print-day-container p, 
          .print-day-container span, 
          .print-day-container div {
            font-size: 10px !important;
            line-height: 1.3 !important;
          }
          .print-day-container .text-[9px] {
            font-size: 8px !important;
          }
          .print-day-container .text-base {
            font-size: 11px !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

    </div>
  )
}
