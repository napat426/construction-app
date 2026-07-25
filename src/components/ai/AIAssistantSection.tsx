'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Sparkles, BarChart2, AlertTriangle, Calendar, FileText, Send, ChevronDown, ChevronUp, Copy, Check, ExternalLink, Search, Loader2 } from 'lucide-react'
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
  cachedAt?: string
  actionType?: string
  originalText?: string
}

export function AIAssistantSection({ projects, user }: AIAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash')
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

  // Semantic Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const [aiOcrEnabled, setAiOcrEnabled] = useState(false)

  useEffect(() => {
    supabase.from('system_settings').select('value').eq('key', 'ai_ocr_enabled').single().then(({ data }) => {
      if (data) {
        setAiOcrEnabled(data.value === 'true' || data.value === true)
      }
    })
  }, [])

  const handleSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const res = await fetch('/api/documents/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          projectId: selectedIds.length === 1 ? selectedIds[0] : null
        })
      })
      const data = await res.json()
      if (res.ok) {
        setSearchResults(data.matches || [])
      } else {
        alert('Error: ' + data.error)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem('ai_selected_projects')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Filter out any IDs that no longer exist in the projects list
        if (Array.isArray(parsed) && projects.length > 0) {
          const validIds = parsed.filter(id => projects.some(p => p.id === id))
          setSelectedIds(validIds)
        }
      } catch (e) {}
    }
  }, [projects])

  useEffect(() => {
    localStorage.setItem('ai_selected_projects', JSON.stringify(selectedIds))
    fetchRagCounts()
  }, [selectedIds])

  useEffect(() => {
    if (messages.length > 1) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [messages])

  const fetchRagCounts = async () => {
    try {
      const { count: cGlobalDocs } = await supabase.from('project_documents').select('*', { count: 'exact', head: true }).eq('scope', 'global')
      
      if (selectedIds.length === 0) {
        setRagCounts({ tasks: 0, materials: 0, reports: 0, inspections: 0, globalDocs: cGlobalDocs || 0, projectDocs: 0 })
        return
      }
      
      const { count: cTasks, error: e1 } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).in('project_id', selectedIds)
      const { count: cMat, error: e2 } = await supabase.from('materials').select('*', { count: 'exact', head: true }).in('project_id', selectedIds)
      const { count: cRep, error: e3 } = await supabase.from('daily_reports').select('*', { count: 'exact', head: true }).in('project_id', selectedIds)
      const { count: cInsp, error: e4 } = await supabase.from('inspections').select('*', { count: 'exact', head: true }).in('project_id', selectedIds)
      const { count: cProjDocs, error: e5 } = await supabase.from('project_documents').select('*', { count: 'exact', head: true }).eq('scope', 'project').in('project_id', selectedIds)
      
      if (e1) console.error('Error counting tasks:', e1)
      if (e2) console.error('Error counting materials:', e2)
      if (e3) console.error('Error counting reports:', e3)
      if (e4) console.error('Error counting inspections:', e4)
      if (e5) console.error('Error counting projectDocs:', e5)

      setRagCounts({
        tasks: cTasks || 0,
        materials: cMat || 0,
        reports: cRep || 0,
        inspections: cInsp || 0,
        globalDocs: cGlobalDocs || 0,
        projectDocs: cProjDocs || 0
      })
    } catch (err) {
      console.error("Error in fetchRagCounts:", err)
    }
  }

  const toggleProject = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const sendQuery = async (text: string, actionType: string, forceRefresh: boolean = false) => {
    if (selectedIds.length === 0) return
    
    if (!forceRefresh) {
      const userMsgId = Date.now().toString()
      setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: text, actionType, originalText: text }])
      setInput('')
    }
    setIsProcessing(true)

    const botMsgId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: botMsgId, role: 'assistant', content: '', isTyping: true, actionType, originalText: text }])

    try {
      // Build conversation history from existing messages for multi-turn memory
      const currentMessages = messages.filter(m => m.id !== '1' && !m.isTyping && m.content)
      const conversationHistory = currentMessages.map(m => ({
        role: m.role,
        content: m.content,
        isTyping: false
      }))

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType, projectIds: selectedIds, question: text, userId: user?.id, forceRefresh, conversationHistory, selectedModel })
      })
      const data = await res.json()
      
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: data.answer || data.error, sources: data.sources, isTyping: false, cachedAt: data.cachedAt } : m))
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
            <h3 className="font-bold text-slate-800 dark:text-white">AI Assistant <span className="text-[10px] bg-indigo-500/20 text-indigo-600 px-2 py-0.5 rounded-full ml-2">Phase 2B-2</span></h3>
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

            {/* Model Selector */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-[#252548] flex-shrink-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">โมเดล AI</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full text-xs font-semibold bg-white dark:bg-[#1a1a32] border border-slate-200 dark:border-[#252548] rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
              >
                <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash (แนะนำ)</option>
                <option value="gemini-2.0-flash">🔥 Gemini 2.0 Flash</option>
                <option value="gemini-1.5-flash">💨 Gemini 1.5 Flash (เร็ว)</option>
                <option value="gemini-1.5-pro">🧠 Gemini 1.5 Pro (ขั้นสูง)</option>
              </select>
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
              {aiOcrEnabled && (
                <>
                  <DocumentManager scope="global" onUpdate={fetchRagCounts} />
                  
                  {selectedIds.length === 1 && (
                    <DocumentManager scope="project" selectedProjectId={selectedIds[0]} onUpdate={fetchRagCounts} />
                  )}
                </>
              )}
            </div>

            {/* Semantic Search Testing */}
            {aiOcrEnabled && (
              <div className="p-4 bg-slate-50 dark:bg-[#14142a] border-t border-slate-200 dark:border-[#252548]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">ทดสอบค้นหา (Semantic Search)</span>
                <form onSubmit={handleSemanticSearch} className="flex gap-2 mb-3">
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="เช่น 'ระยะทาบเหล็ก'" 
                    className="flex-1 text-xs px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-[#1a1a32]"
                  />
                  <button type="submit" disabled={isSearching || !searchQuery} className="bg-primary-600 text-white px-2.5 py-1.5 rounded disabled:opacity-50 flex items-center justify-center">
                    {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  </button>
                </form>
                <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                  {searchResults.map((r, i) => (
                    <div key={i} className="text-[10px] p-2 bg-white dark:bg-[#1a1a32] border border-slate-200 dark:border-slate-700 rounded shadow-sm">
                      <div className="flex justify-between items-start mb-1 text-slate-500">
                        <span className="font-bold text-primary-600 truncate">{r.section_title || 'ไม่ระบุหัวข้อ'} (หน้า {r.page_number})</span>
                        <span className="text-[8px] bg-slate-100 dark:bg-slate-800 px-1 rounded">{(r.similarity * 100).toFixed(1)}%</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 line-clamp-3">{r.content}</p>
                      {r.extract_method === 'gemini_ocr' && (
                        <span className="inline-block mt-1 text-[8px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1 rounded border border-amber-200 dark:border-amber-800">
                          ⚠️ จาก OCR ({r.ocr_confidence})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Chat Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Quick Actions */}
            <div className="p-3 border-b border-slate-200 dark:border-[#252548] bg-slate-50/50 dark:bg-[#1a1a36] flex gap-2 overflow-x-auto custom-scrollbar">
              <QuickBtn icon={<BarChart2 size={14}/>} label="สรุปสถานะ" onClick={() => sendQuery('ช่วยสรุปสถานะโครงการ', 'summary')} disabled={selectedIds.length === 0} />
              <QuickBtn icon={<AlertTriangle size={14}/>} label="วิเคราะห์ความเสี่ยง" onClick={() => sendQuery('วิเคราะห์ความเสี่ยง', 'risk')} disabled={selectedIds.length === 0} />
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
                    
                    {/* Copy Button & Cache Info */}
                    {!m.isTyping && m.role === 'assistant' && m.id !== '1' && (
                      <div className="flex flex-wrap items-center justify-between mt-1 gap-2">
                        <button onClick={() => handleCopy(m.content, m.id)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600">
                          {copiedId === m.id ? <Check size={12} className="text-emerald-500"/> : <Copy size={12} />}
                          {copiedId === m.id ? 'คัดลอกแล้ว' : 'คัดลอก'}
                        </button>
                        
                        {m.cachedAt && (
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span>วิเคราะห์เมื่อ {new Date(m.cachedAt).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit', timeZone: 'Asia/Bangkok'})}</span>
                            <button 
                              onClick={() => sendQuery(m.originalText || m.actionType || 'summary', m.actionType || 'summary', true)}
                              className="flex items-center gap-1 text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded font-medium"
                            >
                              🔄 วิเคราะห์ใหม่
                            </button>
                          </div>
                        )}
                      </div>
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
