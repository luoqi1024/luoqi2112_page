import { applyFooterHomeText, applySiteMeta, renderAccountsTop, renderBookmarksTop, renderProfileCard, renderRecent, renderSearchEngines, renderTodoTop, setPanelVisible, showError } from './render.js';
import { WallpaperRotator } from './wallpaper.js';
import { clampList, readJson, upsertRecent, writeJson } from './storage.js';
import { createDrawer } from './drawer.js?v=20260728-desktop2';
import { normalizeBookmarks, searchBookmarks, trackBookmarkClick } from './bookmarks.js';
import { addTodo, clearDone, loadTodos, removeTodo, saveTodos, splitTodos, toggleDone } from './todo.js';
import { buildPhotosDrawerContent, openPhoto, renderPhotoThumbs, collectAllPhotos, findPhotoIndex } from './photos.js';
import { performSiteSearch, renderSiteSearchModal, wireSiteSearchModalActions } from './siteSearch.js';
import { initDesktopMode } from './desktop.js?v=20260728-desktop3';

async function fetchConfig() {
  const url = './data/config.json';
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function formatClock() {
  const d = new Date();
  const date = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  });
  const time = d.toLocaleTimeString(undefined, { hour12: false });
  return `${date} ${time}`;
}

function initClock(extras) {
  const clock = document.getElementById('clock');
  if (!clock) return;
  const enabled = Boolean(extras?.showClock);
  if (!enabled) {
    clock.textContent = '';
    return;
  }
  const tick = () => (clock.textContent = formatClock());
  tick();
  window.setInterval(tick, 1000);
}

function getEngine(config, engineId) {
  const engines = config?.search?.engines || [];
  const id = engineId || config?.search?.defaultEngineId;
  return engines.find((e) => e.id === id) || engines[0];
}

function performSearch(query, engineId, config, { drawer, getTodos, setTodos, bookmarks } = {}) {
  const q = String(query || '').trim();
  if (!q) return false;

  if (engineId === 'site') {
    const results = performSiteSearch(q, {
      config,
      bookmarks: bookmarks || normalizeBookmarks(config),
      todos: getTodos ? getTodos() : loadTodos()
    });
    renderSiteSearchModal(results, q);
    wireSiteSearchModalActions({
      drawer,
      getTodos,
      setTodos
    });
    return true;
  }

  const engine = getEngine(config, engineId);
  if (!engine?.queryUrl) return false;
  const url = engine.queryUrl.replace('{q}', encodeURIComponent(q));
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

function initSearch(config, { drawer, getTodos, setTodos, bookmarks } = {}) {
  const input = document.getElementById('searchInput');
  const select = document.getElementById('engineSelect');
  const btn = document.getElementById('searchBtn');
  if (!input || !select || !btn) return;

  const go = () => {
    const q = (input.value || '').trim();
    if (!q) return;
    performSearch(q, select.value, config, { drawer, getTodos, setTodos, bookmarks });
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go();
  });
  btn.addEventListener('click', go);
}

function buildSearchDrawerContent(config, { drawer, getTodos, setTodos, bookmarks } = {}) {
  const root = document.createElement('div');
  root.className = 'desktopSearchPanel';

  const form = document.createElement('form');
  form.className = 'desktopSearchPanel__form';
  form.setAttribute('role', 'search');

  const input = document.createElement('input');
  input.className = 'search__input';
  input.type = 'search';
  input.placeholder = '输入关键词，Enter 搜索';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', '桌面搜索输入框');

  const select = document.createElement('select');
  select.className = 'search__select';
  select.setAttribute('aria-label', '选择搜索引擎');
  for (const engine of (config?.search?.engines || [])) {
    const option = document.createElement('option');
    option.value = engine.id;
    option.textContent = engine.name;
    select.appendChild(option);
  }
  const siteOption = document.createElement('option');
  siteOption.value = 'site';
  siteOption.textContent = '站内';
  select.appendChild(siteOption);
  select.value = config?.search?.defaultEngineId || select.options[0]?.value || 'site';

  const submit = document.createElement('button');
  submit.className = 'btn';
  submit.type = 'submit';
  submit.textContent = '搜索';

  const hint = document.createElement('div');
  hint.className = 'desktopSearchPanel__hint';
  hint.textContent = '选择“站内”可搜索账号、收藏、摄影和 Todo';

  form.appendChild(input);
  form.appendChild(select);
  form.appendChild(submit);
  root.appendChild(form);
  root.appendChild(hint);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    if (select.value === 'site') {
      drawer?.close?.();
      window.setTimeout(() => {
        performSearch(query, select.value, config, { drawer, getTodos, setTodos, bookmarks });
      }, 190);
      return;
    }

    if (performSearch(query, select.value, config, { drawer, getTodos, setTodos, bookmarks })) {
      drawer?.close?.();
    }
  });

  return { root, input };
}

