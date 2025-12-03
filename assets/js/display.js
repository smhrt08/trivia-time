// js/display.js
import { supabase } from './supabaseClient.js';

let sub = null;
let currentSessionId = null;

function formatTime(s){
  if (s < 0) s = 0;
  const mm = Math.floor(s/60).toString().padStart(2,'0');
  const ss = (s%60).toString().padStart(2,'0');
  return `${mm}:${ss}`;
}

export function initDisplay(){
  const joinCodeInput = document.getElementById('joinCode');
  const joinBtn = document.getElementById('joinBtn');
  const status = document.getElementById('status');
  const timerLarge = document.getElementById('timerLarge');
  const chunksBar = document.getElementById('chunksBar');
  const dispTeam1 = document.getElementById('dispTeam1Val');
  const dispTeam2 = document.getElementById('dispTeam2Val');
  const dispTeam1Saved = document.getElementById('dispTeam1Saved');
  const dispTeam2Saved = document.getElementById('dispTeam2Saved');

  joinBtn.addEventListener('click', async () => {
    const code = (joinCodeInput.value || '').trim().toUpperCase();
    if (!code) return alert('Enter host code');
    try {
      status.textContent = 'Connecting...';
      // lookup session id
      const { data: sessions, error } = await supabase.from('sessions').select('*').eq('host_code', code);
      if (error) throw error;
      if (!sessions || sessions.length === 0) {
        status.textContent = 'Session not found';
        return;
      }
      const sessionRow = sessions[0];
      currentSessionId = sessionRow.id;
      status.textContent = 'Connected — subscribing';
      // fetch current round_state row
      const { data: rs, error: rsErr } = await supabase.from('round_state').select('*').eq('session_id', currentSessionId).single();
      if (rsErr) throw rsErr;
      applyState(rs);
      // subscribe
      if (sub) {
        try { await supabase.removeChannel(sub); } catch(e){}
        sub = null;
      }

      sub = supabase.channel(`display:${currentSessionId}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'round_state', filter: `session_id=eq.${currentSessionId}` },
          (payload) => { applyState(payload.new); })
        .subscribe();
      status.textContent = 'Live';
    } catch (err) {
      console.error(err);
      status.textContent = 'Error: ' + (err.message || err);
    }
  });

  function applyState(rs){
    if (!rs) return;
    timerLarge.textContent = formatTime(rs.timer_value ?? 0);
    dispTeam1.textContent = String(rs.team1_score ?? 0);
    dispTeam2.textContent = String(rs.team2_score ?? 0);
    dispTeam1Saved.textContent = rs.saved_team1 !== null ? `(saved: ${rs.saved_team1})` : '(not saved)';
    dispTeam2Saved.textContent = rs.saved_team2 !== null ? `(saved: ${rs.saved_team2})` : '(not saved)';

    // chunks
    buildChunks(rs.chunks || 5, rs.start_seconds || 60, rs.timer_value || 0);

    // highlight active team
    const t1card = document.getElementById('displayTeam1');
    const t2card = document.getElementById('displayTeam2');
    if (rs.active_team === 2) {
      t2card.style.border = '4px solid rgba(255,209,102,.18)';
      t1card.style.border = 'none';
    } else {
      t1card.style.border = '4px solid rgba(255,209,102,.18)';
      t2card.style.border = 'none';
    }
  }

  function buildChunks(chunks, startSeconds, remaining){
    chunksBar.innerHTML = '';
    // each chunk length in seconds
    const chunkSec = Math.max(1, Math.floor((startSeconds || 1) / (chunks || 1)));
    for (let i=0; i<chunks; i++){
      const seg = document.createElement('div');
      seg.className = 'chunk';
      const segStart = i*chunkSec;
      const segEnd = segStart + chunkSec;
      // compute fill percentage for this segment
      const elapsed = (startSeconds - remaining);
      const segFilled = Math.max(0, Math.min(chunkSec, elapsed - segStart)); // amount of seconds filled
      const pct = Math.round((segFilled / chunkSec) * 100);
      // visual: darker background for filled portion using linear gradient
      seg.style.background = `linear-gradient(90deg, rgba(255,255,255,0.18) ${pct}%, transparent ${pct}%)`;
      seg.textContent = `${Math.round(100/chunks)}%`;
      chunksBar.appendChild(seg);
    }
  }
}
