'use client'

import { useState, useTransition, useCallback, useMemo } from 'react'
import {
  Plus, Search, FolderOpen, Pin, PinOff, Trash2, NotebookPen,
  X, ChevronRight, MoreVertical, Palette, Lock, Pencil, Type
} from 'lucide-react'
import type { ProjectNote, Project } from '@/lib/types'
import type { UserSession } from '@/lib/auth'
import { createNote, updateNote, deleteNote } from '@/app/actions/notes'
import { NoteEditor } from './NoteEditor'

const NOTE_COLORS = [
  { value: '#ffffff', label: 'ขาว', dark: '#1a1a2e' },
  { value: '#fef9c3', label: 'เหลือง', dark: '#2d2a00' },
  { value: '#dcfce7', label: 'เขียว', dark: '#0a2a14' },
  { value: '#dbeafe', label: 'ฟ้า', dark: '#0a1628' },
  { value: '#fce7f3', label: 'ชมพู', dark: '#2a0a1a' },
  { value: '#ede9fe', label: 'ม่วง', dark: '#1a0a2a' },
  { value: '#ffedd5', label: 'ส้ม', dark: '#2a1200' },
  { value: '#f1f5f9', label: 'เทา', dark: '#1e2232' },
]

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'เมื่อสักครู่'
  if (mins < 60) return `${mins} นาทีที่แล้ว`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} วันที่แล้ว`
  return new Date(dateStr).toLocaleDateString('th-TH', { dateStyle: 'medium' })
}

interface NotesClientProps {
  project: Project
  initialNotes: ProjectNote[]
  initialFolders: string[]
  user: UserSession | null
}

export function NotesClient({ project, initialNotes, initialFolders, user }: NotesClientProps) {
  const canEdit = !!user && (user.role === 'admin' || user.role === 'editor')

  const [notes, setNotes] = useState<ProjectNote[]>(initialNotes)
  const [folders, setFolders] = useState<string[]>(initialFolders.length ? initialFolders : ['ทั่วไป'])
  const [selectedFolder, setSelectedFolder] = useState<string>('ทั่วไป')
  const [searchQuery, setSearchQuery] = useState('')
  const [openNote, setOpenNote] = useState<ProjectNote | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // ── Derived state ──────────────────────────────────────────────────────────
  const filteredNotes = useMemo(() => {
    return notes
      .filter((n) => selectedFolder === '__all__' || n.folder === selectedFolder)
      .filter((n) => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return n.title.toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q)
      })
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })
  }, [notes, selectedFolder, searchQuery])

  const noteCountByFolder = useMemo(() => {
    const counts: Record<string, number> = {}
    notes.forEach((n) => {
      counts[n.folder] = (counts[n.folder] || 0) + 1
    })
    return counts
  }, [notes])

  // ── CRUD helpers ───────────────────────────────────────────────────────────
  const handleCreateNote = () => {
    if (!canEdit || !user) return
    startTransition(async () => {
      const res = await createNote(project.id, { folder: selectedFolder }, user)
      if (res.success && res.note) {
        setNotes((prev) => [res.note!, ...prev])
        setOpenNote(res.note!)
      }
    })
  }

  const handleSaveNote = useCallback(
    async (data: { title?: string; content?: string; drawing_data?: string }) => {
      if (!openNote || !user) return
      const updated: ProjectNote = {
        ...openNote,
        ...data,
        updated_at: new Date().toISOString(),
      }
      setNotes((prev) => prev.map((n) => (n.id === openNote.id ? updated : n)))
      setOpenNote(updated)
      await updateNote(openNote.id, data, user, project.id)
    },
    [openNote, user, project.id]
  )

  const handlePin = (note: ProjectNote) => {
    if (!canEdit || !user) return
    const updated = { ...note, is_pinned: !note.is_pinned }
    setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)))
    startTransition(async () => {
      await updateNote(note.id, { is_pinned: !note.is_pinned }, user, project.id)
    })
  }

  const handleColorChange = (note: ProjectNote, color: string) => {
    if (!canEdit || !user) return
    const updated = { ...note, color }
    setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)))
    setShowColorPicker(null)
    startTransition(async () => {
      await updateNote(note.id, { color }, user, project.id)
    })
  }

  const handleDelete = (note: ProjectNote) => {
    if (!canEdit || !user) return
    if (!confirm(`ลบโน้ต "${note.title}" ใช่หรือไม่?`)) return
    setNotes((prev) => prev.filter((n) => n.id !== note.id))
    if (openNote?.id === note.id) setOpenNote(null)
    startTransition(async () => {
      await deleteNote(note.id, user, project.id)
    })
  }

  const handleAddFolder = () => {
    const name = newFolderName.trim()
    if (!name || folders.includes(name)) return
    setFolders((prev) => [...prev, name])
    setSelectedFolder(name)
    setNewFolderName('')
    setShowNewFolder(false)
  }

  const hasDrawing = (note: ProjectNote) => {
    try {
      const d = note.drawing_data ? JSON.parse(note.drawing_data) : []
      return Array.isArray(d) && d.length > 0
    } catch { return false }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-5 h-[calc(100vh-220px)] min-h-[600px]">

      {/* ── Left sidebar: folders ── */}
      <aside className="w-56 flex-shrink-0 flex flex-col gap-2">
        <div className="bg-white dark:bg-[#13132a] rounded-2xl border border-slate-200 dark:border-[#1c1c34] p-4 flex-1 flex flex-col gap-1 shadow-sm">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-1">โฟลเดอร์</p>

          {/* All */}
          <button
            onClick={() => setSelectedFolder('__all__')}
            className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              selectedFolder === '__all__'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e1e38]'
            }`}
          >
            <span className="flex items-center gap-2">
              <FolderOpen size={15} />
              ทั้งหมด
            </span>
            <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${selectedFolder === '__all__' ? 'bg-white/20' : 'bg-slate-100 dark:bg-[#1e1e38] text-slate-500'}`}>
              {notes.length}
            </span>
          </button>

          {/* Folders */}
          {folders.map((folder) => (
            <button
              key={folder}
              onClick={() => setSelectedFolder(folder)}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm font-medium transition-all group ${
                selectedFolder === folder
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e1e38]'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <FolderOpen size={15} className="flex-shrink-0" />
                <span className="truncate">{folder}</span>
              </span>
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold flex-shrink-0 ${selectedFolder === folder ? 'bg-white/20' : 'bg-slate-100 dark:bg-[#1e1e38] text-slate-500'}`}>
                {noteCountByFolder[folder] || 0}
              </span>
            </button>
          ))}

          {/* Add folder */}
          {canEdit && (
            <div className="mt-auto pt-3 border-t border-slate-100 dark:border-[#1c1c34]">
              {showNewFolder ? (
                <div className="flex flex-col gap-2">
                  <input
                    autoFocus
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-primary-300 dark:border-primary-700 bg-transparent outline-none text-slate-700 dark:text-white"
                    placeholder="ชื่อโฟลเดอร์..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddFolder(); if (e.key === 'Escape') setShowNewFolder(false) }}
                  />
                  <div className="flex gap-1">
                    <button onClick={handleAddFolder} className="flex-1 px-2 py-1 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 transition-colors">สร้าง</button>
                    <button onClick={() => setShowNewFolder(false)} className="px-2 py-1 bg-slate-100 dark:bg-[#1e1e38] text-slate-500 text-xs rounded-lg hover:bg-slate-200 transition-colors"><X size={12} /></button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewFolder(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-all font-medium"
                >
                  <Plus size={14} /> โฟลเดอร์ใหม่
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#1c1c34] rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-300 dark:focus:ring-primary-700 text-slate-700 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              placeholder="ค้นหาโน้ต..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* New note button */}
          {canEdit ? (
            <button
              onClick={handleCreateNote}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-primary-500 to-violet-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:scale-105 transition-all disabled:opacity-60"
            >
              <Plus size={16} /> โน้ตใหม่
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-[#1e1e38] text-slate-400 rounded-xl text-sm">
              <Lock size={14} /> ต้องเข้าสู่ระบบ
            </div>
          )}
        </div>

        {/* Notes grid + Editor split */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Notes grid */}
          <div className={`${openNote ? 'w-80 flex-shrink-0' : 'flex-1'} overflow-y-auto pb-4`}>
            {filteredNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-100 to-violet-100 dark:from-primary-900/30 dark:to-violet-900/30 flex items-center justify-center">
                  <NotebookPen size={40} className="text-primary-400" />
                </div>
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-200 text-lg">
                    {searchQuery ? 'ไม่พบโน้ตที่ค้นหา' : 'ยังไม่มีโน้ต'}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    {canEdit ? 'กดปุ่ม "โน้ตใหม่" เพื่อเริ่มจดบันทึก' : 'ยังไม่มีโน้ตในโฟลเดอร์นี้'}
                  </p>
                </div>
              </div>
            ) : (
              <div className={`grid gap-3 ${openNote ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                {filteredNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    isOpen={openNote?.id === note.id}
                    canEdit={canEdit}
                    showColorPicker={showColorPicker === note.id}
                    hasDrawing={hasDrawing(note)}
                    onClick={() => setOpenNote(openNote?.id === note.id ? null : note)}
                    onPin={() => handlePin(note)}
                    onDelete={() => handleDelete(note)}
                    onColorPickerToggle={() => setShowColorPicker(showColorPicker === note.id ? null : note.id)}
                    onColorChange={(c) => handleColorChange(note, c)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Note Editor panel */}
          {openNote && (
            <div className="flex-1 min-w-0 bg-white dark:bg-[#13132a] rounded-2xl border border-slate-200 dark:border-[#1c1c34] shadow-lg flex flex-col overflow-hidden">
              <div
                className="h-2 flex-shrink-0 rounded-t-2xl"
                style={{ backgroundColor: openNote.color === '#ffffff' ? '#6366f1' : openNote.color }}
              />
              <div className="flex-1 p-5 flex flex-col overflow-auto">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <FolderOpen size={12} />
                    {openNote.folder}
                    <ChevronRight size={12} />
                    {openNote.created_by && <span>โดย {openNote.created_by}</span>}
                    <span>· {timeAgo(openNote.updated_at)}</span>
                  </div>
                  <button
                    onClick={() => setOpenNote(null)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1e38] text-slate-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <NoteEditor
                  key={openNote.id}
                  noteId={openNote.id}
                  title={openNote.title}
                  content={openNote.content}
                  drawingData={openNote.drawing_data}
                  color={openNote.color}
                  canEdit={canEdit}
                  onSave={handleSaveNote}
                  onClose={() => setOpenNote(null)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── NoteCard ──────────────────────────────────────────────────────────────────
interface NoteCardProps {
  note: ProjectNote
  isOpen: boolean
  canEdit: boolean
  showColorPicker: boolean
  hasDrawing: boolean
  onClick: () => void
  onPin: () => void
  onDelete: () => void
  onColorPickerToggle: () => void
  onColorChange: (color: string) => void
}

function NoteCard({
  note, isOpen, canEdit, showColorPicker, hasDrawing,
  onClick, onPin, onDelete, onColorPickerToggle, onColorChange,
}: NoteCardProps) {
  return (
    <div
      className={`relative group rounded-2xl border-2 transition-all cursor-pointer overflow-hidden hover:shadow-md hover:-translate-y-0.5 ${
        isOpen
          ? 'border-primary-500 shadow-md shadow-primary-100 dark:shadow-primary-900/30'
          : 'border-transparent hover:border-slate-200 dark:hover:border-[#252548]'
      }`}
      style={{ backgroundColor: note.color === '#ffffff' ? undefined : note.color }}
      onClick={onClick}
    >
      <div className={`p-4 ${note.color === '#ffffff' ? 'bg-white dark:bg-[#13132a]' : ''}`}>
        {/* Pin badge */}
        {note.is_pinned && (
          <div className="absolute top-2 right-2">
            <Pin size={12} className="text-primary-500 fill-primary-500/30" />
          </div>
        )}

        {/* Title */}
        <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1.5 pr-4 line-clamp-2">{note.title}</h3>

        {/* Content preview */}
        {note.content && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 mb-2">{note.content}</p>
        )}

        {/* Drawing indicator */}
        {hasDrawing && (
          <div className="flex items-center gap-1 text-xs text-primary-500 mb-2">
            <Pencil size={10} />
            <span>มีภาพวาด</span>
          </div>
        )}

        {/* Mode indicators */}
        <div className="flex items-center gap-1.5 mb-2">
          {note.content && <span className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-[#1e1e38] text-slate-500 rounded-full px-2 py-0.5"><Type size={9} /> ข้อความ</span>}
          {hasDrawing && <span className="inline-flex items-center gap-1 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full px-2 py-0.5"><Pencil size={9} /> วาด</span>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">{timeAgo(note.updated_at)}</span>

          {canEdit && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              {/* Color picker */}
              <div className="relative">
                <button
                  onClick={onColorPickerToggle}
                  className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors"
                  title="เปลี่ยนสี"
                >
                  <Palette size={13} />
                </button>
                {showColorPicker && (
                  <div className="absolute bottom-8 right-0 z-50 bg-white dark:bg-[#1e1e38] rounded-xl shadow-xl border border-slate-200 dark:border-[#252548] p-2 flex gap-1.5 flex-wrap w-32">
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => onColorChange(c.value)}
                        className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${note.color === c.value ? 'border-slate-800 dark:border-white scale-110' : 'border-slate-200 dark:border-[#252548]'}`}
                        style={{ backgroundColor: c.value === '#ffffff' ? '#f8fafc' : c.value }}
                        title={c.label}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Pin */}
              <button
                onClick={onPin}
                className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors"
                title={note.is_pinned ? 'ถอนหมุด' : 'ปักหมุด'}
              >
                {note.is_pinned ? <PinOff size={13} /> : <Pin size={13} />}
              </button>

              {/* Delete */}
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                title="ลบโน้ต"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
