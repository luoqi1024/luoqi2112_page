import { assetUrl, responsivePhotoUrl, setResponsivePhoto } from './photos-data.js?v=20261122-atlas-scs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FULL_VIEW = [0, 0, 860, 610];
const radians = Math.PI / 180;
const lambda0 = 105 * radians;
const n = (Math.sin(25 * radians) + Math.sin(47 * radians)) / 2;
const constant = Math.cos(25 * radians) ** 2 + 2 * n * Math.sin(25 * radians);

export function createSvgElement(tagName, attributes = {}) {
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
  const phi = latitude * radians;
  const lambda = longitude * radians;
  const rho = Math.sqrt(constant - 2 * n * Math.sin(phi)) / n;
  const theta = n * (lambda - lambda0);
  return [rho * Math.sin(theta), -rho * Math.cos(theta)];
}

export function createAtlasProjection(features, width = 860, height = 610, padding = 38) {
  const rawPoints = [];
  for (const feature of features) {
    walkCoordinates(feature?.geometry?.coordinates, (point) => {
      if (point[0] >= 70 && point[0] <= 140 && point[1] >= 17 && point[1] <= 55) {
        rawPoints.push(albersChinaRaw(point));
      }
    });
  }

  return fitProjection(rawPoints, padding, padding, width - 2 * padding, height - 2 * padding);
}

function fitProjection(rawPoints, left, top, width, height) {
  const minX = Math.min(...rawPoints.map((point) => point[0]));
  const maxX = Math.max(...rawPoints.map((point) => point[0]));
  const minY = Math.min(...rawPoints.map((point) => point[1]));
  const maxY = Math.max(...rawPoints.map((point) => point[1]));
  const scale = Math.min(width / (maxX - minX), height / (maxY - minY));
  const offsetX = left + (width - (maxX - minX) * scale) / 2;
  const offsetY = top + (height - (maxY - minY) * scale) / 2;

  const project = (point) => {
    const [rawX, rawY] = albersChinaRaw(point);
    return [offsetX + (rawX - minX) * scale, offsetY + (maxY - rawY) * scale];
  };
  project.unproject = ([x, y]) => {
    const rx = minX + (x - offsetX) / scale;
    const ry = maxY - (y - offsetY) / scale;
    const sinPhi = (constant - (Math.hypot(rx, ry) * n) ** 2) / (2 * n);
    return [(lambda0 + Math.atan2(rx, -ry) / n) / radians,
      Math.asin(Math.max(-1, Math.min(1, sinPhi))) / radians];
  };
  return project;
}

function createInsetProjection() {
  const corners = [[105, 2.5], [123.5, 2.5], [105, 25.5], [123.5, 25.5]];
  return fitProjection(corners.map(albersChinaRaw), 732, 450, 106, 122);
}

function drawSouthSeaInset(features) {
  const content = document.getElementById('atlasInsetContent');
  const project = createInsetProjection();
  const land = new Set(['350000', '440000', '450000', '460000', '710000', '810000', '820000']);
  for (const feature of features) {
    const code = String(feature.properties?.adcode);
    if (!land.has(code)) continue;
    const path = createSvgElement('path', {
      d: atlasGeometryPath(feature.geometry, project), class: 'photoAtlas__insetLand', 'data-adcode': code
    });
    path.classList.toggle('photoAtlas__insetIslands', code === '460000');
    content.append(path);
  }
  const boundary = features.find(feature => feature.properties?.adcode === '100000_JD');
  if (boundary) content.append(createSvgElement('path', {
    d: atlasGeometryPath(boundary.geometry, project), class: 'photoAtlas__tenDash'
  }));
}

export function atlasGeometryPath(geometry, project) {
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
    return geometry.coordinates.flatMap((polygon) => polygon.map(ringPath)).join('');
  }
  return '';
}

function initTheme(root) {
  const toggle = document.getElementById('atlasThemeToggle');
  const key = 'atlas-theme-override';
  const valid = value => value === 'day' || value === 'night';
  const query = new URL(location.href).searchParams.get('atlasTheme');
  let override = valid(query) ? query : null;
  if (!override) {
    try {
      const saved = sessionStorage.getItem(key);
      if (valid(saved)) override = saved;
    } catch { /* Storage is optional in private contexts. */ }
  }
  function refresh() {
    const hour = new Date().getHours();
    const theme = override || (hour >= 6 && hour < 19 ? 'day' : 'night');
    root.dataset.atlasTheme = theme;
    toggle.textContent = theme === 'day' ? '☾ 切换夜览星图' : '☀ 切换昼览古图';
  }
  toggle.addEventListener('click', () => {
    override = root.dataset.atlasTheme === 'day' ? 'night' : 'day';
    try { sessionStorage.setItem(key, override); } catch { /* Keep the in-page override. */ }
    const url = new URL(location.href);
    if (valid(url.searchParams.get('atlasTheme'))) {
      url.searchParams.set('atlasTheme', override);
      history.replaceState(history.state, '', url);
    }
    refresh();
  });
  refresh();
  document.addEventListener('visibilitychange', refresh);
  window.setInterval(refresh, 60000);
}

