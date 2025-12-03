// js/host.js
import { supabase } from './supabaseClient.js';

/**
 * Host logic:
 * - createSession() -> insert into sessions and round_state
 * - subscribe to round_state changes for this session to keep localState
 * - hostTickLoop: when timer_running true, update remaining seconds in DB every second
 */

let session = null;        // session row { id, host_code, ... }
let roundState = null;     // round_state row
let tickInterval = null;
let subscription = null;

function generateCode(len = 6){
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

async function createSessionInDb(host_code){
  // create session
  const { data: sessionRow, error: sErr } = await supabase
    .from('sessions')
    .insert({ host_code })
    .select()
    .single();
  if (sErr) throw sErr;

  // create a matching round_state row
  const { data: rsRow, error: rsErr } = await supabase
    .from('round_state')
    .insert({
      session_id: sessionRow.id,
      start_seconds: 60,
      timer_value: 60,
      timer_running: false,
      team1_score: 0,
      team2_score: 0,
      active_team: 1,
      chunks: 5,
      saved_team1: null,
      saved_team2: null
    })
    .select()
    .single();
  if (rsErr) throw rsErr;

  return { sessionRow, rsRow };
}

async function subscribeRoundState(sessionId, onUpdate){
  // unsubscribe previous
  if (subscription) {
    try { await supabase.removeChannel(subscription); } catch(e){/* ignore */ }
    subscription = null;
  }

  // Use supabase.channel / .on postgres_changes filter
  subscription = supabase.channel(`round_state:${sessionId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'round_state', filter: `session_id=eq.${sessionId}` },
      (payload) => {
        // payload: { eventType, new, old }
        const newRow = payload.new;
        onUpdate(newRow);
      })
    .subscribe();

  return subscription;
}

function formatTime(s){
  if (s < 0) s = 0;
  const mm = Math.floor(s/60).toString().padStart(2,'0');
  const ss = (s%60).toString().padStart(2,'0');
  return `${mm}:${ss}`;
}

/* Host page initialization */
export function initHost(){
  // DOM refs
  const sessionCodeEl = document.getElementById('sessionCode');
  const createBtn = document.getElementById('createSession');
  const releaseBtn = document.getElementById('releaseHost');
  const startSecondsInput = document.getElementById('startSeconds');
  const chunksInput = document.getElementById('chunks');
  const timerDisplay = document.getElementById('timerDisplay');
  const team1El = document.getElementById('team1');
  const team2El = document.getElementById('team2');
  const team1Saved = document.getElementById('team1Saved');
  const team2Saved = document.getElementById('team2Saved');
  const toggleBtn = document.getElementById('toggleTimer');
  const incBtn = document.getElementById('incBtn');
  const decBtn = document.getElementById('decBtn');
  const switchBtn = document.getElementById('switchBtn');
  const resetTimerBtn = document.getElementById('resetTimerBtn');
  const resetAllBtn = document.getElementById('resetAll');
  const activeSelect = document.getElementById('activeTeam');

  createBtn.addEventListener('click', async () => {
    try {
      createBtn.disabled = true;
      const code = generateCode();
      const { sessionRow, rsRow } = await createSessionInDb(code);
      session = sessionRow;
      roundState = rsRow;
      sessionCodeEl.textContent = code;
      startSecondsInput.value = rsRow.start_seconds ?? 60;
      chunksInput.value = rsRow.chunks ?? 5;
      activeSelect.value = String(rsRow.active_team || 1);
      // subscribe
      await subscribeRoundState(session.id, onRoundStateUpdate);
      console.log('session created', sessionRow.id);
    } catch (err) {
      console.error('createSession error', err);
      alert('Failed to create session: ' + err.message);
    } finally {
      createBtn.disabled = false;
    }
  });

  releaseBtn.addEventListener('click', async () => {
    // remove session lock by deleting session row (or set a flag). Simpler: delete both rows to allow new host code reuse.
    if (!session) return alert('No active session to release');
    const ok = confirm('Release host and delete session? Displays will disconnect.');
    if (!ok) return;
    await supabase.from('round_state').delete().eq('session_id', session.id);
    await supabase.from('sessions').delete().eq('id', session.id);
    // cleanup local
    session = null; roundState = null;
    try { await supabase.removeChannel(subscription); } catch(e){}
    subscription = null;
    sessionCodeEl.textContent = '—';
    timerDisplay.textContent = '00:00';
    team1El.textContent = '0';
    team2El.textContent = '0';
    team1Saved.textContent = '(not saved)';
    team2Saved.textContent = '(not saved)';
  });

  // Controls
  toggleBtn.addEventListener('click', async () => {
    if (!roundState) return alert('No session; create one first.');
    await toggleTimer();
  });
  incBtn.addEventListener('click', () => changeScore(1));
  decBtn.addEventListener('click', () => changeScore(-1));
  switchBtn.addEventListener('click', () => switchTeam());
  resetTimerBtn.addEventListener('click', () => resetTimerKeepCounts());
  resetAllBtn.addEventListener('click', () => resetEverything());
  startSecondsInput.addEventListener('change', async (e) => {
    if (!roundState) return;
    const v = parseInt(e.target.value || 60);
    await supabase.from('round_state').update({ start_seconds: v, timer_value: v }).eq('id', roundState.id);
  });
  chunksInput.addEventListener('change', async (e) => {
    if (!roundState) return;
    const c = parseInt(e.target.value || 5);
    await supabase.from('round_state').update({ chunks: c }).eq('id', roundState.id);
  });
  activeSelect.addEventListener('change', async (e) => {
    if (!roundState) return;
    const a = parseInt(e.target.value);
    await supabase.from('round_state').update({ active_team: a }).eq('id', roundState.id);
  });

  // keyboard
  window.addEventListener('keydown', (ev) => {
    if (!roundState) return;
    if (ev.code === 'Space') { ev.preventDefault(); toggleTimer(); }
    if (ev.code === 'Enter') { ev.preventDefault(); changeScore(1); }
    if (ev.key === 'Delete') { ev.preventDefault(); changeScore(-1); }
    if (ev.key === 's' || ev.key === 'S') { ev.preventDefault(); switchTeam(); }
    if (ev.key === 'r' || ev.key === 'R') { ev.preventDefault(); resetTimerKeepCounts(); }
  });

  async function onRoundStateUpdate(newRow){
    roundState = newRow;
    // update UI
    timerDisplay.textContent = formatTime(newRow.timer_value ?? 0);
    team1El.textContent = String(newRow.team1_score ?? 0);
    team2El.textContent = String(newRow.team2_score ?? 0);
    team1Saved.textContent = newRow.saved_team1 !== null ? `(saved: ${newRow.saved_team1})` : '(not saved)';
    team2Saved.textContent = newRow.saved_team2 !== null ? `(saved: ${newRow.saved_team2})` : '(not saved)';
    activeSelect.value = String(newRow.active_team || 1);

    // manage tick loop (host is controlling timer)
    if (newRow.timer_running) {
      if (!tickInterval) startTickLoop();
    } else {
      stopTickLoop();
    }
  }

  // start tick loop - host will step server-side remaining seconds every second
  function startTickLoop(){
    if (tickInterval) return;
    tickInterval = setInterval(async () => {
      if (!roundState || !roundState.timer_running) return;
      // compute new remaining: decrement by 1
      const newRemaining = Math.max(0, (roundState.timer_value ?? roundState.start_seconds ?? 60) - 1);
      const runningNow = newRemaining > 0;
      const nowISO = new Date().toISOString();
      const { error } = await supabase.from('round_state').update({
        timer_value: newRemaining,
        timer_running: runningNow,
        last_tick: nowISO
      }).eq('id', roundState.id);
      if (error) console.warn('tick update error', error);
      // if it hit 0, stop interval (on next update subscription will call stop)
    }, 1000);
  }
  function stopTickLoop(){
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
  }

  async function toggleTimer(){
    if (!roundState) return;
    // if currently running -> stop (set timer_running false)
    const willRun = !roundState.timer_running;
    const nowISO = new Date().toISOString();
    // if starting and timer_value is null/0 set to start_seconds
    const rv = (willRun && (roundState.timer_value === null || roundState.timer_value === 0)) ? (roundState.start_seconds || 60) : roundState.timer_value;
    const newVals = { timer_running: willRun, timer_value: rv, last_tick: nowISO };
    const { error } = await supabase.from('round_state').update(newVals).eq('id', roundState.id);
    if (error) console.error('toggleTimer update error', error);
  }

  async function changeScore(delta){
    if (!roundState) return;
    const which = roundState.active_team === 2 ? 'team2_score' : 'team1_score';
    const next = Math.max(0, (roundState[which] ?? 0) + delta);
    const payload = {};
    payload[which] = next;
    await supabase.from('round_state').update(payload).eq('id', roundState.id);
  }

  async function switchTeam(){
    if (!roundState) return;
    const current = roundState.active_team || 1;
    const other = current === 1 ? 2 : 1;
    const updates = { active_team: other };
    // if switching from team1 -> team2, save team1 value
    if (current === 1) updates.saved_team1 = roundState.team1_score ?? 0;
    // likewise, if switching from team2 -> team1 we could save team2 (not required by spec but safe)
    if (current === 2) updates.saved_team2 = roundState.team2_score ?? 0;
    await supabase.from('round_state').update(updates).eq('id', roundState.id);
  }

  async function resetTimerKeepCounts(){
    if (!roundState) return;
    const s = parseInt(startSecondsInput.value || 60);
    await supabase.from('round_state').update({ timer_running: false, timer_value: s }).eq('id', roundState.id);
  }

  async function resetEverything(){
    if (!roundState) return;
    const s = parseInt(startSecondsInput.value || 60);
    await supabase.from('round_state').update({
      timer_running: false,
      timer_value: s,
      team1_score: 0,
      team2_score: 0,
      saved_team1: null,
      saved_team2: null,
      active_team: 1
    }).eq('id', roundState.id);
  }
}
