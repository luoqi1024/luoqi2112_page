import { assetUrl } from './photos-data.js?v=20261122-atlas-scs';
import { byId, element, ensureOrientations, thumbnail } from './photos-ui.js?v=20261122-atlas-scs';
import { parseQuery, matchesQuery } from './photos-filter.js?v=20261122-atlas-scs';

export function initSearch({ photos, stories, regions, openPhoto, selectRegion, table, hero, film }) {
  const dialog = byId('photoSearch'),
    input = byId('searchInput'),
    results = byId('searchResults');
  let choices = [],
    matches = [],
    active = -1,
    revision = 0,
    trigger;
  const commands = [
    ...stories.map((story) => ({
      title: '> play ' + story.name,
      detail: '旅程幻灯片',
      run: () => {
        const roll = photos.filter((p) => p.storyId === story.id);
        if (roll.length) openPhoto(roll[0], roll, true);
      }
    })),
    { title: '> shutter', detail: '按下快门', run: hero.fire },
    ...Object.entries({ contact: '印样', masonry: '瀑布', timeline: '时间轴', light: '光线' }).map(
      ([id, label]) => ({
        title: '> view ' + id,
        detail: label,
        run: () => table.choose(id, true)
      })
    ),
    { title: '> film', detail: '切换胶片模拟', run: film.toggle },
    { title: '> home', detail: '返回首页', run: () => location.assign('../') }
  ];
  function close() {
    dialog.close();
    trigger?.focus({ preventScroll: true });
  }
  function choose(i, apply = false) {
    const choice = choices[i];
    if (apply && matches.length) {
      const query = input.value.trim();
      close();
      table.clear().then(() => table.apply({ q: query }, { jump: true }));
      return;
    }
    if (choice) {
      close();
      choice.run();
    }
  }
  function highlight(i, scroll = true) {
    if (!choices.length) {
      active = -1;
      input.removeAttribute('aria-activedescendant');
      return;
    }
    active = (i + choices.length) % choices.length;
    for (const node of results.querySelectorAll('[role=option]'))
      node.setAttribute('aria-selected', String(+node.dataset.index === active));
    const node = byId('result-' + active);
    input.setAttribute('aria-activedescendant', node.id);
    if (scroll) node.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  async function render() {
    const token = ++revision,
      raw = input.value.trim(),
      terms = parseQuery(raw),
      isCommand = raw.startsWith('>');
    const labels = terms.filter((t) => t.key).map((t) => element('span', '', t.word));
    byId('searchTokens').replaceChildren(...labels);
    if (terms.some((t) => t.key === 'orient')) await ensureOrientations(photos);
    if (token !== revision) return;
    results.replaceChildren();
    choices = [];
    matches = raw && !isCommand ? photos.filter((p) => matchesQuery(p, terms)) : [];
    function group(label, list) {
      if (!list.length) return;
      const section = element('div', 'resultGroup');
      section.setAttribute('role', 'group');
      section.setAttribute('aria-label', label);
      section.append(element('h3', '', label + ' · ' + list.length));
      for (const item of list) {
        const n = choices.push(item) - 1,
          node = element('button', 'resultItem');
        node.type = 'button';
        node.id = 'result-' + n;
        node.tabIndex = -1;
        node.dataset.index = n;
        node.setAttribute('role', 'option');
        if (item.photo) node.append(thumbnail(item.photo));
        const copy = element('span');
        copy.append(element('b', '', item.title), element('small', '', item.detail));
        node.append(copy);
        node.onclick = (e) => choose(n, e.shiftKey);
        node.onpointerenter = () => highlight(n, false);
        section.append(node);
      }
      results.append(section);
    }
    if (!isCommand && raw) {
      group(
        'PHOTOS',
        matches.map((p) => ({
          photo: p,
          title: p.caption,
          detail: [p.exif?.datetime?.replace('T', ' '), p.exif?.focal].filter(Boolean).join(' · '),
          run: () => openPhoto(p)
        }))
      );
      const q = raw.replace(/^place:/i, '').toLowerCase();
      group(
        'ROLLS',
        stories
          .filter((s) => [s.name, s.title].some((v) => v?.toLowerCase().includes(q)))
          .map((s) => ({ title: s.name, detail: s.meta, run: () => location.assign(assetUrl(s.url)) }))
      );
      const places = [];
      for (const r of regions) {
        const add = (name) =>
          places.push({ title: name, detail: r.name + ' · 摄影地图', run: () => selectRegion(r.id) });
        if (r.name.includes(q)) add(r.name);
        for (const place of r.places) if (place.name.toLowerCase().includes(q)) add(place.name);
      }
      group('PLACES', places);
    }
    if (isCommand || !raw) {
      const parts = raw.slice(1).trim().toLowerCase().split(/\s+/);
      group(
        'COMMANDS',
        commands.filter((c) => parts.every((part) => c.title.toLowerCase().includes(part)))
      );
    }
    if (!choices.length) results.append(element('p', 'emptyNote', '没有找到这段光。'));
    highlight(0, false);
  }
  function open() {
    if (dialog.open) return;
    trigger = document.activeElement === document.body ? byId('openSearch') : document.activeElement;
    input.value = '';
    dialog.showModal();
    input.focus();
    render();
  }
  input.oninput = render;
  input.onkeydown = (e) => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      highlight(active + (e.key === 'ArrowDown' ? 1 : -1));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      choose(active, e.shiftKey);
    }
  };
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dialog.onclick = (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
    }
  };
  byId('openSearch').onclick = open;
  byId('closeSearch').onclick = close;
  return { open };
}
