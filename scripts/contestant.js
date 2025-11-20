// Contestant logic using Supabase: join, submit team, upload photo, buzz
let sessionId = null;
let teamId = null;
let sessionRow = null;

const el = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  el('join').addEventListener('click', onJoin);
  el('submit-team').addEventListener('click', onSubmitTeam);
  el('buzzer').addEventListener('click', onBuzz);
  const param = getSessionParam();
  if(param) el('session-input').value = param;
});

async function onJoin(){
  const id = el('session-input').value.trim();
  if(!id) { alert('Enter a session id'); return; }
  sessionId = id;
  const { data, error } = await supabase.from('sessions').select('*').eq('id', id).single();
  if(error || !data){ alert('Session not found'); return; }
  sessionRow = data;
  el('join-panel').classList.remove('hidden');
}

async function onSubmitTeam(){
  const name = el('team-name').value.trim();
  if(!name){ alert('Enter team name'); return; }
  teamId = makeId(6);
  const fileInput = el('team-photo');
  let photoUrl = '';
  if(fileInput.files && fileInput.files[0]){
    const f = fileInput.files[0];
    const path = `${sessionId}/${teamId}/${Date.now()}_${f.name}`;
    // Ensure you have created a storage bucket named 'team-photos'
    const { data, error: upErr } = await supabase.storage.from('team-photos').upload(path, f);
    if(upErr){
      console.error(upErr);
      alert('Photo upload failed');
    } else {
      // get public url
      const { data: urlData } = supabase.storage.from('team-photos').getPublicUrl(path);
      photoUrl = urlData.publicUrl || '';
    }
  }
  // update teams JSON in sessions row
  const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
  if(error || !data){ alert('Session vanished'); return; }
  const teams = data.teams || {};
  teams[teamId] = { name, photoUrl, score: 0 };
  const { error: updErr } = await supabase.from('sessions').update({ teams }).eq('id', sessionId);
  if(updErr){
    console.error(updErr);
    alert('Failed to register team');
    return;
  }
  // UI: show buzzer panel immediately
  el('buzzer-panel').classList.remove('hidden');
  el('join-panel').classList.add('hidden');
  alert('Team registered!');
  // optional: keep local copy
  sessionRow = Object.assign({}, data, { teams });
}

async function onBuzz(){
  if(!sessionId || !teamId){ alert('You must register a team first'); return; }
  // Insert buzzer event into buzzers table
  const { data, error } = await supabase.from('buzzers').insert([{ session_id: sessionId, team_id: teamId }]);
  if(error){ console.error(error); alert('Failed to buzz'); return; }
  el('buzzer-status').innerText = 'Buzzed!';
}
