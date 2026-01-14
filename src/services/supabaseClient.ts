
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gongoqjjpwphhttumdjm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Pero8Puw-usZK08s2HIDkQ_X3W-5QMw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
