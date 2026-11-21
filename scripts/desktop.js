import { readJson, writeJson } from './storage.js?v=20261121-moments-art-r2';

const MODE_KEY = 'layoutMode';
const DESKTOP_LAYOUT_KEY = 'desktopLayout';
const DESKTOP_QUERY = '(min-width: 900px)';
const DESKTOP_LAYOUTS = new Set(['popover', 'widgets']);

export function initDesktopMode({
  drawer,
  openSearch,
  openAccounts,
  openBookmarks,
  openTodos,
  openPhotos
} = {}) {
  const main = document.getElementById('main');
  const workspace = document.getElementById('desktopWorkspace');
  const enterButton = document.getElementById('enterDesktopMode');
  const wallpaperButton = document.getElementById('desktopWallpaperButton');
  const wallpaperControls = document.getElementById('desktopWallpaperControls');
  const layoutButton = document.getElementById('desktopLayoutButton');
  const layoutMenu = document.getElementById('desktopLayoutMenu');
  const widgetTime = document.getElementById('desktopWidgetTime');
  const widgetDate = document.getElementById('desktopWidgetDate');
  const desktopMedia = window.matchMedia(DESKTOP_QUERY);

  if (
    !main ||
    !workspace ||
    !enterButton ||
    !wallpaperButton ||
    !wallpaperControls ||
    !layoutButton ||
    !layoutMenu
  ) {
    return null;
  }

  let preferredMode = readJson(MODE_KEY, 'panel') === 'desktop' ? 'desktop' : 'panel';
  const savedDesktopLayout = readJson(DESKTOP_LAYOUT_KEY, 'popover');
  let desktopLayout = DESKTOP_LAYOUTS.has(savedDesktopLayout) ? savedDesktopLayout : 'popover';
  const exitButton = document.getElementById('desktopExitButton');
  const palette = document.getElementById('commandPalette');
  const drawerElement = document.getElementById('drawer');
  const drawerOverlay = document.getElementById('drawerOverlay');
  let idleTimer;

  const canDim = () => document.body.classList.contains('is-desktop') &&
    !document.hidden && layoutMenu.hidden && !palette?.open && !drawer?.isOpen &&
    (desktopLayout === 'widgets' || wallpaperControls.hidden);

  function wakeControls() {
    window.clearTimeout(idleTimer);
    workspace.classList.remove('is-idle');
    if (canDim()) {
      idleTimer = window.setTimeout(() => {
        if (canDim()) workspace.classList.add('is-idle');
      }, 15000);
    }
  }

  const onActivity = () => {
    if (document.body.classList.contains('is-desktop')) wakeControls();
  };
  for (const event of ['pointermove', 'pointerdown', 'wheel', 'keydown', 'focusin']) {
    window.addEventListener(event, onActivity, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', onActivity);
  const overlays = new MutationObserver(onActivity);
  for (const element of [layoutMenu, wallpaperControls, palette, drawerElement]) {
    if (element) overlays.observe(element, { attributes: true, attributeFilter: ['hidden', 'open'] });
  }

  // The wallpaper module supplies either an index/total or the photographer's credit.
  const meta = document.getElementById('desktopWallpaperMeta');
  const kind = document.getElementById('desktopWallpaperKind');
  const position = document.getElementById('desktopWallpaperPosition');
  function updateWallpaperLabel() {
    const source = meta.textContent.trim();
    const isVideo = /video/i.test(source);
    const label = source.replace(/\s*·\s*video$/i, '');
    const count = /^(\d+)\s*\/\s*(\d+)$/.exec(label);
    kind.textContent = isVideo ? 'VIDEO' : 'IMAGE';
    position.textContent = count ? count.slice(1).map((n) => n.padStart(2, '0')).join(' / ') : label;
    position.title = label;
  }
  new MutationObserver(updateWallpaperLabel).observe(meta, { childList: true, characterData: true, subtree: true });
  updateWallpaperLabel();

  const closeWallpaperControls = () => {
    wallpaperControls.hidden = true;
    wallpaperButton.setAttribute('aria-expanded', 'false');
  };

  const closeLayoutMenu = () => {
    layoutMenu.hidden = true;
    layoutButton.setAttribute('aria-expanded', 'false');
  };

  const syncLayoutSelection = () => {
    document.body.dataset.desktopLayout = desktopLayout;
    layoutMenu.querySelectorAll('[data-layout-choice]').forEach((item) => {
      const choice = item.getAttribute('data-layout-choice');
      if (choice === 'panel') return;
      item.setAttribute('aria-checked', String(choice === desktopLayout));
    });
  };

  const updateAnchors = () => {
    if (!document.body.classList.contains('is-desktop')) return;
    const bounds = workspace.getBoundingClientRect();
    const centerOf = button => {
      const rect = button.getBoundingClientRect();
      return rect.left + rect.width / 2 - bounds.left;
    };
    workspace.style.setProperty('--desktop-wallpaper-anchor-x', `${centerOf(wallpaperButton)}px`);
    if (!layoutMenu.hidden) {
      const layoutCenter = centerOf(layoutButton);
      const halfWidth = layoutMenu.offsetWidth / 2;
      const rightLimit = bounds.width - halfWidth - 16;
      const center = Math.max(halfWidth + 16, Math.min(layoutCenter + halfWidth - 52, rightLimit));
      workspace.style.setProperty('--desktop-layout-anchor-x', `${center}px`);
      layoutMenu.style.setProperty('--view-tip-x', `${layoutCenter - center + halfWidth}px`);
    }
  };

  const setDesktopLayout = (layout) => {
    const nextLayout = DESKTOP_LAYOUTS.has(layout) ? layout : 'popover';
    desktopLayout = nextLayout;
    writeJson(DESKTOP_LAYOUT_KEY, desktopLayout);
    syncLayoutSelection();
    closeLayoutMenu();
    closeWallpaperControls();
    if (desktopLayout === 'widgets' && document.body.classList.contains('is-desktop')) {
      wallpaperControls.hidden = false;
      wallpaperButton.setAttribute('aria-expanded', 'true');
    }
    updateAnchors();
  };

  const applyMode = () => {
    const desktopActive = preferredMode === 'desktop' && desktopMedia.matches;
    // Share a stacking context so the drawer covers the widgets but stays below the Dock.
    const drawerHost = desktopActive ? workspace : document.body;
    const focusedControl = drawerElement.contains(document.activeElement) ? document.activeElement : null;
    if (drawerElement.parentElement !== drawerHost) {
      drawerHost.append(drawerOverlay, drawerElement);
      drawerElement.setAttribute('aria-modal', String(!desktopActive));
    }
    document.body.classList.toggle('is-desktop', desktopActive);
    main.setAttribute('aria-hidden', String(desktopActive));
    workspace.setAttribute('aria-hidden', String(!desktopActive));
    focusedControl?.focus({ preventScroll: true });
    syncLayoutSelection();
    closeLayoutMenu();
    closeWallpaperControls();
    if (desktopActive && desktopLayout === 'widgets') {
      wallpaperControls.hidden = false;
      wallpaperButton.setAttribute('aria-expanded', 'true');
    }
    updateAnchors();
    wakeControls();
  };

  const setMode = (mode) => {
    preferredMode = mode === 'desktop' ? 'desktop' : 'panel';
    writeJson(MODE_KEY, preferredMode);
    if (preferredMode === 'panel') drawer?.close?.();
    applyMode();
    (mode === 'panel' ? enterButton : exitButton).focus({ preventScroll: true });
  };

  const openFromDock = (callback) => {
    if (desktopLayout === 'popover') closeWallpaperControls();
    closeLayoutMenu();
    callback?.();
  };

  const updateWidgetClock = () => {
    if (!widgetTime || !widgetDate) return;
    const now = new Date();
    widgetTime.textContent = now.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    widgetDate.textContent = now.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  enterButton.addEventListener('click', () => setMode('desktop'));
  exitButton.addEventListener('click', () => setMode('panel'));

  workspace.addEventListener('click', (event) => {
    const layoutChoice = event.target?.closest?.('[data-layout-choice]');
    if (layoutChoice) {
      const choice = layoutChoice.getAttribute('data-layout-choice');
      if (choice === 'panel') {
        setMode('panel');
      } else {
        setDesktopLayout(choice);
        layoutButton.focus({ preventScroll: true });
      }
      return;
    }

    const button = event.target?.closest?.('[data-desktop-action]');
    if (!button) return;

    const action = button.getAttribute('data-desktop-action');
    if (button.getAttribute('aria-controls') === 'drawer') {
      button.focus({ preventScroll: true });
      if (button.getAttribute('aria-expanded') === 'true') {
        openFromDock(drawer.close);
        return;
      }
    }
    if (drawer?.isOpen && ['search', 'wallpaper'].includes(action)) {
      drawer.close();
      button.focus({ preventScroll: true });
    }
    if (action === 'search') openFromDock(openSearch);
    if (action === 'accounts') openFromDock(openAccounts);
    if (action === 'bookmarks') openFromDock(openBookmarks);
    if (action === 'todos') openFromDock(openTodos);
    if (action === 'photos') openFromDock(openPhotos);
    if (action === 'moments') window.location.assign('./moments/');
    if (action === 'wallpaper') {
      closeLayoutMenu();
      const nextOpen = wallpaperControls.hidden;
      wallpaperControls.hidden = !nextOpen;
      wallpaperButton.setAttribute('aria-expanded', String(nextOpen));
      if (nextOpen) updateAnchors();
    }
    if (action === 'layout') {
      if (desktopLayout === 'popover') closeWallpaperControls();
      const nextOpen = layoutMenu.hidden;
      layoutMenu.hidden = !nextOpen;
      layoutButton.setAttribute('aria-expanded', String(nextOpen));
      if (nextOpen) {
        updateAnchors();
        layoutMenu.querySelector('[aria-checked="true"]')?.focus();
      }
    }
  });

  layoutMenu.addEventListener('keydown', event => {
    const choices = [...layoutMenu.querySelectorAll('[data-layout-choice]')];
    const index = choices.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeLayoutMenu();
      layoutButton.focus();
      return;
    }
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    choices[(index + step + choices.length) % choices.length].focus();
  });

  document.addEventListener('pointerdown', (event) => {
    if (
      !layoutMenu.hidden &&
      !layoutMenu.contains(event.target) &&
      !layoutButton.contains(event.target)
    ) {
      closeLayoutMenu();
    }
    if (
      desktopLayout === 'popover' &&
      !wallpaperControls.hidden &&
      !wallpaperControls.contains(event.target) &&
      !wallpaperButton.contains(event.target)
    ) {
      closeWallpaperControls();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (!document.body.classList.contains('is-desktop')) return;

    const isMac = navigator.platform.toLowerCase().includes('mac');
    const commandK = (isMac ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === 'k';
    if ((event.key === '/' || commandK) && !drawer?.isOpen) {
      event.preventDefault();
      openFromDock(openSearch);
      return;
    }
    if (event.key === 'Escape') {
      if (desktopLayout === 'popover') closeWallpaperControls();
      closeLayoutMenu();
    }
  });

  desktopMedia.addEventListener('change', applyMode);
  window.addEventListener('resize', updateAnchors);
  updateWidgetClock();
  window.setInterval(updateWidgetClock, 1000);
  applyMode();

  return {
    setMode,
    setDesktopLayout,
    get mode() {
      return document.body.classList.contains('is-desktop') ? 'desktop' : 'panel';
    },
    get desktopLayout() {
      return desktopLayout;
    }
  };
}
