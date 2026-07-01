'use client'

import { useState, useTransition } from 'react'
import { Check, X, Shield, Users, UserCog, UserMinus, ShieldAlert, Loader2 } from 'lucide-react'
import { updateUserRoleStatus } from '@/app/actions/user'
import type { UserSession } from '@/lib/auth'

interface UserProfile {
  id: string
  username: string
  display_name: string
  role: 'admin' | 'editor' | 'viewer'
  status: 'pending' | 'approved' | 'suspended'
  created_at: string
  approved_at: string | null
  approved_by: string | null
}

interface Props {
  initialUsers: UserProfile[]
  currentUser: UserSession
}

export function AdminUsersClient({ initialUsers, currentUser }: Props) {
  const [users, setUsers] = useState<UserProfile[]>(initialUsers)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  
  // Local roles states for pending approvals to customize roles before approving
  const [pendingRoles, setPendingRoles] = useState<Record<string, 'admin' | 'editor' | 'viewer'>>({})

  // Revalidate sync
  if (JSON.stringify(initialUsers) !== JSON.stringify(users) && !isPending) {
    setUsers(initialUsers)
  }

  const handleAction = (
    userId: string,
    role: 'admin' | 'editor' | 'viewer',
    status: 'approved' | 'pending' | 'suspended',
    actionType: 'approve' | 'reject' | 'update'
  ) => {
    setError('')
    
    // Safety check for self modification
    if (userId === currentUser.id) {
      setError('คุณไม่สามารถเปลี่ยนสถานะสิทธิ์การใช้งานของตัวเองได้')
      return
    }

    if (actionType === 'reject' && !confirm('ปฏิเสธและลบคำขอลงทะเบียนของสมาชิกคนนี้?')) {
      return
    }

    startTransition(async () => {
      const res = await updateUserRoleStatus(userId, role, status, actionType)
      if (res?.error) {
        setError(res.error)
      }
    })
  }

  const pendingUsers = users.filter((u) => u.status === 'pending')
  const activeUsers = users.filter((u) => u.status !== 'pending')

  const roleLabels = {
    admin: 'ผู้ดูแลระบบ (Admin)',
    editor: 'ผู้จัดทำ (Editor)',
    viewer: 'ผู้เข้าชม (Viewer)',
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-600 dark:text-red-400">
          ⚠️ {error}
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
              const selectedRole = pendingRoles[user.id] || 'viewer'
              return (
                <div
                  key={user.id}
                  className="card p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#14142a] border border-slate-200 dark:border-[#252548]"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {user.display_name}
                    </p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                      @{user.username}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">
                      สมัครเมื่อ: {new Date(user.created_at).toLocaleDateString('th-TH')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto">
                    {/* Role select before approval */}
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
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
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
      <div className="card rounded-2xl overflow-hidden border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#14142a]">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#1e1e38] flex items-center gap-2">
          <Users size={16} className="text-primary-500" />
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            รายชื่อผู้ใช้ที่ได้รับการอนุมัติในระบบ ({activeUsers.length} คน)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#1c1c38]/40 text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100 dark:border-[#1e1e38]">
                <th className="py-3 px-5">ชื่อผู้ใช้งาน</th>
                <th className="py-3 px-5">บทบาท (Role)</th>
                <th className="py-3 px-5 text-center">สถานะใช้งาน</th>
                <th className="py-3 px-5 text-center">อัปเดตสิทธิ์</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e1e38] text-slate-700 dark:text-slate-300">
              {activeUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-xs text-slate-400 italic font-bold">
                    ยังไม่มีรายชื่อสมาชิกผู้ใช้งานในระบบ
                  </td>
                </tr>
              ) : (
                activeUsers.map((user) => {
                  const isSelf = user.id === currentUser.id
                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/40 dark:hover:bg-[#1e1e38]/20 transition-colors"
                    >
                      <td className="py-3.5 px-5">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs sm:text-sm">
                            {user.display_name}
                            {isSelf && (
                              <span className="bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                                ตัวคุณ
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            @{user.username}
                          </p>
                        </div>
                      </td>

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
                              handleAction(
                                user.id,
                                e.target.value as any,
                                user.status,
                                'update'
                              )
                            }
                            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-[#252548] text-xs font-semibold bg-white dark:bg-[#14142a] text-slate-800 dark:text-slate-200 focus:outline-none"
                          >
                            <option value="viewer">Viewer (เข้าดูข้อมูล)</option>
                            <option value="editor">Editor (จัดทำ/แก้ไข)</option>
                            <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                          </select>
                        )}
                      </td>

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

                      <td className="py-3.5 px-5 text-center">
                        {isSelf ? (
                          <span className="text-xs text-slate-400 font-bold">—</span>
                        ) : (
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
                                ? 'border-red-500/30 text-red-500 hover:bg-red-500/5'
                                : 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/5'
                            }`}
                          >
                            {user.status === 'approved' ? 'ระงับบัญชี' : 'เปิดใช้งานบัญชี'}
                          </button>
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
    </div>
  )
}
