// Host logic using Supabase (improved reactivity and repo-game loader)
let currentSessionId = null;
let sessionRow = null;
let subscription = null;

const el = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  el('create-session').addEventListener('click', onCreateSession);
  el('add-question').addEventListener('click', onAddQuestion);
  el('prev').addEventListener('click', ()=>changeIndex(-1));
  el('next').addEventListener('click', ()=>changeIndex(1));
  el('reveal').addEventListener('click', ()=>setReveal(true));
  el('update-display').addEventListener('click', updateDisplayNow);
  el('add-team').addEventListener('click', onAddTeam);
  el('submit-scores').addEventListener('click', showScoreboard);

  // Wire up repo games UI controls
  el('refresh-repo-games').addEventListener('click', populateRepoGameSelect);
  el('load-repo-game').addEventListener('click', onLoadSelectedRepoGame);

  // If the host page loads with ?session=<id>, subscribe to that session
  const param = getSessionParam();
  if(param){
    joinExistingSessionAsHost(param);
  } else {
    // show repo-games controls so host can create session from template
    document.getElementById('repo-games').classList.remove('hidden');
    populateRepoGameSelect();
  }
});

async function populateRepoGameSelect(){
  const select = el('repo-game-select');
  select.innerHTML = '<option value="">-- loading list --</option>';
  const preview = el('repo-game-preview');
  preview.innerText = '';
  try {
    // Use GitHub Contents API to list files in /games
    const apiUrl = 'https://api.github.com/repos/smhrt08/trivia-time/contents/games';
    const resp = await fetch(apiUrl);
    if(!resp.ok){
      if(resp.status === 404){
        select.innerHTML = '<option value="">(no /games folder found)</option>';
        return;
      }
      throw new Error('GitHub API error: ' + resp.status);
    }
    const files = await resp.json();
    // files is an array of items with name, path, download_url, type
    select.innerHTML = '<option value="">-- select a game --</option>';
    files.filter(f => f.type === 'file' && f.name.toLowerCase().endsWith('.json')).forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.download_url;
      opt.dataset.name = f.name;
      opt.text = f.name;
      select.appendChild(opt);
    });
    // preview when selection changes
    select.onchange = async () => {
      const url = select.value;
      if(!url){ preview.innerText = ''; return; }
      try{
        const r = await fetch(url);
        const json = await r.json();
        const qcount = (json.questions && json.questions.length) || 0;
        preview.innerText = `${select.selectedOptions[0].dataset.name} — ${qcount} question(s)`;
      }catch(e){
        preview.innerText = 'Preview failed';
      }
    };
  } catch(err){
    console.error('Failed to list repo games', err);
    select.innerHTML = '<option value="">(failed to load list)</option>';
  }
}

async function onLoadSelectedRepoGame(){
  const select = el('repo-game-select');
  const downloadUrl = select.value;
  if(!downloadUrl) return alert('Select a game file first');
  try {
    const resp = await fetch(downloadUrl);
    if(!resp.ok) throw new Error('Failed to download game JSON');
    const gameJson = await resp.json();
    // validate
    if(!gameJson.questions || !Array.isArray(gameJson.questions)){
      return alert('Invalid game JSON: missing questions array');
    }
    // create session pre-populated with template questions
    const newSessionId = makeId(6);
    const initial = {
      id: newSessionId,
      host_active: true,
      current: { type: 'waiting', index: -1 },
      questions: gameJson.questions,
      teams: {},
      chase: {}
    };
    const { data, error } = await supabase.from('sessions').insert([initial]);
    if(error){
      console.error('Failed to create session from template', error);
      return alert('Failed to create session');
    }
    // join the newly created session as host
    await joinExistingSessionAsHost(newSessionId);
  } catch(err){
    console.error('Load template failed', err);
    alert('Failed to load template: '+(err.message||err));
  }
}

// rest of host.js functions (joinExistingSessionAsHost, renderQuestions, onCreateSession, etc...)
// If your existing host.js already has these functions, keep them as is.
// For clarity they are left unchanged below:

async function joinExistingSessionAsHost(sessionId){
  try {
    const { data, error } = await getSessionRow(sessionId);
    if(error || !data) {
      console.warn('Session not found:', error);
      return;
    }
    currentSessionId = sessionId;
    sessionRow = data;
    el('session-info').classList.remove('hidden');
    el('session-id').innerText = sessionId;
    const link = `${location.origin}${location.pathname.replace('host.html','contestant.html')}?session=${sessionId}`;
    el('join-link').href = link;
    el('join-link').innerText = link;
    document.querySelectorAll('.card').forEach(c=>c.classList.remove('hidden'));
    if(subscription) unsubscribeSession(subscription);
    subscription = subscribeSession(sessionId, (newRow) => {
      sessionRow = newRow;
      renderQuestions();
      renderTeams();
      el('current-index').innerText = (sessionRow.current && sessionRow.current.index>=0) ? sessionRow.current.index : '-';
    });
    renderQuestions();
    renderTeams();
  } catch(err){
    console.error('Failed to join session as host', err);
  }
}

async function onCreateSession(){
  const id = makeId(5);
  try{
    await createSessionRow(id);
    await joinExistingSessionAsHost(id);
  }catch(err){
    alert('Failed to create session: '+(err.message || JSON.stringify(err)));
  }
}

// (keep other helpers: renderQuestions, hostGoToQuestion, hostEditQuestion, hostDeleteQuestion, onAddQuestion, changeIndex, setReveal, updateDisplayNow, renderTeams, hostRemoveTeam, hostEditTeam, onAddTeam, showScoreboard)
// For brevity these remain as in your existing host.js file; the added code above integrates the repo loader.
