'use client'

import { useState, useTransition } from 'react'
import {
  Check,
  X,
  Shield,
  Users,
  ShieldAlert,
  Loader2,
  Trash2,
  Key,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Sparkles
} from 'lucide-react'
import { updateUserRoleStatus, adminResetPassword } from '@/app/actions/user'
import type { UserSession } from '@/lib/auth'

export interface UserProfile {
  id: string
  username: string
  display_name: string
  role: 'admin' | 'editor' | 'viewer'
  status: 'pending' | 'approved' | 'suspended'
  created_at: string
  approved_at: string | null
  approved_by: string | null
  avatar_url?: string | null
  raw_password?: string | null
}

interface Props {
  initialUsers: UserProfile[]
  currentUser: UserSession
}

export function AdminUsersClient({ initialUsers, currentUser }: Props) {
  const [users, setUsers] = useState<UserProfile[]>(initialUsers)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Local roles states for pending approvals
  const [pendingRoles, setPendingRoles] = useState<Record<string, 'admin' | 'editor' | 'viewer'>>({})

  // Toggle reveal password state per user
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({})

  // Password Reset Modal State
  const [resetModal, setResetModal] = useState<{
    userId: string
    username: string
    displayName: string
    currentPassword?: string | null
  } | null>(null)
  const [newPasswordInput, setNewPasswordInput] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [resetError, setResetError] = useState('')

  // Revalidate sync
  if (JSON.stringify(initialUsers) !== JSON.stringify(users) && !isPending) {
    setUsers(initialUsers)
  }

  const showNotification = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3500)
  }

  const handleAction = (
    userId: string,
    role: 'admin' | 'editor' | 'viewer',
    status: 'approved' | 'pending' | 'suspended',
    actionType: 'approve' | 'reject' | 'update' | 'delete'
  ) => {
    setError('')

    // Safety check for self modification
    if (userId === currentUser.id && (actionType === 'delete' || status === 'suspended')) {
      setError('คุณไม่สามารถระงับสิทธิ์หรือลบบัญชีของตัวเองได้')
      return
    }

    if (actionType === 'reject' && !confirm('ปฏิเสธและลบคำขอลงทะเบียนของสมาชิกคนนี้?')) {
      return
    }

    if (actionType === 'delete') {
      const target = users.find((u) => u.id === userId)
      if (
        !confirm(
          `คุณต้องการลบบัญชีผู้ใช้ "${target?.display_name || ''}" (@${target?.username || ''}) ใช่หรือไม่?\n\n⚠️ เมื่อลบแล้ว บัญชีนี้จะไม่สามารถเข้าสู่ระบบได้อีก และข้อมูลจะไม่สามารถกู้คืนได้`
        )
      ) {
        return
      }
    }

    startTransition(async () => {
      if (actionType === 'delete' || actionType === 'reject') {
        setUsers((prev) => prev.filter((u) => u.id !== userId))
      }
      const res = await updateUserRoleStatus(userId, role, status, actionType)
      if (res?.error) {
        setError(res.error)
        // Rollback if needed
        setUsers(initialUsers)
      } else {
        if (actionType === 'delete') {
          showNotification('ลบบัญชีผู้ใช้เรียบร้อยแล้ว')
        } else if (actionType === 'approve') {
          showNotification('อนุมัติการใช้งานผู้ใช้เรียบร้อยแล้ว')
        } else {
          showNotification('อัปเดตสิทธิ์ผู้ใช้เรียบร้อยแล้ว')
        }
      }
    })
  }



  // Handle Password Reset
  const handleOpenResetModal = (user: UserProfile) => {
    setResetModal({
      userId: user.id,
      username: user.username,
      displayName: user.display_name,
      currentPassword: user.raw_password,
    })
    setNewPasswordInput(user.raw_password || '')
    setResetError('')
  }

  const handleSaveNewPassword = async () => {
    if (!resetModal) return
    if (!newPasswordInput || newPasswordInput.trim().length < 6) {
      setResetError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }

    setIsResetting(true)
    setResetError('')

    try {
      const res = await adminResetPassword(resetModal.userId, newPasswordInput.trim())
      if (res?.error) {
        setResetError(res.error)
      } else {
        // Update local state
        setUsers((prev) =>
          prev.map((u) =>
            u.id === resetModal.userId ? { ...u, raw_password: newPasswordInput.trim() } : u
          )
        )
        showNotification(`ตั้งรหัสผ่านใหม่สำหรับ @${resetModal.username} เรียบร้อยแล้ว`)
        setResetModal(null)
      }
    } catch (err: any) {
      setResetError(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน')
    } finally {
      setIsResetting(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    showNotification(`คัดลอก ${label} แล้ว!`)
  }

  const pendingUsers = users.filter((u) => u.status === 'pending')
  const activeUsers = users.filter((u) => u.status !== 'pending')

  const roleLabels = {
    admin: 'ผู้ดูแลระบบ (Admin)',
    editor: 'Editor (จัดทำ/แก้ไข)',
    viewer: 'Viewer (เข้าดูข้อมูล)',
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-600 dark:text-red-400 flex items-center justify-between animate-fade-in">
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} className="p-1 text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 animate-fade-in shadow-xs">
          <Check size={16} className="text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── 1. Pending Approvals Section ── */}
      {pendingUsers.length > 0 && (
        <div className="border-2 border-amber-500/30 dark:border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <ShieldAlert size={20} className="animate-pulse" />
            <h3 className="font-black text-sm uppercase tracking-wider">
              สมาชิกใหม่รออนุมัติการใช้งาน ({pendingUsers.length} คน)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingUsers.map((user) => {
              const selectedRole = pendingRoles[user.id] || 'editor'
              return (
                <div
                  key={user.id}
                  className="card p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#14142a] border border-slate-200 dark:border-[#252548]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">
                      {user.display_name?.charAt(0) || 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {user.display_name}
                      </p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                        @{user.username}
                      </p>
                      {user.raw_password && (
                        <p className="text-[11px] text-primary-600 dark:text-primary-400 font-mono font-bold mt-0.5">
                          🔑 {user.raw_password}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1 font-medium">
                        สมัครเมื่อ: {new Date(user.created_at).toLocaleDateString('th-TH')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <select
                      value={selectedRole}
                      onChange={(e) =>
                        setPendingRoles((prev) => ({
                          ...prev,
                          [user.id]: e.target.value as any,
                        }))
                      }
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-[#252548] text-xs font-semibold bg-slate-50 dark:bg-[#1c1c38] text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      <option value="editor">Editor (จัดทำ/แก้ไข)</option>
                      <option value="viewer">Viewer (เข้าดูข้อมูล)</option>
                      <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                    </select>

                    <button
                      onClick={() => handleAction(user.id, selectedRole, 'approved', 'approve')}
                      disabled={isPending}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Check size={14} /> อนุมัติ
                    </button>
                    <button
                      onClick={() => handleAction(user.id, 'viewer', 'pending', 'reject')}
                      disabled={isPending}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                    >
                      <X size={14} /> ปฏิเสธ
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 2. All Registered Users List ── */}
      <div className="card rounded-2xl overflow-hidden border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#14142a] shadow-xs">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#1e1e38] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-primary-500" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              รายชื่อผู้ใช้ที่ได้รับการอนุมัติในระบบ ({activeUsers.length} คน)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            แสดงรหัสผ่านสำหรับช่วยเหลือผู้ใช้งาน
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#1c1c38]/40 text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100 dark:border-[#1e1e38]">
                <th className="py-3 px-5">ผู้ใช้งาน</th>
                <th className="py-3 px-5">Username & รหัสผ่าน</th>
                <th className="py-3 px-5">บทบาท (Role)</th>
                <th className="py-3 px-5 text-center">สถานะใช้งาน</th>
                <th className="py-3 px-5 text-right">การจัดการบัญชี</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e1e38] text-slate-700 dark:text-slate-300">
              {activeUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-400 italic font-bold">
                    ยังไม่มีรายชื่อสมาชิกผู้ใช้งานในระบบ
                  </td>
                </tr>
              ) : (
                activeUsers.map((user) => {
                  const isSelf = user.id === currentUser.id
                  const isPasswordRevealed = Boolean(revealedPasswords[user.id])

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-[#1e1e38]/20 transition-colors"
                    >
                      {/* 1. Name & Avatar */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          {/* Static Initial Avatar */}
                          <div className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-2xs">
                            {user.display_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                          </div>

                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs sm:text-sm">
                              {user.display_name}
                              {isSelf && (
                                <span className="bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                                  ตัวคุณ
                                </span>
                              )}
                            </p>
                            <span className="text-[10px] text-slate-400 font-medium">
                              สมัครเมื่อ: {new Date(user.created_at).toLocaleDateString('th-TH')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Username & Password */}
                      <td className="py-3.5 px-5">
                        <div className="space-y-1">
                          {/* Username with Copy */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                              @{user.username}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(user.username, 'Username')}
                              title="คัดลอก Username"
                              className="p-1 text-slate-400 hover:text-primary-600 rounded transition-colors cursor-pointer"
                            >
                              <Copy size={12} />
                            </button>
                          </div>

                          {/* Password Display / Change */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#1c1c38] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#252548] shadow-2xs">
                              <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 select-all">
                                {isPasswordRevealed
                                  ? (user.raw_password ? user.raw_password : '⚠️ ยังไม่ระบุรหัส')
                                  : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setRevealedPasswords((prev) => ({
                                    ...prev,
                                    [user.id]: !prev[user.id],
                                  }))
                                }
                                title={isPasswordRevealed ? 'ซ่อนรหัสผ่าน' : 'คลิกเพื่อดูรหัสผ่าน'}
                                className="p-0.5 text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer transition-colors"
                              >
                                {isPasswordRevealed ? <EyeOff size={14} className="text-primary-600" /> : <Eye size={14} />}
                              </button>
                              {user.raw_password && isPasswordRevealed && (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(user.raw_password!, 'รหัสผ่าน')}
                                  title="คัดลอกรหัสผ่าน"
                                  className="p-0.5 text-slate-400 hover:text-primary-600 cursor-pointer transition-colors"
                                >
                                  <Copy size={12} />
                                </button>
                              )}
                            </div>

                            {/* Reset / Change Password Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenResetModal(user)}
                              title="ตั้งหรือเปลี่ยนรหัสผ่านสำหรับผู้ใช้นี้"
                              className="px-2.5 py-1 rounded-lg text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 dark:hover:bg-primary-900/50 border border-primary-200 dark:border-primary-800/40 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Key size={12} />
                              <span>{user.raw_password ? 'เปลี่ยนรหัส' : 'ตั้งรหัสใหม่'}</span>
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 3. Role Select */}
                      <td className="py-3.5 px-5">
                        {isSelf ? (
                          <span className="text-xs font-bold text-slate-500">
                            {roleLabels[user.role]}
                          </span>
                        ) : (
                          <select
                            value={user.role}
                            disabled={isPending}
                            onChange={(e) =>
                              handleAction(user.id, e.target.value as any, user.status, 'update')
                            }
                            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-[#252548] text-xs font-semibold bg-white dark:bg-[#14142a] text-slate-800 dark:text-slate-200 focus:outline-none"
                          >
                            <option value="editor">Editor (จัดทำ/แก้ไข)</option>
                            <option value="viewer">Viewer (เข้าดูข้อมูล)</option>
                            <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                          </select>
                        )}
                      </td>

                      {/* 4. Status Badge */}
                      <td className="py-3.5 px-5 text-center">
                        <span
                          className={`inline-flex items-center text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                            user.status === 'approved'
                              ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/20'
                              : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-300 dark:border-red-500/20'
                          }`}
                        >
                          {user.status === 'approved' ? 'อนุมัติแล้ว' : 'ระงับการใช้งาน'}
                        </span>
                      </td>

                      {/* 5. Actions (Suspend + Delete) */}
                      <td className="py-3.5 px-5 text-right">
                        {isSelf ? (
                          <span className="text-xs text-slate-400 font-bold">—</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {/* Suspend / Activate Button */}
                            <button
                              onClick={() =>
                                handleAction(
                                  user.id,
                                  user.role,
                                  user.status === 'approved' ? 'suspended' : 'approved',
                                  'update'
                                )
                              }
                              disabled={isPending}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                                user.status === 'approved'
                                  ? 'border-amber-500/30 text-amber-600 hover:bg-amber-500/10'
                                  : 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10'
                              }`}
                            >
                              {user.status === 'approved' ? 'ระงับบัญชี' : 'เปิดใช้งาน'}
                            </button>

                            {/* Delete Account Button */}
                            <button
                              onClick={() =>
                                handleAction(user.id, user.role, user.status, 'delete')
                              }
                              disabled={isPending}
                              title="ลบบัญชีผู้ใช้นี้ถาวร"
                              className="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all border border-red-500/30 text-red-600 hover:bg-red-600 hover:text-white flex items-center gap-1"
                            >
                              <Trash2 size={13} />
                              <span className="hidden sm:inline">ลบ</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3. Reset Password Modal ── */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#1e1e38]">
              <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                <Key size={18} />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  ตั้งรหัสผ่านใหม่
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResetModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#1e1e38]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-[#16162e] rounded-xl p-3 border border-slate-200/60 dark:border-[#252548] text-xs space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                ชื่อผู้ใช้: <span className="text-primary-600 dark:text-primary-400">{resetModal.displayName}</span>
              </p>
              <p className="text-slate-500 font-mono">
                Username: <strong>@{resetModal.username}</strong>
              </p>
              {resetModal.currentPassword && (
                <p className="text-slate-500 font-mono">
                  รหัสผ่านปัจจุบัน: <strong className="text-emerald-600">{resetModal.currentPassword}</strong>
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    // Generate easy 6-digit random password
                    const randomPass = Math.floor(100000 + Math.random() * 900000).toString()
                    setNewPasswordInput(randomPass)
                  }}
                  className="text-xs text-primary-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles size={11} /> สุ่มรหัสตัวเลข
                </button>
              </div>
              <input
                type="text"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="ระบุรหัสผ่านใหม่..."
                className="input-base font-mono font-bold text-sm"
              />
            </div>

            {resetError && (
              <p className="text-xs text-red-600 font-medium">⚠️ {resetError}</p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetModal(null)}
                className="flex-1 py-2 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-[#252548] text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveNewPassword}
                disabled={isResetting}
                className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-primary-600 hover:bg-primary-700 text-white shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    บันทึกรหัสผ่าน
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
