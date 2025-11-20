// Host logic using Supabase (improved reactivity and subscription handling)
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

  // If the host page loads with ?session=<id>, subscribe to that session
  const param = getSessionParam();
  if(param){
    joinExistingSessionAsHost(param);
  }
});

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
    // ensure any existing subscription removed
    if(subscription) unsubscribeSession(subscription);
    subscription = subscribeSession(sessionId, (newRow) => {
      sessionRow = newRow;
      renderQuestions();
      renderTeams();
      el('current-index').innerText = (sessionRow.current && sessionRow.current.index>=0) ? sessionRow.current.index : '-';
    });
    // initial render
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
    // reuse join logic to subscribe
    await joinExistingSessionAsHost(id);
  }catch(err){
    alert('Failed to create session: '+(err.message || JSON.stringify(err)));
  }
}

function renderQuestions(){
  const container = el('questions-list');
  container.innerHTML = '';
  const qs = (sessionRow && sessionRow.questions) || [];
  qs.forEach((q, i) => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<strong>Q${i+1}:</strong> ${q.text || '(no text)'} <br/>
      <button class="btn" onclick="hostGoToQuestion(${i})">Go</button>
      <button class="btn" onclick="hostEditQuestion(${i})">Edit</button>
      <button class="btn" onclick="hostDeleteQuestion(${i})">Delete</button>
    `;
    container.appendChild(div);
  });
}

window.hostGoToQuestion = async function(i){
  if(!currentSessionId) return alert('No session active.');
  await supabase.from('sessions').update({ current: { type: 'question', index: i } }).eq('id', currentSessionId);
};

window.hostEditQuestion = function(i){
  const q = sessionRow.questions[i];
  const newText = prompt('Question text:', q.text||'');
  if(newText===null) return;
  q.text = newText;
  // update DB and immediately update UI
  supabase.from('sessions').update({ questions: sessionRow.questions }).eq('id', currentSessionId).then(res=>{
    if(res.error) console.error(res.error);
    else renderQuestions();
  });
};

window.hostDeleteQuestion = function(i){
  if(!confirm('Delete question?')) return;
  sessionRow.questions.splice(i,1);
  supabase.from('sessions').update({ questions: sessionRow.questions }).eq('id', currentSessionId).then(res=>{
    if(res.error) console.error(res.error);
    else renderQuestions();
  });
};

async function onAddQuestion(){
  const qText = prompt('Enter question text (leave blank for video question):');
  if(qText===null) return;
  const type = qText.trim() ? 'text' : 'video';
  let question = { type, text: qText || '', choices: [], answerIndex: -1 };
  if(type === 'text'){
    for(let k=0;k<4;k++){
      const choice = prompt(`Choice ${k+1}:`);
      if(choice===null) { return; }
      question.choices.push(choice);
    }
    const ans = parseInt(prompt('Index (0-3) of correct answer:'),10);
    question.answerIndex = isNaN(ans) ? -1 : ans;
  }else{
    const url = prompt('Enter video URL to embed (YouTube or direct):');
    question.videoUrl = url || '';
  }
  sessionRow.questions = sessionRow.questions || [];
  sessionRow.questions.push(question);
  // update DB and re-render immediately on success
  const { data, error } = await supabase.from('sessions').update({ questions: sessionRow.questions }).eq('id', currentSessionId);
  if(error) { console.error(error); alert('Failed to add question'); return; }
  renderQuestions();
}

async function changeIndex(delta){
  if(!sessionRow || !sessionRow.current) return;
  const idx = (sessionRow.current.index||0) + delta;
  const max = (sessionRow.questions || []).length - 1;
  const newIndex = Math.max(0, Math.min(max, idx));
  await supabase.from('sessions').update({ current: { type: 'question', index: newIndex } }).eq('id', currentSessionId);
}

async function setReveal(){
  if(!sessionRow || !sessionRow.current) return;
  const current = sessionRow.current;
  await supabase.from('sessions').update({ current: { type: 'reveal', index: current.index } }).eq('id', currentSessionId);
}

async function updateDisplayNow(){
  await supabase.from('sessions').update({ last_update: new Date().toISOString() }).eq('id', currentSessionId);
}

// Teams
function renderTeams(){
  const container = el('teams-list');
  container.innerHTML = '';
  const teams = (sessionRow && sessionRow.teams) || {};
  Object.entries(teams).forEach(([id, t])=>{
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<strong>${t.name}</strong> (Score: ${t.score || 0}) 
      <button class="btn" onclick="hostRemoveTeam('${id}')">Remove</button>
      <button class="btn" onclick="hostEditTeam('${id}')">Edit</button>
    `;
    container.appendChild(div);
  });
}

