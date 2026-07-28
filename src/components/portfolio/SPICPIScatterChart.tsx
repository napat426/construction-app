'use client'

import React, { useMemo } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ZAxis, Cell } from 'recharts'

interface ProjectEVMData {
  name: string
  SPI: number
  CPI: number
  budget: number | null
}

interface SPICPIScatterChartProps {
  data: ProjectEVMData[]
}

export function SPICPIScatterChart({ data }: SPICPIScatterChartProps) {
  const chartData = useMemo(() => {
    return data.map(p => {
      // Safe fallback values to prevent any runtime toFixed / NaN issues
      const spiVal = typeof p.SPI === 'number' && !isNaN(p.SPI) ? p.SPI : 1.0
      const cpiVal = typeof p.CPI === 'number' && !isNaN(p.CPI) ? p.CPI : 1.0
      const budgetVal = typeof p.budget === 'number' && !isNaN(p.budget as number) ? (p.budget ?? 1000000) : 1000000

      return {
        name: p.name,
        x: parseFloat(spiVal.toFixed(2)),
        y: parseFloat(cpiVal.toFixed(2)),
        z: budgetVal,
        color: spiVal >= 1.0 && cpiVal >= 1.0 
          ? '#10b981' // Green (Healthy)
          : spiVal < 0.9 || cpiVal < 0.9 
          ? '#ef4444' // Red (Critical)
          : '#f59e0b' // Orange (Warning)
      }
    })
  }, [data])

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      return (
        <div className="bg-white dark:bg-[#121228] border border-slate-200 dark:border-[#252548] p-4 rounded-xl shadow-xl max-w-xs">
          <p className="font-bold text-sm text-slate-800 dark:text-white mb-2 leading-tight">
            {item.name}
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">ดัชนีแผนงาน (SPI):</span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{item.x}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">ดัชนีต้นทุน (CPI):</span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{item.y}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-100 dark:border-[#1e1e38] pt-1 mt-1 font-semibold">
              <span className="text-slate-500">สถานะ:</span>
              <span style={{ color: item.color }}>
                {item.x >= 1.0 && item.y >= 1.0 ? '● สุขภาพดี' : item.x < 0.9 || item.y < 0.9 ? '● วิกฤต' : '● เฝ้าระวัง'}
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white dark:bg-[#0b0b16] border border-slate-200 dark:border-[#1c1c34] rounded-2xl p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            วิเคราะห์สถานภาพโครงการ (SPI vs CPI Scatter)
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            แกน X: แผนงาน (SPI) · แกน Y: ต้นทุน (CPI) · ขนาดวงกลม: งบประมาณ
          </p>
        </div>
      </div>

      {/* Replaced 'flex-1 relative' with simple fixed height container to prevent ResponsiveContainer from collapsing to height: 0 */}
      <div className="h-80 w-full mt-2 relative">
        {chartData.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
            ไม่มีข้อมูลดัชนีชี้วัด
          </div>
        ) : (
          <>
            {/* Quadrant Legend Labels overlay */}
            <div className="absolute top-2 left-10 pointer-events-none text-[9px] font-bold text-amber-500 opacity-60">
              ล่าช้า / ประหยัดงบ (SPI &lt; 1, CPI &gt; 1)
            </div>
            <div className="absolute top-2 right-2 pointer-events-none text-[9px] font-bold text-emerald-500 opacity-60">
              เร็วกว่าแผน / ประหยัดงบ (SPI &gt; 1, CPI &gt; 1)
            </div>
            <div className="absolute bottom-10 left-10 pointer-events-none text-[9px] font-bold text-red-500 opacity-60">
              ล่าช้า / เกินงบประมาณ (SPI &lt; 1, CPI &lt; 1)
            </div>
            <div className="absolute bottom-10 right-2 pointer-events-none text-[9px] font-bold text-amber-500 opacity-60">
              เร็วกว่าแผน / เกินงบประมาณ (SPI &gt; 1, CPI &lt; 1)
            </div>

            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 10, bottom: 20, left: -20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1c34" className="hidden dark:block" />
                
                {/* 1.0 Reference boundaries */}
                <ReferenceLine x={1.0} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: 'SPI = 1.0', fill: '#94a3b8', fontSize: 9, position: 'insideBottomRight' }} />
                <ReferenceLine y={1.0} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: 'CPI = 1.0', fill: '#94a3b8', fontSize: 9, position: 'insideLeft' }} />

                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="SPI" 
                  domain={[0, 2]} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  label={{ value: 'Schedule Performance Index (SPI)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="CPI" 
                  domain={[0, 3.0]} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  label={{ value: 'Cost Performance Index (CPI)', angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                />
                <ZAxis type="number" dataKey="z" range={[100, 800]} />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Projects" data={chartData} fill="#8884d8">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  )
}
