import Link from 'next/link'
import { Header } from '@/components/Header'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/types'
import {
  getSupervisorStorageData,
  getSupervisorsList,
} from '@/app/actions/supervisor_tasks'
import { getSupervisorAvatars } from '@/app/actions/settings'
import {
  Users,
  Award,
  Building2,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Printer,
  Sparkles,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ผลงานผู้ควบคุมงานทั้งหมด | ระบบควบคุมงานก่อสร้าง',
}

export default async function SupervisorsOverviewPage() {
  const currentUser = await getCurrentUser()
  const [allSupervisors, supervisorAvatars] = await Promise.all([
    getSupervisorsList(),
    getSupervisorAvatars(),
  ])

  const { data: projectsData } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  const projects: Project[] = (projectsData as Project[]) || []
  const storageData = await getSupervisorStorageData()
  const allTasks = storageData.tasks || []

  // Overall Team Stats
  const totalProjects = projects.length
  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter((t) => t.status === 'completed').length
  const totalIssues = allTasks.filter((t) => t.has_issue).length

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#f2f2f8] dark:bg-[#0a0a14]">
      <Header
        breadcrumb={['ระบบควบคุมงานก่อสร้าง', 'ผลงานผู้ควบคุมงาน']}
        title="แฟ้มสะสมผลงานผู้ควบคุมงาน"
        subtitle="ภาพรวมภารกิจย่อย โครงการก่อสร้างหลัก และการประเมินผลงานรายบุคคล"
        user={currentUser}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/projects"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-[#13132a] border border-slate-200 dark:border-[#252548] hover:bg-slate-100 transition-colors shadow-2xs"
            >
              ← กลับหน้าหลัก
            </Link>
          </div>
        }
      />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* ── Team Summary Banner ── */}
        <div className="card p-5 sm:p-6 bg-gradient-to-br from-white via-white to-slate-50 dark:from-[#111124] dark:to-[#16162e] border border-slate-200 dark:border-[#202042] rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#202042]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center text-white shadow-md">
                <Users size={22} />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  แดชบอร์ดภาพรวมผลงานผู้ควบคุมงาน ({allSupervisors.length} ท่าน)
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  สำหรับผู้บริหาร คณะกรรมการประเมินเงินเดือน และเจ้าหน้าที่ควบคุมงาน
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                ✨ พร้อมประเมินผลงานรอบปี
              </span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            <div className="bg-slate-50 dark:bg-[#181834] p-3 rounded-xl border border-slate-100 dark:border-[#252548]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                ผู้ควบคุมงาน
              </span>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {allSupervisors.length} ท่าน
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-[#181834] p-3 rounded-xl border border-slate-100 dark:border-[#252548]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                โครงการก่อสร้างหลัก
              </span>
              <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
                {totalProjects} โครงการ
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-[#181834] p-3 rounded-xl border border-slate-100 dark:border-[#252548]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                ภารกิจย่อยที่บันทึก
              </span>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {totalTasks} งาน
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-[#181834] p-3 rounded-xl border border-slate-100 dark:border-[#252548]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                ปัญหาอุปสรรคที่บันทึก
              </span>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {totalIssues} เรื่อง
              </p>
            </div>
          </div>
        </div>

        {/* ── Supervisor Cards Grid ── */}
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3.5 flex items-center gap-2">
            <Award size={16} className="text-primary-600 dark:text-primary-400" />
            รายชื่อผู้ควบคุมงาน (คลิกเพื่อตรวจผลงานรายบุคคล)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allSupervisors.map((sName) => {
              const supervisorProjects = projects.filter((p) => (p.supervisor || '').includes(sName))
              const supervisorTasksList = allTasks.filter((t) => t.supervisor === sName)
              const completedCount = supervisorTasksList.filter((t) => t.status === 'completed').length
              const issuesCount = supervisorTasksList.filter((t) => t.has_issue).length
              const totalBudget = supervisorProjects.reduce((sum, p) => sum + (p.budget || 0), 0)

              const isCurrentUser =
                currentUser?.display_name === sName || currentUser?.username === sName

              return (
                <div
                  key={sName}
                  className={`card p-5 border rounded-2xl bg-white dark:bg-[#121226] transition-all hover:shadow-lg flex flex-col justify-between ${
                    isCurrentUser
                      ? 'border-primary-400 dark:border-primary-600 ring-2 ring-primary-500/20'
                      : 'border-slate-200 dark:border-[#202042]'
                  }`}
                >
                  <div>
                    {/* Top Identity */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        {supervisorAvatars[sName] ? (
                          <img
                            src={supervisorAvatars[sName]}
                            alt={sName}
                            className="w-12 h-12 rounded-xl object-cover shadow-sm shrink-0 border border-slate-200 dark:border-[#252548]"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center text-white text-base font-black shadow-sm shrink-0">
                            {sName.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                            {sName}
                          </h3>
                          <span className="text-[11px] text-slate-400 font-semibold">
                            วิศวกร / ผู้ควบคุมงาน
                          </span>
                        </div>
                      </div>

                      {isCurrentUser && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-600 text-white shadow-2xs">
                          บัญชีของคุณ
                        </span>
                      )}
                    </div>

                    {/* Stats pills */}
                    <div className="grid grid-cols-2 gap-2 my-3.5 pt-3 border-t border-slate-100 dark:border-[#202042]">
                      <div className="bg-slate-50 dark:bg-[#181834] p-2.5 rounded-xl border border-slate-100 dark:border-[#252548]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          🏢 โครงการหลัก
                        </span>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                          {supervisorProjects.length} โครงการ
                        </p>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold truncate">
                          ฿{(totalBudget / 1000000).toFixed(2)}M
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-[#181834] p-2.5 rounded-xl border border-slate-100 dark:border-[#252548]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          📋 ภารกิจย่อย
                        </span>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                          {supervisorTasksList.length} งาน
                        </p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                          สำเร็จ {completedCount} งาน
                        </p>
                      </div>
                    </div>

                    {issuesCount > 0 && (
                      <div className="mb-3 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-[11px] font-medium flex items-center gap-1.5 border border-amber-200/50">
                        <AlertTriangle size={12} />
                        <span>มีบันทึกปัญหาอุปสรรค {issuesCount} เรื่อง</span>
                      </div>
                    )}
                  </div>

                  {/* Open Portfolio Button */}
                  <Link
                    href={`/supervisors/${encodeURIComponent(sName)}`}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-slate-100 hover:bg-primary-600 dark:bg-[#181834] dark:hover:bg-primary-600 text-slate-800 hover:text-white dark:text-slate-200 dark:hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs group cursor-pointer"
                  >
                    <span>เปิดตรวจผลงานและรูปถ่าย</span>
                    <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
