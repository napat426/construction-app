'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { signToken, getCurrentUser } from '@/lib/auth'
import type { ActionState } from '@/lib/types'
import { logActivity } from '@/lib/auditLogger'

/**
 * Register a new user profile in the database
 */
export async function registerUser(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const username = (formData.get('username') as string)?.trim()
  const displayName = (formData.get('display_name') as string)?.trim()
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (!username || !displayName || !password || !confirmPassword) {
    return { error: 'กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง' }
  }

  if (username.length < 3) {
    return { error: 'Username ต้องมีอย่างน้อย 3 ตัวอักษร' }
  }

  if (password.length < 6) {
    return { error: 'Password ต้องมีอย่างน้อย 6 ตัวอักษร' }
  }

  if (password !== confirmPassword) {
    return { error: 'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน' }
  }

  // Check if username already exists
  const { data: existingUser } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (existingUser) {
    return { error: 'Username นี้ถูกใช้งานไปแล้ว กรุณาใช้ชื่ออื่น' }
  }

  // Hash password
  const password_hash = bcrypt.hashSync(password, 10)

  // Insert profile
  const { data: newProfile, error } = await supabase.from('user_profiles').insert({
    username,
    display_name: displayName,
    password_hash,
    role: 'viewer',
    status: 'pending'
  }).select('id').maybeSingle()

  if (error) {
    return { error: `ลงทะเบียนไม่สำเร็จ: ${error.message}` }
  }

  if (newProfile?.id) {
    await saveUserExtraField(newProfile.id, 'raw_password', password)
  }

  await logActivity({
    actionType: 'CREATE',
    entityType: 'user',
    entityTitle: `ลงทะเบียนผู้ใช้ใหม่: ${displayName} (@${username}) (รออนุมัติ)`,
    details: {
      username,
      display_name: displayName,
      role: 'viewer',
      status: 'pending',
    },
  })

  revalidatePath('/admin/users')
  revalidatePath('/activities')

  return { success: true }
}

/**
 * Log in a user and set a session cookie
 */
export async function loginUser(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const username = (formData.get('username') as string)?.trim()
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'กรุณากรอก Username และ Password' }
  }

  // Query user by username
  const { data: user, error: fetchError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle()

  if (fetchError || !user) {
    return { error: 'Username หรือ Password ไม่ถูกต้อง' }
  }

  // Compare passwords
  const passwordValid = bcrypt.compareSync(password, user.password_hash)
  if (!passwordValid) {
    return { error: 'Username หรือ Password ไม่ถูกต้อง' }
  }

  // Check account status
  if (user.status === 'pending') {
    return { error: 'บัญชีอยู่ระหว่างรอการอนุมัติการใช้งานจากผู้ดูแลระบบ' }
  }

  if (user.status === 'suspended') {
    return { error: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' }
  }

  // Fetch user extra avatar if available
  const extras = await getUserExtras()
  const avatar_url = extras[user.id]?.avatar_url || null

  // Generate session token
  const token = signToken({
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    status: user.status,
    avatar_url
  })

  // Set session cookie (valid for 30 days)
  const cookieStore = await cookies()
  cookieStore.set('session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/'
  })

  return { success: true }
}

/**
 * Log out user by deleting the cookie
 */
export async function logoutUser(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('session_token')
  revalidatePath('/')
}

/**
 * Helper to get user extra metadata (raw_password, avatar_url) from system_settings
 */
export async function getUserExtras(): Promise<Record<string, { raw_password?: string; avatar_url?: string }>> {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'user_extras')
      .maybeSingle()
    if (!data?.value) return {}
    return JSON.parse(data.value)
  } catch {
    return {}
  }
}

/**
 * Helper to save user extra field in system_settings
 */
export async function saveUserExtraField(userId: string, field: 'raw_password' | 'avatar_url', value: string) {
  try {
    const current = await getUserExtras()
    current[userId] = {
      ...(current[userId] || {}),
      [field]: value
    }
    const { data: existing } = await supabase
      .from('system_settings')
      .select('id')
      .eq('key', 'user_extras')
      .maybeSingle()

    if (existing) {
      await supabase
        .from('system_settings')
        .update({ value: JSON.stringify(current) })
        .eq('key', 'user_extras')
    } else {
      await supabase
        .from('system_settings')
        .insert({ key: 'user_extras', value: JSON.stringify(current) })
    }
  } catch (err) {
    console.error('Error saving user extra field:', err)
  }
}

/**
 * Admin action to reset or set user's password
 */
