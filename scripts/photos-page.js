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

function responsivePhotoUrl(src, width) {
  const value = String(src || '');
  const match = value.match(/^(.*\/)?([^/?#]+)\.webp([?#].*)?$/i);
  if (!match || value.includes('/responsive/')) return value;
  return `${match[1] || ''}responsive/${match[2]}-${width}.webp${match[3] || ''}`;
}

function setResponsivePhoto(image, src, { preferredWidth = 1280, sizes = '100vw' } = {}) {
  image.src = responsivePhotoUrl(src, preferredWidth);
  image.srcset = `${responsivePhotoUrl(src, 640)} 640w, ${responsivePhotoUrl(src, 1280)} 1280w`;
  image.sizes = sizes;
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
        kind: item.kind || kind,
        storyId: item.storyId || album.storyId || '',
        storyTitle: item.storyTitle || album.storyTitle || album.title || 'Photography'
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

function createStoryCard(story) {
  const link = document.createElement('a');
  link.className = 'storyCard';
  link.href = assetUrl(story.url);
  link.setAttribute('aria-label', `阅读影像故事：${story.name || story.title}`);

  const image = document.createElement('img');
  setResponsivePhoto(image, assetUrl(story.cover), {
    preferredWidth: 1280,
    sizes: '(max-width: 900px) 100vw, 75vw'
  });
  image.alt = story.coverAlt || `${story.name || story.title}影像故事封面`;
  image.loading = 'lazy';
  image.decoding = 'async';

  const content = document.createElement('div');
  content.className = 'storyCard__content';

  const titleWrap = document.createElement('div');
  for (const [className, text] of [
    ['storyCard__eyebrow', story.issue],
    ['storyCard__title', story.name || story.title],
    ['storyCard__summary', story.summary || story.title]
  ]) {
    const line = document.createElement('div');
    line.className = className;
    line.textContent = text || '';
    titleWrap.appendChild(line);
  }

  const meta = document.createElement('div');
  meta.className = 'storyCard__meta';
  const count = document.createElement('span');
  count.textContent = story.photoCount != null ? `${story.photoCount} Photographs` : story.meta || '';
  const read = document.createElement('span');
  read.className = 'storyCard__read';
  read.textContent = '阅读故事 ↗';
  meta.append(count, read);

  content.appendChild(titleWrap);
  content.appendChild(meta);
  link.appendChild(image);
  link.appendChild(content);
  return link;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
}

function walkCoordinates(value, callback) {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === 'number' && typeof value[1] === 'number') {
    callback(value);
    return;
  }
  for (const child of value) walkCoordinates(child, callback);
}

function albersChinaRaw([longitude, latitude]) {
  const radians = Math.PI / 180;
  const phi1 = 25 * radians;
  const phi2 = 47 * radians;
  const lambda0 = 105 * radians;
  const phi = latitude * radians;
  const lambda = longitude * radians;
  const n = (Math.sin(phi1) + Math.sin(phi2)) / 2;
  const constant = Math.cos(phi1) ** 2 + 2 * n * Math.sin(phi1);
  const rho = Math.sqrt(constant - 2 * n * Math.sin(phi)) / n;
  const theta = n * (lambda - lambda0);
  return [rho * Math.sin(theta), -rho * Math.cos(theta)];
}

function createAtlasProjection(features, width = 860, height = 610, padding = 38) {
  const rawPoints = [];
  for (const feature of features) {
    walkCoordinates(feature?.geometry?.coordinates, (point) => {
      if (point[0] >= 70 && point[0] <= 140 && point[1] >= 17 && point[1] <= 55) {
        rawPoints.push(albersChinaRaw(point));
      }
    });
  }

  const minX = Math.min(...rawPoints.map((point) => point[0]));
  const maxX = Math.max(...rawPoints.map((point) => point[0]));
  const minY = Math.min(...rawPoints.map((point) => point[1]));
  const maxY = Math.max(...rawPoints.map((point) => point[1]));
  const scale = Math.min(
    (width - padding * 2) / (maxX - minX),
    (height - padding * 2) / (maxY - minY)
  );
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;

  return (point) => {
    const [rawX, rawY] = albersChinaRaw(point);
    return [
      offsetX + (rawX - minX) * scale,
      offsetY + (maxY - rawY) * scale
    ];
  };
}

function atlasGeometryPath(geometry, project) {
  const ringPath = (ring) => {
    const commands = ring.map((point, index) => {
      const [x, y] = project(point);
      return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `${commands.join('')}Z`;
  };

  if (geometry?.type === 'Polygon') {
    return geometry.coordinates.map(ringPath).join('');
  }
  if (geometry?.type === 'MultiPolygon') {
    return geometry.coordinates
      .flatMap((polygon) => polygon.map(ringPath))
      .join('');
  }
  return '';
}

function atlasConfigUrl(value) {
  return assetUrl(value || '');
}

async function initPhotoAtlas(config) {
  const atlas = config?.photos?.atlas;
  const map = document.getElementById('photoAtlasMap');
  const provinceLayer = document.getElementById('atlasProvinceLayer');
  const placeLayer = document.getElementById('atlasPlaceLayer');
  const status = document.getElementById('atlasMapStatus');
  const regionNav = document.getElementById('atlasRegionNav');
  if (!atlas || !map || !provinceLayer || !placeLayer || !status || !regionNav) return;

  const regions = Array.isArray(atlas.regions) ? atlas.regions : [];
  const stories = Array.isArray(atlas.stories) ? atlas.stories : [];
  if (!regions.length) {
    status.textContent = '摄影地图还没有地点。';
    return;
  }

  const regionById = new Map(regions.map((region) => [String(region.id), region]));
  const regionByAdcode = new Map(regions.map((region) => [String(region.adcode), region]));
  const storyById = new Map(stories.map((story) => [String(story.id), story]));

  const regionIndex = document.getElementById('atlasRegionIndex');
  const regionState = document.getElementById('atlasRegionState');
  const regionEnglish = document.getElementById('atlasRegionEnglish');
  const regionName = document.getElementById('atlasRegionName');
  const regionSummary = document.getElementById('atlasRegionSummary');
  const placeCount = document.getElementById('atlasPlaceCount');
  const photoCount = document.getElementById('atlasPhotoCount');
  const storyCount = document.getElementById('atlasStoryCount');
  const placeList = document.getElementById('atlasPlaceList');
  const storyLink = document.getElementById('atlasStoryLink');
  const storyCover = document.getElementById('atlasStoryCover');
  const storyIssue = document.getElementById('atlasStoryIssue');
  const storyTitle = document.getElementById('atlasStoryTitle');
  const storyMeta = document.getElementById('atlasStoryMeta');

  const response = await fetch(atlasConfigUrl(atlas.mapUrl), { cache: 'force-cache' });
  if (!response.ok) throw new Error(`摄影地图加载失败：${response.status}`);
  const geojson = await response.json();
  const features = Array.isArray(geojson?.features) ? geojson.features : [];
  if (!features.length) throw new Error('摄影地图没有可渲染的省份数据');

  const project = createAtlasProjection(features);
  const provincePaths = [];
  for (const feature of features) {
    const adcode = String(feature?.properties?.adcode || '');
    const region = regionByAdcode.get(adcode);
    const path = createSvgElement('path', {
      d: atlasGeometryPath(feature.geometry, project),
      class: `photoAtlas__province${region ? ' is-published' : ''}`,
      'data-adcode': adcode
    });
    if (region) {
      path.dataset.atlasRegion = String(region.id);
    }
    path.setAttribute('aria-hidden', 'true');
    provinceLayer.appendChild(path);
    provincePaths.push(path);
  }

  const placeGroups = [];
  for (const region of regions) {
    for (const place of (region.places || [])) {
      if (!Array.isArray(place.coordinates)) continue;
      const [x, y] = project(place.coordinates);
      const [labelX = 12, labelY = -10] = place.labelOffset || [];
      const anchor = labelX < 0 ? 'end' : 'start';
      const group = createSvgElement('g', {
        class: 'photoAtlas__place',
        transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`,
        'data-atlas-region': region.id,
        'aria-hidden': 'true'
      });
      group.append(
        createSvgElement('circle', { class: 'photoAtlas__placeHalo', cx: 0, cy: 0, r: 9 }),
        createSvgElement('circle', { class: 'photoAtlas__placeDot', cx: 0, cy: 0, r: 4.2 }),
        createSvgElement('line', {
          class: 'photoAtlas__placeLine',
          x1: labelX > 0 ? 4 : -4,
          y1: labelY > 0 ? 4 : -4,
          x2: labelX * .78,
          y2: labelY * .78
        })
      );
      const indexLabel = createSvgElement('text', {
        class: 'photoAtlas__placeIndex',
        x: labelX,
        y: labelY - 7,
        'text-anchor': anchor
      });
      indexLabel.textContent = place.index || '';
      const nameLabel = createSvgElement('text', {
        class: 'photoAtlas__placeLabel',
        x: labelX,
        y: labelY + 4,
        'text-anchor': anchor
      });
      nameLabel.textContent = place.name || '';
      group.append(indexLabel, nameLabel);
      placeLayer.appendChild(group);
      placeGroups.push(group);
    }
  }

  const buttons = regions.map((region) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.atlasRegion = String(region.id);
    button.textContent = `${region.index || ''} · ${region.name}`;
    button.addEventListener('click', () => selectRegion(region.id));
    return button;
  });
  regionNav.replaceChildren(...buttons);

  function syncRegionUrl(id) {
    const url = new URL(window.location.href);
    url.searchParams.set('region', id);
    url.hash = 'atlas';
    window.history.replaceState({}, '', url);
  }

  function selectRegion(id, { updateUrl = true } = {}) {
    const region = regionById.get(String(id)) || regions[0];
    const story = storyById.get(String(region.stories?.[0] || '')) || stories[0];
    if (!region) return;

    regionIndex.textContent = `REGION ${region.index || '00'}`;
    regionState.textContent = region.state || '已到访';
    regionEnglish.textContent = region.english || '';
    regionName.textContent = region.name || '';
    regionSummary.textContent = region.summary || '';
    placeCount.textContent = String(region.places?.length || 0).padStart(2, '0');
    photoCount.textContent = String(region.photoCount || 0).padStart(2, '0');
    storyCount.textContent = String(region.stories?.length || 0).padStart(2, '0');

    const placeTags = (region.places || []).map((place) => {
      const tag = document.createElement('span');
      tag.textContent = place.name || '';
      return tag;
    });
    placeList.replaceChildren(...placeTags);

    if (story) {
      storyLink.href = atlasConfigUrl(story.url);
      storyLink.setAttribute('aria-label', `阅读摄影故事：${story.title}`);
      setResponsivePhoto(storyCover, atlasConfigUrl(story.cover), {
        preferredWidth: 640,
        sizes: '(max-width: 900px) 100vw, 360px'
      });
      storyIssue.textContent = story.issue || '';
      storyTitle.textContent = story.title || '';
      storyMeta.textContent = story.meta || '';
      storyLink.hidden = false;
    } else {
      storyLink.hidden = true;
    }

    for (const path of provincePaths) {
      path.classList.toggle('is-selected', path.dataset.atlasRegion === String(region.id));
    }
    for (const group of placeGroups) {
      group.classList.toggle('is-selected', group.dataset.atlasRegion === String(region.id));
    }
    for (const button of buttons) {
      const active = button.dataset.atlasRegion === String(region.id);
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }

    if (updateUrl) syncRegionUrl(region.id);
  }

  provinceLayer.addEventListener('click', (event) => {
    const path = event.target.closest('[data-atlas-region]');
    if (path) selectRegion(path.dataset.atlasRegion);
  });

  const requestedRegion = new URL(window.location.href).searchParams.get('region');
  const initialRegion = regionById.has(requestedRegion)
    ? requestedRegion
    : String(atlas.defaultRegion || regions[0].id);
  selectRegion(initialRegion, { updateUrl: false });
  status.hidden = true;
}

function createPhotoCard(photo, onOpen) {
  const button = document.createElement('button');
  button.className = 'photoCard';
  button.type = 'button';
  button.setAttribute('aria-label', `查看照片 ${photo.caption || photo.id}`);

  const image = document.createElement('img');
  setResponsivePhoto(image, photo.src, {
    preferredWidth: 640,
    sizes: '(max-width: 680px) 100vw, (max-width: 1100px) 50vw, 33vw'
  });
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
  setResponsivePhoto(heroImage, hero.src, {
    preferredWidth: 1280,
    sizes: '100vw'
  });
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
    lightboxImage.removeAttribute('srcset');
    lightboxImage.removeAttribute('sizes');
    lightboxImage.alt = photo.caption || '摄影作品';
    lightboxTitle.textContent = photo.caption || 'Untitled';
    lightboxAlbum.textContent = photo.storyTitle;
    lightboxCounter.textContent = `${currentPhotoIndex + 1} / ${visiblePhotos.length}`;
    lightboxTags.innerHTML = '';

    const tags = [photo.date || photo.year, photo.province, photo.place, photo.kind === 'aerial' ? '航拍' : '相机', ...(photo.tags || [])]
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

  try {
    await initPhotoAtlas(config);
  } catch (error) {
    const atlasStatus = document.getElementById('atlasMapStatus');
    if (atlasStatus) atlasStatus.textContent = '地图暂时未能载入。';
    console.error(error);
  }

  for (const story of (config?.photos?.atlas?.stories || [])) {
    storyGrid.appendChild(createStoryCard(story));
  }

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