window.hostRemoveTeam = function(id){
  if(!confirm('Remove team?')) return;
  delete sessionRow.teams[id];
  supabase.from('sessions').update({ teams: sessionRow.teams }).eq('id', currentSessionId).then(res=>{
    if(res.error) console.error(res.error);
    else renderTeams();
  });
};

window.hostEditTeam = function(id){
  const t = sessionRow.teams[id];
  const newName = prompt('Team name:', t.name);
  if(newName===null) return;
  t.name = newName;
  const newScore = parseInt(prompt('Score:', t.score||0),10);
  t.score = isNaN(newScore)?(t.score||0):newScore;
  supabase.from('sessions').update({ teams: sessionRow.teams }).eq('id', currentSessionId).then(res=>{
    if(res.error) console.error(res.error);
    else renderTeams();
  });
};

async function onAddTeam(){
  const name = prompt('Team name:');
  if(!name) return;
  const id = makeId(6);
  sessionRow.teams = sessionRow.teams||{};
  sessionRow.teams[id] = { name, photoUrl: '', score: 0 };
  const { data, error } = await supabase.from('sessions').update({ teams: sessionRow.teams }).eq('id', currentSessionId);
  if(error) { console.error(error); alert('Failed to add team'); return; }
  renderTeams();
}

// Scoreboard / Chart
async function showScoreboard(){
  const teams = sessionRow.teams || {};
  const labels = [], data=[];
  Object.values(teams).forEach(t=>{
    labels.push(t.name);
    data.push(t.score||0);
  });
  el('scoreboard').classList.remove('hidden');
  const ctx = document.getElementById('score-chart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Score', data, backgroundColor: '#2b7cff' }] },
    options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 5 } } } }
  });
  await supabase.from('sessions').update({ current: { type: 'scoreboard', index: -1 } }).eq('id', currentSessionId);
}

// Chase controls (basic)
document.addEventListener('keydown', (e)=>{
  if(!sessionRow) return;
  if(e.code === 'Space'){
    e.preventDefault();
    const running = sessionRow.chase && sessionRow.chase.running;
    sessionRow.chase = sessionRow.chase || {};
    sessionRow.chase.running = !running;
    supabase.from('sessions').update({ chase: sessionRow.chase }).eq('id', currentSessionId);
  }else if(e.code === 'Enter'){
    const active = sessionRow.chase && sessionRow.chase.active;
    if(!active) return;
    sessionRow.chase.counters = sessionRow.chase.counters || {};
    sessionRow.chase.counters[active] = (sessionRow.chase.counters[active] || 0) + 1;
    supabase.from('sessions').update({ chase: sessionRow.chase }).eq('id', currentSessionId);
  }else if(e.code === 'Delete'){
    const active = sessionRow.chase && sessionRow.chase.active;
    if(!active) return;
    sessionRow.chase.counters = sessionRow.chase.counters || {};
    sessionRow.chase.counters[active] = Math.max(0, (sessionRow.chase.counters[active] || 0) - 1);
    supabase.from('sessions').update({ chase: sessionRow.chase }).eq('id', currentSessionId);
  }
});
