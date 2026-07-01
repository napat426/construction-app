'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { signToken, getCurrentUser } from '@/lib/auth'
import type { ActionState } from '@/lib/types'

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
  const { error } = await supabase.from('user_profiles').insert({
    username,
    display_name: displayName,
    password_hash,
    role: 'viewer',
    status: 'pending'
  })

  if (error) {
    return { error: `ลงทะเบียนไม่สำเร็จ: ${error.message}` }
  }

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

  // Generate session token
  const token = signToken({
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    status: user.status
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
 * Admin action to approve, reject, promote, or suspend users
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
    return { error: 'ไม่สามารถเปลี่ยนสถานะหรือบทบาทของตัวเองได้' }
  }

  if (actionType === 'reject') {
    // Delete custom reject - deletes the profile from user_profiles table
    const { error: deleteErr } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId)

    if (deleteErr) {
      return { error: `ปฏิเสธบัญชีไม่สำเร็จ: ${deleteErr.message}` }
    }

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

  revalidatePath('/admin/users')
  return { success: true }
}
