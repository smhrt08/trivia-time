(function(){
  const bc = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('trivia-chase') : null;

  function send(msg){
    if(bc) bc.postMessage(msg);
    else {
      // If BroadcastChannel not available, try to call a global if display is in same window (debug fallback).
      if(window.TriviaChaseDisplay && typeof window.TriviaChaseDisplay.applyMessage === 'function'){
        window.TriviaChaseDisplay.applyMessage(msg);
      } else {
        console.warn('No BroadcastChannel and no local display API.');
      }
    }
  }

  // Elements
  const timerInput = document.getElementById('timerInput');
  const setTimerBtn = document.getElementById('setTimerBtn');
  const startStopBtn = document.getElementById('startStopBtn');
  const resetTimerBtn = document.getElementById('resetTimerBtn');

  const chunksInput = document.getElementById('chunksInput');
  const setChunksBtn = document.getElementById('setChunksBtn');

  const activeTeamSelect = document.getElementById('activeTeamSelect');
  const toggleTeamBtn = document.getElementById('toggleTeamBtn');

  const incBtn = document.getElementById('incBtn');
  const decBtn = document.getElementById('decBtn');
  const saveTeamBtn = document.getElementById('saveTeamBtn');

  const ctrlStatus = document.getElementById('ctrlStatus');

  function updateStatus(text){ if(ctrlStatus) ctrlStatus.textContent = text; }

  setTimerBtn.addEventListener('click', () => {
    const sec = Math.max(1, parseInt(timerInput.value,10)||60);
    send({type:'setTimer', seconds: sec});
    send({type:'resetTimer'});
  });

  startStopBtn.addEventListener('click', () => {
    send({type:'toggle'});
  });

  resetTimerBtn.addEventListener('click', () => {
    send({type:'resetTimer'});
  });

  setChunksBtn.addEventListener('click', () => {
    const ch = Math.max(1, parseInt(chunksInput.value,10)||5);
    send({type:'setChunks', chunks: ch});
  });

  toggleTeamBtn.addEventListener('click', () => {
    const team = (activeTeamSelect.value === '1') ? 1 : 0;
    send({type:'setActiveTeam', team});
  });

  activeTeamSelect.addEventListener('change', () => {
    const team = (activeTeamSelect.value === '1') ? 1 : 0;
    send({type:'setActiveTeam', team});
  });

  incBtn.addEventListener('click', () => {
    const team = (activeTeamSelect.value === '1') ? 1 : 0;
    send({type:'increment', team});
  });

  decBtn.addEventListener('click', () => {
    const team = (activeTeamSelect.value === '1') ? 1 : 0;
    send({type:'decrement', team});
  });

  saveTeamBtn.addEventListener('click', () => {
    const team = (activeTeamSelect.value === '1') ? 1 : 0;
    send({type:'saveTeamCount', team});
  });

  // Keyboard shortcuts for host
  window.addEventListener('keydown', (e) => {
    // Do not capture keys if focus is on an input field
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if(tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable) return;

    if(e.code === 'Space'){
      e.preventDefault();
      send({type:'toggle'});
    } else if(e.key === 'Enter'){
      send({type:'increment', team: (activeTeamSelect.value === '1') ? 1 : 0});
    } else if(e.key === 'Delete'){
      send({type:'decrement', team: (activeTeamSelect.value === '1') ? 1 : 0});
    } else if(e.key === 't' || e.key === 'T'){
      // toggle team
      const newTeam = activeTeamSelect.value === '1' ? '0' : '1';
      activeTeamSelect.value = newTeam;
      send({type:'setActiveTeam', team: parseInt(newTeam,10)});
    }
  });

  updateStatus(bc ? 'connected (BroadcastChannel)' : 'local-only (BroadcastChannel not available)');

  // Expose send for debugging
  window.TriviaChaseControl = { send };
})();