function linePath(points, project, step = 1) {
  return points.filter((_, i) => i % step === 0 || i === points.length - 1).map((point, i) => {
    const [x, y] = project(point);
    return `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join('');
}

function drawGraticules(project) {
  const layer = document.getElementById('atlasGraticuleLayer');
  for (let lon = 75; lon <= 135; lon += 10) {
    const points = Array.from({ length: 43 }, (_, i) => [lon, 15 + i]);
    layer.append(createSvgElement('path', { d: linePath(points, project) }));
  }
  for (let lat = 20; lat <= 50; lat += 10) {
    const points = Array.from({ length: 69 }, (_, i) => [70 + i, lat]);
    layer.append(createSvgElement('path', { d: linePath(points, project) }));
  }
}

async function fetchMapData(url) {
  const response = await fetch(assetUrl(url));
  if (!response.ok) throw new Error(`地图资源加载失败：${response.status}`);
  return response.json();
}

function initViewport(map, project) {
  const toggle = document.getElementById('atlasZoomToggle');
  const coord = document.getElementById('atlasCursorCoord');
  const range = coord.textContent;
  const compass = document.getElementById('atlasCompassLayer');
  const { e: compassX, f: compassY } = compass.transform.baseVal.getItem(0).matrix;
  let frame, selected, zoomed = false;
  function setView([x, y, w, h]) {
    map.setAttribute('viewBox', [x, y, w, h].join(' '));
    const ratio = w / FULL_VIEW[2];
    // Keep the compass and the point labels readable during a camera move.
    compass.setAttribute('transform', `translate(${x + compassX * ratio} ${y + compassY * ratio}) scale(${ratio})`);
    map.style.setProperty('--atlas-marker-scale', String(Math.max(0.34, ratio)));
  }
  function move() {
    cancelAnimationFrame(frame);
    let target = FULL_VIEW;
    if (zoomed && selected) {
      const box = selected.getBBox();
      const w = Math.max(box.width, box.height * 860 / 610, 90) * 1.48;
      const h = w * 610 / 860;
      target = [box.x + (box.width - w) / 2, box.y + (box.height - h) / 2, w, h];
    }
    map.dataset.zoomed = String(zoomed);
    toggle.setAttribute('aria-pressed', String(zoomed));
    toggle.textContent = zoomed ? '⟲ 返回全景' : '⊕ 聚焦本省';
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setView(target);
    const box = map.viewBox.baseVal;
    const start = [box.x, box.y, box.width, box.height];
    const time = performance.now();
    function animate(now) {
      const t = Math.min(1, Math.max(0, (now - time) / 420));
      setView(start.map((value, i) => value + (target[i] - value) * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
  }
  function toggleZoom() {
    if (!selected) return;
    zoomed = !zoomed;
    move();
  }
  toggle.addEventListener('click', toggleZoom);
  map.addEventListener('pointermove', event => {
    if (!zoomed && event.target.closest?.('#atlasSouthSeaInset')) {
      coord.textContent = '南海诸岛 · 3°N—25°N / 105°E—123°E';
      return;
    }
    const matrix = map.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const [lon, lat] = project.unproject([point.x, point.y]);
    coord.textContent = `${lat.toFixed(2)}°N · ${lon.toFixed(2)}°E`;
  });
  map.addEventListener('pointerleave', () => { coord.textContent = range; });
  return { toggleZoom, select(path) {
    selected = path;
    toggle.disabled = !path;
    if (zoomed) move();
  } };
}

export async function initPhotoAtlas(config, photos, onSelect, openPhoto) {
  const atlas = config?.photos?.atlas;
  const map = document.getElementById('photoAtlasMap');
  const provinceLayer = document.getElementById('atlasProvinceLayer');
  const placeLayer = document.getElementById('atlasPlaceLayer');
  const status = document.getElementById('atlasMapStatus');
  const regionNav = document.getElementById('atlasRegionNav');
  if (!atlas || !map || !provinceLayer || !placeLayer || !status || !regionNav) return;
  initTheme(document.getElementById('photoAtlas'));

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

  const [geojson, roads] = await Promise.all([
    fetchMapData(atlas.mapUrl), fetchMapData('data/story-routes.json').catch(() => null)
  ]);
  const features = Array.isArray(geojson?.features) ? geojson.features : [];
  if (!features.length) throw new Error('摄影地图没有可渲染的省份数据');

  const project = createAtlasProjection(features);
  drawGraticules(project);
  drawSouthSeaInset(features);
  const viewport = initViewport(map, project);
  const routeLayer = document.getElementById('atlasRouteLayer');
  for (const story of stories) {
    const legs = roads?.stories?.[story.id]?.legs || [];
    const d = legs.map(leg => linePath(leg.coordinates, project, leg.coordinates.length > 45 ? 2 : 1)).join('');
    if (!d) continue;
    const group = createSvgElement('g', { 'data-story': story.id });
    group.append(createSvgElement('path', { d, class: 'photoAtlas__routeGlow' }),
      createSvgElement('path', { d, class: 'photoAtlas__routeCore' }));
    routeLayer.append(group);
  }
  document.getElementById('atlasRouteLegend').hidden = !routeLayer.childElementCount;
  document.getElementById('atlasRouteCredit').hidden = !routeLayer.childElementCount;
  const provincePaths = [];
  for (const feature of features) {
    const adcode = String(feature?.properties?.adcode || '');
    if (adcode === '100000_JD') {
      provinceLayer.append(createSvgElement('path', {
        d: atlasGeometryPath(feature.geometry, project), class: 'photoAtlas__tenDash', 'data-adcode': adcode
      }));
      continue;
    }
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
  const selectedFrames = new Set(['DSC_4311', 'DSC_4350', 'DSC_4266']);
  const photosByPlace = new Map();
  const photosByRegion = new Map();
  for (const photo of photos) {
    const region = photo.atlasRegionId;
    if (!region) continue;
    if (!photosByRegion.has(region)) photosByRegion.set(region, []);
    photosByRegion.get(region).push(photo);
    const key = region + '/' + photo.atlasPlace;
    if (photo.atlasPlace && (!photosByPlace.has(key) || selectedFrames.has(photo.id))) {
      photosByPlace.set(key, photo);
    }
  }
  let activeRegion, pinned;
  const pin = document.getElementById('atlasPhotoPin');
  const pinImage = document.getElementById('atlasPinImg');
  function photoHref(photo) {
    const url = new URL(location.href);
    url.searchParams.set('photo', photo.id);
    url.hash = 'gallery';
    return url.href;
  }
  function showPlace(region, place) {
    const photo = photosByPlace.get(region.id + '/' + place?.name);
    for (const group of placeGroups) {
      group.classList.toggle('is-focused', group.dataset.atlasRegion === region.id && group.dataset.place === place?.name);
    }
    for (const button of placeList.children) {
      button.setAttribute('aria-pressed', String(activeRegion === region && button.dataset.place === place?.name));
    }
    pin.hidden = !photo;
    pinned = photo;
    if (!photo) return;
    const src = responsivePhotoUrl(photo.src, 640);
    if (pinImage.getAttribute('src') !== src) pinImage.src = src;
    pin.href = photoHref(photo);
    document.getElementById('atlasPinKicker').textContent = `SPOT ${place.index} · ${place.name}`;
    document.getElementById('atlasPinTitle').textContent = photo.caption || place.name;
    document.getElementById('atlasPinExif').textContent =
      [photo.camera, photo.exif?.focal, photo.exif?.aperture].filter(Boolean).join(' · ');
  }
  function viewFrame(event, photo) {
    if (!photo || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openPhoto(photo, photosByRegion.get(photo.atlasRegionId));
  }
  pin.addEventListener('click', event => viewFrame(event, pinned));
  function showGallery(region) {
    const frames = [...(photosByRegion.get(region.id) || [])].sort((a, b) =>
      Number(selectedFrames.has(b.id)) - Number(selectedFrames.has(a.id)));
    const places = new Set();
    const links = [];
    for (const photo of frames) {
      const place = photo.place || photo.atlasPlace;
      if (!place || places.has(place)) continue;
      places.add(place);
      const link = document.createElement('a');
      link.href = photoHref(photo);
      link.setAttribute('aria-label', '查看实拍：' + (photo.caption || place));
      const image = new Image();
      image.alt = '';
      image.loading = 'lazy';
      image.src = responsivePhotoUrl(photo.src, 640);
      const caption = document.createElement('span');
      caption.textContent = place;
      link.append(image, caption);
      link.addEventListener('click', event => viewFrame(event, photo));
      links.push(link);
      if (links.length === 3) break;
    }
    document.getElementById('atlasMiniGallery').replaceChildren(...links);
  }
  for (const region of regions) {
    for (const place of region.places || []) {
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
      const symbol = createSvgElement('g', { class: 'photoAtlas__marker' });
      group.dataset.place = place.name;
      group.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'touch') showPlace(region, place);
      });
      group.addEventListener('click', () => {
        if (activeRegion !== region) selectRegion(region.id);
        showPlace(region, place);
      });
      symbol.append(
        createSvgElement('circle', { class: 'photoAtlas__placeHalo', cx: 0, cy: 0, r: 9 }),
        createSvgElement('circle', { class: 'photoAtlas__placeDot', cx: 0, cy: 0, r: 4.2 }),
        createSvgElement('line', {
          class: 'photoAtlas__placeLine',
          x1: labelX > 0 ? 4 : -4,
          y1: labelY > 0 ? 4 : -4,
          x2: labelX * 0.78,
          y2: labelY * 0.78
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
      symbol.append(indexLabel, nameLabel);
      group.append(symbol);
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
    if (activeRegion === region) {
      if (updateUrl) {
        syncRegionUrl(region.id);
        onSelect(region.id);
      }
      return;
    }
    activeRegion = region;
    const story = storyById.get(region.stories?.[0]);

    regionIndex.textContent = `REGION ${region.index || '00'}`;
    regionState.textContent = region.state || '已到访';
    regionEnglish.textContent = region.english || '';
    regionName.textContent = region.name || '';
    regionSummary.textContent = region.summary || '';
    placeCount.textContent = String(region.places?.length || 0).padStart(2, '0');
    photoCount.textContent = String(region.photoCount || 0).padStart(2, '0');
    storyCount.textContent = story ? story.name.replace(/^\d{4}\s*/, '') : '—';

    const placeTags = (region.places || []).map((place) => {
      const tag = document.createElement('button');
      tag.type = 'button';
      tag.dataset.place = place.name;
      tag.textContent = place.name || '';
      tag.onpointerenter = tag.onfocus = tag.onclick = () => showPlace(region, place);
      return tag;
    });
    placeList.replaceChildren(...placeTags);
    showGallery(region);
    const firstPlace = region.places?.find(place => photosByPlace.has(region.id + '/' + place.name));
    showPlace(region, firstPlace);
    for (const route of [...routeLayer.children]) {
      const active = storyById.get(route.dataset.story)?.regions.includes(region.id);
      route.classList.toggle('is-active', active);
      if (active) routeLayer.append(route);
    }

    if (story) {
      storyLink.href = assetUrl(story.url) + '#storyRoutePlate';
      storyLink.setAttribute('aria-label', `查看本期路线与摄影故事：${story.title}`);
      const cover = assetUrl(story.cover);
      if (!document.getElementById('atlas').dataset.imagesReady) {
        storyCover.dataset.src = responsivePhotoUrl(cover, 640);
        storyCover.dataset.srcset =
          storyCover.dataset.src + ' 640w, ' + responsivePhotoUrl(cover, 1280) + ' 1280w';
      } else
        setResponsivePhoto(storyCover, cover, {
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
    viewport.select(provincePaths.find(path => path.dataset.atlasRegion === region.id));
    for (const group of placeGroups) {
      group.classList.toggle('is-selected', group.dataset.atlasRegion === String(region.id));
    }
    for (const button of buttons) {
      const active = button.dataset.atlasRegion === String(region.id);
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }

    if (updateUrl) {
      syncRegionUrl(region.id);
      onSelect(region.id);
    }
  }

  provinceLayer.addEventListener('click', (event) => {
    const path = event.target.closest('[data-atlas-region]');
    if (!path) return;
    if (path.dataset.atlasRegion === activeRegion?.id) viewport.toggleZoom();
    else selectRegion(path.dataset.atlasRegion);
  });

  const requestedRegion = new URL(window.location.href).searchParams.get('region');
  const initialRegion = regionById.has(requestedRegion)
    ? requestedRegion
    : String(atlas.defaultRegion || regions[0].id);
  selectRegion(initialRegion, { updateUrl: false });
  status.hidden = true;
  return { selectRegion };
}
