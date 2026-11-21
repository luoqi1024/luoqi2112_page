import { assetUrl, responsivePhotoUrl, setResponsivePhoto } from './photos-data.js?v=20261121-life-issues';

const SVG_NS = 'http://www.w3.org/2000/svg';

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

export function createAtlasProjection(features, width = 860, height = 610, padding = 38) {
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
  const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY));
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;

  return (point) => {
    const [rawX, rawY] = albersChinaRaw(point);
    return [offsetX + (rawX - minX) * scale, offsetY + (maxY - rawY) * scale];
  };
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

function atlasConfigUrl(value) {
  return assetUrl(value || '');
}

export async function initPhotoAtlas(config, onSelect) {
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
      group.append(
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
      storyLink.href = atlasConfigUrl(story.url) + '#storyRoutePlate';
      storyLink.setAttribute('aria-label', `查看本期路线与摄影故事：${story.title}`);
      const cover = atlasConfigUrl(story.cover);
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
    if (path) selectRegion(path.dataset.atlasRegion);
  });

  const requestedRegion = new URL(window.location.href).searchParams.get('region');
  const initialRegion = regionById.has(requestedRegion)
    ? requestedRegion
    : String(atlas.defaultRegion || regions[0].id);
  selectRegion(initialRegion, { updateUrl: false });
  status.hidden = true;
  return { selectRegion };
}
