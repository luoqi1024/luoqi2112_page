import { applyFooterHomeText, applySiteMeta, renderAccountsTop, renderBookmarksTop, renderProfileCard, renderTodoTop, setPanelVisible, showError } from './render.js?v=20261121-photo-art';
import { WallpaperRotator } from './wallpaper.js?v=20261121-photo-art';
import { readJson, upsertRecent, writeJson } from './storage.js?v=20261121-photo-art';
import { createDrawer } from './drawer.js?v=20261121-photo-art';
import { normalizeBookmarks, trackBookmarkClick } from './bookmarks.js?v=20261121-photo-art';
import { addTodo, clearDone, loadTodos, removeTodo, saveTodos, splitTodos, toggleDone } from './todo.js?v=20261121-photo-art';
import { initCommandPalette } from './commandPalette.js?v=20261121-photo-art';
import { initHomeMoments } from './homeMoments.js?v=20261121-photo-art';
import { initNowBar } from './nowBar.js?v=20261121-photo-art';
import { initDesktopMode } from './desktop.js?v=20261121-photo-art';
import { initWeather } from './weather.js?v=20261121-photo-art';
import { initMusic } from './music.js?v=20261121-photo-art';

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

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const serial = n => String(n).padStart(2, '0');

function displayAddress(value) {
  try {
    const url = new URL(value, location.href);
    if (url.protocol === 'mailto:') return url.pathname;
    if (url.origin === location.origin) return url.pathname;
    return url.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function buildDrawerTile(item, { bookmark = false, index, icon, category } = {}) {
  const link = element('a', (bookmark ? 'bmCard' : 'accCard') + ' external');
  link.href = item.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.dataset.recentName = item.name;
  link.dataset.recentUrl = item.url;
  if (bookmark) link.dataset.bookmarkUrl = item.url;

  const glyph = element('span', bookmark ? 'bmCard__glyph' : 'accCard__avatar', item.icon || icon || '↗');
  glyph.setAttribute('aria-hidden', 'true');
  const address = displayAddress(item.url);
  const info = element('div', 'bmCard__info');
  const top = element('div', bookmark ? 'bmCard__top' : 'accCard__title');
  top.append(element('span', 'bmCard__idx', serial(index)), element('strong', 'bmCard__name', item.name));
  info.append(top);
  if (!bookmark && item.note) info.append(element('span', 'accCard__note', item.note));
  info.append(element('span', bookmark ? 'bmCard__domain' : 'accCard__url', address));
  const right = element('div', 'bmCard__right');
  if (bookmark) {
    right.append(element('span', 'bmCard__tag', item.tags?.[0] || category));
  }
  right.append(element('span', bookmark ? 'bmCard__arrow' : 'accCard__cta',
    bookmark ? '↗' : item.url.startsWith('mailto:') ? '写邮件 ↗' : '打开 ↗'));
  link.title = item.name + ' · ' + address;
  link.append(glyph, info, right);
  return link;
}

function buildAccountsDrawerContent(config) {
  const grid = element('div', 'accGrid');
  const profiles = [...(config.profiles || [])].sort((a, b) => (a.topRank ?? 999) - (b.topRank ?? 999));
  profiles.forEach((profile, i) => grid.append(buildDrawerTile(profile, { index: i + 1 })));
  return grid;
}

function sectionHeading(number, title, count) {
  const heading = element('h3', 'catGroup__hd');
  heading.append(element('span', 'catGroup__num', number), element('span', 'catGroup__title', title),
    element('span', 'catGroup__line'), element('span', 'catGroup__meta', count));
  return heading;
}

function buildBookmarksDrawerContent(categories) {
  const root = element('div', 'bookmarkGallery');
  const bar = element('div', 'bmBar');
  bar.innerHTML = `<label class="glassSearch">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"></circle><path d="m15 15 5 5"></path></svg>
    <input id="bookmarkFilter" type="search" data-autofocus aria-label="搜索收藏" placeholder="筛选名称、域名或标签…">
  </label>`;
  const input = bar.querySelector('input');
  const tabs = element('div', 'segTabs');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', '书签分类');
  const groups = element('div', 'galleryGroups');
  let selected = null;
  const filters = [{ id: null, title: '全部馆藏', count: categories.reduce((n, c) => n + c.items.length, 0) },
    ...categories.map(c => ({ ...c, count: c.items.length }))];
  for (const category of filters) {
    const tab = element('button', 'segTab', category.title);
    tab.type = 'button';
    if (category.icon) {
      const icon = element('span', '', category.icon);
      icon.setAttribute('aria-hidden', 'true');
      tab.prepend(icon);
    }
    tab.append(element('small', '', serial(category.count)));
    tab.setAttribute('aria-pressed', String(category.id === selected));
    tab.addEventListener('click', () => {
      selected = category.id;
      for (const button of tabs.children) button.setAttribute('aria-pressed', String(button === tab));
      render();
    });
    tabs.append(tab);
  }

  function render() {
    const query = input.value.trim().toLowerCase();
    const sections = [];
    let index = 0;
    categories.forEach((category, i) => {
      const grid = element('div', 'bmGrid');
      for (const item of category.items) {
        index++;
        if (selected !== null && selected !== category.id) continue;
        const fields = [item.name, displayAddress(item.url), ...(item.tags || [])];
        if (query && !fields.some(value => String(value).toLowerCase().includes(query))) continue;
        grid.append(buildDrawerTile(item, { bookmark: true, index, icon: category.icon, category: category.title }));
      }
      if (!grid.childElementCount) return;
      const section = element('section', 'catGroup');
      section.append(sectionHeading(serial(i + 1), category.title, serial(grid.childElementCount) + ' BOOKMARKS'), grid);
      sections.push(section);
    });
    groups.replaceChildren(...sections);
    if (!sections.length) groups.append(element('p', 'galleryEmpty', '没有匹配的书签'));
  }
  input.addEventListener('input', render);
  bar.append(tabs);
  root.append(bar, groups);
  render();
  return root;
}

function buildTodosDrawerContent(getTodos, setTodos, setBadge) {
  const root = element('div', 'todoGallery');
  root.innerHTML = `<div class="todoBar"><form class="commitInput">
    <label class="commitInput__branch" for="drawerTodoInput">+ commit -m</label>
    <input id="drawerTodoInput" data-autofocus aria-label="新增待办" autocomplete="off" placeholder="写下新的待办事项…">
    <button class="commitInput__kbd" type="submit" aria-label="添加待办">↵ Enter</button>
    </form><button id="clearDone" class="gcBtn" type="button"></button></div>
    <div class="todoBoard"></div>`;
  const form = root.querySelector('form');
  const input = form.querySelector('input');
  const clear = root.querySelector('#clearDone');
  const board = root.querySelector('.todoBoard');
  const dateFormat = new Intl.DateTimeFormat('zh-CN', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
  function render() {
    const { undone, done } = splitTodos(getTodos());
    setBadge('● branch: main · ' + undone.length + ' OPEN');
    clear.textContent = 'git gc · 清理已合并 (' + done.length + ')';
    clear.disabled = !done.length;
    board.replaceChildren();
    for (const [merged, items] of [[false, undone], [true, done]]) {
      const column = element('section');
      column.append(sectionHeading(merged ? 'MERGED' : 'OPEN', merged ? '已归档记录' : '待合并提交', serial(items.length)));
      const timeline = element('div', merged ? 'timeline timeline--done' : 'timeline');
      for (const item of items) {
        let hash = 0;
        for (const char of String(item.id)) hash = Math.imul(hash, 31) + char.charCodeAt(0);
        const card = element('div', merged ? 'nodeCard done' : 'nodeCard');
        const body = element('div', 'nodeCard__body');
        const timestamp = merged ? item.doneAt : item.createdAt;
        const stamp = timestamp && Number.isFinite(new Date(timestamp).getTime()) ? dateFormat.format(timestamp) : '';
        body.append(element('div', 'nodeCard__title', item.text),
          element('div', 'nodeCard__meta', [stamp, merged ? '✓ merged into main' : 'working tree'].filter(Boolean).join(' · ')));
        const actions = element('div', 'nodeCard__acts');
        for (const [action, label, caption] of [
          ['toggle', merged ? '恢复' : '完成', merged ? '↺ revert' : '✓ merge'], ['delete', '删除', '✕']
        ]) {
          const button = element('button', 'pillAct ' + (action === 'delete' ? 'pillAct--del' : 'pillAct--merge'), caption);
          button.type = 'button';
          button.dataset.id = item.id;
          button.dataset.action = action;
          button.setAttribute('aria-label', label + '「' + item.text + '」');
          button.title = label;
          actions.append(button);
        }
        card.append(element('code', 'nodeCard__hash', (hash >>> 0).toString(16).padStart(6, '0').slice(-6)), body, actions);
        timeline.append(card);
      }
      if (!items.length) timeline.append(element('p', 'galleryEmpty', merged ? '暂无已完成事项' : '暂无待办事项'));
      column.append(timeline);
      board.append(column);
    }
  }
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.isComposing || event.keyCode === 229)) event.preventDefault();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!input.value.trim()) return;
    setTodos(addTodo(getTodos(), input.value));
    input.value = '';
    render();
    input.focus();
  });
  board.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { id, action } = button.dataset;
    setTodos(action === 'toggle' ? toggleDone(getTodos(), id) : removeTodo(getTodos(), id));
    render();
    const next = [...board.querySelectorAll('[data-action="toggle"]')].find(el => el.dataset.id === id);
    (next || input).focus({ preventScroll: true });
  });
  clear.addEventListener('click', () => {
    setTodos(clearDone(getTodos()));
    render();
    input.focus();
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
      drawer.open({
        key: 'accounts', kicker: 'COLLECTION 01 · DIGITAL IDENTITIES', title: '数字身份与联络处',
        subtitle: '散落在互联网各处的坐标与信箱',
        badge: config.profile.handle + ' · ' + serial(config.profiles.length) + ' PROFILES',
        content: buildAccountsDrawerContent(config)
      });
    };
    const openBookmarks = () => {
      const categories = bookmarks.categories;
      const total = categories.reduce((n, category) => n + category.items.length, 0);
      drawer.open({
        key: 'bookmarks', kicker: 'COLLECTION 02 · CURATED LINKS', title: '书签与灵感馆藏',
        subtitle: '常用工具、技术文档与日常去处',
        badge: serial(categories.length) + ' SECTIONS · ' + serial(total) + ' ITEMS',
        content: buildBookmarksDrawerContent(categories)
      });
    };
    const openTodos = () => {
      drawer.open({
        key: 'todos', kicker: 'COLLECTION 03 · GIT COMMIT LOG', title: '待办与提交记录',
        subtitle: '把每一件小事当作一次向生活的 Commit',
        badge: '● branch: main · ' + splitTodos(getTodos()).undone.length + ' OPEN',
        content: buildTodosDrawerContent(getTodos, setTodos, drawer.setBadge)
      });
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
