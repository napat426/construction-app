'use client'

import { useState, useTransition } from 'react'
import {
  Bookmark,
  ExternalLink,
  FileText,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  Copy,
  Check,
  Link2,
  Tag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { QuickLink } from '@/lib/types'
import {
  createQuickLink,
  updateQuickLink,
  deleteQuickLink,
  updateQuickLinksOrder,
} from '@/app/actions/quick_links'

interface Props {
  projectId?: string
  userRole?: string | null
  initialData?: QuickLink[]
}

export function QuickLinksDrawer({ projectId, userRole, initialData = [] }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [links, setLinks] = useState<QuickLink[]>(initialData)
  const [isPending, startTransition] = useTransition()

  // Form states
  const [editingItem, setEditingItem] = useState<QuickLink | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'link' | 'note'>('link')
  const [url, setUrl] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('ทั่วไป')
  const [errorMsg, setErrorMsg] = useState('')

  // UI state for copied link feedback
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})

  const isAdmin = userRole === 'admin'

  const openAddForm = () => {
    setEditingItem(null)
    setTitle('')
    setType('link')
    setUrl('')
    setContent('')
    setCategory('ทั่วไป')
    setErrorMsg('')
    setIsFormOpen(true)
  }

  const openEditForm = (item: QuickLink) => {
    setEditingItem(item)
    setTitle(item.title)
    setType(item.type)
    setUrl(item.url || '')
    setContent(item.content || '')
    setCategory(item.category || 'ทั่วไป')
    setErrorMsg('')
    setIsFormOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErrorMsg('กรุณากรอกชื่อเรื่อง')
      return
    }

    setErrorMsg('')
    startTransition(async () => {
      if (editingItem) {
        const res = await updateQuickLink(editingItem.id, {
          title,
          type,
          url: type === 'link' ? url : null,
          content,
          category,
          project_id: projectId,
        })
        if (res.error) {
          setErrorMsg(res.error)
          return
        }
        setLinks((prev) =>
          prev.map((item) =>
            item.id === editingItem.id
              ? { ...item, title, type, url: type === 'link' ? url : null, content, category }
              : item
          )
        )
      } else {
        const nextOrder = links.length > 0 ? Math.max(...links.map((l) => l.sort_order || 0)) + 1 : 0
        const res = await createQuickLink({
          project_id: projectId,
          title,
          type,
          url: type === 'link' ? url : null,
          content,
          category,
          sort_order: nextOrder,
        })
        if (res.error) {
          setErrorMsg(res.error)
          return
        }
        // Optimistic refresh
        const newItem: QuickLink = {
          id: `temp-${Date.now()}`,
          project_id: projectId,
          title,
          type,
          url: type === 'link' ? url : null,
          content,
          category,
          sort_order: nextOrder,
          created_at: new Date().toISOString(),
        }
        setLinks((prev) => [...prev, newItem])
      }
      setIsFormOpen(false)
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) return

    startTransition(async () => {
      await deleteQuickLink(id, projectId)
      setLinks((prev) => prev.filter((l) => l.id !== id))
    })
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= links.length) return

    const updated = [...links]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp

    // Re-assign sort_order
    const updates = updated.map((item, idx) => ({
      ...item,
      sort_order: idx,
    }))

    setLinks(updates)

    startTransition(async () => {
      await updateQuickLinksOrder(
        updates.map((u) => ({ id: u.id, sort_order: u.sort_order })),
        projectId
      )
    })
  }

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const toggleExpandNote = (id: string) => {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <>
      {/* ── Trigger Button ── */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-xl hover:bg-slate-50 dark:hover:bg-[#1e1e38] transition-all shadow-sm cursor-pointer"
        title="คลังลิงก์ & โน้ตสำคัญ"
      >
        <Bookmark size={15} className="text-amber-500" />
        <span className="hidden md:inline">📌 คลังลิงก์ & โน้ต</span>
        {links.length > 0 && (
          <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-black">
            {links.length}
          </span>
        )}
      </button>

      {/* ── Slide-over Drawer Overlay ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative w-full max-w-md bg-white dark:bg-[#14142a] shadow-2xl h-full flex flex-col z-10 border-l border-slate-200 dark:border-[#252548]">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#1e1e38]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                  <Bookmark size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    คลังลิงก์ & โน้ตสำคัญ
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    ศูนย์รวมลิงก์ด่วนและประกาศสำคัญของโครงการ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#1e1e38] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Admin Add Toolbar */}
            {isAdmin && (
              <div className="p-3 bg-slate-50 dark:bg-[#101022] border-b border-slate-100 dark:border-[#1e1e38] flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">จัดการข้อมูล (Admin Only)</span>
                <button
                  onClick={openAddForm}
                  className="btn-primary text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus size={14} /> เพิ่มรายการใหม่
                </button>
              </div>
            )}

            {/* Drawer Body - Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {links.length === 0 ? (
                <div className="text-center py-12 px-4 text-slate-400">
                  <Bookmark size={32} className="mx-auto mb-3 opacity-30 text-amber-500" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400">ยังไม่มีรายการลิงก์หรือโน้ต</p>
                  {isAdmin && (
                    <p className="text-xs mt-1 text-slate-400">กดปุ่ม "+ เพิ่มรายการใหม่" ด้านบนเพื่อเริ่มสร้างบันทึกแรก</p>
                  )}
                </div>
              ) : (
                links.map((item, idx) => {
                  const isNoteExpanded = expandedNotes[item.id]

                  return (
                    <div
                      key={item.id}
                      className="group p-3.5 rounded-2xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] hover:border-primary-500/40 transition-all shadow-xs flex items-start gap-3"
                    >
                      {/* Left Reorder Handles (Admin Only) */}
                      {isAdmin && (
                        <div className="flex flex-col items-center gap-0.5 pt-0.5">
                          <button
                            onClick={() => handleMove(idx, 'up')}
                            disabled={idx === 0 || isPending}
                            className="p-1 text-slate-300 hover:text-primary-500 disabled:opacity-20 cursor-pointer"
                            title="เลื่อนขึ้น"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            onClick={() => handleMove(idx, 'down')}
                            disabled={idx === links.length - 1 || isPending}
                            className="p-1 text-slate-300 hover:text-primary-500 disabled:opacity-20 cursor-pointer"
                            title="เลื่อนลง"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>
                      )}

                      {/* Item Content Area */}
                      <div className="flex-1 min-w-0">
                        {/* Title & Badge */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.type === 'link'
                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50'
                                : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50'
                            }`}
                          >
                            {item.type === 'link' ? <Link2 size={10} /> : <FileText size={10} />}
                            {item.category || 'ทั่วไป'}
                          </span>

                          {item.type === 'link' && item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-bold text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1 group-hover:underline truncate"
                            >
                              <span>{item.title}</span>
                              <ExternalLink size={12} className="flex-shrink-0 text-slate-400" />
                            </a>
                          )}

                          {item.type === 'note' && (
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              {item.title}
                            </h4>
                          )}
                        </div>

                        {/* Additional Content / Note Details */}
                        {item.content && (
                          <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#14142a] p-2.5 rounded-xl border border-slate-100 dark:border-[#252548]/60 relative">
                            <p
                              className={`whitespace-pre-wrap leading-relaxed ${
                                !isNoteExpanded && item.content.length > 120 ? 'line-clamp-3' : ''
                              }`}
                            >
                              {item.content}
                            </p>

                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/40 dark:border-slate-800/40 text-[10px]">
                              {item.content.length > 120 && (
                                <button
                                  onClick={() => toggleExpandNote(item.id)}
                                  className="text-primary-600 dark:text-primary-400 font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
                                >
                                  {isNoteExpanded ? (
                                    <>
                                      ย่อลง <ChevronUp size={12} />
                                    </>
                                  ) : (
                                    <>
                                      อ่านเพิ่มเติม <ChevronDown size={12} />
                                    </>
                                  )}
                                </button>
                              )}

                              <button
                                onClick={() => handleCopyText(item.id, item.content || '')}
                                className="ml-auto text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold flex items-center gap-1 cursor-pointer"
                                title="คัดลอกข้อความ"
                              >
                                {copiedId === item.id ? (
                                  <>
                                    <Check size={12} className="text-emerald-500" />
                                    <span className="text-emerald-500">คัดลอกแล้ว</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={12} />
                                    <span>คัดลอก</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Admin Actions (Edit/Delete) */}
                      {isAdmin && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => openEditForm(item)}
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors cursor-pointer"
                            title="แก้ไข"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                            title="ลบ"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Form Modal (Create / Edit) ── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-[#14142a] rounded-2xl shadow-xl border border-slate-200 dark:border-[#252548] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#1e1e38]">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                {editingItem ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}
              </h4>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 text-xs font-bold text-red-600 rounded-xl">
                  ⚠️ {errorMsg}
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  ประเภทรายการ
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('link')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      type === 'link'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 ring-2 ring-primary-500/20'
                        : 'border-slate-200 dark:border-[#252548] text-slate-500'
                    }`}
                  >
                    <Link2 size={14} /> 🔗 ลิงก์ (Link)
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('note')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      type === 'note'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20'
                        : 'border-slate-200 dark:border-[#252548] text-slate-500'
                    }`}
                  >
                    <FileText size={14} /> 📝 บันทึก/ประกาศ
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  ชื่อเรื่อง / หัวข้อ *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={type === 'link' ? 'เช่น แบบแปลน Google Drive' : 'เช่น เบอร์โทรฉุกเฉินหน้างาน'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-sm font-medium focus:ring-2 focus:ring-primary-500/40 outline-none"
                  required
                />
              </div>

              {type === 'link' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    URL ลิงก์ปลายทาง (https://...)
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-sm font-medium focus:ring-2 focus:ring-primary-500/40 outline-none font-mono text-xs"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  หมวดหมู่ (Category)
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="เช่น แบบแปลน, ความปลอดภัย, กฎระเบียบ, ทั่วไป"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-sm font-medium focus:ring-2 focus:ring-primary-500/40 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  รายละเอียดเพิ่มเติม / รายละเอียดโน้ต
                </label>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="พิมพ์ข้อความรายละเอียดหรือโน้ตเพิ่มเติม..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-sm font-medium focus:ring-2 focus:ring-primary-500/40 outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#1e1e38]">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-primary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  {isPending ? 'กำลังบันทึก...' : 'บันทึกรายการ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
