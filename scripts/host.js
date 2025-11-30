async function populateRepoGameSelect(){
  const select = el('repo-game-select');
  select.innerHTML = '<option value="">-- loading list --</option>';
  const preview = el('repo-game-preview');
  preview.innerText = '';

  const owner = 'smhrt08';
  const repo = 'trivia-time';
  const repoApi = `https://api.github.com/repos/${owner}/${repo}`;

  try {
    // 1) get repo metadata so we know the default branch
    const repoResp = await fetch(repoApi);
    if(!repoResp.ok){
      console.warn('Repo metadata fetch failed', repoResp.status, repoResp.statusText);
      select.innerHTML = `<option value="">(failed to access repo: ${repoResp.status})</option>`;
      preview.innerText = 'If repository is private, the site cannot list files via GitHub API.';
      return;
    }
    const repoMeta = await repoResp.json();
    const branch = repoMeta.default_branch || 'main';

    // 2) fetch the repo tree recursively for that branch
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const treeResp = await fetch(treeUrl);
    if(!treeResp.ok){
      console.warn('Tree fetch failed', treeResp.status, treeResp.statusText);
      select.innerHTML = `<option value="">(failed to read branch tree: ${treeResp.status})</option>`;
      preview.innerText = 'Make sure the branch exists and repo is public, or use the fallback index file.';
      return;
    }
    const treeData = await treeResp.json();
    if(!treeData.tree || treeData.tree.length === 0){
      select.innerHTML = '<option value="">(no files found)</option>';
      return;
    }

    // 3) filter for files under games/ that end with .json
    const files = treeData.tree
      .filter(item => item.type === 'blob' && item.path.startsWith('games/') && item.path.toLowerCase().endsWith('.json'))
      .map(item => ({ path: item.path }));

    if(files.length === 0){
      select.innerHTML = '<option value="">(no .json files in /games)</option>';
      preview.innerText = `Tip: Add a JSON template under /games on the ${branch} branch.`;
      return;
    }

    // 4) populate select with raw.githubusercontent URLs using the branch we discovered
    select.innerHTML = '<option value="">-- select a game --</option>';
    files.forEach(f => {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodeURIComponent(f.path)}`;
      const name = f.path.split('/').pop();
      const opt = document.createElement('option');
      opt.value = rawUrl;
      opt.dataset.path = f.path;
      opt.text = name;
      select.appendChild(opt);
    });

    // 5) preview and on-change handler
    select.onchange = async () => {
      const url = select.value;
      if(!url){ preview.innerText = ''; return; }
      try{
        const r = await fetch(url);
        if(!r.ok) { preview.innerText = `Preview failed (${r.status})`; return; }
        const json = await r.json();
        const qcount = (json.questions && json.questions.length) || 0;
        preview.innerText = `${select.selectedOptions[0].dataset.path} — ${qcount} question(s)`;
      } catch(e){
        console.error('Preview fetch error', e);
        preview.innerText = 'Preview failed (see console)';
      }
    };

  } catch(err){
    console.error('populateRepoGameSelect error', err);
    select.innerHTML = '<option value="">(error loading list)</option>';
    preview.innerText = 'Check console for details (CORS, rate-limits, or private repo).';
  }
}
