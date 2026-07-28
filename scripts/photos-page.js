const CONFIG_URL = '../data/config.json';

function photoId(src) {
  const file = String(src || '').split('/').pop() || '';
  return file.replace(/\.[^.]+$/, '');
}

function assetUrl(src) {
  const value = String(src || '');
  if (!value) return '';
  if (/^(?:https?:|data:|\/)/i.test(value)) return value;
  return `../${value}`;
}

function albumKind(album) {
  const text = `${album?.title || ''} ${(album?.items || []).flatMap((item) => item?.tags || []).join(' ')}`;
  if (text.includes('航拍') || text.includes('无人机')) return 'aerial';
  if (text.includes('相机') || text.includes('摄影')) return 'camera';
  return `album-${String(album?.year || 'other')}`;
}

function normalizePhotoData(config) {
  const albums = [];
  const photos = [];
  const bySrc = new Map();

  for (const [albumIndex, album] of (config?.photos?.albums || []).entries()) {
    const kind = albumKind(album);
    const albumId = `${kind}-${albumIndex + 1}`;
    const items = [];

    for (const item of (album?.items || [])) {
      if (!item?.src) continue;
      const photo = {
        ...item,
        id: photoId(item.src),
        src: assetUrl(item.src),
        rawSrc: item.src,
        albumId,
        albumTitle: album.title || 'Photography',
        year: album.year || '',
        kind
      };
      items.push(photo);
      photos.push(photo);
      bySrc.set(item.src, photo);
    }

    if (items.length) {
      albums.push({
        id: albumId,
        title: album.title || 'Photography',
        year: album.year || '',
        kind,
        items,
        cover: items[0]
      });
    }
  }

  const featured = (config?.photos?.featured || [])
    .map((item) => bySrc.get(item?.src))
    .filter(Boolean);

  return { albums, photos, featured };
}

function createStoryCard(photos) {
  const link = document.createElement('a');
  link.className = 'storyCard';
  link.href = './stories/2025-chuan-zang/';
  link.setAttribute('aria-label', '阅读影像故事：2025 川藏线');

  const image = document.createElement('img');
  const cover = photos.find((photo) => photo.id === 'DJI_20250712140834_0012_D-1') || photos[0];
  image.src = cover.src;
  image.alt = '2025 川藏线影像故事封面：塔公草原';
  image.loading = 'lazy';
  image.decoding = 'async';

  const content = document.createElement('div');
  content.className = 'storyCard__content';

  const titleWrap = document.createElement('div');
  titleWrap.innerHTML = `
    <div class="storyCard__eyebrow">Journey 01 · July 2025</div>
    <div class="storyCard__title">2025 川藏线</div>
    <div class="storyCard__summary">从河谷、草原与高山湖泊之间经过，最后把沿途的光整理成一篇影像手记。</div>
  `;

  const meta = document.createElement('div');
  meta.className = 'storyCard__meta';
  meta.innerHTML = `
    <span>${photos.length} Photographs</span>
    <span class="storyCard__read">阅读故事 <b aria-hidden="true">↗</b></span>
  `;

  content.appendChild(titleWrap);
  content.appendChild(meta);
  link.appendChild(image);
  link.appendChild(content);
  return link;
}

