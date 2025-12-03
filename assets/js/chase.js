(function(){
  const bc = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('trivia-chase') : null;

  let duration = 60;
  let remaining = 0;
  let running = false;
  let timerId = null;

  const counts = [0,0];
  let chunks = 5;
  let activeTeam = 0;

  const timerValue = document.getElementById('timerValue');
  const status = document.getElementById('status');
  const countEls = [document.getElementById('count0'), document.getElementById('count1')];
  const chunksEls = [document.getElementById('chunks0'), document.getElementById('chunks1')];

  function renderTimer(){
    const mm = Math.floor(remaining/60).toString().padStart(2,'0');
    const ss = Math.floor(remaining%60).toString().padStart(2,'0');
    timerValue.textContent = `${mm}:${ss}`;
    status.textContent = `Status: ${running ? 'running' : 'stopped'} • Active team: ${activeTeam+1}`;
  }

  function renderCounts(){
    countEls[0].textContent = counts[0];
    countEls[1].textContent = counts[1];
    renderChunks();
  }

  function renderChunks(){
    for(let t=0;t<2;t++){
      const container = chunksEls[t];
      container.innerHTML = '';
      const teamCount = counts[t];
      for(let i=0;i<chunks;i++){
        const div = document.createElement('div');
        div.className = 'chunk' + (i < teamCount ? ' filled' : '');
        container.appendChild(div);
      }
    }
  }

  function tick(){
    if(!running) return;
    if(remaining > 0){
      remaining--;
      renderTimer();
    } else {
      running = false;
      clearInterval(timerId);
      timerId = null;
      renderTimer();
    }
  }

  function startTimer(){
    if(running) return;
    if(remaining <= 0) remaining = duration;
    running = true;
    renderTimer();
    timerId = setInterval(tick, 1000);
  }
  function stopTimer(){
    running = false;
    if(timerId) clearInterval(timerId);
    timerId = null;
    renderTimer();
  }
  function resetTimer(){
    remaining = duration;
    stopTimer();
    renderTimer();
  }

  function applyMessage(msg){
    switch(msg.type){
      case 'setTimer':
        duration = Math.max(1, parseInt(msg.seconds,10)||60);
        remaining = duration;
        renderTimer();
        break;
      case 'start':
        startTimer();
        break;
      case 'stop':
        stopTimer();
        break;
      case 'toggle':
        running ? stopTimer() : startTimer();
        break;
      case 'resetTimer':
        remaining = duration;
        stopTimer();
        renderTimer();
        break;
      case 'setChunks':
        chunks = Math.max(1, parseInt(msg.chunks,10)||5);
        renderChunks();
        break;
      case 'setActiveTeam':
        activeTeam = msg.team === 1 ? 1 : 0;
        renderTimer();
        break;
      case 'increment':
        if(msg.team === undefined) msg.team = activeTeam;
        if(msg.team === activeTeam){
          counts[msg.team] = Math.min(chunks, counts[msg.team]+1);
          renderCounts();
        }
        break;
      case 'decrement':
        if(msg.team === undefined) msg.team = activeTeam;
        if(msg.team === activeTeam){
          counts[msg.team] = Math.max(0, counts[msg.team]-1);
          renderCounts();
        }
        break;
      case 'saveTeamCount':
        // Visual-only: we "save" by keeping the value displayed. No other action needed.
        // Could flash a saved indicator
        (function flash(team){
          const el = countEls[team];
          el.style.transition = 'none';
          el.style.color = '#00ffbb';
          setTimeout(()=>{ el.style.color = ''; }, 500);
        })(msg.team||activeTeam);
        break;
      default:
        console.warn('unknown msg', msg);
    }
  }

  // Listen for broadcasted commands
  if(bc){
    bc.onmessage = (ev) => {
      applyMessage(ev.data);
    };
  } else {
    // Fallback: listen for keyboard events in same window
    console.warn('BroadcastChannel not available — display will only respond to local keyboard.');
  }

  // Expose a small local API for debugging / manual control in the display window
  window.TriviaChaseDisplay = {
    applyMessage
  };

  // Initialize
  remaining = duration;
  renderTimer();
  renderCounts();
})();
