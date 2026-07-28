import { readJson, writeJson } from './storage.js';

const MODE_KEY = 'layoutMode';
const DESKTOP_QUERY = '(min-width: 900px)';

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
  const desktopMedia = window.matchMedia(DESKTOP_QUERY);

  if (!main || !workspace || !enterButton || !wallpaperButton || !wallpaperControls) {
    return null;
  }

  let preferredMode = readJson(MODE_KEY, 'panel') === 'desktop' ? 'desktop' : 'panel';

  const closeWallpaperControls = () => {
    wallpaperControls.hidden = true;
    wallpaperButton.setAttribute('aria-expanded', 'false');
  };

  const applyMode = () => {
    const desktopActive = preferredMode === 'desktop' && desktopMedia.matches;
    document.body.classList.toggle('is-desktop', desktopActive);
    main.setAttribute('aria-hidden', String(desktopActive));
    workspace.setAttribute('aria-hidden', String(!desktopActive));
    if (!desktopActive) closeWallpaperControls();
  };

  const setMode = (mode) => {
    preferredMode = mode === 'desktop' ? 'desktop' : 'panel';
    writeJson(MODE_KEY, preferredMode);
    if (preferredMode === 'panel') drawer?.close?.();
    applyMode();
  };

  const openFromDock = (callback) => {
    closeWallpaperControls();
    callback?.();
  };

  enterButton.addEventListener('click', () => setMode('desktop'));

  workspace.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-desktop-action]');
    if (!button) return;

    const action = button.getAttribute('data-desktop-action');
    if (action === 'search') openFromDock(openSearch);
    if (action === 'accounts') openFromDock(openAccounts);
    if (action === 'bookmarks') openFromDock(openBookmarks);
    if (action === 'todos') openFromDock(openTodos);
    if (action === 'photos') openFromDock(openPhotos);
    if (action === 'panel') setMode('panel');
    if (action === 'wallpaper') {
      const nextOpen = wallpaperControls.hidden;
      wallpaperControls.hidden = !nextOpen;
      wallpaperButton.setAttribute('aria-expanded', String(nextOpen));
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (wallpaperControls.hidden) return;
    if (wallpaperControls.contains(event.target) || wallpaperButton.contains(event.target)) return;
    closeWallpaperControls();
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
    if (event.key === 'Escape' && !wallpaperControls.hidden) {
      closeWallpaperControls();
    }
  });

  desktopMedia.addEventListener('change', applyMode);
  applyMode();

  return {
    setMode,
    get mode() {
      return document.body.classList.contains('is-desktop') ? 'desktop' : 'panel';
    }
  };
}
