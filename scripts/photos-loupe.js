import { byId } from './photos-ui.js?v=20260930-photos4';
import { responsivePhotoUrl } from './photos-data.js?v=20260930-photos4';

export function initLoupe(root, photos, enabled) {
  const glass = byId('loupe');
  let current,
    timer,
    rect,
    raf,
    point,
    start,
    touch = false,
    suppress,
    alt = false;
  function hide() {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    raf = 0;
    current = null;
    glass.hidden = true;
  }
  function paint() {
    raf = 0;
    if (!current || glass.hidden) return;
    const img = current.querySelector('img');
    const scale = Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
    const w = img.naturalWidth * scale,
      h = img.naturalHeight * scale,
      size = glass.clientWidth;
    const px = point.x - rect.left + (w - rect.width) / 2,
      py = point.y - rect.top + (h - rect.height) / 2;
    glass.style.backgroundSize = w * 4 + 'px ' + h * 4 + 'px';
    glass.style.backgroundPosition = size / 2 - px * 4 + 'px ' + (size / 2 - py * 4) + 'px';
    const x = Math.max(4, Math.min(innerWidth - size - 8, point.x - size / 2));
    const y = Math.max(4, Math.min(innerHeight - size - 12, point.y - size * (touch ? 1.1 : 0.5)));
    glass.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }
  function begin(e) {
    const node = e.target.closest('.stripFrame');
    if (!node || !enabled() || e.altKey || alt) return;
    if (current === node) return;
    hide();
    current = node;
    touch = e.pointerType === 'touch';
    point = start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(
      () => {
        const img = node.querySelector('img');
        if (!img.naturalWidth || !enabled()) return;
        rect = img.getBoundingClientRect();
        const p = photos.get(node.dataset.frame);
        glass.style.backgroundImage = 'url("' + responsivePhotoUrl(p.src, 1280) + '")';
        glass.firstElementChild.textContent = 'LOUPE ×4 · ' + p.caption;
        glass.hidden = false;
        if (touch) suppress = node;
        paint();
      },
      touch ? 350 : 120
    );
  }
  root.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'touch') begin(e);
  });
  root.addEventListener('pointerdown', (e) => {
    suppress = null;
    if (e.pointerType === 'touch') begin(e);
  });
  root.addEventListener('pointermove', (e) => {
    if (!current) return;
    point = { x: e.clientX, y: e.clientY };
    if (touch && glass.hidden && Math.hypot(point.x - start.x, point.y - start.y) > 10) {
      hide();
      return;
    }
    if (!raf && !glass.hidden) raf = requestAnimationFrame(paint);
  });
  root.addEventListener('pointerout', (e) => {
    if (current && !current.contains(e.relatedTarget)) hide();
  });
  root.addEventListener('pointerup', () => {
    if (touch) hide();
  });
  root.addEventListener('contextmenu', (e) => {
    if (touch && current) e.preventDefault();
  });
  root.addEventListener(
    'click',
    (e) => {
      if (suppress?.contains(e.target)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      suppress = null;
      hide();
    },
    true
  );
  root.addEventListener('pointercancel', hide);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Alt') {
      alt = true;
      hide();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt') alt = false;
  });
  window.addEventListener('blur', () => {
    alt = false;
    hide();
  });
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide);
  return hide;
}