function createPhotoCard(photo, onOpen) {
  const button = document.createElement('button');
  button.className = 'photoCard';
  button.type = 'button';
  button.setAttribute('aria-label', `查看照片 ${photo.caption || photo.id}`);

  const image = document.createElement('img');
  image.src = photo.src;
  image.alt = photo.caption || '摄影作品';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.addEventListener('load', () => image.classList.add('is-loaded'), { once: true });
  if (image.complete) image.classList.add('is-loaded');

  const overlay = document.createElement('span');
  overlay.className = 'photoCard__overlay';
  overlay.innerHTML = `
    <span class="photoCard__title">${photo.caption || 'Untitled'}</span>
    <span class="photoCard__meta">${photo.year || ''} · ${photo.kind === 'aerial' ? '航拍' : '相机'}</span>
  `;

  button.appendChild(image);
  button.appendChild(overlay);
  button.addEventListener('click', () => onOpen(photo.id));
  return button;
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const response = await fetch(CONFIG_URL, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const config = await response.json();
  const { photos, featured } = normalizePhotoData(config);
  if (!photos.length) throw new Error('摄影配置中没有可显示的作品');

  const hero = featured[0] || photos[0];
  const heroImage = document.getElementById('heroImage');
  const heroCaption = document.getElementById('heroCaption');
  const heroMeta = document.getElementById('heroMeta');
  heroImage.src = hero.src;
  heroImage.alt = hero.caption || '摄影作品封面';
  heroCaption.textContent = hero.caption || 'Untitled';
  heroMeta.textContent = `${hero.year || ''} · ${hero.kind === 'aerial' ? '航拍' : '相机'}`;

  const storyGrid = document.getElementById('storyGrid');
  const photoGrid = document.getElementById('photoGrid');
  const photoEmpty = document.getElementById('photoEmpty');
  const galleryTitle = document.getElementById('galleryTitle');
  const galleryCount = document.getElementById('galleryCount');
  const navPhotoCount = document.getElementById('navPhotoCount');

  const lightbox = document.getElementById('photoLightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxAlbum = document.getElementById('lightboxAlbum');
  const lightboxTags = document.getElementById('lightboxTags');
  const lightboxCounter = document.getElementById('lightboxCounter');
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');
  const copyPhotoLink = document.getElementById('copyPhotoLink');

  let currentFilter = 'all';
  let visiblePhotos = photos.slice();
  let currentPhotoIndex = 0;
  let lightboxOpen = false;

  const filterLabel = (filter) => {
    if (filter === 'all') return '全部作品';
    if (filter === 'aerial') return '航拍作品';
    if (filter === 'camera') return '相机作品';
    return '摄影作品';
  };

  const filteredPhotos = (filter) => {
    if (filter === 'all') return photos.slice();
    return photos.filter((photo) => photo.kind === filter);
  };

  const syncFilterButtons = () => {
    for (const button of document.querySelectorAll('[data-photo-filter]')) {
      const active = button.getAttribute('data-photo-filter') === currentFilter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  };

  const renderGallery = () => {
    visiblePhotos = filteredPhotos(currentFilter);
    photoGrid.innerHTML = '';
    for (const photo of visiblePhotos) {
      photoGrid.appendChild(createPhotoCard(photo, openLightbox));
    }
    galleryTitle.textContent = filterLabel(currentFilter);
    galleryCount.textContent = `${visiblePhotos.length} Photos`;
    navPhotoCount.textContent = `${photos.length} Photos`;
    photoEmpty.hidden = visiblePhotos.length > 0;
    syncFilterButtons();
  };

  const selectFilter = (filter, { scroll = false } = {}) => {
    currentFilter = filter;
    renderGallery();
    if (scroll) {
      document.getElementById('gallery').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const updatePhotoUrl = (id) => {
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set('photo', id);
      url.hash = '';
    } else {
      url.searchParams.delete('photo');
    }
    window.history.replaceState({}, '', url);
  };

  const showLightboxPhoto = (index, { updateUrl = true } = {}) => {
    if (!visiblePhotos.length) return;
    currentPhotoIndex = (index + visiblePhotos.length) % visiblePhotos.length;
    const photo = visiblePhotos[currentPhotoIndex];
    lightboxImage.src = photo.src;
    lightboxImage.alt = photo.caption || '摄影作品';
    lightboxTitle.textContent = photo.caption || 'Untitled';
    lightboxAlbum.textContent = '2025 · 川藏线';
    lightboxCounter.textContent = `${currentPhotoIndex + 1} / ${visiblePhotos.length}`;
    lightboxTags.innerHTML = '';

    const tags = [photo.year, photo.kind === 'aerial' ? '航拍' : '相机', ...(photo.tags || [])]
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index);
    for (const tag of tags) {
      const span = document.createElement('span');
      span.className = 'lightbox__tag';
      span.textContent = tag;
      lightboxTags.appendChild(span);
    }

    if (updateUrl) updatePhotoUrl(photo.id);

    const next = visiblePhotos[(currentPhotoIndex + 1) % visiblePhotos.length];
    if (next) {
      const preload = new Image();
      preload.src = next.src;
    }
  };

  function openLightbox(id, { updateUrl = true } = {}) {
    const allIndex = photos.findIndex((photo) => photo.id === id);
    if (allIndex < 0) return;

    if (!visiblePhotos.some((photo) => photo.id === id)) {
      currentFilter = 'all';
      renderGallery();
    }
    const index = visiblePhotos.findIndex((photo) => photo.id === id);
    showLightboxPhoto(index, { updateUrl });
    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-lightbox-open');
    lightboxOpen = true;
    requestAnimationFrame(() => {
      lightbox.classList.add('is-open');
      document.querySelector('.lightbox__close')?.focus();
    });
  }

  const closeLightbox = ({ updateUrl = true } = {}) => {
    if (!lightboxOpen) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-lightbox-open');
    lightboxOpen = false;
    if (updateUrl) updatePhotoUrl('');
    window.setTimeout(() => {
      if (!lightboxOpen) lightbox.hidden = true;
    }, 220);
  };

  storyGrid.appendChild(createStoryCard(photos));

  for (const button of document.querySelectorAll('[data-photo-filter]')) {
    button.addEventListener('click', () => {
      selectFilter(button.getAttribute('data-photo-filter') || 'all', { scroll: true });
    });
  }

  for (const close of document.querySelectorAll('[data-lightbox-close]')) {
    close.addEventListener('click', () => closeLightbox());
  }

  lightboxPrev.addEventListener('click', () => showLightboxPhoto(currentPhotoIndex - 1));
  lightboxNext.addEventListener('click', () => showLightboxPhoto(currentPhotoIndex + 1));
  copyPhotoLink.addEventListener('click', async () => {
    const copied = await copyText(window.location.href);
    copyPhotoLink.textContent = copied ? '已复制' : '复制失败';
    window.setTimeout(() => {
      copyPhotoLink.textContent = '复制链接';
    }, 1200);
  });

  window.addEventListener('keydown', (event) => {
    if (!lightboxOpen) return;
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') showLightboxPhoto(currentPhotoIndex - 1);
    if (event.key === 'ArrowRight') showLightboxPhoto(currentPhotoIndex + 1);
  });

  renderGallery();

  const requestedPhoto = new URL(window.location.href).searchParams.get('photo');
  if (requestedPhoto) openLightbox(requestedPhoto, { updateUrl: false });
}

main().catch((error) => {
  const panel = document.getElementById('photoPageError');
  panel.hidden = false;
  panel.textContent = `摄影页面加载失败：${error?.message || error}`;
  console.error(error);
});
