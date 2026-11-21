import { assetUrl, responsivePhotoUrl } from './photos-data.js?v=20261121-moments-art-r2';
import { analyze, rgb } from './photos-color.js?v=20261121-moments-art-r2';
import {
  byId,
  button,
  coords,
  element,
  pad,
  photoButton,
  save,
  saved,
  setQuery
} from './photos-ui.js?v=20261121-moments-art-r2';

const guides = ['关闭', '三分法', '黄金螺旋', '对角线'];
function composition(mode) {
  if (mode === 1)
    return (
      '<path d="M33.33 0v100 M66.67 0v100 M0 33.33h100 M0 66.67h100"/>' +
      [33.33, 66.67]
        .flatMap((x) => [33.33, 66.67].map((y) => '<circle cx="' + x + '" cy="' + y + '" r=".55"/>'))
        .join('')
    );
  if (mode === 3) return '<path d="M0 0L100 100 M100 0L0 100"/>';
  if (mode === 2) {
    const points = [];
    for (let t = 0; t <= Math.PI * 4; t += 0.045) {
      const radius = 74 * Math.exp((-Math.log((1 + Math.sqrt(5)) / 2) * t) / (Math.PI / 2));
      points.push((72 - radius * Math.cos(t)).toFixed(2) + ',' + (40 + radius * Math.sin(t)).toFixed(2));
    }
    return '<polyline points="' + points.join(' ') + '"/>';
  }
  return '';
}
export function initDarkroom(photos, stories, { selectTone, openRelated }) {
  const room = byId('photoLightbox'),
    stage = byId('roomStage'),
    print = byId('roomPrint'),
    img = byId('lightboxImage');
  const strip = byId('filmThumbs'),
    overlay = byId('composition'),
    hist = byId('histogram');
  const mobile = matchMedia('(max-width:959px)');
  const prefs = { info: true, hist: true, grid: 0, ...saved('darkroom', {}) };
  let frames = [],
    index = 0,
    ticket = 0,
    zoom = false,
    expanded = false,
    playing = false,
    timer,
    noticeTimer,
    trigger;
  let bounds = { x: 0.03, y: 0.025, w: 0.94, h: 0.86 },
    natural = [1, 1],
    pan = { x: 0, y: 0 },
    gesture = null;
  const current = () => frames[index];
  function notice(message) {
    byId('roomMessage').textContent = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (byId('roomMessage').textContent = ''), 1400);
  }
  function size() {
    if (!room.open) return;
    const margin = mobile.matches ? 0 : 36,
      w = Math.max(1, stage.clientWidth - margin),
      h = Math.max(1, stage.clientHeight - margin);
    const factor = zoom ? 1 : Math.min(w / natural[0], h / natural[1]);
    const width = natural[0] * factor,
      height = natural[1] * factor;
    print.style.width = width + 'px';
    print.style.height = height + 'px';
    const bound = (v, max) => Math.max(-max, Math.min(max, v));
    pan.x = bound(pan.x, Math.max(0, (width - w) / 2));
    pan.y = bound(pan.y, Math.max(0, (height - h) / 2));
    print.style.transform = 'translate(' + pan.x + 'px,' + pan.y + 'px)';
    Object.assign(overlay.style, {
      left: bounds.x * 100 + '%',
      top: bounds.y * 100 + '%',
      width: bounds.w * 100 + '%',
      height: bounds.h * 100 + '%'
    });
  }
  new ResizeObserver(size).observe(stage);
  function tools() {
    room.classList.toggle('withoutInfo', !prefs.info);
    room.classList.toggle('sheetOpen', expanded);
    room.classList.toggle('zoomed', zoom);
    overlay.innerHTML = composition(prefs.grid);
    byId('sheetGrip').setAttribute('aria-expanded', String(expanded));
    const flags = {
      info: mobile.matches ? expanded : prefs.info,
      hist: prefs.hist,
      grid: !!prefs.grid,
      slide: playing,
      zoom,
      full: document.fullscreenElement === document.documentElement
    };
    for (const b of room.querySelectorAll('[data-tool]')) {
      if (Object.hasOwn(flags, b.dataset.tool)) b.setAttribute('aria-pressed', String(flags[b.dataset.tool]));
    }
    byId('histPanel').hidden = !prefs.hist || !hist.childElementCount;
    size();
  }
  mobile.addEventListener('change', tools);
  document.addEventListener('fullscreenchange', tools);
  function setPlay(active) {
    clearTimeout(timer);
    playing = active && frames.length > 1;
    room.classList.toggle('playing', playing);
    const progress = byId('slideProgress');
    progress.getAnimations().forEach((a) => a.cancel());
    if (playing) {
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        progress.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 4000);
      timer = setTimeout(() => change(1), 4000);
    }
    tools();
  }
  function histogram(bins) {
    const max = Math.max(1, ...bins.flat());
    hist.replaceChildren(
      ...bins.map((channel, i) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', ['#ee695f', '#7bc46c', '#60aaf5'][i]);
        path.setAttribute(
          'd',
          'M0 32 ' + channel.map((n, x) => 'L' + x + ' ' + (32 - (31 * n) / max)).join(' ') + ' L64 32Z'
        );
        return path;
      })
    );
  }
  async function renderPixels(p, version) {
    hist.replaceChildren();
    byId('palettePanel').hidden = true;
    const result = await analyze(p);
    if (version !== ticket || !room.open || !result) return;
    bounds = result.bounds;
    histogram(result.bins);
    byId('swatches').replaceChildren(
      ...result.palette.map((color) => {
        const hex = color.map((n) => n.toString(16).padStart(2, '0')).join('');
        const b = button(
          '',
          () => {
            close();
            selectTone(hex);
          },
          '按色调 #' + hex + ' 排序'
        );
        b.title = '#' + hex;
        b.style.background = rgb(color);
        return b;
      })
    );
    byId('palettePanel').hidden = false;
    tools();
  }
  async function source(p, version) {
    const medium = new Image();
    medium.src = responsivePhotoUrl(p.src, 1280);
    try {
      await medium.decode();
    } catch {
      if (version === ticket) notice('预览图暂时无法载入');
    }
    if (version !== ticket) return;
    if (medium.naturalWidth) {
      img.src = medium.src;
      natural = [medium.naturalWidth, medium.naturalHeight];
      img.style.visibility = 'visible';
      size();
    }
    for (const delta of [-1, 1]) {
      const neighbor = frames[(index + delta + frames.length) % frames.length];
      if (neighbor && neighbor !== p) new Image().src = responsivePhotoUrl(neighbor.src, 1280);
    }
    const original = async () => {
      if (version !== ticket) return;
      const full = new Image();
      full.src = p.src;
      try {
        await full.decode();
      } catch {
        return;
      }
      if (version === ticket) {
        img.src = full.src;
        natural = [full.naturalWidth, full.naturalHeight];
        img.style.visibility = 'visible';
        size();
      }
    };
    if (window.requestIdleCallback) requestIdleCallback(original, { timeout: 600 });
    else setTimeout(original, 50);
  }
  function render() {
    const p = current(),
      version = ++ticket,
      e = p.exif || {};
    zoom = false;
    pan = { x: 0, y: 0 };
    bounds = { x: 0.03, y: 0.025, w: 0.94, h: 0.86 };
    img.style.visibility = 'hidden';
    img.alt = p.caption || p.id;
    setQuery({ photo: p.id });
    const num = pad(photos.indexOf(p) + 1),
      title = p.caption || p.id;
    byId('roomFrame').textContent =
      'ROLL ' + p.roll + ' · ' + p.storyTitle + ' / FRAME ' + num + ' OF ' + photos.length;
    byId('lightboxTitle').textContent = title;
    byId('sideTitle').textContent = title;
    byId('sideFrame').textContent = 'FRAME ' + num + ' · ' + (e.datetime?.replace('T', ' ') || '时刻未记录');
    byId('sidePlace').textContent = [p.province || p.atlasRegionName, p.place || p.atlasPlace, coords(p), p.lightEstimate].filter(Boolean).join(' · ');
    byId('sideGear').textContent = [e.body, e.lens].filter(Boolean).join(' · ') || '—';
    const values = [
      ['FOCAL', e.focal],
      ['APERTURE', e.aperture],
      ['SHUTTER', e.shutter && e.shutter + 's'],
      ['ISO', e.iso]
    ];
    byId('sideParams').replaceChildren(
      ...values.map(([key, val]) => {
        const wrap = element('div');
        wrap.append(element('dt', '', key), element('dd', '', val ?? '—'));
        return wrap;
      })
    );
    const story = stories.find((s) => s.id === p.storyId),
      link = byId('roomStory');
    link.hidden = !story;
    if (story) link.href = assetUrl(story.url);
    const related = photos
      .filter((other) => p.light && other !== p && other.light === p.light)
      .sort((a, b) => Number(a.storyId === p.storyId) - Number(b.storyId === p.storyId))
      .slice(0, 3);
    byId('relatedPanel').hidden = !related.length;
    byId('related').replaceChildren(
      ...related.map((photo) =>
        photoButton(photo, (other) => {
          if (frames.includes(other)) {
            index = frames.indexOf(other);
            render();
          } else openRelated(other);
        })
      )
    );
    for (const b of strip.children) b.setAttribute('aria-current', String(b.dataset.frame === p.id));
    const thumb = strip.children[index];
    if (thumb)
      strip.scrollLeft = thumb.offsetLeft - strip.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2;
    room.style.setProperty('--strip-progress', ((index + 1) / frames.length) * 100 + '%');
    source(p, version);
    renderPixels(p, version);
    setPlay(playing);
  }
  function change(delta) {
    index = (index + delta + frames.length) % frames.length;
    render();
  }
  function open(p, list, slideshow = false) {
    if (!room.open) {
      trigger = document.activeElement;
      expanded = false;
      room.showModal();
      document.body.classList.add('is-lightbox-open');
      room.querySelector('[data-tool=close]').focus({ preventScroll: true });
    }
    frames = list.includes(p) ? list : [p];
    index = frames.indexOf(p);
    strip.replaceChildren(
      ...frames.map((item) =>
        photoButton(item, (chosen) => {
          index = frames.indexOf(chosen);
          render();
        })
      )
    );
    playing = slideshow;
    render();
  }
  function close() {
    if (!room.open) return;
    ++ticket;
    setPlay(false);
    if (document.fullscreenElement === document.documentElement) document.exitFullscreen().catch(() => {});
    room.close();
    document.body.classList.remove('is-lightbox-open');
    setQuery({ photo: null });
    (trigger?.isConnected && trigger !== document.body ? trigger : byId('openHero')).focus({
      preventScroll: true
    });
  }
  function escape() {
    if (zoom) {
      zoom = false;
      pan = { x: 0, y: 0 };
      tools();
    } else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else close();
  }
  room.addEventListener('cancel', (e) => {
    e.preventDefault();
    escape();
  });
  async function action(name) {
    switch (name) {
      case 'close':
        close();
        return;
      case 'slide':
        setPlay(!playing);
        return;
      case 'zoom':
        zoom = !zoom;
        pan = { x: 0, y: 0 };
        break;
      case 'full':
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await document.documentElement.requestFullscreen();
        } catch {
          notice('当前浏览器无法进入全屏');
        }
        break;
      case 'info':
        if (mobile.matches) expanded = !expanded;
        else prefs.info = !prefs.info;
        break;
      case 'hist':
        prefs.hist = !prefs.hist;
        break;
      case 'grid':
        prefs.grid = (prefs.grid + 1) % guides.length;
        notice('构图 · ' + guides[prefs.grid]);
        break;
      case 'copy':
        try {
          await navigator.clipboard.writeText(location.href);
          notice('照片链接已复制');
        } catch {
          notice('可复制地址栏中的照片链接');
        }
        return;
    }
    save('darkroom', prefs);
    tools();
  }
  room.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]');
    if (b) action(b.dataset.tool);
  });
  byId('sheetGrip').onclick = () => action('info');
  byId('lightboxPrev').onclick = () => change(-1);
  byId('lightboxNext').onclick = () => change(1);
  room.onkeydown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase(),
      shortcuts = { i: 'info', g: 'grid', h: 'hist', f: 'full', z: 'zoom', ' ': 'slide' };
    if (key === 'escape') {
      e.preventDefault();
      escape();
    } else if (key === 'arrowleft' || key === 'arrowright') {
      e.preventDefault();
      change(key === 'arrowleft' ? -1 : 1);
    } else if (shortcuts[key]) {
      e.preventDefault();
      action(shortcuts[key]);
    }
  };
  stage.onpointerdown = (e) => {
    if (e.target.closest('button')) return;
    gesture = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    stage.setPointerCapture(e.pointerId);
  };
  stage.onpointermove = (e) => {
    if (!gesture) return;
    const dx = e.clientX - gesture.x,
      dy = e.clientY - gesture.y;
    if (zoom) {
      pan = { x: gesture.px + dx, y: gesture.py + dy };
      size();
    } else if (e.pointerType === 'touch')
      print.style.transform = 'translate(' + dx * 0.6 + 'px,' + Math.max(0, dy) * 0.45 + 'px)';
  };
  stage.onpointerup = (e) => {
    if (!gesture) return;
    const dx = e.clientX - gesture.x,
      dy = e.clientY - gesture.y;
    gesture = null;
    if (!zoom && e.pointerType === 'touch') {
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) change(dx < 0 ? 1 : -1);
      else if (dy > 65 && dy > Math.abs(dx)) close();
    }
    size();
  };
  stage.onpointercancel = () => {
    gesture = null;
    size();
  };
  let sheetY = 0;
  const side = room.querySelector('.roomSide');
  side.addEventListener(
    'touchstart',
    (e) => {
      sheetY = e.touches[0].clientY;
    },
    { passive: true }
  );
  side.addEventListener(
    'touchend',
    (e) => {
      const dy = e.changedTouches[0].clientY - sheetY;
      if (Math.abs(dy) > 45 && (!expanded || side.scrollTop === 0)) {
        expanded = dy < 0;
        tools();
      }
    },
    { passive: true }
  );
  strip.onwheel = (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      strip.scrollLeft += e.deltaY;
    }
  };
  let drag = null,
    dragged = false;
  strip.onpointerdown = (e) => {
    if (e.pointerType === 'mouse') {
      drag = { x: e.clientX, left: strip.scrollLeft };
      dragged = false;
    }
  };
  strip.onpointermove = (e) => {
    if (!drag || !e.buttons) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 5) {
      strip.setPointerCapture(e.pointerId);
      dragged = true;
      strip.scrollLeft = drag.left - dx;
    }
  };
  strip.onpointerup = strip.onpointercancel = () => {
    drag = null;
  };
  strip.addEventListener(
    'click',
    (e) => {
      if (dragged) {
        dragged = false;
        e.stopImmediatePropagation();
      }
    },
    true
  );
  return { open, close };
}
