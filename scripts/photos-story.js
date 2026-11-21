import { createSvgElement, createAtlasProjection, atlasGeometryPath } from './photos-atlas.js?v=20261121-photo-art';
import { normalizePhotoData, responsivePhotoUrl } from './photos-data.js?v=20261121-photo-art';
import { element, button, pad, reduced } from './photos-ui.js?v=20261121-photo-art';

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


// Rank route numbers by the length of legs on which they appear.
function roadShields(svg, legs, fit, project, recorded = {}) {
  const roads = new Map();
  for (const leg of legs) {
    if (!leg) continue;
    const line = leg.line.map(fit);
    const distances = [0];
    line.slice(1).forEach(([x,y], i) => {
      distances.push(distances[i] + Math.hypot(x - line[i][0], y - line[i][1]));
    });
    const length = distances.at(-1);
    if (!length) continue;
    const seen = new Set();
    for (const name of leg.roads.split('、')) {
      for (const code of name.match(/\b[GS]\d{1,4}[A-Z]?\b/g) || []) {
        if (seen.has(code)) continue;
        seen.add(code);
        const road = roads.get(code) || { code, total: 0, longest: 0 };
        road.total += length;
        if (length > road.longest) {
          road.longest = length;
          road.type = code.startsWith('S') ? 'provincial' :
            (name.includes('高速') || !/^G\d{3}$/.test(code)) ? 'expressway' : 'national';
          // Use arc length so tightly sampled switchbacks do not bias the midpoint.
          road.centers = [.5,.32,.68,.2,.8].map(fraction => {
            const target = fraction * length;
            const i = distances.findIndex(d => d >= target);
            const t = (target - distances[i - 1]) / (distances[i] - distances[i - 1]);
            return line[i].map((v, k) => line[i-1][k] + t * (v - line[i-1][k]));
          });
        }
        roads.set(code, road);
      }
    }
  }
  return [...roads.values()].sort((a,b) => b.total - a.total).map(road => {
    const width = 9 + road.code.length * 6.5;
    const group = createSvgElement('g', {class: 'roadShield ' + road.type, 'aria-hidden': 'true'});
    group.style.display = 'none';
    const body = createSvgElement('rect', {width, height: 16, rx: 3});
    group.append(body);
    if (road.type === 'expressway') {
      group.append(createSvgElement('rect', {class: 'shieldBand', x: 1, y: 1, width: width-2, height: 3, rx: 1}));
    }
    const text = createSvgElement('text', {x: width / 2, y: road.type === 'expressway' ? 12.5 : 11.5});
    text.textContent = road.code;
    group.append(text);
    svg.append(group);
    const leader = createSvgElement('line', {class: 'plateLeader'});
    svg.insertBefore(leader, svg.querySelector('.plateStop'));
    const anchors = recorded[road.code];
    const centers = Array.isArray(anchors) && anchors.length && anchors.every(validPoint)
      ? anchors.map(p => fit(project(p))) : road.centers;
    return {group, leader, width, centers};
  });
}

function boxGap(a, b) {
  const dx = Math.max(0, b.x - a.x - a.width, a.x - b.x - b.width);
  const dy = Math.max(0, b.y - a.y - a.height, a.y - b.y - b.height);
  return Math.hypot(dx, dy);
}

