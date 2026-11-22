import { createSvgElement, createAtlasProjection, atlasGeometryPath } from './photos-atlas.js?v=20261122-story-gb-roads';
import { normalizePhotoData, responsivePhotoUrl } from './photos-data.js?v=20261122-story-gb-roads';
import { element, button, pad, reduced } from './photos-ui.js?v=20261122-story-gb-roads';

const siteRoot = new URL('../', import.meta.url);
const siteUrl = (path) => new URL(path, siteRoot).href;

// Ignore display separators when matching names such as 张掖 · 七彩丹霞.
const placeKey = (name) => String(name || '').replace(/[\s·]+/gu, '');
function validPoint(coords) {
  return Array.isArray(coords) && coords.length === 2 && coords.every(Number.isFinite)
    && Math.abs(coords[0]) <= 180 && Math.abs(coords[1]) <= 90;
}

function itinerary(story, photos, regions, project) {
  const regionIds = new Set(story?.regions || []);
  const images = photos.filter((p) => p.storyId === story?.id)
    .sort((a, b) => (a.exif?.datetime || a.date || '9999').localeCompare(b.exif?.datetime || b.date || '9999'));
  const places = regions.flatMap((r) => (r.places || []).map((p) => ({ ...p, regionId: r.id })));
  const localPlaces = places.filter((p) => regionIds.has(p.regionId));
  const photographed = localPlaces.flatMap((place) => {
    const photo = images.find((p) => p.atlasRegionId === place.regionId && p.atlasPlace === place.name);
    return photo && validPoint(place.coordinates) ? [{ name: place.name, point: project(place.coordinates), photo }] : [];
  }).sort((a, b) => images.indexOf(a.photo) - images.indexOf(b.photo));

  if (Array.isArray(story?.route) && story.route.length) {
    const stops = story.route.map((entry) => {
      const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
      if (!name) return null;
      const key = placeKey(name);
      const nearby = localPlaces.filter((p) => placeKey(p.name) === key);
      const matches = nearby.length ? nearby : places.filter((p) => placeKey(p.name) === key);
      const place = matches.length === 1 ? matches[0] : null;
      const coordinates = entry.coordinates ?? place?.coordinates;
      if (!validPoint(coordinates)) return null;
      const photo = entry.photographed === false ? null :
        images.find((p) => p.id === entry.photoId) ||
        images.find((p) => (!place || place.regionId === p.atlasRegionId) &&
          (placeKey(p.atlasPlace) === key || placeKey(p.place) === key));
      return { name, point: project(coordinates), photo, routeNote: entry.routeNote };
    });
    // An unresolved waypoint must not silently create a shortcut between its neighbors.
    if (stops.every(Boolean)) {
      if (story.loop === true && stops.length >= 3) {
        const first = stops[0], last = stops.at(-1);
        if (first.point[0] === last.point[0] && first.point[1] === last.point[1]) last.closing = true;
        else stops.push({ ...first, closing: true });
      }
      return { stops, routed: true };
    }
  }
  return { stops: photographed, routed: false };
}

const chapterSelector = '.storyChapter, .storySpread, .storyIce, .storyRed, .storyFinal';

function link(label, href, className) {
  const a = element('a', className, label);
  a.href = href;
  return a;
}

function archiveImage(src, alt, eager = false) {
  const img = element('img');
  img.alt = alt;
  img.loading = eager ? 'eager' : 'lazy';
  img.decoding = 'async';
  img.src = responsivePhotoUrl(siteUrl(src), 640);
  return img;
}

function exifLine(photo) {
  const e = photo.exif || {};
  const time = (e.datetime || '').replaceAll('-', '.').replace('T', ' ');
  return [e.body, e.lens, e.focal, e.aperture, e.shutter && e.shutter.replace(/s?$/, 's'),
    e.iso && 'ISO ' + e.iso, time].filter(Boolean).join(' · ');
}

function collectFrames(photos, story) {
  const byUrl = new Map(photos.map(p => [siteUrl(p.rawSrc), p]));
  const frames = [];
  for (const figure of document.querySelectorAll('.storyFigure')) {
    const img = figure.querySelector('img');
    if (!img) continue;
    const original = img.src.replace('/responsive/', '/').replace(/-(?:640|1280)\.webp$/, '.webp');
    const photo = byUrl.get(original);
    if (!photo) continue;
    const note = figure.querySelector('.lifeCaption__note')?.textContent.trim() || '';
    const title = figure.querySelector('.lifeCaption__title')?.textContent.trim() || '';
    frames.push({ figure, img, photo, note, title, chapter: figure.closest(chapterSelector) });
  }
  const lead = frames.find(f => f.figure.hasAttribute('data-quintessence')) ||
    frames.find(f => f.photo.rawSrc === story.cover) || frames.find(f => f.photo.featured);
  const roll = story.issue.match(/\d+$/)?.[0] || '';
  frames.forEach((frame, index) => {
    frame.main = frame === lead;
    frame.code = (frame.main ? '#25' : pad(index + 1) + 'A') + ' · ROLL ' + roll;
    const camera = frame.photo.camera.replace(/^NIKON\b/, 'Nikon');
    const aerial = frame.photo.kind === 'aerial' || frame.photo.tags?.some(tag => /无人机|航拍/.test(tag));
    const meta = element('span', 'lifeCaption__meta',
      ['▸ ' + frame.code, camera, aerial && '航拍'].filter(Boolean).join(' · '));
    const head = frame.figure.querySelector('.lifeCaption__head');
    const timestamp = head?.querySelector('.lifeCaption__meta');
    if (timestamp) timestamp.replaceWith(meta);
    else head?.append(meta);
    if (frame.main) {
      frame.figure.classList.add('storyFigure--quintessence');
      frame.figure.append(element('span', 'frameStamp', 'Frame #25 · The Quintessence'));
    }
  });
  return frames;
}

