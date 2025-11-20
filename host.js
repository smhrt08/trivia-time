// Host logic using Supabase
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
});

async function onCreateSession(){
  const id = makeId(5);
  try{
    await createSessionRow(id);
    currentSessionId = id;
    el('session-info').classList.remove('hidden');
    el('session-id').innerText = id;
    const link = `${location.origin}${location.pathname.replace('host.html','contestant.html')}?session=${id}`;
    el('join-link').href = link;
    el('join-link').innerText = link;
    document.querySelectorAll('.card').forEach(c=>c.classList.remove('hidden'));
    const { data } = await getSessionRow(id);
    sessionRow = data;
    if(subscription) subscription.unsubscribe();
    subscription = subscribeSession(id, async (newRow) => {
      sessionRow = newRow;
      renderQuestions();
      renderTeams();
      el('current-index').innerText = (sessionRow.current && sessionRow.current.index>=0) ? sessionRow.current.index : '-';
    });
    // initial render
    renderQuestions();
    renderTeams();
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
  await supabase.from('sessions').update({ current: { type: 'question', index: i } }).eq('id', currentSessionId);
};

window.hostEditQuestion = function(i){
  const q = sessionRow.questions[i];
  const newText = prompt('Question text:', q.text||'');
  if(newText===null) return;
  q.text = newText;
  supabase.from('sessions').update({ questions: sessionRow.questions }).eq('id', currentSessionId);
};

window.hostDeleteQuestion = function(i){
  if(!confirm('Delete question?')) return;
  sessionRow.questions.splice(i,1);
  supabase.from('sessions').update({ questions: sessionRow.questions }).eq('id', currentSessionId);
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
  await supabase.from('sessions').update({ questions: sessionRow.questions }).eq('id', currentSessionId);
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
  supabase.from('sessions').update({ teams: sessionRow.teams }).eq('id', currentSessionId);
};

window.hostEditTeam = function(id){
  const t = sessionRow.teams[id];
  const newName = prompt('Team name:', t.name);
  if(newName===null) return;
  t.name = newName;
  const newScore = parseInt(prompt('Score:', t.score||0),10);
  t.score = isNaN(newScore)?(t.score||0):newScore;
  supabase.from('sessions').update({ teams: sessionRow.teams }).eq('id', currentSessionId);
};

async function onAddTeam(){
  const name = prompt('Team name:');
  if(!name) return;
  const id = makeId(6);
  sessionRow.teams = sessionRow.teams||{};
  sessionRow.teams[id] = { name, photoUrl: '', score: 0 };
  await supabase.from('sessions').update({ teams: sessionRow.teams }).eq('id', currentSessionId);
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