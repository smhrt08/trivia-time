// js/supabaseClient.js
// Edit the two constants below with your Supabase project's values.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://REPLACE_WITH_YOUR_SUPABASE_URL.supabase.co';
const SUPABASE_ANON_KEY = 'REPLACE_WITH_YOUR_ANON_KEY';

// create and export a single client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