function initViewer(frames) {
  if (!frames.length) return;
  const dialog = element('dialog', 'storyViewer');
  dialog.setAttribute('aria-label', '本期暗房观片');
  dialog.innerHTML = `<div class="viewerShell"><header><span>NEGATIVE ARCHIVE</span><button type="button" autofocus>关闭 ×</button></header>
    <div class="viewerStage"><button type="button" aria-label="上一张">←</button><img alt=""><button type="button" aria-label="下一张">→</button></div>
    <footer aria-live="polite"><small></small><strong></strong><p class="viewerNote"></p><p class="viewerExif"></p><i>“Beautiful things don't ask for attention.”</i></footer>
    <nav class="viewerStrip" aria-label="本期底片"></nav></div>`;
  document.body.append(dialog);
  const [close, previous, next] = dialog.querySelectorAll('button');
  const image = dialog.querySelector('img');
  const strip = dialog.querySelector('.viewerStrip');
  const thumbs = frames.map((frame, index) => {
    const description = [frame.main ? '#25 主照' : '第 ' + (index + 1) + ' 帧', frame.img.alt].join(' · ');
    const thumb = button('', () => show(index), description);
    thumb.title = description;
    thumb.append(archiveImage(frame.photo.rawSrc, '', true));
    if (frame.main) thumb.append(element('span', 'thumbStamp', '#25'));
    strip.append(thumb);
    return thumb;
  });
  let current = 0, ticket = 0, trigger;
  function show(index) {
    const request = ++ticket;
    current = (index + frames.length) % frames.length;
    const f = frames[current];
    const original = siteUrl(f.photo.rawSrc);
    image.src = responsivePhotoUrl(original, 1280);
    image.alt = f.img.alt;
    const hi = new Image();
    hi.src = original;
    hi.decode().then(() => {
      if (request === ticket && dialog.open) image.src = original;
    }).catch(() => {}); // Keep the preview when the original is unavailable.
    for (const step of [-1, 1]) {
      const neighbor = frames[(current + step + frames.length) % frames.length];
      new Image().src = responsivePhotoUrl(siteUrl(neighbor.photo.rawSrc), 1280);
    }
    thumbs.forEach((thumb, i) => thumb.setAttribute('aria-pressed', String(i === current)));
    const selected = thumbs[current];
    strip.scrollTo({
      left: selected.offsetLeft - (strip.clientWidth - selected.offsetWidth) / 2,
      behavior: reduced.matches ? 'instant' : 'smooth',
    });
    dialog.querySelector('small').textContent = pad(current + 1) + ' / ' + pad(frames.length) + '　·　' + f.code;
    dialog.querySelector('strong').textContent = f.title || f.photo.caption || f.img.alt;
    const note = dialog.querySelector('.viewerNote');
    note.textContent = f.note;
    note.hidden = !f.note;
    dialog.querySelector('.viewerExif').textContent = exifLine(f.photo);
    dialog.querySelector('i').hidden = !f.main;
  }
  frames.forEach(({ img }, index) => {
    let opener = img.closest('a');
    if (!opener) {
      opener = link('', siteUrl(frames[index].photo.rawSrc));
      img.replaceWith(opener);
      opener.append(img);
    }
    opener.classList.add('viewerOpener');
    opener.setAttribute('aria-haspopup', 'dialog');
    opener.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      trigger = opener;
      dialog.showModal();
      show(index);
      document.documentElement.classList.add('storyViewing');
    });
  });
  close.onclick = () => dialog.close();
  previous.onclick = () => show(current - 1);
  next.onclick = () => show(current + 1);
  dialog.addEventListener('click', event => {
    if ([dialog, dialog.querySelector('.viewerShell'), dialog.querySelector('.viewerStage')].includes(event.target)) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    show(current + (event.key === 'ArrowLeft' ? -1 : 1));
    if (strip.contains(document.activeElement)) thumbs[current].focus({preventScroll:true});
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    ++ticket;
    document.documentElement.classList.remove('storyViewing');
    trigger?.focus({ preventScroll: true });
  });
}

function addEditorial(story, stories, lead) {
  const motto = element('aside', 'storyMotto');
  motto.innerHTML = `<p><i>“To see the world, things dangerous to come to, to see behind walls, draw closer, to find each other, and to feel.”</i>
    <span>看见世界，贴近彼此，感受生活。</span></p>`;
  if (lead) {
    const jump = button('Negative sleeve #25 · 直达本期主照 ↓', () => {
      lead.figure.scrollIntoView({behavior: reduced.matches ? 'instant' : 'smooth', block: 'center'});
      lead.img.closest('a')?.focus({preventScroll: true});
      if (!reduced.matches) {
        lead.figure.classList.remove('spotlight');
        void lead.figure.offsetWidth;
        lead.figure.classList.add('spotlight');
      }
    });
    lead.figure.addEventListener('animationend', event => {
      if (event.animationName === 'frameSpotlight') lead.figure.classList.remove('spotlight');
    });
    jump.className = 'mottoJump';
    motto.append(jump);
  }
  document.querySelector('.storyIntro__label').after(motto);
  const end = element('nav', 'storyColophon');
  end.setAttribute('aria-label', '继续阅读其他摄影期刊');
  end.append(element('h2', '', '继续阅读'));
  for (const other of stories.filter(s => s.id !== story.id)) {
    const card = link('', siteUrl(other.url));
    card.append(archiveImage(other.cover, ''), element('small', '', other.issue + '　/　' + other.photoCount + ' FRAMES'),
      element('strong', '', other.name + '　↗'));
    end.append(card);
  }
  document.querySelector('.storyAfterword').after(end);
}

// Keep every waypoint on the spline. Reuse the same segments for the travelled overlay.
function spline(points, loop) {
  const segments = [];
  const n = points.length;
  const at = i => points[loop ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - (loop ? 0 : 1); i++) {
    const [a,b,c,d] = [at(i-1), at(i), at(i+1), at(i+2)];
    const control1 = b.map((v,k) => v + (c[k] - a[k]) / 6);
    const control2 = c.map((v,k) => v - (d[k] - b[k]) / 6);
    segments.push('C' + control1.join(' ') + ' ' + control2.join(' ') + ' ' + c.join(' '));
  }
  return segments;
}


const roadGrades = {
  'nat-exp':'国家高速', 'prov-exp':'省级高速', 'nat-hwy':'国道', 'prov-road':'省道', 'local-road':'地方道路'
};

function classifyRoadCode(code, fullText) {
  if (code.startsWith('G')) return /^G(?:\d{1,2}|\d{4})[A-Z]?$/.test(code) || /高速|林拉/.test(fullText) ? 'nat-exp' : 'nat-hwy';
  if (code.startsWith('S')) return /^S(?:\d{1,2}|\d{4})[A-Z]?$/.test(code) || fullText.includes('高速') ? 'prov-exp' : 'prov-road';
  return 'local-road';
}

function parseRoadTokens(roadsText) {
  const parts = (Array.isArray(roadsText) ? roadsText : [roadsText])
    .filter(s => typeof s === 'string').flatMap(s => s.split('、')).map(s => s.trim()).filter(Boolean);
  return parts.map(part => {
    const numbers = /\b[GSX]\d{1,4}[A-Z]?\b/g;
    const refs = [...new Set(part.match(numbers) || [])];
    const label = part.replace(numbers,'').replaceAll('/',' ').replace(/\s*[-－]\s*/g,'-').replace(/\s+/g,' ').trim();
    if (!refs.length && label === '柳格高速') refs.push('G3011');
    const codes = refs.map(code => ({code, grade:classifyRoadCode(code,part)}));
    return {codes,label,primaryGrade:codes[0]?.grade || 'local-road'};
  });
}

