import { readJson, writeJson } from './storage.js?v=20260918-test1';

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
    window.requestAnimationFrame(() => {
      const workspaceRect = workspace.getBoundingClientRect();
      const wallpaperRect = wallpaperButton.getBoundingClientRect();
      const layoutRect = layoutButton.getBoundingClientRect();
      const wallpaperCenter = wallpaperRect.left - workspaceRect.left + wallpaperRect.width / 2;
      const layoutCenter = layoutRect.left - workspaceRect.left + layoutRect.width / 2;
      workspace.style.setProperty('--desktop-wallpaper-anchor-x', `${wallpaperCenter}px`);
      workspace.style.setProperty('--desktop-layout-anchor-x', `${layoutCenter}px`);
    });
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
    }
    updateAnchors();
  };

  const applyMode = () => {
    const desktopActive = preferredMode === 'desktop' && desktopMedia.matches;
    document.body.classList.toggle('is-desktop', desktopActive);
    main.setAttribute('aria-hidden', String(desktopActive));
    workspace.setAttribute('aria-hidden', String(!desktopActive));
    syncLayoutSelection();
    closeLayoutMenu();
    closeWallpaperControls();
    if (desktopActive && desktopLayout === 'widgets') {
      wallpaperControls.hidden = false;
    }
    updateAnchors();
  };

  const setMode = (mode) => {
    preferredMode = mode === 'desktop' ? 'desktop' : 'panel';
    writeJson(MODE_KEY, preferredMode);
    if (preferredMode === 'panel') drawer?.close?.();
    applyMode();
  };

  const openFromDock = (callback) => {
    closeWallpaperControls();
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

  workspace.addEventListener('click', (event) => {
    const layoutChoice = event.target?.closest?.('[data-layout-choice]');
    if (layoutChoice) {
      const choice = layoutChoice.getAttribute('data-layout-choice');
      if (choice === 'panel') {
        setMode('panel');
      } else {
        setDesktopLayout(choice);
      }
      return;
    }

    const button = event.target?.closest?.('[data-desktop-action]');
    if (!button) return;

    const action = button.getAttribute('data-desktop-action');
    if (action === 'search') openFromDock(openSearch);
    if (action === 'accounts') openFromDock(openAccounts);
    if (action === 'bookmarks') openFromDock(openBookmarks);
    if (action === 'todos') openFromDock(openTodos);
    if (action === 'photos') openFromDock(openPhotos);
    if (action === 'wallpaper') {
      closeLayoutMenu();
      const nextOpen = wallpaperControls.hidden;
      wallpaperControls.hidden = !nextOpen;
      wallpaperButton.setAttribute('aria-expanded', String(nextOpen));
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
      closeWallpaperControls();
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
