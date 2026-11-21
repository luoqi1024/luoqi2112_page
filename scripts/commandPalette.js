import { flattenCategories, trackBookmarkClick } from './bookmarks.js?v=20261121-life-issues';
import { highlightHtml, performSiteSearch } from './siteSearch.js?v=20261121-life-issues';
import { readJson } from './storage.js?v=20261121-life-issues';

function score(title, detail, query) {
  if (!query) return 1;
  const name = title.toLowerCase();
  if (name.startsWith(query)) return 4;
  if (name.split(/[\s·/—_-]+/).some(word => word.startsWith(query))) return 3;
  if (name.includes(query)) return 2;
  return detail.toLowerCase().includes(query) ? 1 : 0;
}

export function initCommandPalette({config,bookmarks,getTodos,toggleTodo,commands,addRecent,loadMoments,egg}) {
  const dialog = document.getElementById('commandPalette');
  const input = document.getElementById('commandInput');
  const list = document.getElementById('commandResults');
  const engines = config.search.engines.filter(engine => engine.queryUrl);
  const defaultEngine = engines.find(engine => engine.id === config.search.defaultEngineId) || engines[0];
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
  for (const label of document.querySelectorAll('[data-shortcut]')) label.textContent = shortcut;
  document.getElementById('engineHints').textContent = engines.map(e => e.id[0] + ' ' + e.name).join(' · ');
  const groups = new Map();
  const link = (item, detail = '') => ({title:item.name || item.title, url:item.url, detail});
  const pinned = [...bookmarks.top,...flattenCategories(bookmarks.categories)];
  const seen = new Set();
  groups.set('收藏', pinned.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  }).map(item => link(item,[item._categoryTitle, ...(item.tags || []), item.url].filter(Boolean).join(' · '))));
  groups.set('账号',config.profiles.map(item => link(item,item.note + ' · ' + item.url)));
  const photos = config.photos || {};
  const photoPages = [
    {title:'摄影档案',url:'./photos/',detail:'摄影地图'},
    ...(photos.journal ? [{title:photos.journal.title,url:photos.journal.storyUrl,detail:photos.journal.meta}] : []),
    ...(photos.atlas?.regions || []).map(region => ({
      title:region.name,url:'./photos/?region=' + encodeURIComponent(region.id),detail:region.english + ' · 摄影地图'
    }))
  ];
  groups.set('摄影',photoPages);
  groups.set('片刻馆',[]);
  let active = 0;
  let choices = [];
  let trigger;
  let restoring = false;
  let indexed = false;

  function engineResult(engine, query) {
    return {title:engine.name + ' 搜索「' + query + '」', detail:'网页搜索',
      url:engine.queryUrl.replace('{q}',encodeURIComponent(query))};
  }

  function results(raw) {
    const q = raw.toLowerCase();
    if (q.startsWith('>')) {
      const todo = /^>todo\s+(.+)$/i.exec(raw);
      if (todo) return [['指令',[{title:'添加待办 · ' + todo[1],run:() => commands.todo(todo[1])}]]];
      return [['指令',Object.entries(commands).filter(([name]) => ('>'+name).startsWith(q)).map(([name,run]) => ({
        title:'>' + name + (name === 'todo' ? ' <文本>' : ''), run: name === 'todo' ? () => complete('>todo ') : run,
        keep:name === 'todo'
      }))]];
    }
    const prefix = /^(\S+)\s+(.+)$/.exec(raw);
    const engine = prefix && engines.find(e => e.id[0] === prefix[1].toLowerCase());
    if (engine) return [['搜索引擎',[engineResult(engine,prefix[2])]]];
    if (['2112','bocchi','kessoku'].includes(q)) return [['指令',[{title:q,run:() => egg(q)}]]];
    const matches = [];
    if (!q && config.extras?.showRecent) matches.push(['最近',readJson('recent',[]).slice(0,6).map(item => link(item,item.url))]);
    for (const [group,entries] of groups) {
      let pool = entries;
      if (group === '摄影' && q) {
        const photos = performSiteSearch(q,{config,bookmarks,todos:[]}).filter(item => item.kind === 'photos');
        pool = [...entries,...photos.map(item => link(item,item.tags.join(' · ')))];
      }
      matches.push([group,rank(pool,q)]);
    }
    matches.push(['待办',rank(getTodos().map(item => ({
      title:item.text,detail:item.done ? '恢复待办' : '完成待办',run:() => toggleTodo(item.id)
    })),q)]);
    if (q && defaultEngine) matches.push(['搜索引擎',[defaultEngine,...engines.filter(e => e !== defaultEngine)].map(e => engineResult(e,raw))]);
    if (!q) matches.push(['指令',[{title:'> 输入指令',run:() => complete('>'),keep:true}]]);
    return matches;
  }

  function rank(items, query) {
    return items.map(item => ({item,weight:score(item.title,item.detail || '',query)}))
      .filter(row => row.weight).sort((a,b) => b.weight-a.weight).slice(0,4).map(row => row.item);
  }
  function complete(text) { input.value = text; render(); input.focus(); }
  function select(index, scroll = false) {
    active = index;
    for (const node of list.querySelectorAll('[role="option"]')) {
      node.setAttribute('aria-selected',String(Number(node.dataset.index) === active));
    }
    const target = list.querySelector('[aria-selected="true"]');
    if (target) {
      input.setAttribute('aria-activedescendant',target.id);
      if (scroll) target.scrollIntoView({block:'nearest'});
    } else input.removeAttribute('aria-activedescendant');
  }
  function render() {
    let budget = 14;
    const query = input.value.trim();
    choices = [];
    list.replaceChildren();
    for (const [group,items] of results(query)) {
      if (!items.length || !budget) continue;
      const section = document.createElement('div');
      section.setAttribute('role','group');
      section.setAttribute('aria-label',group);
      const heading = document.createElement('h3');
      heading.textContent = group;
      section.append(heading);
      for (const item of items.slice(0, Math.min(budget,group === '最近' ? 6 : 4))) {
        const index = choices.length;
        const row = document.createElement('div');
        row.setAttribute('role','option');
        row.id = 'command-option-' + index;
        row.dataset.index = String(index);
        const title = document.createElement('span');
        title.innerHTML = highlightHtml(item.title,query);
        const detail = document.createElement('small');
        detail.innerHTML = highlightHtml(item.detail,query);
        row.append(title,detail);
        section.append(row);
        choices.push({...item,group});
        budget--;
      }
      list.append(section);
    }
    if (!choices.length) list.textContent = '没有匹配的指令';
    select(0);
  }
  function execute(index) {
    const item = choices[index];
    if (!item) return;
    if (!item.keep) dialog.close();
    if (item.run) return item.run();
    const url = new URL(item.url,location.href);
    if (!['http:','https:','mailto:'].includes(url.protocol)) return;
    addRecent({name:item.title,url:item.url});
    if (item.group === '收藏') trackBookmarkClick(item.url);
    if (url.origin === location.origin) location.assign(url.href);
    else window.open(url.href,'_blank','noopener,noreferrer');
  }
  function open(source = document.activeElement) {
    if (restoring || dialog.open) return;
    trigger = source;
    input.value = '';
    dialog.showModal();
    input.focus();
    render();
    if (!indexed) {
      indexed = true;
      loadMoments().then(entries => { groups.set('片刻馆',entries); if (dialog.open) render(); });
    }
  }
  document.getElementById('commandClose').onclick = () => dialog.close();
  dialog.addEventListener('click',event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  dialog.addEventListener('close',() => {
    restoring = true;
    if (trigger?.isConnected && !document.body.classList.contains('is-immersed')) trigger.focus({preventScroll:true});
    restoring = false;
  });
  input.oninput = render;
  list.onclick = event => {
    const row = event.target.closest('[role="option"]');
    if (row) execute(Number(row.dataset.index));
  };
  dialog.addEventListener('keydown',event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); dialog.close(); return; }
    if (event.key === 'Enter' && event.target === input) { event.preventDefault(); execute(active); return; }
    if (!choices.length || !['ArrowDown','ArrowUp','Tab'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Tab') {
      const starts = choices.map((item,i) => i === 0 || item.group !== choices[i-1].group ? i : -1).filter(i => i >= 0);
      const group = starts.findLastIndex(i => i <= active);
      select(starts[(group + (event.shiftKey ? -1 : 1) + starts.length) % starts.length],true);
    } else select((active + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length,true);
  });
  for (const button of document.querySelectorAll('[data-palette]')) button.onclick = () => open(button);
  // Opening on keyboard focus must not reopen the dialog when native focus restoration runs.
  const prompt = document.querySelector('.console__prompt');
  prompt.onfocus = () => { if (!dialog.open && !restoring && trigger !== prompt) open(prompt); };
  prompt.onblur = () => { if (!dialog.open) trigger = null; };
  return open;
}