function roadEntries({codes,label,primaryGrade}) {
  return codes.length ? codes : [{code:label, grade:primaryGrade}];
}

function legVisualClass(tokens) {
  const grades = tokens.flatMap(roadEntries).map(entry => entry.grade);
  if (grades.some(grade => grade.endsWith('-exp'))) return 'expressway';
  return grades.includes('nat-hwy') ? 'national' : 'provincial';
}

let plaqueId = 0;
function buildGbSvgShield({code,grade}) {
  const express = grade.endsWith('-exp');
  const width = Math.max(32, Math.ceil([...code].reduce((sum,ch) => sum + (ch.charCodeAt(0)>127 ? 10 : 6.8),11)));
  const height = express ? 23 : 19;
  const plaque = createSvgElement('svg',{class:'gbPlaque gbPlaque--'+grade,width,height,viewBox:'0 0 '+width+' '+height,'aria-hidden':'true'});
  const box = {x:.7,y:.7,width:width-1.4,height:height-1.4,rx:3.2};
  plaque.append(createSvgElement('rect',{...box,class:'gbFace'}));
  if (express) {
    const id = 'gbBrow'+(++plaqueId);
    const clip = createSvgElement('clipPath',{id});
    clip.append(createSvgElement('rect',box));
    const band = createSvgElement('g',{'clip-path':'url(#'+id+')'});
    band.append(createSvgElement('rect',{class:'gbBrow',x:1,y:1,width:width-2,height:6.2}),
      createSvgElement('path',{d:'M1 7.2H'+(width-1),stroke:'#fff','stroke-width':.65}));
    const micro = createSvgElement('text',{class:'gbMicro',x:width/2,y:5.8});
    micro.textContent = roadGrades[grade];
    plaque.append(clip,band,micro);
  } else if (grade === 'prov-road' || grade === 'nat-hwy') {
    plaque.append(createSvgElement('rect',{class:'gbInner',x:2,y:2,width:width-4,height:height-4,rx:2}));
  }
  const number = createSvgElement('text',{class:'gbNumber',x:width/2,y:express ? 18.7 : 13});
  number.textContent = code;
  plaque.append(number);
  return plaque;
}

function buildMapShield(entry, centers, current = false) {
  const {code,grade,label} = entry;
  const plaque = buildGbSvgShield(entry);
  const width = Number(plaque.getAttribute('width')), height = Number(plaque.getAttribute('height'));
  const group = createSvgElement('g',{class:'roadShield'+(current ? ' is-current' : ''),role:'button',
    tabindex:0,'aria-label':[current && '当前',roadGrades[grade],code,label !== code && label].filter(Boolean).join(' '),
    'aria-pressed':'false','data-road-code':code});
  const shortName = label && label !== code ? label : '';
  const caption = current ? '当前'+(shortName ? ' · '+shortName : '') : grade.endsWith('-exp') && shortName;
  let totalWidth = width;
  if (caption) {
    const sideWidth = [...caption].reduce((n,ch) => n+(ch.charCodeAt(0)>127 ? 9 : 5),9);
    const side = createSvgElement('rect',{class:'gbSide',x:width-3,y:(height-17)/2,width:sideWidth+3,height:17,rx:3});
    const text = createSvgElement('text',{class:'gbSideName',x:width+sideWidth/2,y:height/2+3});
    text.textContent = caption;
    group.append(side,text);
    totalWidth += sideWidth;
  }
  group.append(plaque);
  const tether = createSvgElement('g',{class:'gbTether '+grade,'aria-hidden':'true'});
  const leader = createSvgElement('line');
  const anchor = createSvgElement('circle',{r:current ? 3.8 : 2.6});
  tether.append(leader,anchor);
  group.style.display = tether.style.display = 'none';
  return {group,tether,leader,anchor,width:totalWidth,height,centers,code,grade};
}

function roadShields(legs, paths, recorded, project, fit) {
  const roads = new Map();
  legs.forEach((leg,i) => {
    if (!leg?.tokens.length) return;
    const path = paths[i], length = path.getTotalLength();
    const centers = [.5,.38,.62,.2,.8].map(t => {
      const p = path.getPointAtLength(length*t);
      return [p.x,p.y];
    });
    leg.centers = centers;
    const seen = new Set();
    for (const token of leg.tokens) for (const entry of roadEntries(token)) {
      if (seen.has(entry.code)) continue;
      seen.add(entry.code);
      const road = roads.get(entry.code) || {...entry,total:0,longest:-1};
      road.total += length;
      if (length > road.longest) Object.assign(road,{longest:length,centers,label:token.label || road.label});
      roads.set(entry.code,road);
    }
  });
  const ranked = [...roads.values()].sort((a,b) => b.total-a.total);
  const firstByGrade = ['nat-exp','nat-hwy','prov-road','prov-exp'].map(grade => ranked.find(r => r.grade === grade)).filter(Boolean);
  return [...new Set([...firstByGrade,...ranked])].map(road => {
    const anchors = recorded?.[road.code]?.filter(validPoint);
    return buildMapShield(road,anchors?.length ? anchors.map(p=>fit(project(p))) : road.centers);
  });
}

function boxGap(a, b) {
  const dx = Math.max(0, b.x - a.x - a.width, a.x - b.x - b.width);
  const dy = Math.max(0, b.y - a.y - a.height, a.y - b.y - b.height);
  return Math.hypot(dx, dy);
}

function placeShield(shield, occupied, scale) {
  const {group,tether,leader,anchor,width,height,centers} = shield;
  const w = width*scale, h = height*scale;
  const offsets = [[0,-1],[0,1],[1,0],[-1,0],[1,-1],[-1,-1],[1,1],[-1,1],[0,0]];
  for (const reach of [1,2,3,4,5]) for (const [cx,cy] of centers) for (const [dx,dy] of offsets) {
    const x = Math.max(4,Math.min(716-w,cx-w/2 + dx*(w/2+8)*reach));
    const y = Math.max(4,Math.min(386-h,cy-h/2 + dy*(h/2+8)*reach));
    const box = {x,y,width:w,height:h};
    if (occupied.some(obstacle => boxGap(box,obstacle)<3)) continue;
    group.setAttribute('transform','translate('+x+' '+y+') scale('+scale+')');
    const endX = Math.max(x,Math.min(x+w,cx)), endY = Math.max(y,Math.min(y+h,cy));
    leader.setAttribute('x1',cx); leader.setAttribute('y1',cy);
    leader.setAttribute('x2',endX); leader.setAttribute('y2',endY);
    anchor.setAttribute('cx',cx); anchor.setAttribute('cy',cy);
    group.style.display = tether.style.display = '';
    occupied.push(box);
    return true;
  }
  return false;
}

