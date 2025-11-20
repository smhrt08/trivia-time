// Shared helpers and Supabase initialization
// Replace with your Supabase project's URL and ANON key
const SUPABASE_URL = "https://xvawqzkndkstkxjvasch.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2YXdxemtuZGtzdGt4anZhc2NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODY1MDQsImV4cCI6MjA3OTE2MjUwNH0.rRcG-aqUaQRs4G9eFCuX2V6gLGHQW7udhzbWFVGs_ck";

if (!window.supabaseClient) {
  // supabase global is provided by the UMD bundle
  window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabaseClient = window.supabase;
}

// Utility helpers
function makeId(len = 6){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for(let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

async function createSessionRow(sessionId){
  // sessions table: id (text PK), host_active (boolean), current (jsonb), questions (jsonb), teams (jsonb), chase (jsonb), created_at (timestamp)
  const initial = {
    id: sessionId,
    host_active: true,
    current: { type: 'waiting', index: -1 },
    questions: [],
    teams: {},
    chase: {}
  };
  const { data, error } = await supabase.from('sessions').insert([initial]);
  if(error) throw error;
  return data;
}

function getSessionRow(sessionId){
  return supabase.from('sessions').select('*').eq('id', sessionId).single();
}

// Realtime subscription helper using .from(...).on(...) pattern
// callback receives the updated row (payload.new)
function subscribeSession(sessionId, callback){
  // remove any subscription for same topic if exists (safe to call)
  // Create a subscription that listens for UPDATE and INSERT on the single row
  const realtimeTopic = `sessions:id=eq.${sessionId}`;
  const subscription = supabase
    .channel(realtimeTopic)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, payload => {
      if(payload && payload.new) callback(payload.new);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, payload => {
      if(payload && payload.new) callback(payload.new);
    })
    .subscribe();

  return subscription;
}

// cleanly unsubscribe a subscription returned by subscribeSession
async function unsubscribeSession(subscription){
  if(!subscription) return;
  try {
    await supabase.removeChannel(subscription);
  } catch(e){
    console.warn('Failed to remove subscription', e);
    // fallback: try unsubscribe method if present
    if(subscription.unsubscribe) {
      try { subscription.unsubscribe(); } catch(_e) {}
    }
  }
}

function getSessionParam(){
  const params = new URLSearchParams(window.location.search);
  return params.get('session') || '';
}
