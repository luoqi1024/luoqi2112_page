import {
  byId,
  button,
  element,
  ensureOrientations,
  groupBy,
  pad,
  photoButton,
  save,
  saved,
  setQuery
} from './photos-ui.js?v=20261122-atlas-scs';
import { averageColor, distance } from './photos-color.js?v=20261122-atlas-scs';
import { parseQuery, matchesQuery } from './photos-filter.js?v=20261122-atlas-scs';
import { renderDial } from './photos-dial.js?v=20261122-atlas-scs';
import { initLoupe } from './photos-loupe.js?v=20261122-atlas-scs';

export async function initLighttable(photos, regions, site, open, onView, onRegion) {
  const root = byId('photoGrid'),
    filters = byId('filterBar'),
    views = byId('viewBar');
  const keys = ['kind', 'orient', 'light', 'region', 'q', 'tone'],
    params = new URL(location.href).searchParams;
  const state = Object.fromEntries(keys.map((k) => [k, params.get(k) || '']));
  const modes = { contact: '印样', masonry: '瀑布', timeline: '时间轴', light: '光线' };
  let view = saved('view', 'contact'),
    loupe = true,
    visible = [],
    revision = 0;
  if (!Object.hasOwn(modes, view)) view = 'contact';
  const regionsById = new Map(regions.map((r) => [r.id, r.name]));
  if (!regionsById.has(state.region)) state.region = '';
  if (!/^[a-f0-9]{6}$/i.test(state.tone)) state.tone = '';
  const colors = new Map(),
    dialState = {};
  const hideLoupe = initLoupe(root, new Map(photos.map((p) => [p.id, p])), () => loupe && view === 'contact');
  const scroll = () => byId('gallery').scrollIntoView({ block: 'start' });
  const wrapOpen = (p) => open(p, visible);
  const cols = () => (innerWidth >= 1600 ? 6 : innerWidth <= 560 ? 2 : innerWidth <= 959 ? 3 : 5);
  function frame(p) {
    const b = photoButton(p, wrapOpen, 'gallery');
    b.className = 'stripFrame';
    if (p.featured) {
      b.classList.add('featured');
      b.style.setProperty(
        '--tilt',
        (Array.from(p.id).reduce((s, c) => s + c.charCodeAt(0), 0) % 11) - 5 + 'deg'
      );
    }
    const number = pad(p.frame);
    b.append(element('span', 'frameCode', '▸ ' + number + '　' + number + 'A'));
    b.title = p.caption;
    return b;
  }
  function contact() {
    // Keep rolls separate; a hue sort can interleave rolls, so label each frame in that case.
    const groups = state.tone ? [visible] : groupBy(visible, (p) => p.albumId).values();
    for (const group of groups) {
      for (let i = 0; i < group.length; i += cols()) {
        const row = element('div', 'filmRow');
        row.style.setProperty('--columns', cols());
        const first = group[i];
        row.append(
          element(
            'small',
            'rowCode',
            state.tone ? 'COLOR STUDY' : 'ROLL ' + first.roll + ' · ' + (first.storyTitle || first.province)
          )
        );
        for (const p of group.slice(i, i + cols())) row.append(frame(p));
        root.append(row);
      }
    }
  }
  function timeline() {
    const ordered = [...visible].sort(
      (a, b) =>
        String(a.year).localeCompare(String(b.year)) ||
        a.storyTitle.localeCompare(b.storyTitle) ||
        (a.date || a.exif?.datetime || '9999').localeCompare(b.date || b.exif?.datetime || '9999')
    );
    for (const [year, yearGroup] of groupBy(ordered, (p) => p.year || '年份未记录')) {
      root.append(element('h3', 'timelineYear', year));
      for (const [story, roll] of groupBy(yearGroup, (p) => p.storyTitle)) {
        root.append(element('h4', 'timelineStory', story));
        for (const [day, frames] of groupBy(
          roll,
          (p) => p.date || p.exif?.datetime?.slice(0, 10) || '日期未记录'
        )) {
          const line = element('div', 'timelineDay'),
            track = element('div', 'timeTrack');
          line.append(element('b', '', [day, frames[0].place].filter(Boolean).join(' · ')), track);
          track.append(...frames.map((p) => photoButton(p, wrapOpen, 'gallery')));
          root.append(line);
        }
      }
    }
  }
  function apply(changes, { jump = false } = {}) {
    Object.assign(state, changes);
    setQuery(changes);
    if (changes.region) onRegion(changes.region);
    const promise = render();
    if (jump) scroll();
    return promise;
  }
  const clear = () => apply(Object.fromEntries(keys.map((k) => [k, ''])));
  function choose(mode, jump = false) {
    if (!Object.hasOwn(modes, mode)) return;
    view = mode;
    save('view', mode);
    render();
    if (jump) scroll();
  }
  function controls(items, terms) {
    const focused = document.activeElement?.dataset?.control;
    filters.replaceChildren();
    views.replaceChildren();
    function chip(text, key, active, callback, parent = filters) {
      const b = button(text, callback);
      b.dataset.control = key;
      b.setAttribute('aria-pressed', String(active));
      parent.append(b);
      return b;
    }
    const onOtherFilters = (p, skip) =>
      (!state.region || p.atlasRegionId === state.region) &&
      (skip === 'kind' || !state.kind || p.kind === state.kind) &&
      (skip === 'orient' || !state.orient || p.orientation === state.orient) &&
      (skip === 'light' || !state.light || p.light === state.light) &&
      matchesQuery(p, terms);
    chip('全部 ' + photos.length, 'all', !keys.some((k) => state[k]), clear);
    for (const [key, val, label] of [
      ['kind', 'camera', '相机'],
      ['kind', 'aerial', '航拍'],
      ['orient', 'landscape', '横幅'],
      ['orient', 'portrait', '竖幅'],
      ['light', 'golden', '◐ 黄金时刻']
    ]) {
      const count =
        key === 'kind' ? ' ' + photos.filter((p) => onOtherFilters(p, key) && p[key] === val).length : '';
      chip(label + count, val, state[key] === val, () => apply({ [key]: state[key] === val ? '' : val }));
    }
    const sel = element('select');
    sel.setAttribute('aria-label', '按省份筛选');
    sel.dataset.control = 'regions';
    sel.add(new Option('全部地区', ''));
    for (const [id, name] of regionsById) sel.add(new Option(name, id));
    sel.value = state.region;
    sel.onchange = () => apply({ region: sel.value });
    filters.append(sel);
    for (const [key, label] of [
      ['region', regionsById.get(state.region)],
      ['q', state.q],
      ['tone', '色调 #' + state.tone]
    ]) {
      if (state[key]) chip(label + ' ×', 'clear-' + key, true, () => apply({ [key]: '' }));
    }
    for (const [mode, label] of Object.entries(modes))
      chip(label, mode, view === mode, () => choose(mode), views);
    if (view === 'contact')
      chip(
        '放大镜',
        'loupe',
        loupe,
        () => {
          loupe = !loupe;
          hideLoupe();
          controls(items, terms);
        },
        views
      );
    if (focused)
      document.querySelector('[data-control="' + CSS.escape(focused) + '"]')?.focus({ preventScroll: true });
  }
  async function render() {
    const ticket = ++revision,
      terms = parseQuery(state.q);
    if (state.orient || terms.some((t) => t.key === 'orient')) await ensureOrientations(photos);
    let items = photos.filter(
      (p) =>
        (!state.kind || p.kind === state.kind) &&
        (!state.orient || p.orientation === state.orient) &&
        (!state.region || p.atlasRegionId === state.region) &&
        (!state.light || p.light === state.light) &&
        matchesQuery(p, terms)
    );
    if (state.tone) {
      const target = state.tone.match(/../g).map((h) => parseInt(h, 16));
      for (let i = 0; i < items.length; i += 5) {
        await Promise.all(
          items.slice(i, i + 5).map(async (p) => {
            if (!colors.has(p.id)) colors.set(p.id, await averageColor(p));
          })
        );
        if (ticket !== revision) return;
      }
      const score = (p) => (colors.get(p.id) ? distance(colors.get(p.id), target) : Infinity);
      items.sort((a, b) => score(a) - score(b));
    }
    if (ticket !== revision) return;
    visible = items;
    hideLoupe();
    root.replaceChildren();
    root.className = 'view-' + view;
    byId('galleryCount').textContent = pad(items.length) + ' / ' + photos.length + ' FRAMES';
    byId('photoEmpty').hidden = items.length > 0;
    root.hidden = !items.length && view !== 'light';
    controls(items, terms);
    if (view === 'contact') contact();
    if (view === 'masonry') root.append(...visible.map((p) => photoButton(p, wrapOpen, 'gallery')));
    if (view === 'timeline') timeline();
    if (view === 'light') renderDial(root, visible, site, wrapOpen, dialState);
    onView(view);
  }
  for (const query of ['(min-width:1600px)', '(max-width:959px)', '(max-width:560px)']) {
    matchMedia(query).addEventListener('change', () => {
      if (view === 'contact') render();
    });
  }
  await render();
  return {
    apply,
    clear,
    choose,
    scroll,
    get photos() {
      return visible;
    },
    get view() {
      return view;
    }
  };
}