function drawMapFurniture(svg, project, fit, center) {
  const [lon, lat] = project.unproject(center);
  const xy = (x, y) => fit(project([x, y]));
  const [west, east] = [xy(lon - .5, lat), xy(lon + .5, lat)];
  const unitsPerKm = Math.hypot(east[0] - west[0], east[1] - west[1]) /
    (6371.0088 * Math.PI / 180 * Math.cos(lat * Math.PI / 180));
  const km = unitsPerKm * 100 < 52 ? 200 : unitsPerKm * 100 > 140 ? 50 : 100;
  const width = km * unitsPerKm;
  const scaleBar = createSvgElement('g', {class:'plateScale', transform:'translate(22 332)'});
  const zero = createSvgElement('text', {y:-6});
  const end = createSvgElement('text', {x:width, y:-6, 'text-anchor':'end'});
  zero.textContent = '0';
  end.textContent = km + ' km';
  scaleBar.append(zero, end, createSvgElement('rect', {width,height:4}),
    createSvgElement('rect', {x:width/2,width:width/2,height:4,fill:'#fffaf0'}));

  const north = xy(lon, lat + .1), origin = xy(lon, lat);
  const bearing = Math.atan2(north[0] - origin[0], origin[1] - north[1]) * 180 / Math.PI;
  const compass = createSvgElement('g', {class:'plateCompass',transform:'translate(688 354)'});
  const letter = createSvgElement('text', {y:-14,'text-anchor':'middle'});
  letter.textContent = 'N';
  compass.append(createSvgElement('circle', {r:11}), letter,
    createSvgElement('path', {d:'M0 -9 L3 4 L0 2 L-3 4 Z', transform:'rotate(' + bearing + ')'}));
  svg.append(scaleBar, compass);

  const grid = createSvgElement('g', {class:'plateGraticule','aria-hidden':'true'});
  const line = points => grid.append(createSvgElement('path', {d:'M' + points.map(p => p.join(' ')).join('L')}));
  for (let x = 70; x <= 138; x += 2) line([xy(x,16),xy(x,56)]);
  for (let y = 16; y <= 56; y += 2) line(Array.from({length:35}, (_, i) => xy(70 + i * 2, y)));
  svg.querySelector('.plateCourseLayer').before(grid);
  return [{x:16,y:312,width:width+16,height:32}, {x:672,y:328,width:32,height:43}];
}

