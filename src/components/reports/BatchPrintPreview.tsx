'use client'

import { X } from 'lucide-react'
import type { Project, DailyReport } from '@/lib/types'

interface BatchPrintPreviewProps {
  project: Project
  selectedReports: DailyReport[]
  onClose: () => void
}

export function BatchPrintPreview({ project, selectedReports, onClose }: BatchPrintPreviewProps) {
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

  const getWeatherIcon = (code: number) => {
    if (code === 0 || code === 1) return '☀️'
    if (code === 2 || code === 3) return '🌤'
    if (code >= 51 && code <= 57) return '🌧'
    if (code >= 61 && code <= 65) return '🌧'
    if (code >= 71 && code <= 77) return '⛈'
    return '☁️'
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[100] flex flex-col overflow-y-auto print:absolute print:inset-0 print:bg-white print:z-0 print:overflow-visible">
      {/* Control bar */}
      <div className="bg-slate-800 text-white p-4 flex justify-between items-center shadow-lg print:hidden sticky top-0 z-10">
        <div>
          <h3 className="font-bold text-lg">🖨 ตัวอย่างก่อนพิมพ์ ({selectedReports.length} วัน)</h3>
          <p className="text-xs text-slate-400">โครงการ: {project.name} | กรุณาเลือกพิมพ์แบบแนวนอนหรือแนวตั้งตามความเหมาะสม</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => window.print()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 font-bold rounded-xl text-sm transition-all shadow-md shadow-purple-500/20 cursor-pointer"
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
      <div className="flex-1 p-8 flex flex-col items-center gap-8 print:p-0 print:gap-0 print:block bg-slate-100 print:bg-white">
        
        {selectedReports.map((report) => {
          const photoPages = getPhotoPages(report.photos || [])
          
          return (
            <div key={report.id} className="print-day-container w-[210mm] min-h-[297mm] bg-white p-[20mm] border border-slate-300 shadow-xl print:shadow-none print:border-none print:p-0 print:w-full print:min-h-0 print:bg-white" style={{ pageBreakAfter: 'always' }}>
              
              {/* Report Header */}
              <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">DAILY CONSTRUCTION REPORT</h1>
                  <h2 className="text-lg font-bold text-slate-700">รายงานปฏิบัติงานก่อสร้างประจำวัน</h2>
                  <p className="text-sm font-semibold text-slate-500 mt-1">โครงการ: {project.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800">วันที่รายงาน: {formatPrintDate(report.report_date)}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    สถานะ: {report.is_confirmed ? '✓ ยืนยันแล้ว' : 'ร่าง (Auto-generated)'}
                  </p>
                </div>
              </div>

              {/* Grid 1: Weather and Resources */}
              <div className="grid grid-cols-3 gap-6 mb-6">
                
                {/* Weather card */}
                <div className="border border-slate-300 rounded-2xl p-4 bg-slate-50/50 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-xs text-slate-400 uppercase font-black tracking-wider">สภาพอากาศ</span>
                    <span className="text-3xl">{getWeatherIcon(report.weather_code || 0)}</span>
                  </div>
                  <div className="mt-4">
                    <p className="text-lg font-black text-slate-900">{report.weather || 'แดดจัด'}</p>
                    <p className="text-xs text-slate-500">
                      อุณหภูมิ: {report.temperature || 25}°C | ฝน: {report.precipitation || 0} มม.
                    </p>
                  </div>
                </div>

                {/* Manpower Summary */}
                <div className="col-span-2 border border-slate-300 rounded-2xl p-4 bg-slate-50/50">
                  <span className="text-xs text-slate-400 uppercase font-black tracking-wider block mb-2">ข้อมูลกำลังพล (Manpower)</span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-semibold">
                    {(!report.manpower || report.manpower.length === 0) ? (
                      <p className="text-xs text-slate-400 italic">ไม่มีข้อมูลกำลังพล</p>
                    ) : (
                      report.manpower.map((m: any, idx: number) => (
                        <div key={idx} className="flex justify-between border-b border-slate-200 py-1">
                          <span className="text-slate-600">{m.name}</span>
                          <span className="text-slate-900 font-bold">{m.quantity} คน</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Machinery & equipment */}
              {report.machinery && report.machinery.length > 0 && (
                <div className="border border-slate-300 rounded-2xl p-4 bg-slate-50/50 mb-6">
                  <span className="text-xs text-slate-400 uppercase font-black tracking-wider block mb-2">เครื่องจักรเครื่องมือที่ใช้ (Machinery & Equipment)</span>
                  <div className="grid grid-cols-3 gap-4 text-sm font-semibold">
                    {report.machinery.map((m: any, idx: number) => (
                      <div key={idx} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl flex justify-between items-center shadow-sm">
                        <span className="text-slate-700 truncate mr-2">{m.name}</span>
                        <span className="text-primary-600 font-bold flex-shrink-0">{m.quantity} คัน/เครื่อง</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Work Done */}
              <div className="border border-slate-300 rounded-2xl p-5 mb-6">
                <span className="text-xs text-slate-400 uppercase font-black tracking-wider block mb-3">รายละเอียดความคืบหน้างานวันนี้ (Work Done)</span>
                <div className="text-sm text-slate-800 whitespace-pre-line leading-relaxed font-medium">
                  {report.work_done || 'ไม่มีข้อมูลบันทึกความคืบหน้า'}
                </div>
              </div>

              {/* Issues / roadblocks */}
              {report.issues && (
                <div className="border border-red-200 bg-red-50/30 rounded-2xl p-5 mb-6">
                  <span className="text-xs text-red-500 uppercase font-black tracking-wider block mb-2">ปัญหาและอุปสรรคในการปฏิบัติงาน (Issues & Roadblocks)</span>
                  <div className="text-sm text-red-900 font-semibold whitespace-pre-line leading-relaxed">
                    {report.issues}
                  </div>
                </div>
              )}

              {/* Photos Page 1 (Max 6) */}
              {photoPages.length > 0 && (
                <div className="mt-8 border-t border-slate-200 pt-6">
                  <span className="text-xs text-slate-400 uppercase font-black tracking-wider block mb-4">รูปภาพและภาพถ่ายหน้างาน (Photos)</span>
                  <div className="grid grid-cols-3 gap-4">
                    {photoPages[0].map((url: string, idx: number) => (
                      <div key={idx} className="aspect-video w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Site image ${idx + 1}`} className="object-cover w-full h-full" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extra Photo Pages for Overflow (> 6 images) */}
              {photoPages.slice(1).map((extraPage, pageIdx) => (
                <div key={pageIdx} className="print-day-container w-[210mm] min-h-[297mm] bg-white p-[20mm] border border-slate-300 shadow-xl print:shadow-none print:border-none print:p-0 print:w-full print:min-h-0 print:bg-white mt-8 print:mt-0" style={{ pageBreakAfter: 'always' }}>
                  <div className="border-b border-slate-200 pb-3 mb-6">
                    <p className="text-xs text-slate-400 font-bold uppercase">รูปภาพหน้างานเพิ่มเติม (หน้ารูปถ่ายที่ {pageIdx + 2})</p>
                    <p className="text-sm font-bold text-slate-700">โครงการ: {project.name} | วันที่: {formatPrintDate(report.report_date)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-6 mt-8">
                    {extraPage.map((url: string, idx: number) => (
                      <div key={idx} className="aspect-video w-full rounded-2xl overflow-hidden border border-slate-300 bg-slate-50 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Extra site image ${idx + 1}`} className="object-cover w-full h-full" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

            </div>
          )
        })}

      </div>

      <style jsx global>{`
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
            page-break-after: always !important;
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
