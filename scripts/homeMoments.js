const rooms = [
  ['cinema','film','影','影厅','#76201d'],
  ['reading','book','书','阅读室','#8c4f36'],
  ['poetry','poem','诗','诗歌室','#747d74'],
  ['records','record','音','唱片室','#a8743f'],
  ['fragments','fragment','文','片语室','#365d72']
];

export function initHomeMoments() {
  const doors = document.getElementById('hallDoors');
  const daily = document.getElementById('dailyMoment');
  const quotes = [];
  let loading;
  let lastDate;
  const sources = rooms.map(([slug, key, glyph, name, color], i) => {
    const url = './moments/' + slug + '/';
    const door = document.createElement('a');
    door.className = 'roomDoor';
    door.href = url;
    door.style.setProperty('--room-color',color);
    door.setAttribute('aria-label',name);
    door.innerHTML = '<span class="roomDoor__info"><b></b><span></span><em>—</em></span><strong></strong><small></small>';
    door.querySelector('b').textContent = name;
    door.querySelector('strong').textContent = glyph;
    door.querySelector('small').textContent = String(i+1).padStart(2,'0');
    doors.append(door);
    return { slug, key, name, url, door };
  });

  function updateQuote() {
    if (!quotes.length) return;
    const date = new Date();
    const stamp = [date.getFullYear(),date.getMonth()+1,date.getDate()].map(n => String(n).padStart(2,'0')).join('-');
    if (lastDate === stamp) return;
    lastDate = stamp;
    const quote = quotes[Number(stamp.replaceAll('-','')) % quotes.length];
    daily.href = quote.url;
    daily.querySelector('small').textContent = '今日一片刻 · ' + stamp.slice(5).replace('-','.');
    daily.querySelector('p').textContent = quote.text;
    daily.querySelector('span').textContent = '— ' + quote.name + '《' + quote.title + '》 ↗';
    daily.hidden = false;
  }

  async function readRoom({ slug, key, name, url, door }) {
    const response = await fetch('./data/moments-' + slug + '.json');
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    const entries = data[key + 's'];
    door.querySelector('.roomDoor__info span').textContent = data.room.statement;
    door.querySelector('em').textContent = entries.length + ' ' + (key + 's').toUpperCase() + ' ↗';
    door.setAttribute('aria-label',name + '，' + entries.length + ' 件馆藏');
    return entries.map(item => ({
      title:item.title, detail:[item.author,item.director,item.artist,item.originalTitle,name].filter(Boolean).join(' · '),
      url:url + '?' + key + '=' + encodeURIComponent(item.id),
      text:item.text || item.lines?.join(''), name
    }));
  }

  function load() {
    loading ??= Promise.allSettled(sources.map(readRoom)).then(results => {
      // Keep room/file order even when requests complete out of order.
      const entries = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
      quotes.push(...entries.filter(item => item.text));
      updateQuote();
      return entries;
    });
    return loading;
  }
  requestAnimationFrame(() => requestAnimationFrame(load));
  document.addEventListener('visibilitychange',updateQuote);
  window.setInterval(updateQuote,60000);
  return load;
}