function initRecent(extras) {
  const enabled = Boolean(extras?.showRecent);
  // New IA doesn't render a recent panel on the primary dashboard.
  // Still keep recent tracking in localStorage.
  const root = document.getElementById('recent');
  if (!enabled || !root) return { addRecent: () => {} };

  const max = Number(extras?.recentMaxItems) || 8;
  const key = 'recent';
  let recent = clampList(readJson(key, []), max);
  renderRecent(recent);

  const save = () => writeJson(key, clampList(recent, max));
  const update = () => {
    renderRecent(recent);
    save();
  };

  return {
    addRecent: (entry) => {
      recent = upsertRecent(recent, entry, max);
      update();
    }
  };
}

function wireExternalClickTracking(addRecent) {
  document.addEventListener('click', (e) => {
    const a = e.target?.closest?.('a.external');
    if (!a) return;
    const url = a.getAttribute('data-recent-url') || a.getAttribute('href') || '';
    if (!url || url.startsWith('#')) return;
    const name = a.getAttribute('data-recent-name') || a.textContent?.trim() || url;
    addRecent({ name, url });

    const bookmarkUrl = a.getAttribute('data-bookmark-url');
    if (bookmarkUrl) trackBookmarkClick(bookmarkUrl);
  });
}

function initWallpaper(config) {
  const layerA = document.getElementById('bgA');
  const layerB = document.getElementById('bgB');
  const meta = document.getElementById('wallpaperMeta');
  if (!layerA || !layerB) return null;

  const wp = config?.wallpapers;
  const rotator = new WallpaperRotator({
    layerA,
    layerB,
    meta,
    fadeMs: wp?.fadeMs,
    intervalSeconds: wp?.intervalSeconds,
    rememberLast: wp?.rememberLast,
    preloadNext: wp?.preloadNext,
    items: wp?.items,
    images: wp?.images
  });
  rotator.init();

  // Load manifest asynchronously (GitHub Pages can't list directories at runtime).
  // If manifest is missing, rotator will keep using config wallpapers.
  rotator.loadManifest?.('assets/wallpapers/manifest.json');

  const prev = document.getElementById('wpPrev');
  const next = document.getElementById('wpNext');
  const toggle = document.getElementById('wpToggle');
  const desktopPrev = document.getElementById('desktopWpPrev');
  const desktopNext = document.getElementById('desktopWpNext');
  const desktopToggle = document.getElementById('desktopWpToggle');
  const desktopMeta = document.getElementById('desktopWallpaperMeta');

  const goPrev = () => rotator.prev();
  const goNext = () => rotator.next();
  const sync = () => {
    if (toggle) {
      toggle.textContent = rotator.paused ? '播放' : '暂停';
      toggle.setAttribute('aria-label', rotator.paused ? '播放壁纸轮播' : '暂停壁纸轮播');
    }
    if (desktopToggle) {
      desktopToggle.textContent = rotator.paused ? '▶' : 'Ⅱ';
      desktopToggle.setAttribute('aria-label', rotator.paused ? '播放壁纸轮播' : '暂停壁纸轮播');
    }
  };
  const togglePlayback = () => {
    rotator.toggle();
    sync();
  };

  prev?.addEventListener('click', goPrev);
  next?.addEventListener('click', goNext);
  desktopPrev?.addEventListener('click', goPrev);
  desktopNext?.addEventListener('click', goNext);
  toggle?.addEventListener('click', togglePlayback);
  desktopToggle?.addEventListener('click', togglePlayback);

  if (meta && desktopMeta) {
    const syncMeta = () => {
      desktopMeta.textContent = meta.textContent || '';
    };
    new MutationObserver(syncMeta).observe(meta, { childList: true, characterData: true, subtree: true });
    syncMeta();
  }
  sync();

  return rotator;
}

