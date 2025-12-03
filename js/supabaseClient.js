// js/supabaseClient.js
// Edit the two constants below with your Supabase project's values.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://xvawqzkndkstkxjvasch.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2YXdxemtuZGtzdGt4anZhc2NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODY1MDQsImV4cCI6MjA3OTE2MjUwNH0.rRcG-aqUaQRs4G9eFCuX2V6gLGHQW7udhzbWFVGs_ck';

// create and export a single client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
