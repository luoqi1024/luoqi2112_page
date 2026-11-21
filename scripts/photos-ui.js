import { responsivePhotoUrl } from './photos-data.js?v=20261121-photo-art';

export const byId = (id) => document.getElementById(id);
export const pad = (n) => String(n).padStart(2, '0');
export const reduced = matchMedia('(prefers-reduced-motion: reduce)');
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
export function button(text, action, label) {
  const node = element('button', '', text);
  node.type = 'button';
  if (label) node.setAttribute('aria-label', label);
  node.addEventListener('click', action);
  return node;
}
// Native lazy loading may fetch an entire screenful below the fold. Keep cold sections
// dormant until they enter the viewport, then let the browser schedule individual frames.
export function deferSections() {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRect.height < 1) continue;
        const section = entry.target;
        section.dataset.imagesReady = 'true';
        for (const img of section.querySelectorAll('img[data-src]')) {
          if (img.dataset.srcset) img.srcset = img.dataset.srcset;
          img.src = img.dataset.src;
          delete img.dataset.src;
          delete img.dataset.srcset;
        }
        observer.unobserve(section);
      }
    },
    { threshold: [0, 0.001] }
  );
  for (const id of ['stories', 'gallery', 'atlas']) observer.observe(byId(id));
}
export function thumbnail(photo, section) {
  const img = new Image();
  img.loading = 'lazy';
  img.decoding = 'async';
  if (photo.width && photo.height) {
    img.width = photo.width;
    img.height = photo.height;
  }
  img.alt = photo.caption || photo.id;
  const source = responsivePhotoUrl(photo.src, 640);
  if (section && !byId(section).dataset.imagesReady) img.dataset.src = source;
  else img.src = source;
  return img;
}
export function photoButton(photo, open, section) {
  const node = button('', () => open(photo), (photo.featured ? '精选 · ' : '') + (photo.caption || photo.id));
  node.dataset.frame = photo.id;
  node.append(thumbnail(photo, section));
  return node;
}
export function setQuery(changes) {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(changes)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  history.replaceState(history.state, '', url);
}
export function saved(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem('photos.' + key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function save(key, value) {
  try {
    localStorage.setItem('photos.' + key, JSON.stringify(value));
  } catch {
    /* storage is optional */
  }
}
export function coords(photo) {
  if (!photo.coordinates) return '';
  const [lon, lat] = photo.coordinates;
  return lat.toFixed(2) + '°N ' + lon.toFixed(2) + '°E';
}
export function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const name = key(item);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  }
  return groups;
}
export async function ensureOrientations(photos) {
  await Promise.all(
    photos
      .filter((p) => !p.orientation)
      .map((p) => {
        if (!p.measuring)
          p.measuring = (async () => {
            const img = new Image();
            img.src = responsivePhotoUrl(p.src, 640);
            try {
              await img.decode();
              p.orientation = img.naturalWidth < img.naturalHeight ? 'portrait' : 'landscape';
            } catch {
              /* leave unreadable dimensions unknown */
            }
          })();
        return p.measuring;
      })
  );
}
