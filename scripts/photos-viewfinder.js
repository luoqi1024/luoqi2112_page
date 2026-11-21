import { setResponsivePhoto } from './photos-data.js?v=20261121-moments-art-r2';
import { byId, coords, element, pad, reduced, save, saved } from './photos-ui.js?v=20261121-moments-art-r2';

export function initViewfinder(photos, first, open) {
  const hero = byId('photoHero'),
    grid = byId('afGrid'),
    numbers = byId('heroNumbers');
  let index = photos.indexOf(first),
    image = byId('heroImage'),
    revision = 0,
    currentDot,
    pending = false;
  let centers = [],
    pointer = null,
    busy = false,
    sound = Boolean(saved('shutterSound', false)),
    audio;
  let displayed = first;
  const dots = Array.from({ length: 21 }, () => element('i'));
  grid.replaceChildren(...dots);
  function focusDot() {
    const closest = pointer
      ? centers.reduce(
          (best, pt, i) =>
            Math.hypot(pt.x - pointer.x, pt.y - pointer.y) <
            Math.hypot(centers[best].x - pointer.x, centers[best].y - pointer.y)
              ? i
              : best,
          10
        )
      : 10;
    currentDot?.classList.remove('is-focused');
    currentDot = dots[closest];
    currentDot.classList.add('is-focused');
    pending = false;
  }
  function measure() {
    const origin = hero.getBoundingClientRect();
    centers = dots.map((dot) => {
      const r = dot.getBoundingClientRect();
      return { x: r.left + r.width / 2 - origin.left, y: r.top + r.height / 2 - origin.top };
    });
    focusDot();
  }
  new ResizeObserver(measure).observe(hero);
  hero.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || !centers.length) return;
    pointer = { x: event.pageX - hero.offsetLeft, y: event.pageY - hero.offsetTop };
    if (!pending) {
      pending = true;
      requestAnimationFrame(focusDot);
    }
  });
  hero.addEventListener('pointerleave', () => {
    pointer = null;
    focusDot();
  });
  const gear = byId('heroGear'),
    params = byId('heroParams');
  function draw(photo) {
    displayed = photo;
    const e = photo.exif || {};
    byId('heroFrame').textContent =
      'FRAME ' + pad(index + 1) + ' / ' + photos.length + ' · ROLL ' + photo.roll + ' · ' + photo.storyTitle;
    byId('heroCaption').textContent = photo.caption;
    byId('heroIndex').textContent = '[ ' + pad(index + 1) + ' / ' + photos.length + ' ]　ROLL ' + photo.roll;
    byId('heroMeta').textContent = [coords(photo), e.datetime?.replace('T', ' ')].filter(Boolean).join(' · ');
    byId('openHero').setAttribute('aria-label', '打开暗房 · ' + photo.caption);
    numbers.replaceChildren(
      ...[e.focal, e.aperture, e.shutter && e.shutter + 's', e.iso != null && 'ISO ' + e.iso].map((v, i) => {
        const span = element('b', '', v || '—');
        span.style.animationDelay = i * 40 + 'ms';
        return span;
      })
    );
    gear.textContent = [e.body, e.lens].filter(Boolean).join(' · ');
    params.textContent = [
      photo.caption,
      e.datetime?.replace('T', ' '),
      gear.textContent,
      ...[...numbers.children].map((n) => n.textContent)
    ]
      .filter(Boolean)
      .join('　·　');
    image.alt = photo.caption;
  }
  function exposure(img) {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      const ctx = c.getContext('2d');
      ctx.drawImage(
        img,
        img.naturalWidth * 0.1,
        img.naturalHeight * 0.1,
        img.naturalWidth * 0.8,
        img.naturalHeight * 0.7,
        0,
        0,
        1,
        1
      );
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      hero.style.setProperty('--ev', 100 - (0.213 * r + 0.715 * g + 0.072 * b) / 2.55 + '%');
    } catch {
      hero.style.setProperty('--ev', '50%');
    }
  }
  async function show(next, initial = false) {
    index = (next + photos.length) % photos.length;
    const photo = photos[index],
      version = ++revision,
      img = initial ? image : new Image();
    img.className = 'photoHero__image';
    img.alt = photo.caption;
    setResponsivePhoto(img, photo.src, { sizes: '(max-width:959px) 1280px, 112vw', includeOriginal: true });
    if (initial) draw(photo);
    try {
      await img.decode();
    } catch {
      return;
    }
    if (version !== revision) return;
    if (!initial) {
      const old = image;
      old.removeAttribute('id');
      old.after(img);
      img.id = 'heroImage';
      image = img;
      if (!reduced.matches)
        img.animate([{ opacity: 0 }, { opacity: 1 }], 400).finished.finally(() => old.remove());
      else old.remove();
      draw(photo);
    }
    exposure(img);
  }
  byId('openHero').onclick = () => open(displayed);
  const info = () => {
    params.hidden = !params.hidden;
    byId('heroInfo').setAttribute('aria-expanded', String(!params.hidden));
  };
  byId('heroInfo').onclick = info;
  byId('heroPrev').onclick = () => show(index - 1);
  byId('heroNext').onclick = () => show(index + 1);
  byId('sound').setAttribute('aria-pressed', String(sound));
  byId('sound').onclick = () => {
    sound = !sound;
    save('shutterSound', sound);
    byId('sound').setAttribute('aria-pressed', String(sound));
  };
  function clickSound() {
    if (!sound) return;
    try {
      audio ||= new AudioContext();
      audio.resume().catch(() => {});
      for (const delay of [0, 0.065]) {
        const osc = audio.createOscillator(),
          gain = audio.createGain(),
          t = audio.currentTime + delay;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1150, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.028);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.034);
        osc.connect(gain).connect(audio.destination);
        osc.start(t);
        osc.stop(t + 0.036);
      }
    } catch {
      /* silent on devices without Web Audio */
    }
  }
  const shutter = byId('shutter');
  for (let i = 0; i < 6; i++) {
    const ns = 'http://www.w3.org/2000/svg',
      group = document.createElementNS(ns, 'g'),
      blade = document.createElementNS(ns, 'path');
    group.setAttribute('transform', 'rotate(' + i * 60 + ')');
    blade.setAttribute('d', 'M -2 -2 L 260 -2 L 132 228 Z');
    group.append(blade);
    shutter.firstElementChild.append(group);
  }
  async function fire() {
    if (busy) return;
    busy = true;
    clickSound();
    hero.scrollIntoView({ behavior: 'instant' });
    shutter.hidden = false;
    const next = (index + 1 + Math.floor(Math.random() * (photos.length - 1))) % photos.length;
    await new Promise((resolve) => setTimeout(resolve, reduced.matches ? 60 : 180));
    await show(next);
    shutter.classList.add('opening');
    await new Promise((resolve) => setTimeout(resolve, reduced.matches ? 60 : 220));
    shutter.hidden = true;
    shutter.classList.remove('opening');
    busy = false;
  }
  show(index, true);
  return { fire, info, step: (delta) => show(index + delta) };
}

