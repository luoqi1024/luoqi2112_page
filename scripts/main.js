import { applyFooterHomeText, applySiteMeta, renderAccountsTop, renderBookmarksTop, renderProfileCard, renderTodoTop, setPanelVisible, showError } from './render.js?v=20260930-photos4';
import { WallpaperRotator } from './wallpaper.js?v=20260930-photos4';
import { readJson, upsertRecent, writeJson } from './storage.js?v=20260930-photos4';
import { createDrawer } from './drawer.js?v=20260930-photos4';
import { normalizeBookmarks, searchBookmarks, trackBookmarkClick } from './bookmarks.js?v=20260930-photos4';
import { addTodo, clearDone, loadTodos, removeTodo, saveTodos, splitTodos, toggleDone } from './todo.js?v=20260930-photos4';
import { initCommandPalette } from './commandPalette.js?v=20260930-photos4';
import { initHomeMoments } from './homeMoments.js?v=20260930-photos4';
import { initNowBar } from './nowBar.js?v=20260930-photos4';
import { initDesktopMode } from './desktop.js?v=20260930-photos4';
import { initWeather } from './weather.js?v=20260930-photos4';
import { initMusic } from './music.js?v=20260930-photos4';

async function fetchConfig() {
  const url = './data/config.json';
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function responsivePhotoSource(src, width) {
  const value = String(src || '');
  const match = value.match(/^(.*\/)?([^/?#]+)\.webp([?#].*)?$/i);
  if (!match || value.includes('/responsive/')) return value;
  return `${match[1] || ''}responsive/${match[2]}-${width}.webp${match[3] || ''}`;
}

function initPhotoJournal(config) {
  const journal = config?.photos?.journal || {};
  const cover = document.getElementById('photoJournalCover');
  const storyLink = document.getElementById('photoJournalStoryLink');
  const masthead = document.getElementById('photoJournalMasthead');
  const name = document.getElementById('photoJournalName');
  const issue = document.getElementById('photoJournalIssue');
  const kicker = document.getElementById('photoJournalKicker');
  const title = document.getElementById('photoJournalTitle');
  const meta = document.getElementById('photoJournalMeta');

  if (!cover || !storyLink || !masthead || !name || !issue || !kicker || !title || !meta) {
    return;
  }

  const coverSrc = String(journal.cover || cover.getAttribute('src') || '');
  cover.src = responsivePhotoSource(coverSrc, 1280);
  cover.srcset = `${responsivePhotoSource(coverSrc, 640)} 640w, ${responsivePhotoSource(coverSrc, 1280)} 1280w`;
  cover.sizes = '(max-width: 900px) 100vw, 50vw';
  masthead.textContent = String(journal.masthead || masthead.textContent);
  name.textContent = String(journal.name || name.textContent);
  issue.textContent = String(journal.issue || issue.textContent);
  kicker.textContent = String(journal.kicker || kicker.textContent);
  title.textContent = String(journal.title || title.textContent);
  meta.textContent = String(journal.meta || meta.textContent);
  storyLink.href = String(journal.storyUrl || './photos/');
  storyLink.setAttribute(
    'aria-label',
    String(journal.storyLabel || `阅读本期摄影故事：${title.textContent}`)
  );
  const sheet = Array.isArray(journal.contactSheet) && journal.contactSheet.length ? journal.contactSheet : [coverSrc];
  for (const src of sheet.slice(0,4)) {
    const image = new Image();
    image.alt = '';
    image.src = responsivePhotoSource(src,640);
    document.getElementById('contactSheet').append(image);
  }
  document.getElementById('journalExif').textContent = journal.exif || '';
  const card = cover.closest('.viewfinder');
  const frame = card.querySelector('.viewfinder__focus');
  const motion = matchMedia('(hover:hover) and (prefers-reduced-motion:no-preference)');
  const reset = () => { frame.style.transform = ''; cover.style.transform = ''; };
  motion.addEventListener('change',reset);
  card.addEventListener('pointerleave',reset);
  card.addEventListener('pointermove',event => {
    if (!motion.matches) return;
    const rect = card.getBoundingClientRect();
    const x = Math.max(27, Math.min(rect.width-27,event.clientX-rect.left));
    const y = Math.max(19, Math.min(rect.height*.7,event.clientY-rect.top));
    frame.style.transform = 'translate(' + (x-rect.width*.5) + 'px,' + (y-rect.height*.44) + 'px)';
    cover.style.transform = 'translate(' + (0.5-x/rect.width)*14 + 'px,' + (0.5-y/rect.height)*14 + 'px)';
  });
}

function initRecent(extras) {
  return {
    addRecent(entry) {
      if (!extras?.showRecent) return;
      const max = Number(extras.recentMaxItems) || 8;
      writeJson('recent',upsertRecent(readJson('recent',[]),entry,max));
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

function buildDrawerTile(item, { bookmark = false } = {}) {
  const a = document.createElement('a');
  a.className = 'tile external';
  a.href = item.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.setAttribute('data-recent-name', item.name);
  a.setAttribute('data-recent-url', item.url);
  if (bookmark) a.setAttribute('data-bookmark-url', item.url);
  a.setAttribute('aria-label', `打开 ${item.name}`);

  const left = document.createElement('div');
  left.className = 'tile__left';
  const icon = document.createElement('div');
  icon.className = 'tile__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = item.icon || '🔗';
  const name = document.createElement('div');
  name.className = 'tile__name';
  name.textContent = item.name || '';
  left.appendChild(icon);
  left.appendChild(name);

  const meta = document.createElement('div');
  meta.className = 'tile__meta';
  meta.textContent = bookmark ? (item.tags || [])[0] || '' : item.note || '';
  a.appendChild(left);
  a.appendChild(meta);
  if (!bookmark && typeof item.url === 'string' && item.url.startsWith('mailto:')) a.removeAttribute('rel');
  return a;
}

function buildDrawerSectionHeader(category, countText) {
  const header = document.createElement('div');
  header.className = 'drawerSection__hd';
  const title = document.createElement('div');
  title.className = 'drawerSection__title';
  title.textContent = `${category.icon || '📁'} ${category.title || ''}`;
  const count = document.createElement('div');
  count.className = 'muted';
  count.textContent = countText;
  header.appendChild(title);
  header.appendChild(count);
  return header;
}

function buildAccountsDrawerContent(config) {
  const root = document.createElement('div');
  const list = (config?.profiles || [])
    .slice()
    .sort((a, b) => (a.topRank ?? 999) - (b.topRank ?? 999));

  const grid = document.createElement('div');
  grid.className = 'grid grid--accounts';
  for (const p of list) {
    grid.appendChild(buildDrawerTile(p));
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
      section.appendChild(buildDrawerSectionHeader(c, String((c.items || []).length)));
      const grid = document.createElement('div');
      grid.className = 'grid';
      for (const it of (c.items || [])) {
        grid.appendChild(buildDrawerTile(it, { bookmark: true }));
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
      <button id="clearDone" class="btn btn--sm btn--danger" type="button" aria-label="清空已完成">git gc · 清空已完成</button>
    </div>
  `.trim();
  root.appendChild(header);

  const columns = document.createElement('div');
  columns.className = 'grid grid--todoColumns';
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
        <div class="todoRow__text"></div>
        <div class="todoRow__actions">
          <button class="btn btn--sm btn--ghost" type="button" aria-label="完成">完成</button>
          <button class="btn btn--sm btn--danger" type="button" aria-label="删除">删除</button>
        </div>
      `.trim();
      row.querySelector('.todoRow__text').textContent = t.text;
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
        <div class="todoRow__text" style="text-decoration: line-through; opacity:.8;"></div>
        <div class="todoRow__actions">
          <button class="btn btn--sm btn--ghost" type="button" aria-label="恢复">恢复</button>
          <button class="btn btn--sm btn--danger" type="button" aria-label="删除">删除</button>
        </div>
      `.trim();
      row.querySelector('.todoRow__text').textContent = t.text;
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
  };

  const clearBtn = header.querySelector('#clearDone');
  clearBtn.addEventListener('click', () => {
    setTodos(clearDone(getTodos()));
    render();
  });

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
    renderBookmarksTop(bookmarks);

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

    const todoInput = document.getElementById('todoInput');
    todoInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        const text = todoInput.value;
        todoInput.value = '';
        setTodos(addTodo(getTodos(), text));
      }
    });

    initPhotoJournal(config);

    const rotator = initWallpaper(config);
    const music = initMusic(config.music);
    initNowBar(config,music);
    initWeather(config.weather);
    const loadMoments = initHomeMoments();
    const mainPanel = document.getElementById('main');
    const desktop = document.getElementById('desktopWorkspace');
    const credit = document.getElementById('focusCredit');
    const focusButton = document.getElementById('focusButton');
    let focusReturn;
    function setImmersed(active) {
      if (active) focusReturn = document.activeElement;
      document.body.classList.toggle('is-immersed',active);
      mainPanel.inert = active;
      desktop.inert = active;
      credit.hidden = !active;
      if (active) credit.focus({preventScroll:true});
      else (focusReturn?.closest('dialog') ? focusButton : focusReturn)?.focus({preventScroll:true});
    }
    focusButton.onclick = () => setImmersed(true);
    credit.onclick = () => setImmersed(false);

    const commands = {
      todo:text => setTodos(addTodo(getTodos(),text)),
      'wp next':() => rotator.next(), 'wp prev':() => rotator.prev(),
      'wp pause':() => { if (!rotator.paused) document.getElementById('desktopWpToggle').click(); },
      focus:() => setImmersed(true),
      photos:() => location.assign('./photos/'), moments:() => location.assign('./moments/'),
      blog:() => document.getElementById('blogLink').click(), github:() => document.getElementById('githubLink').click()
    };
    if (music?.hasTracks) Object.assign(commands,{play:music.play,pause:music.pause,next:music.next,prev:music.prev});
    const desktopMedia = matchMedia('(min-width:900px)');
    const syncDesktopCommand = () => {
      if (desktopMedia.matches) commands.desktop = () => document.getElementById('enterDesktopMode').click();
      else delete commands.desktop;
    };
    syncDesktopCommand();
    desktopMedia.addEventListener('change',syncDesktopCommand);

    const starMessage = '2112 — 从未来寄来的问候';
    let eggTimer;
    function egg(code) {
      const logo = document.querySelector('.now__logo');
      const player = document.getElementById('nowMusic');
      const toast = document.getElementById('homeToast');
      if (code === '2112') {
        logo.classList.add('is-star');
        toast.textContent = starMessage;
      } else if (music?.playByMatch?.('結束バンド')) player.classList.add('encore');
      window.clearTimeout(eggTimer);
      eggTimer = window.setTimeout(() => {
        toast.textContent = '';
        logo.classList.remove('is-star');
        player.classList.remove('encore');
      },3000);
    }
    const openSearch = initCommandPalette({config,bookmarks,getTodos,commands,addRecent,loadMoments,egg,
      toggleTodo:id => setTodos(toggleDone(getTodos(),id))
    });
    // Capture before the desktop shortcut handler, including while editing inside the dialog.
    window.addEventListener('keydown',event => {
      if (event.isComposing || event.altKey) return;
      const key = event.key.toLowerCase();
      const commandK = (event.ctrlKey || event.metaKey) && key === 'k';
      const editing = event.target.closest?.('input,textarea,select,[contenteditable=true]');
      if (document.getElementById('commandPalette').open) {
        if (key === '/' || commandK) { event.stopImmediatePropagation(); if (commandK) event.preventDefault(); }
        return;
      }
      if (!credit.hidden) {
        if (['escape','f','arrowleft','arrowright'].includes(key)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (key === 'arrowleft') rotator.prev();
          else if (key === 'arrowright') rotator.next();
          else setImmersed(false);
        }
        return;
      }
      if (editing && key === '/') { event.stopImmediatePropagation(); return; }
      if (drawer.isOpen || (!commandK && (event.metaKey || event.ctrlKey || editing))) return;
      if (commandK || key === '/' || key === 'f') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (key === 'f') setImmersed(true);
        else openSearch();
      }
    },true);
    console.info('[ luoqi2112 ]\n// 写代码，也拍照。欢迎来看源码 → ' + config.site.githubUrl);
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
      window.location.assign('./photos/');
    };

    // Drawer openers shared by panel mode and desktop Dock.
    document.getElementById('openAccounts')?.addEventListener('click', openAccounts);
    document.getElementById('openBookmarks')?.addEventListener('click', openBookmarks);
    document.getElementById('openTodos')?.addEventListener('click', openTodos);

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
