import { sunTimes, lightAt } from './photos-light.js?v=20260930-photos4';
import { element, pad, photoButton } from './photos-ui.js?v=20260930-photos4';

const colors = { night: '#2a3449', blue: '#587cb0', golden: '#ef9b53', day: '#8f8980' };
const labels = { night: '夜', blue: '蓝调时刻', golden: '黄金时刻', day: '白天' };
const dayMinutes = 1440;
const wrap = (n) => ((n % dayMinutes) + dayMinutes) % dayMinutes;
function point(minute, r) {
  const angle = (minute * Math.PI) / 720 + Math.PI / 2;
  return [300 + r * Math.cos(angle), 300 + r * Math.sin(angle)];
}
function svg(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}
export function renderDial(root, photos, site, open, state) {
  const panel = element('div', 'lightDial'),
    face = element('div', 'dialFace'),
    matches = element('div', 'dialMatches');
  const heading = element('h3', '', '按光线浏览');
  const marker = element('div', 'dialReadout'),
    clock = element('strong'),
    description = element('b'),
    count = element('small');
  marker.append(clock, description, count);
  const scale = svg('svg', { viewBox: '0 0 600 600', 'aria-hidden': true });
  const now = new Date(),
    today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(now);
  const times = sunTimes(today, site.latitude, site.longitude),
    midnight = Date.parse(today + 'T00:00:00+08:00');
  const kind = (m) => lightAt(new Date(midnight + m * 60000), times) || 'night';
  let start = 0;
  for (let m = 1; m <= 1440; m++) {
    if (m < 1440 && kind(m) === kind(start)) continue;
    const a = point(start, 247),
      b = point(m, 247);
    scale.append(
      svg('path', {
        d: 'M' + a.join(' ') + ' A247 247 0 ' + (m - start > 720 ? 1 : 0) + ' 1 ' + b.join(' '),
        fill: 'none',
        stroke: colors[kind(start)],
        'stroke-width': 18
      })
    );
    start = m;
  }
  for (let hour = 0; hour < 24; hour++) {
    const a = point(hour * 60, 260),
      b = point(hour * 60, hour % 3 ? 266 : 274);
    scale.append(svg('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#b1a99b' }));
    if (hour % 6 === 0) {
      const [x, y] = point(hour * 60, 287),
        t = svg('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      t.textContent = pad(hour);
      scale.append(t);
    }
  }
  const dated = [],
    unknown = [];
  for (const p of photos) {
    const time = p.exif?.datetime?.slice(11, 16);
    if (!time) {
      unknown.push(p);
      continue;
    }
    const [h, m] = time.split(':').map(Number),
      minutes = h * 60 + m,
      [x, y] = point(minutes, 247);
    dated.push([minutes, p]);
    scale.append(
      svg('circle', {
        cx: x,
        cy: y,
        r: 4,
        fill: colors[p.light] || '#ddd',
        stroke: '#fff',
        'stroke-width': 1.5
      })
    );
  }
  const hand = svg('line', { x1: 300, y1: 300, stroke: '#ffca6e', 'stroke-width': 2 });
  scale.append(hand);
  face.append(scale, marker);
  face.tabIndex = 0;
  face.setAttribute('role', 'slider');
  for (const [key, value] of Object.entries({
    'aria-label': '选择拍摄时刻',
    'aria-valuemin': 0,
    'aria-valuemax': 1439
  }))
    face.setAttribute(key, value);
  const legend = element('div', 'dialLegend');
  for (const [key, label] of Object.entries(labels)) {
    const item = element('span', '', label);
    item.style.setProperty('--dot', colors[key]);
    legend.append(item);
  }
  panel.append(face, matches);
  root.append(heading, panel, legend);
  if (unknown.length) {
    const more = element('details');
    more.append(
      element('summary', '', '时刻未记录 · ' + unknown.length + ' 张'),
      ...unknown.map((p) => photoButton(p, open, 'gallery'))
    );
    root.append(more);
  }
  function update(mins) {
    state.minute = wrap(Math.round(mins));
    const m = state.minute,
      key = kind(m),
      [x, y] = point(m, 252);
    root.style.setProperty('--tint', colors[key]);
    clock.textContent = pad(Math.floor(m / 60)) + ':' + pad(m % 60);
    description.textContent =
      key.toUpperCase() + (['blue', 'golden'].includes(key) ? (m < 720 ? ' · DAWN' : ' · DUSK') : '');
    const subset = dated.filter(([n]) => Math.min(wrap(n - m), wrap(m - n)) <= 45).map((pair) => pair[1]);
    count.textContent = '这段光里有 ' + subset.length + ' 张照片';
    hand.setAttribute('x2', x);
    hand.setAttribute('y2', y);
    face.setAttribute('aria-valuenow', m);
    face.setAttribute('aria-valuetext', clock.textContent + ' ' + labels[key]);
    matches.replaceChildren(...subset.map((p) => photoButton(p, open, 'gallery')));
    if (!subset.length) matches.append(element('p', 'emptyNote', '这段光里还没有照片。'));
  }
  let rect;
  function fromPointer(e) {
    const x = e.clientX - rect.left - rect.width / 2,
      y = e.clientY - rect.top - rect.height / 2;
    update(((Math.atan2(y, x) - Math.PI / 2) * 720) / Math.PI);
  }
  face.onpointerdown = (e) => {
    rect = face.getBoundingClientRect();
    face.setPointerCapture(e.pointerId);
    fromPointer(e);
  };
  face.onpointermove = (e) => {
    if (face.hasPointerCapture(e.pointerId)) fromPointer(e);
  };
  face.onkeydown = (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      update(state.minute + (['ArrowRight', 'ArrowUp'].includes(e.key) ? 15 : -15));
    }
  };
  face.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      update(state.minute + Math.sign(e.deltaY) * 15);
    },
    { passive: false }
  );
  update(state.minute ?? 20 * 60 + 13);
}