function routeDrawing(features, regions, story, photos, archive) {
  const project = createAtlasProjection(features);
  const { stops, routed } = itinerary(story, photos, regions, project);
  const loop = stops.at(-1)?.closing === true;
  if (loop) stops.pop();
  if (!stops.length) return null;
  // Match by endpoints so an outdated or missing leg cannot shift the rest of the tour.
  const legs = routed ? stops.slice(0, loop ? stops.length : -1).map((stop, i) => {
    const next = stops[(i + 1) % stops.length];
    const leg = archive?.legs?.find(l => l.from === stop.name && l.to === next.name);
    if (!Array.isArray(leg?.coordinates) || leg.coordinates.length < 2 ||
        !leg.coordinates.every(validPoint)) return null;
    return {line:leg.coordinates.map(project), tokens:parseRoadTokens(leg.roads)};
  }) : [];
  // Lakes and summits have separate POI coordinates. Place route markers on the driving network.
  const access = stops.map((stop, i) => legs[i]?.line[0] ??
    legs[i === 0 && loop ? legs.length - 1 : i - 1]?.line.at(-1) ?? stop.point);
  const extent = access.concat(legs.flatMap(leg => leg?.line || []));
  const xs = extent.map(p => p[0]), ys = extent.map(p => p[1]);
  const left = Math.min(...xs), top = Math.min(...ys);
  const dx = Math.max(...xs) - left, dy = Math.max(...ys) - top;
  const scale = Math.min(600 / Math.max(30, dx), 290 / Math.max(22, dy));
  function fit([x,y]) {
    return [360 + (x - left - dx / 2) * scale, 193 + (y - top - dy / 2) * scale];
  }
  const svg = createSvgElement('svg', { viewBox: '0 0 720 390', role: 'group', 'aria-label': story.name + '局部路线图' });
  const regionCodes = regions.filter(r => story.regions.includes(r.id)).map(r => String(r.adcode));
  for (const feature of features) {
    svg.append(createSvgElement('path', { d: atlasGeometryPath(feature.geometry, xy => fit(project(xy))),
      class: regionCodes.includes(String(feature.properties.adcode)) ? 'plateLand inStory' : 'plateLand' }));
  }
  const points = access.map(fit);
  const curves = spline(points, loop);
  const course = createSvgElement('g',{class:'plateCourseLayer'});
  const casing = createSvgElement('g',{class:'plateCasingLayer'});
  const ink = createSvgElement('g',{class:'plateInkLayer'});
  const halo = createSvgElement('path',{class:'plateActiveHalo'});
  const growth = createSvgElement('path',{class:'plateGrowth',pathLength:1});
  svg.append(course,halo,casing,ink,growth);
  const segments = curves.map((curve,i) => {
    const leg = legs[i], end = points[(i+1) % points.length];
    const shape = leg ? leg.line.slice(1,-1).map(p => 'L'+fit(p).join(' ')).join('')+'L'+end.join(' ') : curve;
    const tokens = leg?.tokens || [];
    const type = 'is-'+legVisualClass(tokens);
    const codes = [...new Set(tokens.flatMap(roadEntries).map(e => e.code))].join(' ');
    const d = 'M'+points[i].join(' ')+shape;
    const attrs = {d,'data-leg':i,'data-codes':codes};
    const line = createSvgElement('path',{...attrs,class:'plateLeg plateLeg--upcoming '+type});
    const backing = createSvgElement('path',{...attrs,class:'plateLegCasing'});
    const traveled = createSvgElement('path',{...attrs,class:'plateLeg plateLeg--traveled '+type});
    course.append(line); casing.append(backing); ink.append(traveled);
    return {line,backing,traveled,d,type,codes};
  });
  const markers = [], labels = [];
  stops.forEach(({name, photo}, i) => {
    const [x,y] = points[i];
    const g = createSvgElement('g', { class: 'plateStop' + (photo ? ' withFrame' : ''), 'data-stop': i });
    const title = createSvgElement('title');
    title.textContent = name;
    g.append(title, createSvgElement('circle', { cx:x, cy:y, r:11, class:'stopTarget' }),
      createSvgElement('circle', { cx:x, cy:y, r:photo ? 5 : 2.8, class:'stopDot' }));
    svg.append(g);
    markers.push(g);
    if (!photo) return;
    const label = createSvgElement('text', {class:'plateLabel','data-stop':i});
    label.textContent = name;
    const leader = createSvgElement('line',{x1:x,y1:y,class:'plateLeader'});
    svg.append(leader);
    labels.push({label, leader, x, y});
  });
  svg.append(...labels.map(item => item.label));
  const shields = roadShields(legs,segments.map(s=>s.line),archive?.roadAnchors,project,fit);
  const tethers = createSvgElement('g');
  const badges = createSvgElement('g',{class:'gbMapSigns'});
  markers[0].before(tethers);
  svg.append(badges);
  for (const shield of shields) {
    badges.append(shield.group);
    tethers.append(shield.tether);
  }
  let activeShield, obstacles;
  function placeShields() {
    if (!obstacles) return;
    const occupied = [...obstacles];
    const compact = svg.clientWidth < 520;
    const size = Math.min(2.5,Math.max(.88,1/(svg.getScreenCTM()?.a || 1)));
    let placed = 0;
    for (const shield of [activeShield,...shields].filter(Boolean)) {
      shield.group.style.display = shield.tether.style.display = 'none';
      if (shield !== activeShield && (placed >= (compact ? 3 : 6) || shield.code === activeShield?.code)) continue;
      // Dense clusters may only have room for a compact current-road caption.
      let visible = placeShield(shield,occupied,size);
      if (!visible && shield === activeShield && compact && size > 1.65) {
        visible = placeShield(shield,occupied,1.65);
      }
      if (visible && shield !== activeShield) placed++;
    }
  }
  const lines = legs.flatMap((leg, i) => {
    const line = leg ? leg.line.map(fit) : [points[i], points[(i+1) % points.length]];
    return line.slice(1).map(([x,y], j) => {
      const [ax,ay] = line[j];
      return {x:Math.min(ax,x), y:Math.min(ay,y), width:Math.abs(x-ax), height:Math.abs(y-ay)};
    });
  });
  const furniture = drawMapFurniture(svg, project, fit, [left + dx/2, top + dy/2]);
  // Space labels in screen pixels so the four nearby 腾冲 stops remain readable on phones.
  new ResizeObserver(() => {
    const font = Math.max(12, 10 * 720 / Math.max(240, svg.clientWidth));
    const reserved = matchMedia('(max-width:600px)').matches ? furniture : [...furniture,{x:12,y:346,width:390,height:38}];
    const occupied = [...reserved, ...points.map(([x,y]) => ({x:x-4, y:y-4, width:8, height:8}))];
    for (const {label, leader, x, y} of labels) {
      label.style.fontSize = font + 'px';
      const size = label.getBBox(), w = size.width, h = Math.max(font, size.height);
      let best, bestCost = Infinity;
      for (let row = 0; row < 7; row++) {
        for (const [sx,sy] of [[1,-1],[-1,-1],[1,1],[-1,1]]) {
          const box = {
            x:Math.max(8, Math.min(712-w, sx > 0 ? x+9 : x-w-9)),
            y:Math.max(6, Math.min(384-h, sy < 0 ? y-8-h-row*(h+2) : y+8+row*(h+2))),
            width:w, height:h
          };
          const cost = occupied.filter(b => boxGap(b,box) < 2).length * 10000 +
            lines.filter(b => boxGap(b,box) < 2).length * 10 + row;
          if (cost < bestCost) { best = box; bestCost = cost; }
        }
        if (bestCost <= row) break;
      }
      const lx = best.x, ly = best.y + Number(label.getAttribute('y') || 0) - size.y;
      label.setAttribute('x',lx);
      label.setAttribute('y',ly);
      leader.setAttribute('x2',Math.max(lx,Math.min(lx+w,x)));
      leader.setAttribute('y2',Math.max(best.y,Math.min(best.y+h,y)));
      leader.style.display = boxGap(best,{x,y,width:0,height:0}) > 16 ? '' : 'none';
      occupied.push(best);
    }
    const labelBoxes = labels.map(({label}) => {
      const {x,y,width,height} = label.getBBox();
      return {x:x-12, y:y-6, width:width+24, height:height+12};
    });
    obstacles = [...reserved, ...labelBoxes, ...points.map(([x,y]) => ({x:x-14, y:y-14, width:28, height:28}))];
    for (const {leader} of labels) {
      if (leader.style.display !== 'none') obstacles.push(leader.getBBox());
    }
    placeShields();
  }).observe(svg);
  const ring = createSvgElement('circle', {r:10, class:'plateRing'});
  svg.append(ring);
  let animation, lastCount = 0;
  function draw(index, closed, animate) {
    animation?.cancel();
    animation = null;
    growth.removeAttribute('d');
    const count = closed ? segments.length : Math.min(index,segments.length);
    const prev = count-1, segment = segments[prev], leg = legs[prev];
    const growing = animate && segment && count === lastCount+1 && !reduced.matches;
    lastCount = count;
    segments.forEach(({traveled,backing,line},i) => {
      const reached = i < count && !(growing && i === prev);
      line.style.display = i >= count || (growing && i === prev) ? '' : 'none';
      traveled.style.display = backing.style.display = reached ? '' : 'none';
      traveled.classList.toggle('is-current',i === prev);
    });
    halo.removeAttribute('d');
    for (const [path,cls] of [[halo,'plateActiveHalo'],[growth,'plateGrowth']]) {
      path.setAttribute('class',cls+' '+(segment?.type || ''));
      path.dataset.codes = segment?.codes || '';
    }
    if (segment && !growing) halo.setAttribute('d',segment.d);
    if (growing) {
      growth.setAttribute('d',segment.d);
      animation = growth.animate([{strokeDashoffset:1},{strokeDashoffset:0}],{duration:900,easing:'ease-in-out'});
      const running = animation;
      running.onfinish = () => {
        if (animation !== running) return;
        segment.line.style.display = 'none';
        segment.backing.style.display = segment.traveled.style.display = '';
        halo.setAttribute('d',segment.d);
        growth.removeAttribute('d');
      };
    }
    activeShield?.group.remove();
    activeShield?.tether.remove();
    activeShield = null;
    if (leg?.tokens.length) {
      const token = leg.tokens[0];
      activeShield = buildMapShield({...roadEntries(token)[0],label:token.label},leg.centers,true);
      badges.append(activeShield.group);
      tethers.append(activeShield.tether);
    }
    placeShields();
    ring.setAttribute('cx',points[index][0]);
    ring.setAttribute('cy',points[index][1]);
    markers.forEach((g,i) => g.classList.toggle('current', i === index));
  }
  const aligned = legs.length > 0 && legs.length === archive?.legs?.length &&
    legs.every((leg,i) => leg && archive.legs[i].from === stops[i].name);
  const elevations = aligned && Array.isArray(archive.elevations) && archive.elevations.length === stops.length &&
    archive.elevations.every(Number.isFinite) ? archive.elevations : [];
  return { svg, stops, loop, draw, routed, legs, elevations, distanceKm: aligned ? archive.distanceKm : null };
}

