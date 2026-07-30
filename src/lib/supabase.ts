import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 
  import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 
  'https://fkvycofytvaarkecrpje.supabase.co';

const SUPABASE_ANON_KEY = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrdnljb2Z5dHZhYXJrZWNycGplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMzQzMTIsImV4cCI6MjEwMDkxMDMxMn0.UKguwnWXZ0PoJ5aff99RdpDsrgQ4nYYQxOOXGiPLWF4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
