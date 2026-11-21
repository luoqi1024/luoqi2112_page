import { assetUrl, normalizePhotoData } from './photos-data.js?v=20261121-photo-art';
import { initPhotoAtlas } from './photos-atlas.js?v=20261121-photo-art';
import { renderCurrentLight } from './photos-light.js?v=20261121-photo-art';
import { initViewfinder, initFilm } from './photos-viewfinder.js?v=20261121-photo-art';
import { initLighttable } from './photos-lighttable.js?v=20261121-photo-art';
import { initDarkroom } from './photos-darkroom.js?v=20261121-photo-art';
import { initSearch } from './photos-search.js?v=20261121-photo-art';
import { byId, button, element, pad, thumbnail, reduced, deferSections } from './photos-ui.js?v=20261121-photo-art';
import { averageColor, rgb } from './photos-color.js?v=20261121-photo-art';

function initSectionNav() {
  const nav = document.querySelector('.photoNav'),
    links = [...nav.querySelectorAll('nav a')];
  const sections = [...new Set(links.map((link) => document.querySelector(link.hash)))];
  let mode = 'contact';
  function update() {
    const current =
      sections.filter((s) => s.getBoundingClientRect().top <= innerHeight * 0.31).at(-1) || sections[0];
    links.forEach((link) => {
      const selected =
        link.hash === '#' + current.id &&
        (current.id !== 'gallery' || (mode === 'light') === link.hasAttribute('data-light-nav'));
      if (selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    nav.classList.toggle('is-scrolled', current !== sections[0]);
  }
  const observer = new IntersectionObserver(update, { rootMargin: '-30% 0px -69% 0px' });
  sections.forEach((s) => observer.observe(s));
  return (view) => {
    mode = view;
    update();
  };
}
function rollLink(className, { story, cover }) {
  const link = element('a', className);
  link.href = assetUrl(story.url);
  link.setAttribute('aria-label', '阅读故事 · ' + story.name);
  if (story.accent) link.style.setProperty('--accent', story.accent);
  else if (cover)
    averageColor(cover).then((color) => {
      if (color) link.style.setProperty('--accent', rgb(color));
    });
  return link;
}

function archiveRow(roll) {
  const { story, code, frames, places, first, last } = roll;
  const row = rollLink('archiveRoll', roll);
  const strip = element('span', 'archiveRoll__strip');
  for (const photo of frames.slice(0, 3)) strip.append(thumbnail(photo, 'stories'));
  const months = new Set([first, last].filter(Boolean).map((date) => date.slice(0, 7).replace('-', '.')));
  row.append(
    element('span', 'archiveRoll__bar'),
    element('span', 'archiveRoll__code', 'ROLL ' + code),
    element('strong', 'archiveRoll__name', story.name),
    element('span', 'archiveRoll__places', places.join(' · ')),
    element('span', 'archiveRoll__meta', [frames.length + ' EXP', [...months].join(' – ')].filter(Boolean).join(' · ')),
    strip,
    element('span', 'archiveRoll__go', '阅读 ↗')
  );
  return row;
}

function renderCabinet(rolls) {
  const cabinet = byId('rollCabinet');
  cabinet.hidden = !rolls.length;
  if (cabinet.hidden) return;

  const list = byId('rollCabinetList');
  const filter = byId('rollYearFilter');
  const more = byId('rollCabinetMore');
  const limit = 6;
  let selected = 'all';
  let expanded = false;
  byId('rollCabinetCount').textContent = '早期底片归档 · ' + rolls.length + ' 卷';

  function update() {
    const all = selected === 'all';
    const matching = all ? rolls : rolls.filter((roll) => roll.year === selected);
    const visible = all && !expanded ? matching.slice(0, limit) : matching;
    list.replaceChildren(...visible.map(archiveRow));
    for (const tab of filter.children) tab.setAttribute('aria-pressed', String(tab.value === selected));
    more.hidden = !all || matching.length <= limit;
    more.setAttribute('aria-expanded', String(expanded));
    if (!more.hidden)
      more.textContent = expanded ? '收起归档 ↑' : '展开其余 ' + (matching.length - limit) + ' 卷归档 ↓';
  }

  const years = [...new Set(rolls.map((roll) => roll.year))].sort((a, b) => (Number(b) || 0) - (Number(a) || 0));
  filter.hidden = years.length <= 1;
  if (!filter.hidden) {
    for (const year of ['all', ...years]) {
      const tab = button(year === 'all' ? '全部 ' + rolls.length : year, () => {
        selected = year;
        expanded = false;
        update();
      });
      tab.value = year;
      tab.setAttribute('aria-controls', list.id);
      filter.append(tab);
    }
  }
  more.addEventListener('click', () => {
    expanded = !expanded;
    update();
  });
  update();
}

function renderRolls(stories, photos, regions) {
  const rolls = stories
    .map((story) => {
      const frames = photos.filter((p) => p.storyId === story.id);
      const dates = frames
        .map((p) => p.exif?.datetime?.slice(0, 10) || p.date)
        .filter(Boolean)
        .sort();
      const first = dates[0], last = dates.at(-1);
      const year = first?.slice(0, 4) || story.name.match(/\d{4}/)?.[0] || '其他';
      const code = frames[0]?.roll || story.issue?.match(/\d+$/)?.[0] || '—';
      const cover = frames.find((p) => p.rawSrc === story.cover) || frames[0];
      const places = regions.filter((r) => story.regions?.includes(r.id)).map((r) => r.name);
      return { story, frames, first, last, year, code, cover, places };
    })
    .sort((a, b) => (b.last || '').localeCompare(a.last || ''));
  byId('storiesEyebrow').textContent = 'Rolls · ' + pad(rolls.length) + (rolls.length === 1 ? ' journey' : ' journeys');
  const grid = byId('storyGrid');
  const featured = rolls.slice(0, 3);
  grid.dataset.count = String(featured.length);
  for (const roll of featured) {
    const { story, frames, first, last, code, cover, places } = roll;
    const card = rollLink('rollCard', roll),
      can = element('div', 'rollCan'),
      label = element('div', 'canLabel');
    const name = story.name.replace(/^\d{4}\s*/, '');
    label.append(
      element('small', '', 'ROLL ' + code),
      element('b', '', name),
      element('em', '', frames.length + ' EXP')
    );
    can.append(label);
    const reel = element('div', 'rollReel'),
      art = element('div', 'rollArt');
    const shots = [
      ...new Set([cover, ...[0.15, 0.5, 0.85].map((f) => frames[Math.floor(frames.length * f)])])
    ].filter(Boolean);
    shots.forEach((p) => {
      const cell = element('div');
      cell.append(
        thumbnail(p, 'stories'),
        element('small', '', '▸ ' + p.frame + '　' + p.frame + 'A　LUOQI 2112')
      );
      reel.append(cell);
    });
    art.append(reel, can);
    const meta = element('div', 'rollCaption');
    meta.append(
      element('small', '', [first, last?.slice(5)].filter(Boolean).join(' — ') + '　' + places.join(' · ')),
      element('b', '', '阅读故事 ↗')
    );
    card.append(art, meta);
    grid.append(card);
  }
  renderCabinet(rolls.slice(3));
}
async function main() {
  const configUrl = '../data/config.json';
  const response = await fetch(configUrl, { cache: 'no-cache' }).catch(() =>
    fetch(configUrl, { cache: 'force-cache' })
  );
  if (!response.ok) throw new Error('摄影配置读取失败');
  const config = await response.json(),
    { photos, featured } = normalizePhotoData(config);
  if (!photos.length) throw new Error('摄影配置中没有作品');
  const { regions, stories } = config.photos.atlas,
    site = config.weather.defaultLocation;
  deferSections();
  const nav = initSectionNav(),
    film = initFilm();
  let atlas, table;
  const room = initDarkroom(photos, stories, {
    openRelated: (p) => openPhoto(p),
    selectTone: async (tone) => {
      if (['light', 'timeline'].includes(table.view)) table.choose('contact');
      await table.apply({ tone }, { jump: true });
    }
  });
  async function openPhoto(photo, list, play = false) {
    if (!list && !table.photos.includes(photo)) await table.clear();
    room.open(photo, list || table.photos, play);
  }
  const hero = initViewfinder(photos, featured[0] || photos[0], (p) => openPhoto(p));
  const refresh = () => renderCurrentLight(byId('currentLight'), site);
  refresh();
  setInterval(refresh, 60_000);
  renderRolls(stories, photos, regions);
  table = await initLighttable(photos, regions, site, openPhoto, nav, (id) =>
    atlas?.selectRegion(id, { updateUrl: false })
  );
  const atlasReady = initPhotoAtlas(config, (id) => table.apply({ region: id }))
    .then((result) => (atlas = result))
    .catch(() => {
      byId('atlasMapStatus').textContent = '地图暂时未能载入。';
    });
  const selectRegion = async (id) => {
    await atlasReady;
    atlas?.selectRegion(id);
    byId('atlas').scrollIntoView();
  };
  const search = initSearch({ photos, stories, regions, openPhoto, selectRegion, table, hero, film });
  document.querySelector('[data-light-nav]').onclick = (e) => {
    e.preventDefault();
    table.choose('light', true);
  };
  document.querySelector('.photoNav__sections a[href="#gallery"]:not([data-light-nav])').onclick = () => {
    if (table.view === 'light') table.choose('contact');
  };
  window.addEventListener('keydown', (e) => {
    if (
      e.isComposing ||
      e.defaultPrevented ||
      e.target.closest?.('input,textarea,select,[contenteditable=true]')
    )
      return;
    const key = e.key.toLowerCase();
    if (key === '/' || ((e.metaKey || e.ctrlKey) && key === 'k')) {
      e.preventDefault();
      if (byId('photoLightbox').open) room.close();
      if (!byId('photoSearch').open) search.open();
      return;
    }
    if (document.querySelector('dialog[open]') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (key.length === 1 && /[a-z]/.test(key) && film.type(key)) return;
    if (byId('photoHero').getBoundingClientRect().bottom < innerHeight * 0.35) return;
    if (key === 'arrowleft' || key === 'arrowright') {
      e.preventDefault();
      hero.step(key === 'arrowleft' ? -1 : 1);
    }
    if (key === 'i') hero.info();
    if (key === ' ' && (e.target.id === 'openHero' || !e.target.closest?.('a,button,[role=slider]'))) {
      e.preventDefault();
      hero.fire();
    }
  });
  const requested = new URL(location.href).searchParams.get('photo');
  const photo = photos.find((p) => p.id === requested);
  if (photo) await openPhoto(photo);
  else if (['#atlas', '#stories', '#gallery'].includes(location.hash))
    document.querySelector(location.hash).scrollIntoView({ behavior: 'instant' });
  if (!reduced.matches) {
    const intro = new IntersectionObserver((entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          entry.target.animate(
            [
              { opacity: 0, transform: 'translateY(12px)' },
              { opacity: 1, transform: 'none' }
            ],
            { duration: 380, easing: 'ease-out' }
          );
          intro.unobserve(entry.target);
        }
    });
    document.querySelectorAll('.photoSection__heading,.rollCard').forEach((n) => intro.observe(n));
  }
}
main().catch((error) => {
  byId('photoPageError').hidden = false;
  byId('photoPageError').textContent = '摄影页面加载失败：' + error.message;
  console.error(error);
});
