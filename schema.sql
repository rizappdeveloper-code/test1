-- =========================================================
-- AQSA ATTENDANCE SYSTEM - SUPABASE DATABASE SCHEMA (STEP 1)
-- =========================================================

-- 1. BRANCHES TABLE
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius NUMERIC DEFAULT 100 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS public.employees (
  id TEXT PRIMARY KEY, -- e.g. "EMP001"
  name TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ATTENDANCE LOGS TABLE
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  emp_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  emp_name TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT', 'REJECTED')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  distance_m NUMERIC,
  photo_url TEXT,
  photo_source TEXT DEFAULT 'LIVE (Camera)',
  file_name TEXT,
  verification_delay NUMERIC,
  status TEXT DEFAULT 'Present',
  accuracy NUMERIC,
  created_by TEXT DEFAULT 'Mobile App',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ADMIN USERS TABLE (Admin & Super Admin Credentials)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_or_username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SUPERADMIN')),
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access for web app queries (Anon key)
DROP POLICY IF EXISTS "Allow public access to branches" ON public.branches;
CREATE POLICY "Allow public access to branches" ON public.branches FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to employees" ON public.employees;
CREATE POLICY "Allow public access to employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to attendance_logs" ON public.attendance_logs;
CREATE POLICY "Allow public access to attendance_logs" ON public.attendance_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to admin_users" ON public.admin_users;
CREATE POLICY "Allow public access to admin_users" ON public.admin_users FOR ALL USING (true) WITH CHECK (true);

-- Insert sample initial data so you can test right away
INSERT INTO public.branches (name, lat, lng, radius) VALUES
  ('Main Branch', 24.8607, 67.0011, 100),
  ('North Branch', 24.9262, 67.0982, 150)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.employees (id, name, branch_name, active) VALUES
  ('EMP001', 'John Doe', 'Main Branch', true),
  ('EMP002', 'Jane Smith', 'North Branch', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_users (email_or_username, password, role, active) VALUES
  ('admin@aqsa.com', 'admin123', 'ADMIN', true),
  ('superadmin@aqsa.com', 'master123', 'SUPERADMIN', true)
ON CONFLICT (email_or_username) DO NOTHING;
