import { createClient } from '@supabase/supabase-js';

// As variáveis de ambiente serão injetadas pelo processo de build/runtime.
// Certifique-se de que SUPABASE_URL e SUPABASE_ANON_KEY estejam definidos no seu ambiente.
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables are not set.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);