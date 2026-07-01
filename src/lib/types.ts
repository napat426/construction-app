export type ProjectStatus = 'กำลังดำเนินการ' | 'เสร็จสิ้น' | 'ระงับ' | 'รอดำเนินการ'

export interface Project {
  id: string
  name: string
  description: string | null
  location: string | null
  supervisor: string
  status: ProjectStatus
  budget: number | null
  start_date: string | null
  end_date: string | null
  progress: number
  planned_progress: number
  paid_amount: number | null
  penalty_rate: number | null
  inspection_committee: string | null
  contractor: string | null
  contract_no: string | null
  created_at: string
}

export type ActionState = {
  success?: boolean
  error?: string
} | null

export interface WBSTask {
  id: string
  project_id: string
  wbs_no: string
  name: string
  cost: number
  start_date: string
  duration: number
  predecessors: string | null
  actual_progress: number
  is_milestone: boolean
  created_at: string
}

export interface ProjectPayment {
  id: string
  project_id: string
  payment_date: string
  amount: number
  description: string | null
  created_at: string
}

export interface ProjectMilestone {
  id?: string
  project_id?: string
  milestone_no: number
  name: string
  work_scope: string | null
  amount: number
  is_paid: boolean
  payment_date: string | null
  created_at?: string
}

export type MaterialStatus = 'pending' | 'approved' | 'rejected'

export interface ProjectMaterial {
  id: string
  project_id: string
  name: string
  submission_no: string | null
  submitted_date: string | null
  approved_date: string | null
  status: MaterialStatus
  note: string | null
  created_at: string
}

export type InspectionStatus = 'submitted' | 'pending' | 'approved' | 'rejected'

export interface Inspection {
  id: string
  project_id: string
  inspection_no: string
  work_type: string
  title: string
  request_date: string | null
  inspector: string | null
  status: InspectionStatus
  note: string | null
  photo_urls: string[]
  sort_order: number
  created_at: string
}

export interface ResourceItem {
  name: string
  quantity: string | number
}

export interface ReportPhoto {
  url: string
  caption: string
}

export interface DailyReport {
  id: string
  project_id: string
  report_date: string
  weather: string | null
  temperature: string | null
  manpower: ResourceItem[]
  machinery: ResourceItem[]
  work_done: string | null
  issues: string | null
  photos: ReportPhoto[]
  sort_order: number
  created_at: string
}

export interface WeeklyReportSnapshot {
  pv: number;
  ev: number;
  ac: number;
  sv: number;
  cv: number;
  budget: number;
  paid_amount: number;
  days_remaining: number;
  task_stats: {
    total: number;
    done: number;
    delayed: number;
    future: number;
  };
  saved_at: string;
  s_curve_data?: any[];
}

export interface WeeklyReport {
  id: string;
  project_id: string;
  date_range: string;
  summary: string | null;
  delayed_tasks: string | null;
  look_ahead: string | null;
  sort_order: number;
  created_at: string;
  snapshot?: WeeklyReportSnapshot | null;
}

export interface PunchList {
  id: string
  project_id: string
  pl_number: string
  title: string
  issued_by: string
  issued_to: string
  due_date: string | null
  status: 'open' | 'closed'
  created_at: string
}

export type PunchItemCategory = 'โครงสร้าง' | 'สถาปัตย์' | 'งานระบบ' | 'ความปลอดภัย' | 'อื่นๆ'
export type PunchItemStatus = 'open' | 'in_progress' | 'done' | 'rejected'

export interface PunchPhoto {
  src: string
  caption?: string
  markup_src?: string | null
}

export interface PunchItem {
  id: string
  punch_list_id: string
  sequence: number
  location: string
  category: PunchItemCategory
  description: string
  photos: PunchPhoto[]
  assignee: string | null
  due_date: string | null
  status: PunchItemStatus
  closed_date: string | null
  remark: string | null
  contractor_response?: string | null
  response_date?: string | null
  created_at: string
}