export async function adminResetPassword(userId: string, newPassword: string): Promise<ActionState> {
  const currentAdmin = await getCurrentUser()
  if (!currentAdmin || currentAdmin.role !== 'admin') {
    return { error: 'สิทธิ์ไม่เพียงพอ (เฉพาะผู้ดูแลระบบเท่านั้น)' }
  }

  if (!newPassword || newPassword.trim().length < 6) {
    return { error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' }
  }

  const { data: targetUser } = await supabase
    .from('user_profiles')
    .select('username, display_name')
    .eq('id', userId)
    .maybeSingle()

  if (!targetUser) {
    return { error: 'ไม่พบผู้ใช้งานนี้ในระบบ' }
  }

  const password_hash = bcrypt.hashSync(newPassword.trim(), 10)

  const { error: updateErr } = await supabase
    .from('user_profiles')
    .update({ password_hash })
    .eq('id', userId)

  if (updateErr) {
    return { error: `เปลี่ยนรหัสผ่านไม่สำเร็จ: ${updateErr.message}` }
  }

  await saveUserExtraField(userId, 'raw_password', newPassword.trim())

  await logActivity({
    actionType: 'UPDATE',
    entityType: 'user',
    entityId: userId,
    entityTitle: `ตั้ง/เปลี่ยนรหัสผ่านสำหรับ: ${targetUser.display_name} (@${targetUser.username})`,
    details: { targetUserId: userId, username: targetUser.username },
  })

  revalidatePath('/admin/users')
  return { success: true }
}

/**
 * Admin action to update user's avatar image URL
 */
export async function adminUpdateUserAvatar(userId: string, avatarUrl: string): Promise<ActionState> {
  const currentAdmin = await getCurrentUser()
  if (!currentAdmin || currentAdmin.role !== 'admin') {
    return { error: 'สิทธิ์ไม่เพียงพอ (เฉพาะผู้ดูแลระบบเท่านั้น)' }
  }

  const { data: targetUser } = await supabase
    .from('user_profiles')
    .select('username, display_name')
    .eq('id', userId)
    .maybeSingle()

  await saveUserExtraField(userId, 'avatar_url', avatarUrl)

  await logActivity({
    actionType: 'UPDATE',
    entityType: 'user',
    entityId: userId,
    entityTitle: `อัปเดตรูปภาพโปรไฟล์สำหรับ: ${targetUser?.display_name || userId}`,
    details: { targetUserId: userId, avatarUrl },
  })

  revalidatePath('/admin/users')
  revalidatePath('/')
  return { success: true }
}

/**
 * Admin action to approve, reject, promote, suspend, or delete users
 */
export async function updateUserRoleStatus(
  userId: string,
  role: 'admin' | 'editor' | 'viewer',
  status: 'approved' | 'pending' | 'suspended',
  actionType: 'approve' | 'reject' | 'update' | 'delete'
): Promise<ActionState> {
  const currentAdmin = await getCurrentUser()
  
  if (!currentAdmin || currentAdmin.role !== 'admin') {
    return { error: 'สิทธิ์ไม่เพียงพอ (เฉพาะผู้ดูแลระบบเท่านั้น)' }
  }

  if (userId === currentAdmin.id) {
    return { error: 'ไม่สามารถเปลี่ยนสถานะ บทบาท หรือลบบัญชีของตัวเองได้' }
  }

  if (actionType === 'reject' || actionType === 'delete') {
    // Fetch user details first for logging
    const { data: targetUser } = await supabase
      .from('user_profiles')
      .select('username, display_name')
      .eq('id', userId)
      .maybeSingle()

    const { error: deleteErr } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId)

    if (deleteErr) {
      return { error: `ลบบัญชีไม่สำเร็จ: ${deleteErr.message}` }
    }

    // Clean up extras
    try {
      const extras = await getUserExtras()
      if (extras[userId]) {
        delete extras[userId]
        await supabase
          .from('system_settings')
          .update({ value: JSON.stringify(extras) })
          .eq('key', 'user_extras')
      }
    } catch (e) {
      console.error('Error cleaning user extras:', e)
    }

    await logActivity({
      actionType: 'DELETE',
      entityType: 'user',
      entityId: userId,
      entityTitle: `${actionType === 'delete' ? 'ลบบัญชีผู้ใช้' : 'ปฏิเสธคำขอลงทะเบียน'}: ${targetUser?.display_name || userId} (@${targetUser?.username || ''})`,
      details: { targetUserId: userId, username: targetUser?.username },
    })

    revalidatePath('/admin/users')
    return { success: true }
  }

  // Prepare updates
  const updates: any = {
    role,
    status
  }

  if (status === 'approved') {
    updates.approved_at = new Date().toISOString()
    updates.approved_by = currentAdmin.id
  }

  const { error: updateErr } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId)

  if (updateErr) {
    return { error: `ปรับปรุงข้อมูลไม่สำเร็จ: ${updateErr.message}` }
  }

  await logActivity({
    actionType: status === 'approved' ? 'APPROVE' : 'UPDATE',
    entityType: 'user',
    entityId: userId,
    entityTitle: `${status === 'approved' ? 'อนุมัติการใช้งานผู้ใช้' : 'ปรับสถานะ/สิทธิ์ผู้ใช้'} (${role}, ${status})`,
    details: { targetUserId: userId, role, status },
  })

  revalidatePath('/admin/users')
  return { success: true }
}
