-- เพิ่มฟิลด์ กลุ่มงาน (work_group) ในตาราง projects
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS work_group TEXT;

-- เพิ่มค่าเริ่มต้นสำหรับกลุ่มงานในตาราง system_settings (หากยังไม่มี)
INSERT INTO public.system_settings (key, value)
VALUES ('work_groups', '["งานงบลงทุนเร่งด่วน", "งานแผนสนับสนุน"]')
ON CONFLICT (key) DO NOTHING;
