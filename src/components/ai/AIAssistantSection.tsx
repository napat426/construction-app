'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Sparkles, BarChart2, AlertTriangle, GitCompare, Calendar, FileText, Send, ChevronDown, ChevronUp, Copy, Check, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { Project, WBSTask, ProjectMaterial, DailyReport, Inspection } from '@/lib/types'

const DocumentManager = dynamic(() => import('./DocumentManager').then(mod => mod.DocumentManager), { ssr: false })

interface AIAssistantProps {
  projects: Project[]
  user: any
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: any[]
  isTyping?: boolean
}

export function AIAssistantSection({ projects, user }: AIAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: '1',
    role: 'assistant',
    content: 'สวัสดีครับ ผมคือผู้ช่วย AI (Phase 1) ประจำระบบ 👷‍♂️\nกรุณาเลือกโครงการที่ต้องการให้ผมช่วยสรุปหรือวิเคราะห์ข้อมูลจากเมนูด้านซ้ายครับ'
  }])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // RAG Source counts for selected projects
  const [ragCounts, setRagCounts] = useState({ tasks: 0, materials: 0, reports: 0, inspections: 0, globalDocs: 0, projectDocs: 0 })

  useEffect(() => {
    const saved = localStorage.getItem('ai_selected_projects')
    if (saved) {
      try {
        setSelectedIds(JSON.parse(saved))
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('ai_selected_projects', JSON.stringify(selectedIds))
    fetchRagCounts()
  }, [selectedIds])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchRagCounts = async () => {
    const { count: cGlobalDocs } = await supabase.from('project_documents').select('*', { count: 'exact', head: true }).eq('scope', 'global')
    
    if (selectedIds.length === 0) {
      setRagCounts({ tasks: 0, materials: 0, reports: 0, inspections: 0, globalDocs: cGlobalDocs || 0, projectDocs: 0 })
      return
    }
    const { count: cTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).in('project_id', selectedIds)
    const { count: cMat } = await supabase.from('project_materials').select('*', { count: 'exact', head: true }).in('project_id', selectedIds)
    const { count: cRep } = await supabase.from('daily_reports').select('*', { count: 'exact', head: true }).in('project_id', selectedIds)
    const { count: cInsp } = await supabase.from('quality_inspections').select('*', { count: 'exact', head: true }).in('project_id', selectedIds)
    const { count: cProjDocs } = await supabase.from('project_documents').select('*', { count: 'exact', head: true }).eq('scope', 'project').in('project_id', selectedIds)
    
    setRagCounts({
      tasks: cTasks || 0,
      materials: cMat || 0,
      reports: cRep || 0,
      inspections: cInsp || 0,
      globalDocs: cGlobalDocs || 0,
      projectDocs: cProjDocs || 0
    })
  }

  const toggleProject = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const sendQuery = async (text: string, actionType: string) => {
    if (selectedIds.length === 0) return
    
    const userMsgId = Date.now().toString()
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: text }])
    setInput('')
    setIsProcessing(true)

    const botMsgId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: botMsgId, role: 'assistant', content: '', isTyping: true }])

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType, projectIds: selectedIds, question: text, userId: user?.id })
      })
      const data = await res.json()
      
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: data.answer || data.error, sources: data.sources, isTyping: false } : m))
    } catch (error) {
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: 'เกิดข้อผิดพลาดในการดึงข้อมูล', isTyping: false } : m))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Formatting markdown-like text to React elements
  const formatText = (text: string) => {
    return text.split('\n').map((line, i) => {
      let l = line
      // Bold
      l = l.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      
      if (l.startsWith('📌')) return <h4 key={i} className="text-primary-600 font-bold mt-3 mb-1" dangerouslySetInnerHTML={{__html: l}}></h4>
      if (l.startsWith('⚠️')) return <h4 key={i} className="text-amber-500 font-bold mt-3 mb-1" dangerouslySetInnerHTML={{__html: l}}></h4>
      if (l.startsWith('✅')) return <h4 key={i} className="text-emerald-500 font-bold mt-3 mb-1" dangerouslySetInnerHTML={{__html: l}}></h4>
      if (l.startsWith('- ')) return <li key={i} className="ml-4 mb-1" dangerouslySetInnerHTML={{__html: l.substring(2)}}></li>
      if (l.trim() === '') return <div key={i} className="h-2"></div>
      if (l.startsWith('|')) {
        // Simple table row renderer
        const cols = l.split('|').filter(c => c.trim() !== '' && c.trim() !== '---')
        if(cols.length > 0 && !line.includes('---')) {
           return <div key={i} className="grid grid-cols-5 gap-2 border-b border-slate-200 py-1 px-2 text-sm">{cols.map((c, j) => <div key={j} dangerouslySetInnerHTML={{__html: c}}></div>)}</div>
        }
        return null
      }
      return <p key={i} dangerouslySetInnerHTML={{__html: l}} className="mb-1"></p>
    })
  }

  return (
    <div className="mt-8 bg-white dark:bg-[#14142a] border border-slate-200 dark:border-[#252548] rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#1a1a32] cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white">AI Assistant <span className="text-[10px] bg-indigo-500/20 text-indigo-600 px-2 py-0.5 rounded-full ml-2">Phase 1</span></h3>
            <p className="text-xs text-slate-500">ผู้ช่วยวิเคราะห์ข้อมูลโครงการก่อสร้างอัจฉริยะ</p>
          </div>
        </div>
        <button className="text-slate-400 hover:text-slate-600">
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {isExpanded && (
        <div className="flex flex-col md:flex-row h-[600px] max-h-[70vh]">
          {/* Left Column - 290px */}
          <div className="w-full md:w-[290px] border-r border-slate-200 dark:border-[#252548] flex flex-col bg-slate-50/50 dark:bg-[#14142a]/50 overflow-y-auto custom-scrollbar">
            {/* Project Selection */}
            <div className="p-4 border-b border-slate-200 dark:border-[#252548] flex-shrink-0">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">เลือกโครงการวิเคราะห์</span>
                <button 
                  onClick={() => setSelectedIds(selectedIds.length === projects.length ? [] : projects.map(p => p.id))}
                  className="text-[10px] text-primary-600 hover:underline font-bold"
                >
                  {selectedIds.length === projects.length ? 'ล้าง' : 'เลือกทั้งหมด'}
                </button>
              </div>
              <div className="space-y-2">
                {projects.map(p => (
                  <label key={p.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#252548] cursor-pointer transition-colors">
                    <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleProject(p.id)} className="w-4 h-4 rounded text-primary-600" />
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{p.name}</span>
                    <span className={`w-2 h-2 rounded-full ${p.status === 'กำลังดำเนินการ' ? 'bg-blue-500' : p.status === 'เสร็จสิ้น' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3 text-center font-medium">เลือกแล้ว {selectedIds.length} โครงการ</p>
            </div>

            {/* RAG Sources */}
            <div className="p-4 bg-slate-100/50 dark:bg-[#1a1a32] border-t border-slate-200 dark:border-[#252548]">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">แหล่งข้อมูลที่ AI ค้นพบ (RAG)</span>
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between"><span>เอกสารกลาง:</span> <span className="font-mono">{ragCounts.globalDocs} ลิงก์</span></div>
                <div className="flex justify-between"><span>เอกสารโครงการ:</span> <span className="font-mono">{ragCounts.projectDocs} ลิงก์</span></div>
                <div className="flex justify-between"><span>แผนงาน/WBS:</span> <span className="font-mono">{ragCounts.tasks}</span></div>
                <div className="flex justify-between"><span>วัสดุก่อสร้าง:</span> <span className="font-mono">{ragCounts.materials}</span></div>
                <div className="flex justify-between"><span>รายงานประจำวัน:</span> <span className="font-mono">{ragCounts.reports}</span></div>
                <div className="flex justify-between"><span>ตรวจสอบคุณภาพ:</span> <span className="font-mono">{ragCounts.inspections}</span></div>
              </div>
              
              <DocumentManager scope="global" />
              
              {selectedIds.length === 1 && (
                <DocumentManager scope="project" selectedProjectId={selectedIds[0]} />
              )}
            </div>
          </div>

          {/* Right Column - Chat Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Quick Actions */}
            <div className="p-3 border-b border-slate-200 dark:border-[#252548] bg-slate-50/50 dark:bg-[#1a1a36] flex gap-2 overflow-x-auto custom-scrollbar">
              <QuickBtn icon={<BarChart2 size={14}/>} label="สรุปสถานะ" onClick={() => sendQuery('ช่วยสรุปสถานะโครงการ', 'summary')} disabled={selectedIds.length === 0} />
              <QuickBtn icon={<AlertTriangle size={14}/>} label="วิเคราะห์ความเสี่ยง" onClick={() => sendQuery('วิเคราะห์ความเสี่ยง', 'risk')} disabled={selectedIds.length === 0} />
              <QuickBtn icon={<GitCompare size={14}/>} label="เปรียบเทียบโครงการ" onClick={() => sendQuery('เปรียบเทียบโครงการ', 'compare')} disabled={selectedIds.length < 2} title={selectedIds.length < 2 ? 'เลือกอย่างน้อย 2 โครงการ' : ''} />
              <QuickBtn icon={<Calendar size={14}/>} label="สิ่งที่ต้องทำสัปดาห์นี้" onClick={() => sendQuery('สิ่งที่ต้องทำสัปดาห์นี้', 'tasks')} disabled={selectedIds.length === 0} />
              <QuickBtn icon={<FileText size={14}/>} label="ร่างรายงานผู้บริหาร" onClick={() => sendQuery('ร่างรายงานผู้บริหาร', 'report')} disabled={selectedIds.length === 0} />
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-6">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-primary-600 text-white' : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'}`}>
                    {m.role === 'user' ? (user?.email?.[0].toUpperCase() || 'U') : <Sparkles size={14} />}
                  </div>
                  <div className="flex flex-col gap-1.5 w-full min-w-0">
                    <div className={`p-3.5 rounded-2xl text-sm ${m.role === 'user' ? 'bg-primary-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-[#1e1e38] text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/50 dark:border-slate-700'}`}>
                      {m.isTyping ? (
                        <div className="flex gap-1 items-center h-5">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}/>
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}/>
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}/>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{formatText(m.content)}</div>
                      )}
                    </div>
                    
                    {/* Sources Badges */}
                    {m.sources && m.sources.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {m.sources.map((src, i) => (
                          <Link key={i} href={src.link || '#'} className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#252548] border border-slate-200 dark:border-slate-600 rounded-md text-[10px] font-medium text-slate-500 hover:text-primary-600 transition-colors shadow-sm">
                            {src.text}
                            <ExternalLink size={10} />
                          </Link>
                        ))}
                      </div>
                    )}
                    
                    {/* Copy Button */}
                    {!m.isTyping && m.role === 'assistant' && m.id !== '1' && (
                      <button onClick={() => handleCopy(m.content, m.id)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 self-start mt-1">
                        {copiedId === m.id ? <Check size={12} className="text-emerald-500"/> : <Copy size={12} />}
                        {copiedId === m.id ? 'คัดลอกแล้ว' : 'คัดลอก'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-[#14142a] border-t border-slate-200 dark:border-[#252548]">
              {selectedIds.length === 0 ? (
                <div className="text-center p-3 border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-xl text-amber-600 text-sm font-semibold">
                  กรุณาเลือกอย่างน้อย 1 โครงการจากเมนูด้านซ้ายเพื่อเริ่มวิเคราะห์
                </div>
              ) : (
                <div className="relative">
                  <textarea 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(input, 'chat'); } }}
                    placeholder="พิมพ์คำถามของคุณที่นี่... (เช่น สรุปงานสัปดาห์นี้ให้หน่อย)"
                    className="w-full bg-slate-50 dark:bg-[#1a1a32] border border-slate-200 dark:border-[#252548] rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none custom-scrollbar"
                    rows={2}
                  />
                  <button 
                    onClick={() => sendQuery(input, 'chat')}
                    disabled={!input.trim() || isProcessing}
                    className="absolute right-2 bottom-2 w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center disabled:opacity-50 hover:bg-primary-700 transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function QuickBtn({ icon, label, onClick, disabled, title }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${
        disabled 
          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
          : 'bg-white dark:bg-[#252548] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-primary-500 hover:text-primary-600 shadow-sm'
      }`}
    >
      {icon} {label}
    </button>
  )
}