function initSearchHotkeys() {
  const input = document.getElementById('searchInput');
  if (!input) return;

  window.addEventListener('keydown', (e) => {
    if (document.body.classList.contains('is-desktop')) return;
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const ctrlK = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k';
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
      return;
    }
    if (ctrlK) {
      e.preventDefault();
      input.focus();
      return;
    }
    if (e.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      input.blur();
    }
  });
}

function buildAccountsDrawerContent(config) {
  const root = document.createElement('div');
  const list = (config?.profiles || [])
    .slice()
    .sort((a, b) => (a.topRank ?? 999) - (b.topRank ?? 999));

  const grid = document.createElement('div');
  grid.className = 'grid grid--accounts';
  for (const p of list) {
    const a = document.createElement('a');
    a.className = 'tile external';
    a.href = p.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('data-recent-name', p.name);
    a.setAttribute('data-recent-url', p.url);
    a.setAttribute('aria-label', `打开 ${p.name}`);
    a.innerHTML = `
      <div class="tile__left">
        <div class="tile__icon" aria-hidden="true">${p.icon || '🔗'}</div>
        <div class="tile__name">${p.name || ''}</div>
      </div>
      <div class="tile__meta">${p.note || ''}</div>
    `.trim();
    if (typeof p.url === 'string' && p.url.startsWith('mailto:')) a.removeAttribute('rel');
    grid.appendChild(a);
  }

  root.appendChild(grid);
  return root;
}

function buildCategoryDrawerContent(category) {
  const root = document.createElement('div');
  
  const header = document.createElement('div');
  header.className = 'drawerSection';
  header.innerHTML = `
    <div class="drawerSection__hd">
      <div class="drawerSection__title">${category.icon || '📁'} ${category.title || ''}</div>
      <div class="muted">${(category.items || []).length} 个书签</div>
    </div>
  `.trim();
  root.appendChild(header);
  
  const grid = document.createElement('div');
  grid.className = 'grid';
  
  for (const it of (category.items || [])) {
    const a = document.createElement('a');
    a.className = 'tile external';
    a.href = it.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('data-recent-name', it.name);
    a.setAttribute('data-recent-url', it.url);
    a.setAttribute('data-bookmark-url', it.url);
    a.setAttribute('aria-label', `打开 ${it.name}`);
    a.innerHTML = `
      <div class="tile__left">
        <div class="tile__icon" aria-hidden="true">${it.icon || '🔗'}</div>
        <div class="tile__name">${it.name || ''}</div>
      </div>
      <div class="tile__meta">${(it.tags || [])[0] || ''}</div>
    `.trim();
    grid.appendChild(a);
  }
  
  root.appendChild(grid);
  return root;
}

function buildBookmarksDrawerContent(bookmarks) {
  const root = document.createElement('div');

  const searchWrap = document.createElement('div');
  searchWrap.className = 'drawerSearch';
  searchWrap.innerHTML = `
    <label class="sr-only" for="bookmarkFilter">搜索收藏</label>
    <input id="bookmarkFilter" class="search__input" type="text" placeholder="搜索收藏（名称/标签）" aria-label="搜索收藏" />
  `.trim();
  root.appendChild(searchWrap);

  const body = document.createElement('div');
  root.appendChild(body);

  const render = (cats) => {
    body.innerHTML = '';
    for (const c of (cats || [])) {
      const section = document.createElement('div');
      section.className = 'drawerSection';
      section.innerHTML = `
        <div class="drawerSection__hd">
          <div class="drawerSection__title">${c.icon || '📁'} ${c.title || ''}</div>
          <div class="muted">${(c.items || []).length}</div>
        </div>
      `.trim();
      const grid = document.createElement('div');
      grid.className = 'grid';
      for (const it of (c.items || [])) {
        const a = document.createElement('a');
        a.className = 'tile external';
        a.href = it.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('data-recent-name', it.name);
        a.setAttribute('data-recent-url', it.url);
        a.setAttribute('data-bookmark-url', it.url);
        a.setAttribute('aria-label', `打开 ${it.name}`);
        a.innerHTML = `
          <div class="tile__left">
            <div class="tile__icon" aria-hidden="true">${it.icon || '🔗'}</div>
            <div class="tile__name">${it.name || ''}</div>
          </div>
          <div class="tile__meta">${(it.tags || [])[0] || ''}</div>
        `.trim();
        grid.appendChild(a);
      }
      section.appendChild(grid);
      body.appendChild(section);
    }
  };

  render(bookmarks?.categories || []);

  const input = root.querySelector('#bookmarkFilter');
  input?.addEventListener('input', () => {
    const q = input.value;
    render(searchBookmarks(bookmarks?.categories || [], q));
  });

  return root;
}