function layoutShields(shields, occupied, scale, labelBoxes) {
  let placed = 0;
  for (const {group, leader, width, centers} of shields) {
    const w = width * scale, h = 16 * scale;
    group.style.display = 'none';
    leader.style.display = 'none';
    if (placed >= 4) continue;
    const options = [[0,0],[0,-1],[0,1],[1,0],[-1,0],[1,-1],[-1,-1],[1,1],[-1,1],
      [0,-2],[0,2],[2,0],[-2,0],[1,-2],[-1,-2],[1,2],[-1,2]];
    const available = offsets => offsets.flatMap(([dx, dy]) => centers.map(([cx, cy]) => ({
      x: cx - w/2 + dx * (w/2 + 5), y: cy - h/2 + dy * (h/2 + 5),
      width:w, height:h, cx, cy, offset:Math.hypot(dx, dy),
    }))).filter(b => b.x >= 3 && b.y >= 3 && b.x+w <= 717 && b.y+h <= 387 &&
      occupied.every(obstacle => boxGap(b, obstacle) >= 3));
    let candidates = available(options);
    if (!candidates.length) {
      // On phones a whole road can lie under a cluster of place names. Keep the leader on the road.
      candidates = available([-1,0,1].flatMap(dx => [-4,-3,3,4].map(dy => [dx,dy])));
    }
    for (const b of candidates) {
      b.clearance = labelBoxes.length ? Math.min(...labelBoxes.map(label => boxGap(b, label))) : 0;
    }
    const pos = candidates.sort((a, b) => b.clearance - a.clearance || a.offset - b.offset)[0];
    if (!pos) continue;
    group.setAttribute('transform', 'translate(' + pos.x + ' ' + pos.y + ') scale(' + scale + ')');
    group.style.display = '';
    const endX = Math.max(pos.x, Math.min(pos.x+w,pos.cx));
    const endY = Math.max(pos.y, Math.min(pos.y+h,pos.cy));
    if (Math.hypot(pos.cx-endX, pos.cy-endY) > 3) {
      leader.setAttribute('x1',pos.cx);
      leader.setAttribute('y1',pos.cy);
      leader.setAttribute('x2',endX);
      leader.setAttribute('y2',endY);
      leader.style.display = '';
      occupied.push(leader.getBBox());
    }
    occupied.push(pos);
    placed++;
  }
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
    return { line: leg.coordinates.map(project), roads: Array.isArray(leg.roads) ? leg.roads.join('、') : '' };
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
  const start = 'M' + points[0].join(' ');
  const curves = spline(points, loop);
  const segments = legs.map((leg, i) => {
    if (!leg) return curves[i];
    const end = points[(i + 1) % points.length];
    return leg.line.slice(1, -1).map(p => 'L' + fit(p).join(' ')).join('') + 'L' + end.join(' ');
  });
  svg.append(createSvgElement('path', { class: 'plateCourse', d: start + segments.join('') }));
  const ink = createSvgElement('path', { class: 'plateCourse plateInk' });
  const growth = createSvgElement('path', { class: 'plateCourse plateInk plateGrowth', pathLength: 1 });
  svg.append(ink, growth);
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
  const shields = roadShields(svg, legs, fit, project, archive?.roadAnchors);
  // Space labels in screen pixels so the four nearby 腾冲 stops remain readable on phones.
  new ResizeObserver(() => {
    const font = Math.max(12, 10 * 720 / Math.max(240, svg.clientWidth));
    const occupied = [];
    for (const {label, leader, x, y} of labels) {
      const w = label.textContent.length * font, h = font * 1.3;
      const lx = Math.min(710 - w, Math.max(10, x + 8));
      let ly = y - 8;
      for (const n of [0,-1,1,-2,2,-3,3,-4,4]) {
        const v = y - 8 + n * (h + 2);
        if (v > h && v < 383 && occupied.every(b => lx+w < b.x || lx > b.x+b.w || v < b.y-h || v-h > b.y)) {
          ly = v;
          break;
        }
      }
      label.style.fontSize = font + 'px';
      label.setAttribute('x',lx);
      label.setAttribute('y',ly);
      leader.setAttribute('x2',lx);
      leader.setAttribute('y2',ly-4);
      leader.style.display = Math.abs(ly-y)>h ? '' : 'none';
      occupied.push({x:lx, y:ly, w});
    }
    const labelBoxes = labels.map(({label}) => {
      const {x,y,width,height} = label.getBBox();
      return {x:x-12, y:y-6, width:width+24, height:height+12};
    });
    const obstacles = [...labelBoxes, ...points.map(([x,y]) => ({x:x-14, y:y-14, width:28, height:28}))];
    for (const {leader} of labels) {
      if (leader.style.display !== 'none') obstacles.push(leader.getBBox());
    }
    layoutShields(shields, obstacles, Math.max(.9, 1 / (svg.getScreenCTM()?.a || 1)), labelBoxes);
  }).observe(svg);
  const ring = createSvgElement('circle', {r:10, class:'plateRing'});
  svg.append(ring);
  let animation;
  function draw(index, closed, animate) {
    animation?.cancel();
    growth.removeAttribute('d');
    const count = closed ? segments.length : Math.min(index, segments.length);
    const complete = start + segments.slice(0, count).join('');
    if (animate && count && !reduced.matches) {
      ink.setAttribute('d', start + segments.slice(0, count - 1).join(''));
      growth.setAttribute('d', 'M' + points[count - 1].join(' ') + segments[count - 1]);
      animation = growth.animate([{strokeDashoffset: '1'}, {strokeDashoffset: '0'}],
        {duration: 900, easing: 'ease-in-out'});
      const current = animation;
      current.onfinish = () => {
        if (animation !== current) return;
        ink.setAttribute('d', complete);
        growth.removeAttribute('d');
      };
    } else {
      animation = null;
      ink.setAttribute('d', complete);
    }
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

function initPlate(drawing, story, frames, chapters) {
  const { svg, stops, loop, draw, routed, legs, elevations, distanceKm } = drawing;
  const plate = element('section', 'routePlate');
  plate.id = 'storyRoutePlate';
  plate.setAttribute('aria-label', '本期路线航图');
  plate.innerHTML = `<div class="plateMap"><header><small>Route plate</small><h3>本期路线航图</h3><button type="button" class="platePlay"></button></header>
    <div class="plateCanvas"></div><div class="plateTools"><div class="plateWindow" role="group" aria-label="相邻站点"></div>
    <div class="plateRuler" role="group" aria-label="全程站点刻度"></div>
    <p>路线示意 · 据行前规划与沿途照片整理</p></div></div>
    <aside class="plateSide"><div class="stopCard"><div class="stopVisual"></div><div class="stopCopy">
    <small></small><h3></h3><p></p><p class="stopRoads" hidden></p><a class="stopJump">跳转到正文 ↓</a></div></div>
    <nav class="chapterDirectory" aria-label="本期章节"><h4>本期章节</h4></nav></aside>`;
  document.querySelector('.storyIntro').append(plate);
  plate.querySelector('.plateCanvas').append(svg);
  if (legs.some(Boolean)) {
    const credit = plate.querySelector('.plateTools p');
    credit.textContent = '据行前规划与照片整理，驾车路线按路网推算 · ';
    credit.append(link('© OpenStreetMap 贡献者', 'https://www.openstreetmap.org/copyright'));
  }
  const play = plate.querySelector('.platePlay'), ruler = plate.querySelector('.plateRuler');
  if (Number.isFinite(distanceKm)) {
    plate.querySelector('header h3').after(element('span', 'plateDistance',
      '估算里程 ' + distanceKm.toLocaleString('zh-CN') + ' km · ' + legs.length + ' 段'));
  }
  const minEl = Math.min(...elevations), maxEl = Math.max(...elevations);
  const meters = el => el.toLocaleString('zh-CN') + ' m';
  if (elevations.length) {
    ruler.classList.add('hasElevation');
    const legend = element('div', 'elevationLegend');
    legend.title = '按公路路线端点从地形模型估算，范围为本期各站的最低与最高海拔。';
    legend.append(element('span', '', '站点海拔'), element('span', '', meters(minEl) + ' — ' + meters(maxEl)));
    ruler.before(legend);
    plate.querySelector('.plateTools p').append(' · ', link('Copernicus DEM / Open-Meteo', 'https://open-meteo.com/en/docs/elevation-api'));
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
    const winStart = Math.max(0,Math.min(stops.length-7,index-3));
    pillButtons.forEach((b,i) => {
      b.hidden = i < winStart || i >= winStart+7;
      b.setAttribute('aria-pressed',String(i===index));
      ticks[i].setAttribute('aria-pressed',String(i===index));
    });
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
    roadInfo.textContent = '';
    if (routed && prev >= 0) {
      const leg = legs[prev];
      const label = leg ? leg.roads : '站点间示意连线';
      roadInfo.textContent = [label && '本段道路 · ' + label, leg && stops[prev].routeNote].filter(Boolean).join('。');
    }
    roadInfo.hidden = !roadInfo.textContent;
    const visual = card.querySelector('.stopVisual');
    visual.replaceChildren();
    if (stop.photo) visual.append(archiveImage(stop.photo.rawSrc,stop.photo.caption));
    const jump = card.querySelector('a');
    jump.hidden = !chapter;
    if (chapter) jump.href = '#' + chapter.id;
  }
  function choose(i) { pause(); select(i); }
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
    const tickLabel = elevations.length ? label + ' · 海拔 ' + meters(elevations[i]) : label;
    const tick = button('', () => choose(i), tickLabel);
    if (elevations.length) {
      const height = 22 + 78 * (elevations[i] - minEl) / Math.max(1, maxEl - minEl);
      tick.style.setProperty('--height', Math.round(height) + '%');
    }
    tick.classList.toggle('withFrame',Boolean(s.photo));
    tick.title = tickLabel;
    windowBar.append(pill);
    ruler.append(tick);
    pillButtons.push(pill);
    ticks.push(tick);
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