export function initFilm() {
  let timer,
    noticeTimer,
    sequence = '',
    last = 0;
  const root = document.documentElement,
    notice = byId('filmNotice');
  function syncGrain() {
    clearInterval(timer);
    if (root.classList.contains('is-film') && !reduced.matches && !document.hidden) {
      let seed = 0;
      const noise = document.querySelector('#grain feTurbulence');
      timer = setInterval(() => noise.setAttribute('seed', String(++seed % 97)), 120);
    }
  }
  reduced.addEventListener('change', syncGrain);
  document.addEventListener('visibilitychange', syncGrain);
  function toggle() {
    const active = root.classList.toggle('is-film');
    syncGrain();
    clearTimeout(noticeTimer);
    notice.textContent = active ? 'FILM SIMULATION · PORTRA 400' : '胶片模拟已关闭';
    noticeTimer = setTimeout(() => (notice.textContent = ''), 1600);
  }
  return {
    toggle,
    type(key) {
      const now = performance.now();
      if (now - last > 2000 || key === 'f') {
        sequence = '';
        last = now;
      }
      sequence += key;
      if (!'film'.startsWith(sequence)) sequence = '';
      if (sequence === 'film') {
        toggle();
        sequence = '';
        return true;
      }
      return sequence.length > 0;
    }
  };
}
