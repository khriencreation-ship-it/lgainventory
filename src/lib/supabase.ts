import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sccefigclrfbtxubyndc.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseKey || supabaseKey.includes('YOUR_')) {
  console.warn('Warning: Supabase credentials are missing or placeholders. Image uploads will fail.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