function buildTodosDrawerContent(getTodos, setTodos) {
  const root = document.createElement('div');
  const header = document.createElement('div');
  header.className = 'drawerSection';
  header.innerHTML = `
    <div class="drawerSection__hd">
      <div class="drawerSection__title">管理</div>
      <button id="clearDone" class="btn btn--sm btn--danger" type="button" aria-label="清空已完成">清空已完成</button>
    </div>
  `.trim();
  root.appendChild(header);

  const columns = document.createElement('div');
  columns.className = 'grid';
  columns.style.gridTemplateColumns = '1fr';
  root.appendChild(columns);

  const render = () => {
    const { undone, done } = splitTodos(getTodos());
    columns.innerHTML = '';

    const sec1 = document.createElement('div');
    sec1.className = 'drawerSection';
    sec1.appendChild(document.createElement('div')).className = 'drawerSection__hd';
    sec1.querySelector('.drawerSection__hd').appendChild(document.createElement('div')).className = 'drawerSection__title';
    sec1.querySelector('.drawerSection__title').textContent = `未完成 (${undone.length})`;
    const list1 = document.createElement('div');
    list1.className = 'list';
    for (const t of undone) {
      const row = document.createElement('div');
      row.className = 'todoRow';
      row.innerHTML = `
        <div class="todoRow__text">${t.text}</div>
        <div class="todoRow__actions">
          <button class="btn btn--sm btn--ghost" type="button" aria-label="完成">完成</button>
          <button class="btn btn--sm btn--danger" type="button" aria-label="删除">删除</button>
        </div>
      `.trim();
      const [btnDone, btnDel] = row.querySelectorAll('button');
      btnDone.addEventListener('click', () => {
        setTodos(toggleDone(getTodos(), t.id));
        render();
      });
      btnDel.addEventListener('click', () => {
        setTodos(removeTodo(getTodos(), t.id));
        render();
      });
      list1.appendChild(row);
    }
    sec1.appendChild(list1);

    const sec2 = document.createElement('div');
    sec2.className = 'drawerSection';
    sec2.appendChild(document.createElement('div')).className = 'drawerSection__hd';
    sec2.querySelector('.drawerSection__hd').appendChild(document.createElement('div')).className = 'drawerSection__title';
    sec2.querySelector('.drawerSection__title').textContent = `已完成 (${done.length})`;

    const list2 = document.createElement('div');
    list2.className = 'list';
    for (const t of done) {
      const row = document.createElement('div');
      row.className = 'todoRow';
      row.innerHTML = `
        <div class="todoRow__text" style="text-decoration: line-through; opacity:.8;">${t.text}</div>
        <div class="todoRow__actions">
          <button class="btn btn--sm btn--ghost" type="button" aria-label="恢复">恢复</button>
          <button class="btn btn--sm btn--danger" type="button" aria-label="删除">删除</button>
        </div>
      `.trim();
      const [btnBack, btnDel] = row.querySelectorAll('button');
      btnBack.addEventListener('click', () => {
        setTodos(toggleDone(getTodos(), t.id));
        render();
      });
      btnDel.addEventListener('click', () => {
        setTodos(removeTodo(getTodos(), t.id));
        render();
      });
      list2.appendChild(row);
    }
    sec2.appendChild(list2);

    columns.appendChild(sec1);
    columns.appendChild(sec2);

    // 2-col on wide
    if (window.matchMedia('(min-width: 720px)').matches) {
      columns.style.gridTemplateColumns = '1fr 1fr';
    } else {
      columns.style.gridTemplateColumns = '1fr';
    }
  };

  const clearBtn = header.querySelector('#clearDone');
  clearBtn.addEventListener('click', () => {
    setTodos(clearDone(getTodos()));
    render();
  });

  window.addEventListener('resize', () => render());
  render();
  return root;
}

