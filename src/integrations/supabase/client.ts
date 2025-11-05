import { createClient } from '@supabase/supabase-js';

// Use variáveis de ambiente do Vite (que devem ser configuradas na Vercel)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://keyccnimtzkybwurlxny.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtleWNjbmltdHpreWJ3dXJseG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NzA3MTcsImV4cCI6MjA3NzQ0NjcxN30.YqTq3TuhP-Nor-PNCiY98prVaVfTuFLIwU85P-f7sLU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);