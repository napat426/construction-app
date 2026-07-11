-- เพิ่มฟิลด์ คาดการณ์วันเบิกจ่าย (expected_payment_date) ในตาราง project_milestones
ALTER TABLE public.project_milestones 
ADD COLUMN IF NOT EXISTS expected_payment_date DATE;
