/* ------------------------------------------------------------------------ */
/*  SUPABASE SETUP — 5-minute checklist                                     */
/*  ------------------------------------------------------------------------ */
/*  1. Go to https://supabase.com → New project (free tier is enough).      */
/*  2. In your project: Settings → API → copy "Project URL" and "anon       */
/*     public" key, paste them below.                                       */
/*  3. In your project: Authentication → Providers → make sure              */
/*     "Email" is enabled (it is by default).                               */
/*  4. In your project: SQL Editor → paste and run the contents of          */
/*     supabase_setup.sql (in this same folder) to create the progress      */
/*     table with Row Level Security enabled.                               */
/*  5. In your terminal: npm install @supabase/supabase-js                  */
/*                                                                            */
/*  The "anon" key below is meant to be public / used in the browser — it's */
/*  not a secret like an AI API key. Row Level Security (set up by the SQL  */
/*  script) is what actually protects each user's data.                     */
/* ------------------------------------------------------------------------ */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vjfobyrbpxvpbsytgokj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7wZI1VGLEN5YI1zG2oesFA_Hfo8cjFq';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);