const meters = value => value.toLocaleString('zh-CN') + ' m';

function elevationProfile(container, stops, elevations, choose) {
  const min = Math.min(...elevations), max = Math.max(...elevations);
  const extremum = value => stops[elevations.indexOf(value)].name + ' ' + meters(value);
  const legend = element('div', 'elevationLegend');
  legend.append(element('strong', '', '站点海拔剖面 · ELEVATION PROFILE'),
    element('span', '', '最低 ' + extremum(min) + ' — 最高 ' + extremum(max)));
  const svg = createSvgElement('svg', {class:'elevationSvg', viewBox:'0 0 760 88', role:'group',
    'aria-label':'按行程排列的站点海拔，点击站点查看日志'});
  let width = 0, selected = 0, points = [];
  const defs = createSvgElement('defs');
  const gradient = createSvgElement('linearGradient', {id:'plateElevationFill', x2:0, y2:1});
  for (const [offset,alpha] of [[0,.32],[1,.04]]) {
    gradient.append(createSvgElement('stop', {offset,'stop-color':'#c95b45','stop-opacity':alpha}));
  }
  defs.append(gradient);
  svg.append(defs);
  const guides = [36,61].map(y => createSvgElement('line',{class:'elevGrid',x1:16,y1:y,y2:y}));
  const terrain = createSvgElement('path', {fill:'url(#plateElevationFill)'});
  const ridge = createSvgElement('path', {class:'elevCurve'});
  svg.append(...guides,terrain,ridge);
  const dots = stops.map((stop,i) => {
    const name = stop.name + ' · ' + meters(elevations[i]);
    const target = createSvgElement('g', {class:'elevTarget',role:'button',tabindex:0,'aria-label':name});
    const title = createSvgElement('title');
    title.textContent = name;
    target.append(title, createSvgElement('circle', {r:10,fill:'transparent'}),
      createSvgElement('circle', {class:'elevDot',r:2.4,'data-stop-idx':i}));
    target.addEventListener('click', () => choose(i));
    target.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(i); }
    });
    svg.append(target);
    return target;
  });
  const marker = createSvgElement('g',{class:'elevMarker','aria-hidden':'true'});
  const needle = createSvgElement('line',{y2:82});
  const dot = createSvgElement('circle',{r:4});
  const badge = createSvgElement('rect',{rx:5,height:15,width:66});
  const text = createSvgElement('text',{'text-anchor':'middle'});
  marker.append(needle,dot,badge,text);
  svg.append(marker);
  container.append(legend,svg);
  function selectPoint(index) {
    selected = index;
    const [x,y] = points[index];
    const left = Math.max(1, Math.min(width-67,x-33)), top = Math.max(1,y-20);
    needle.setAttribute('x1',x); needle.setAttribute('x2',x); needle.setAttribute('y1',y);
    dot.setAttribute('cx',x); dot.setAttribute('cy',y);
    badge.setAttribute('x',left); badge.setAttribute('y',top);
    text.setAttribute('x',left+33); text.setAttribute('y',top+11);
    text.textContent = meters(elevations[index]);
    dots.forEach((target,i) => target.setAttribute('aria-pressed', String(i === index)));
  }
  function resize() {
    const next = Math.min(760, Math.round(svg.clientWidth) || 760);
    if (width === next) return;
    width = next;
    svg.setAttribute('viewBox', '0 0 ' + width + ' 88');
    points = elevations.map((height,i) => [16 + (width-32)*i/(elevations.length-1),
      max === min ? 47 : 74 - 54*(height-min)/(max-min)]);
    const curve = 'M' + points[0].join(' ') + spline(points,false).join('');
    ridge.setAttribute('d',curve);
    terrain.setAttribute('d',curve + 'L' + (width-16) + ' 82H16Z');
    guides.forEach(line => line.setAttribute('x2',width-16));
    points.forEach(([x,y],i) => dots[i].setAttribute('transform','translate(' + x + ' ' + y + ')'));
    selectPoint(selected);
  }
  resize();
  new ResizeObserver(resize).observe(svg);
  return selectPoint;
}

function roadLegend() {
  const legend = element('div','plateLegendBar');
  legend.setAttribute('aria-label','道路图例');
  for (const [code,grade] of [['G6','nat-exp'],['S20','prov-exp'],['G215','nat-hwy'],['S314','prov-road']]) {
    const item = element('span','gbLegendItem');
    item.append(buildGbSvgShield({code,grade}),roadGrades[grade]);
    legend.append(item);
  }
  legend.append(element('span','gbLineKey','实线已抵'),element('span','gbLineKey upcoming','虚线待行'));
  return legend;
}

function roadChip(token) {
  const chip = element('button','gbChip');
  chip.type = 'button';
  const entries = roadEntries(token);
  chip.dataset.roadCode = entries.map(e=>e.code).join(' ');
  const name = [...token.codes.map(e=>e.code),token.label].filter(Boolean).join(' ');
  chip.setAttribute('aria-label','高亮 '+name);
  for (const entry of entries) chip.append(buildGbSvgShield(entry));
  if (token.codes.length && token.label) chip.append(element('span','gbChip__name',token.label));
  return chip;
}

function corridorControls(plate,svg) {
  let locked = '', preview = '';
  const selector = '[data-road-code]';
  function paint() {
    const codes = new Set((locked || preview).split(' ').filter(Boolean));
    const overlaps = keys => keys.split(' ').some(key=>codes.has(key));
    svg.classList.toggle('has-corridor-highlight',codes.size>0);
    for (const path of svg.querySelectorAll('[data-codes]')) path.classList.toggle('is-corridor',overlaps(path.dataset.codes));
    for (const item of plate.querySelectorAll(selector)) {
      item.classList.toggle('is-corridor',overlaps(item.dataset.roadCode));
      item.setAttribute('aria-pressed',String(Boolean(locked) && item.dataset.roadCode.split(' ').some(code=>locked.split(' ').includes(code))));
    }
  }
  plate.addEventListener('pointerover',event => {
    const el = event.target.closest(selector);
    if (!el || el.contains(event.relatedTarget) || event.pointerType === 'touch') return;
    preview = el.dataset.roadCode; paint();
  });
  plate.addEventListener('pointerout',event => {
    const el = event.target.closest(selector);
    if (!el || el.contains(event.relatedTarget)) return;
    preview = ''; paint();
  });
  plate.addEventListener('click',event => {
    const el = event.target.closest(selector);
    if (!el && !svg.contains(event.target)) return;
    locked = el && locked !== el.dataset.roadCode ? el.dataset.roadCode : '';
    preview = ''; paint();
  });
  plate.addEventListener('keydown',event => {
    if (event.key === 'Escape') { locked = preview = ''; paint(); }
    const shield = event.target.closest('.roadShield');
    if (shield && ['Enter',' '].includes(event.key)) {
      event.preventDefault();
      shield.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    }
  });
  return () => { preview = ''; paint(); };
}