async function main() {
  try {
    const config = await fetchConfig();

    const drawer = createDrawer();

    const bookmarks = normalizeBookmarks(config);

    applySiteMeta(config);
    applyFooterHomeText(config);
    renderProfileCard(config);

    renderAccountsTop(config, { max: 6 });
    renderBookmarksTop(bookmarks, { 
      max: 8,
      onCategoryClick: (cat) => {
        drawer.open({ 
          title: `${cat.icon || '📁'} ${cat.title || '书签'}`, 
          content: buildCategoryDrawerContent(cat) 
        });
      }
    });

    initClock(config?.extras);

    // recent stays as a secondary persistence; no primary UI here for now
    const { addRecent } = initRecent(config?.extras);
    wireExternalClickTracking(addRecent);

    // TODOS
    let todos = loadTodos();
    const getTodos = () => todos;
    const setTodos = (next) => {
      todos = next;
      saveTodos(todos);
      renderTodoTop(document.getElementById('todoTop'), todos, {
        max: config?.todos?.settings?.showTopN || 5,
        onToggle: (id) => {
          setTodos(toggleDone(getTodos(), id));
        }
      });
    };
    setTodos(todos);

    // SEARCH (needs todos/bookmarks for site search)
    renderSearchEngines(config);
    // add built-in site search option (UI text in Chinese)
    const engineSelect = document.getElementById('engineSelect');
    if (engineSelect && !Array.from(engineSelect.options).some((o) => o.value === 'site')) {
      const opt = document.createElement('option');
      opt.value = 'site';
      opt.textContent = '站内';
      engineSelect.appendChild(opt);
    }
    initSearch(config, { drawer, getTodos, setTodos, bookmarks });
    initSearchHotkeys();

    const todoInput = document.getElementById('todoInput');
    todoInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = todoInput.value;
        todoInput.value = '';
        setTodos(addTodo(getTodos(), text));
      }
    });

    // PHOTOS - 从所有照片中随机选取3张显示在一级菜单
    const allPhotos = collectAllPhotos(config);
    
    // 随机选取3张照片
    const getRandomPhotos = (photos, count) => {
      if (photos.length <= count) return [...photos];
      const shuffled = [...photos].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    };
    const featuredPhotos = getRandomPhotos(allPhotos, 3);
    
    renderPhotoThumbs(document.getElementById('photosFeatured'), featuredPhotos, {
      showCaption: false,
      onOpen: (p) => {
        // 找到这张照片在所有照片中的索引
        const index = findPhotoIndex(allPhotos, p.src);
        drawer.open({ 
          title: 'Photography', 
          content: buildPhotosDrawerContent(config, { initialIndex: index >= 0 ? index : 0 }) 
        });
      }
    });

    initWallpaper(config);

    const openSearch = () => {
      const searchPanel = buildSearchDrawerContent(config, { drawer, getTodos, setTodos, bookmarks });
      drawer.open({ title: 'Search', content: searchPanel.root, variant: 'compact' });
      requestAnimationFrame(() => searchPanel.input.focus());
    };
    const openAccounts = () => {
      drawer.open({ title: 'Accounts', content: buildAccountsDrawerContent(config) });
    };
    const openBookmarks = () => {
      drawer.open({ title: 'Bookmarks', content: buildBookmarksDrawerContent(bookmarks) });
    };
    const openTodos = () => {
      drawer.open({ title: 'Todos', content: buildTodosDrawerContent(getTodos, setTodos) });
    };
    const openPhotos = () => {
      drawer.open({ title: 'Photography', content: buildPhotosDrawerContent(config, { initialIndex: 0 }) });
    };

    // Drawer openers shared by panel mode and desktop Dock.
    document.getElementById('openAccounts')?.addEventListener('click', openAccounts);
    document.getElementById('openBookmarks')?.addEventListener('click', openBookmarks);
    document.getElementById('openTodos')?.addEventListener('click', openTodos);
    document.getElementById('openPhotos')?.addEventListener('click', openPhotos);

    initDesktopMode({
      drawer,
      openSearch,
      openAccounts,
      openBookmarks,
      openTodos,
      openPhotos
    });

    // hide error panel if previously shown
    setPanelVisible('errorPanel', false);
  } catch (err) {
    const msg = '无法加载 ./data/config.json';
    showError(msg, String(err?.stack || err));

    // no-op: keep primary dashboard, but显示错误
  }
}

main();
