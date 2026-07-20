'use server'

import { supabase } from '@/lib/supabase'
import type { Employee } from '@/lib/types'
import { revalidatePath } from 'next/cache'

export async function getEmployees(): Promise<{ data: Employee[] | null, error: any }> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('employee_id', { ascending: true })

  return { data, error }
}

export async function createEmployee(
  employeeData: Omit<Employee, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; data?: Employee; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .insert([employeeData])
      .select()
      .single()

    if (error) {
      console.error('Error creating employee:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/employees')
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function updateEmployee(
  id: string,
  employeeData: Partial<Omit<Employee, 'id' | 'created_at'>>
): Promise<{ success: boolean; data?: Employee; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .update({ ...employeeData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating employee:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/employees')
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function deleteEmployee(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting employee:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/employees')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