function initPlate(drawing, story, frames, chapters) {
  const { svg, stops, loop, draw, routed, legs, elevations, distanceKm } = drawing;
  const plate = element('section', 'routePlate');
  plate.id = 'storyRoutePlate';
  plate.setAttribute('aria-label', '本期路线航图');
  plate.innerHTML = `<div class="plateMap"><header><small>Route plate</small><h3>本期路线航图</h3><button type="button" class="platePlay"></button></header>
    <div class="plateCanvas"></div><div class="plateTools">
    <div class="plateWindowWrap">
      <button type="button" class="railArrow" data-dir="-1" aria-label="向左浏览站点">‹</button>
      <div class="plateWindow" role="group" aria-label="全程站点"></div>
      <button type="button" class="railArrow" data-dir="1" aria-label="向右浏览站点">›</button>
    </div>
    <div class="elevationCard"><footer class="plateCredit"><span>路线示意 · 据行前规划与沿途照片整理</span><span></span></footer></div></div></div>
    <aside class="plateSide"><div class="stopCard"><div class="stopVisual"></div><div class="stopCopy">
    <div class="stopBar"><small></small><div class="stopStepper" role="group" aria-label="切换行程站点">
      <button type="button" data-step="-1" aria-label="上一站">← 上一站</button>
      <button type="button" data-step="1" aria-label="下一站">下一站 →</button>
    </div></div><h3></h3><p></p><div class="stopRoads" hidden></div><a class="stopJump">跳转到正文 ↓</a></div></div>
    <nav class="chapterDirectory" aria-label="本期章节"><h4>本期章节</h4></nav></aside>`;
  document.querySelector('.storyIntro').append(plate);
  const mapSurface = element('div','plateMapSurface');
  mapSurface.append(svg,roadLegend());
  plate.querySelector('.plateCanvas').append(mapSurface);
  const refreshCorridor = corridorControls(plate,svg);
  const credit = plate.querySelector('.plateCredit');
  const sources = credit.lastElementChild;
  if (legs.some(Boolean)) {
    credit.firstElementChild.textContent = '据行前规划与照片整理，驾车路线按路网推算';
    sources.append(link('© OpenStreetMap 贡献者', 'https://www.openstreetmap.org/copyright'));
  }
  const play = plate.querySelector('.platePlay');
  if (Number.isFinite(distanceKm)) {
    plate.querySelector('header h3').after(element('span', 'plateDistance',
      '估算里程 ' + distanceKm.toLocaleString('zh-CN') + ' km · ' + legs.length + ' 段'));
  }
  const profile = element('div', elevations.length >= 2 ? 'elevationPlot' : 'plateRuler');
  credit.before(profile);
  let markElevation;
  if (elevations.length >= 2) {
    markElevation = elevationProfile(profile, stops, elevations, choose);
    if (sources.childNodes.length) sources.append(' · ');
    sources.append(link('Copernicus DEM / Open-Meteo', 'https://open-meteo.com/en/docs/elevation-api'));
  } else {
    profile.setAttribute('role','group');
    profile.setAttribute('aria-label','全程站点刻度');
  }
  const windowBar = plate.querySelector('.plateWindow'), card = plate.querySelector('.stopCard');
  const directory = plate.querySelector('.chapterDirectory');
  const associated = stops.map(s => frames.find(f => f.photo === s.photo)?.chapter);
  const chapterLinks = new Map();
  const pillButtons = [], ticks = [];
  let current, timer;
  const playLabel = routed ? (loop ? '环线回放' : '路线回放') : '拍摄点巡览';
  function pause() {
    clearTimeout(timer);
    timer = null;
    play.textContent = '▶ ' + playLabel;
    play.setAttribute('aria-pressed','false');
  }
  function select(index, closed = false) {
    const animate = current !== undefined && (closed || current !== index);
    current = index;
    const stop = stops[index], chapter = associated[index];
    draw(index, closed, animate);
    pillButtons.forEach((b,i) => {
      b.setAttribute('aria-pressed',String(i===index));
      ticks[i]?.setAttribute('aria-pressed',String(i===index));
    });
    markElevation?.(index);
    const pill = pillButtons[index];
    const targetLeft = pill.offsetLeft + pill.offsetWidth / 2 - windowBar.clientWidth / 2;
    windowBar.scrollTo({left:targetLeft, behavior:animate && !reduced.matches ? 'smooth' : 'instant'});
    for (const [section,a] of chapterLinks) a.classList.toggle('current',section === chapter);
    const previous = closed ? stops.at(-1) : stops[index - 1];
    const next = closed ? null : stops[index + 1] ?? (loop ? stops[0] : null);
    const neighbors = [previous, stop, next];
    const caption = card.querySelector('small');
    caption.textContent = 'STOP ' + pad(index+1) + ' / ' + pad(stops.length) + '　·　' + (stop.photo ? '● 拍摄点' : '○ 沿线站点');
    if (elevations.length) caption.append(' · ', element('span', 'stopElevation', '海拔 ' + meters(elevations[index])));
    card.querySelector('h3').textContent = stop.name;
    card.querySelector('p').textContent = neighbors.filter(Boolean).map(s=>s.name).join(' → ');
    const roadInfo = card.querySelector('.stopRoads');
    const prev = closed ? stops.length - 1 : index - 1;
    roadInfo.replaceChildren();
    if (routed && prev >= 0) {
      const leg = legs[prev];
      if (leg?.tokens.length) {
        roadInfo.append(element('span','stopRoads__label','本段道路'),...leg.tokens.map(roadChip));
        if (stops[prev].routeNote) roadInfo.append(element('span','stopRoads__note',stops[prev].routeNote));
      } else if (!leg) roadInfo.append(element('span','stopRoads__note','站点间示意连线'));
    }
    roadInfo.hidden = !roadInfo.childElementCount;
    refreshCorridor();
    const visual = card.querySelector('.stopVisual');
    visual.replaceChildren();
    visual.hidden = !stop.photo;
    if (stop.photo) {
      visual.append(archiveImage(stop.photo.rawSrc,stop.photo.caption));
      const exif = stop.photo.exif || {};
      const params = [(stop.photo.camera || exif.body || '').replace(/^NIKON\b/, 'Nikon'),
        exif.focal, exif.aperture, exif.shutter && exif.shutter.replace(/s?$/, 's')].filter(Boolean);
      if (params.length) visual.append(element('span','stopExif',params.join(' · ')));
    }
    const jump = card.querySelector('a');
    jump.hidden = !chapter;
    if (chapter) jump.href = '#' + chapter.id;
  }
  function choose(i) { pause(); select(i); }
  for (const step of card.querySelectorAll('[data-step]')) {
    step.onclick = () => choose((current + Number(step.dataset.step) + stops.length) % stops.length);
  }
  for (const arrow of plate.querySelectorAll('[data-dir]')) {
    arrow.onclick = () => windowBar.scrollBy({left:220 * Number(arrow.dataset.dir),behavior:reduced.matches ? 'instant' : 'smooth'});
  }
  function advance() {
    if (current+1 < stops.length) {
      select(current+1);
      timer = setTimeout(advance,2000);
    } else {
      if (loop) select(0,true);
      pause();
    }
  }
  play.onclick = () => {
    if (timer) return pause();
    select(0);
    play.textContent = '■ 停止';
    play.setAttribute('aria-pressed','true');
    timer = setTimeout(advance,2000);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide',pause);
  svg.addEventListener('click', e => {
    const el = e.target.closest('[data-stop]');
    if (!el) return;
    // A city visited twice shares one map position; successive clicks select its visits in order.
    const [x, y] = stops[Number(el.dataset.stop)].point;
    const visits = stops.flatMap((s, i) => s.point[0] === x && s.point[1] === y ? [i] : []);
    choose(visits[(visits.indexOf(current) + 1) % visits.length]);
  });
  stops.forEach((s,i) => {
    const label = pad(i + 1) + ' · ' + s.name;
    const pill = button((s.photo ? '● ' : '○ ') + s.name, () => choose(i), label);
    if (!markElevation) {
      const tick = button('', () => choose(i), label);
      tick.classList.toggle('withFrame',Boolean(s.photo));
      tick.title = label;
      profile.append(tick);
      ticks.push(tick);
    }
    windowBar.append(pill);
    pillButtons.push(pill);
  });
  function selectChapter(section) {
    const index = associated.indexOf(section);
    if (index >= 0 && associated[current] !== section) choose(index);
    else pause();
  }
  chapters.forEach((section,i) => {
    const a = link('', '#' + section.id);
    a.append(element('small','',pad(i+1)),element('span','',section.querySelector('h2').textContent),
      element('small','',section.querySelectorAll('.storyFigure').length + ' 帧'));
    a.onclick = () => selectChapter(section);
    directory.append(a);
    chapterLinks.set(section,a);
  });
  const coverIndex = stops.findIndex(s => s.photo?.rawSrc === story.cover);
  choose(coverIndex >= 0 ? coverIndex : Math.max(0,stops.findIndex(s=>s.photo)));
  card.querySelector('a').onclick = pause;
  return { plate, selectChapter };
}


function initRibbon(story, chapters, route, count) {
  const ribbon = element('nav','storyRibbon');
  ribbon.setAttribute('aria-label','阅读进度与章节');
  const issue = story.issue.match(/\d+$/)?.[0] || '';
  ribbon.append(link('← Photography','../../','ribbonBack'),element('b','lifeCartouche','LUOQI · LIFE'),
    element('strong','ribbonTitle','Issue ' + issue + '　·　' + story.name));
  const sections = route ? [route.plate,...chapters] : chapters;
  const links = element('div','ribbonChapters');
  const menu = element('select','ribbonSelect');
  menu.setAttribute('aria-label','跳转章节');
  const items = sections.map(section => {
    const chapterNo = chapters.indexOf(section) + 1;
    const title = pad(chapterNo) + ' ' + (chapterNo ? section.dataset.navTitle || section.querySelector('h2').textContent : '路线航图');
    const a = link(title,'#' + section.id);
    a.onclick = () => route?.selectChapter(section);
    links.append(a);
    menu.add(new Option(title,section.id));
    return a;
  });
  menu.onchange = () => {
    const section = document.getElementById(menu.value);
    route?.selectChapter(section);
    location.hash = section.id;
  };
  const progress = element('div','ribbonProgress');
  ribbon.append(links,menu,element('small','ribbonArchive','Negative archive · ' + count + ' frames'),progress);
  ribbon.hidden = true;
  document.body.append(ribbon);
  const hero = document.querySelector('.storyHero');
  let queued = false;
  function update() {
    queued = false;
    ribbon.hidden = hero.getBoundingClientRect().bottom > 0;
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = 'scaleX(' + Math.min(1,Math.max(0,scrollY / Math.max(1,maxScroll))) + ')';
    let active = 0;
    sections.forEach((s,i) => { if (s.getBoundingClientRect().top <= ribbon.offsetHeight + 50) active=i; });
    items.forEach((a,i) => {
      if (i === active) a.setAttribute('aria-current','location');
      else a.removeAttribute('aria-current');
    });
    menu.selectedIndex = active;
  }
  function schedule() {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }
  const observer = new IntersectionObserver(schedule);
  [hero,...sections].forEach(s=>observer.observe(s));
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule);
  update();
}

