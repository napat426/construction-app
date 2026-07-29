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
  Search,
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
  initialData?: QuickLink[]
  userRole?: string | null
}

export function QuickLinksPageClient({ initialData = [], userRole }: Props) {
  const [links, setLinks] = useState<QuickLink[]>(initialData)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
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

  // UI state for copied link feedback & note expansion
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})

  const isAdmin = userRole === 'admin'

  // Extract unique categories for filter
  const categories = Array.from(new Set(links.map((l) => l.category || 'ทั่วไป')))

  // Filter links
  const filteredLinks = links.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.content && item.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = selectedCategory === 'all' || (item.category || 'ทั่วไป') === selectedCategory
    return matchesSearch && matchesCategory
  })

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
          title,
          type,
          url: type === 'link' ? url : null,
          content,
          category,
          sort_order: nextOrder,
        })
        if (res.error || !res.data) {
          setErrorMsg(res.error || 'ไม่สามารถบันทึกข้อมูลได้')
          return
        }
        setLinks((prev) => [...prev, res.data])
      }
      setIsFormOpen(false)
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) return

    startTransition(async () => {
      await deleteQuickLink(id)
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

    const updates = updated.map((item, idx) => ({
      ...item,
      sort_order: idx,
    }))

    setLinks(updates)

    startTransition(async () => {
      await updateQuickLinksOrder(
        updates.map((u) => ({ id: u.id, sort_order: u.sort_order }))
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Top Header Toolbar ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#13132a] p-5 rounded-2xl border border-slate-200 dark:border-[#252548] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
            <Bookmark size={24} className="fill-amber-500/20" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              คลังลิงก์ & โน้ตสำคัญ
              <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {links.length} รายการ
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ศูนย์รวมลิงก์ด่วน แบบแปลน และบันทึกข้อความสำคัญสำหรับทีมงาน
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={openAddForm}
            className="btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Plus size={16} />
            <span>เพิ่มรายการใหม่</span>
          </button>
        )}
      </div>

      {/* ── Search & Category Filter ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อเรื่อง, รายละเอียด, หรือหมวดหมู่..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#13132a] text-xs font-medium focus:ring-2 focus:ring-amber-500/40 outline-none"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white dark:bg-[#13132a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#252548] hover:bg-slate-50'
            }`}
          >
            ทั้งหมด ({links.length})
          </button>
          {categories.map((cat) => {
            const count = links.filter((l) => (l.category || 'ทั่วไป') === cat).length
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white dark:bg-[#13132a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#252548] hover:bg-slate-50'
                }`}
              >
                {cat} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Cards List Grid ── */}
      {filteredLinks.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#13132a] rounded-2xl border border-slate-200 dark:border-[#252548] p-6">
          <Bookmark size={40} className="mx-auto mb-3 text-amber-500/30" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400">ยังไม่มีรายการที่ค้นหา</p>
          {isAdmin && (
            <button
              onClick={openAddForm}
              className="mt-3 text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline"
            >
              + คลิกที่นี่เพื่อสร้างรายการใหม่
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLinks.map((item, idx) => {
            const isNoteExpanded = expandedNotes[item.id]

            return (
              <div
                key={item.id}
                className="group p-4 rounded-2xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#13132a] hover:border-amber-500/50 transition-all shadow-xs flex items-start gap-3 relative"
              >
                {/* Admin Reorder Handles */}
                {isAdmin && (
                  <div className="flex flex-col items-center gap-0.5 pt-0.5">
                    <button
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0 || isPending}
                      className="p-1 text-slate-300 hover:text-amber-500 disabled:opacity-20 cursor-pointer"
                      title="เลื่อนขึ้น"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === filteredLinks.length - 1 || isPending}
                      className="p-1 text-slate-300 hover:text-amber-500 disabled:opacity-20 cursor-pointer"
                      title="เลื่อนลง"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                )}

                {/* Content Details */}
                <div className="flex-1 min-w-0">
                  {/* Category & Badge Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        item.type === 'link'
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50'
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50'
                      }`}
                    >
                      {item.type === 'link' ? <Link2 size={10} /> : <FileText size={10} />}
                      {item.category || 'ทั่วไป'}
                    </span>

                    {/* Admin Action Edit/Delete */}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditForm(item)}
                          className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors cursor-pointer"
                          title="แก้ไข"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                          title="ลบ"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  {item.type === 'link' && item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-slate-900 dark:text-white hover:text-amber-500 dark:hover:text-amber-400 flex items-center gap-1.5 group-hover:underline"
                    >
                      <span className="truncate">{item.title}</span>
                      <ExternalLink size={14} className="flex-shrink-0 text-amber-500" />
                    </a>
                  ) : (
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                  )}

                  {/* Content Box */}
                  {item.content && (
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#1a1a34] p-3 rounded-xl border border-slate-100 dark:border-[#252548]/60">
                      <p
                        className={`whitespace-pre-wrap leading-relaxed ${
                          !isNoteExpanded && item.content.length > 150 ? 'line-clamp-3' : ''
                        }`}
                      >
                        {item.content}
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/40 dark:border-slate-800/40 text-[10px]">
                        {item.content.length > 150 && (
                          <button
                            onClick={() => toggleExpandNote(item.id)}
                            className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
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
                              <span className="text-emerald-500 font-bold">คัดลอกสำเร็จ</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>คัดลอกข้อความ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Form Modal (Create / Edit) ── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-[#14142a] rounded-2xl shadow-xl border border-slate-200 dark:border-[#252548] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#1e1e38]">
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Bookmark size={16} className="text-amber-500 fill-amber-500/20" />
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
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-sm font-medium focus:ring-2 focus:ring-amber-500/40 outline-none"
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-sm font-medium focus:ring-2 focus:ring-amber-500/40 outline-none font-mono text-xs"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-sm font-medium focus:ring-2 focus:ring-amber-500/40 outline-none"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-sm font-medium focus:ring-2 focus:ring-amber-500/40 outline-none resize-none"
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
    </div>
  )
}
