'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  ListChecks,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  CheckCircle2,
  FileText,
  AlertCircle,
} from 'lucide-react'
import type { ChecklistMaster } from '@/lib/types'
import {
  getChecklistMasters,
  addMasterChecklist,
  editMasterChecklist,
  deleteMasterChecklist,
} from '@/app/actions/checklist'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCountUpdate?: (count: number) => void
}

export function AdminChecklistMasterModal({ isOpen, onClose, onCountUpdate }: Props) {
  const [masters, setMasters] = useState<ChecklistMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isPending, startTransition] = useTransition()

  // Form states inside modal
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingMaster, setEditingMaster] = useState<ChecklistMaster | null>(null)
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    setLoading(true)
    const data = await getChecklistMasters()
    setMasters(data)
    setLoading(false)
    if (onCountUpdate) onCountUpdate(data.length)
  }

  if (!isOpen) return null

  // Categories list
  const categories = Array.from(new Set(masters.map((m) => m.category)))

  // Filter items
  const filteredMasters = masters.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCat = selectedCategory === 'all' || m.category === selectedCategory
    return matchesSearch && matchesCat
  })

  // Group by category
  const groupedMasters: Record<string, ChecklistMaster[]> = {}
  filteredMasters.forEach((m) => {
    if (!groupedMasters[m.category]) {
      groupedMasters[m.category] = []
    }
    groupedMasters[m.category].push(m)
  })

  const openAddForm = (defaultCat?: string) => {
    setEditingMaster(null)
    setCategory(defaultCat || categories[0] || 'หมวดที่ 1: โครงสร้างและภายนอกอาคาร')
    setTitle('')
    setDescription('')
    setErrorMsg('')
    setIsFormOpen(true)
  }

  const openEditForm = (item: ChecklistMaster) => {
    setEditingMaster(item)
    setCategory(item.category)
    setTitle(item.title)
    setDescription(item.description || '')
    setErrorMsg('')
    setIsFormOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !category.trim()) {
      setErrorMsg('กรุณากรอกหมวดหมู่และชื่อเรื่องรายการ')
      return
    }

    setErrorMsg('')
    startTransition(async () => {
      if (editingMaster) {
        const res = await editMasterChecklist(editingMaster.id, {
          category,
          title,
          description,
        })
        if (res.error) {
          setErrorMsg(res.error)
          return
        }
        const updated = masters.map((m) =>
          m.id === editingMaster.id ? { ...m, category, title, description } : m
        )
        setMasters(updated)
        if (onCountUpdate) onCountUpdate(updated.length)
      } else {
        const res = await addMasterChecklist({
          category,
          title,
          description,
        })
        if (res.error || !res.data) {
          setErrorMsg(res.error || 'ไม่สามารถเพิ่มข้อมูลได้')
          return
        }
        const updated = [...masters, res.data]
        setMasters(updated)
        if (onCountUpdate) onCountUpdate(updated.length)
      }
      setIsFormOpen(false)
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('คุณต้องการลบรายการตรวจรับแม่แบบนี้ออกจากระบบหรือไม่?')) return

    startTransition(async () => {
      const res = await deleteMasterChecklist(id)
      if (!res.error) {
        const updated = masters.filter((m) => m.id !== id)
        setMasters(updated)
        if (onCountUpdate) onCountUpdate(updated.length)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-white dark:bg-[#13132a] rounded-3xl shadow-2xl border border-slate-200 dark:border-[#252548] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-[#1e1e38] flex items-center justify-between bg-slate-50/80 dark:bg-[#1a1a36]">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-500/10 text-primary-600 rounded-2xl">
              <ListChecks size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                ตั้งค่า Master Checklist ตรวจรับงาน
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold">
                  {masters.length} รายการ
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ศูนย์กลางจัดการรายการตรวจรับงานก่อสร้างมาตรฐาน (ผู้ดูแลระบบแก้ไขได้คนเดียว)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openAddForm()}
              className="btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus size={16} />
              <span>เพิ่มหัวข้อตรวจรับใหม่</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-[#1e1e38] bg-white dark:bg-[#13132a] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อหัวข้อตรวจรับ หรือคำอธิบาย..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1a1a36] text-xs font-medium focus:ring-2 focus:ring-primary-500/40 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-[#1a1a36] text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({masters.length})
            </button>
            {categories.map((cat, idx) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-[#1a1a36] text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                หมวดที่ {idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Items List Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="text-center py-16 text-slate-400 font-bold text-sm">กำลังโหลดข้อมูล Master Checklist...</div>
          ) : Object.keys(groupedMasters).length === 0 ? (
            <div className="text-center py-16 text-slate-400 font-bold text-sm">ไม่พบรายการตรวจรับ</div>
          ) : (
            Object.entries(groupedMasters).map(([catTitle, items]) => (
              <div
                key={catTitle}
                className="border border-slate-200 dark:border-[#252548] rounded-2xl overflow-hidden bg-white dark:bg-[#14142a]"
              >
                <div className="bg-slate-50 dark:bg-[#1a1a36] px-4 py-3 border-b border-slate-200 dark:border-[#252548] flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    {catTitle} ({items.length} รายการ)
                  </h4>
                  <button
                    onClick={() => openAddForm(catTitle)}
                    className="text-xs text-primary-600 dark:text-primary-400 font-bold hover:underline"
                  >
                    + เพิ่มในหมวดนี้
                  </button>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-[#1e1e38]">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 flex items-start justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-[#1a1a36]/40 transition-colors"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {item.title}
                        </h5>
                        {item.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEditForm(item)}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded-lg transition-colors cursor-pointer"
                          title="แก้ไขหัวข้อ"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                          title="ลบหัวข้อ"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add/Edit Sub Modal Form */}
        {isFormOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white dark:bg-[#14142a] rounded-2xl shadow-xl border border-slate-200 dark:border-[#252548] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#1e1e38]">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  {editingMaster ? 'แก้ไขหัวข้อตรวจรับ' : 'เพิ่มหัวข้อตรวจรับใหม่'}
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
                    หมวดหมู่ *
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="เช่น หมวดที่ 1: โครงสร้างและภายนอกอาคาร"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-sm font-medium focus:ring-2 focus:ring-primary-500/40 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    ชื่อเรื่องหัวข้อตรวจรับ *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="เช่น ดินรอบอาคาร, การระบายน้ำรอบอาคาร"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-sm font-medium focus:ring-2 focus:ring-primary-500/40 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    คำอธิบายเกณฑ์การตรวจสอบ
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="รายละเอียดวิธีการและเกณฑ์การตรวจสอบ..."
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
      </div>
    </div>
  )
}