async function loadJson(path) {
  const response = await fetch(siteUrl(path));
  if (!response.ok) throw new Error('无法读取 ' + path);
  return response.json();
}

async function init() {
  const config = await loadJson('data/config.json');
  const {stories, regions, mapUrl} = config.photos.atlas;
  const story = stories.find(s => s.id === document.body.dataset.storyId);
  if (!story) return;
  const {photos} = normalizePhotoData(config);
  const frames = collectFrames(photos.filter(p=>p.storyId===story.id),story);
  const chapters = [...document.querySelectorAll(chapterSelector)];
  initViewer(frames);
  addEditorial(story,stories,frames.find(f => f.main));
  let route;
  try {
    const [{features}, archive] = await Promise.all([
      loadJson(mapUrl),
      loadJson('data/story-routes.json').catch(() => null),
    ]);
    const drawing = routeDrawing(features,regions,story,photos,archive?.stories?.[story.id]);
    if (drawing) route = initPlate(drawing,story,frames,chapters);
  } catch (error) {
    console.warn('本期路线航图未能加载',error);
  }
  initRibbon(story,chapters,route,frames.length);
  if (location.hash === '#storyRoutePlate') route?.plate.scrollIntoView({behavior:'instant'});
}

init().catch(error => console.warn('期刊增强功能未能加载',error));
