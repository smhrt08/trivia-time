// Display logic using Supabase: subscribe and render public display (improved subscription)
let sessionId = getSessionParam();
if(!sessionId){
  const id = prompt('Enter session id to display:');
  if(!id) document.getElementById('display-content').innerText = 'No session specified.';
  else sessionId = id;
}
if(sessionId){
  loadAndSubscribe(sessionId);
}

async function loadAndSubscribe(sessionId){
  const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
  if(error || !data){ document.getElementById('display-content').innerText = 'Session not found.'; return; }
  renderCurrent(data);
  // unsubscribe existing any channel?
  // subscribe via the helper that uses postgres_changes (keeps compatibility)
  const sub = subscribeSession(sessionId, (newRow) => {
    renderCurrent(newRow);
  });
  // keep reference in window for debugging if needed
  window.__displaySubscription = sub;
}

function renderCurrent(data){
  const container = document.getElementById('display-content');
  const current = data.current || { type: 'waiting' };
  container.innerHTML = '';
  if(current.type === 'question'){
    const q = (data.questions || [])[current.index];
    if(!q){ container.innerHTML = '<h2>No question</h2>'; return; }
    if(q.type === 'text'){
      const elq = document.createElement('div');
      elq.innerHTML = `<h2>Q${current.index+1}: ${q.text}</h2>`;
      container.appendChild(elq);
      q.choices.forEach((c, i)=>{
        const choiceEl = document.createElement('div');
        choiceEl.className = 'choice';
        choiceEl.innerText = `${String.fromCharCode(65+i)}. ${c}`;
        container.appendChild(choiceEl);
      });
    }else if(q.type === 'video'){
      container.innerHTML = `<h2>Video</h2><div>${q.videoUrl ? `<iframe width="800" height="450" src="${q.videoUrl}" frameborder="0" allowfullscreen></iframe>` : 'No video URL'}</div>`;
    }
  }else if(current.type === 'reveal'){
    const q = (data.questions || [])[current.index];
    if(!q){ container.innerHTML = '<h2>No question to reveal</h2>'; return; }
    if(q.type === 'text'){
      container.innerHTML = `<h2>Answer</h2><p>${q.choices[q.answerIndex] || 'No answer set'}</p>`;
    }else{
      container.innerHTML = `<h2>Answer</h2><p>Video question - reveal</p>`;
    }
  }else if(current.type === 'scoreboard'){
    const div = document.createElement('div');
    div.innerHTML = `<canvas id="display-chart" width="900" height="400"></canvas>`;
    container.appendChild(div);
    const teams = data.teams || {};
    const labels = [], values = [];
    Object.values(teams).forEach(t=>{
      labels.push(t.name);
      values.push(t.score || 0);
    });
    setTimeout(()=>{ // ensure canvas in DOM
      const ctx = document.getElementById('display-chart').getContext('2d');
      new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Score', data: values, backgroundColor: '#2b7cff' }] }, options: { scales: { y: { beginAtZero:true, ticks:{stepSize:5} } } } });
    },50);
  }else{
    container.innerHTML = '<h2>Waiting for host...</h2>';
  }
}
