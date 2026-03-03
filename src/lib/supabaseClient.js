import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function createFallbackClient(message) {
  return {
    from() {
      return {
        select() {
          return {
            async limit() {
              return { data: null, error: { message } };
            },
          };
        },
      };
    },
  };
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createFallbackClient('Supabase env missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
