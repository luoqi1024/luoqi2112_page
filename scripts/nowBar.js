// Forecast times are wall-clock ISO strings at the weather location.
function sunlight(weather, now) {
  if (!weather?.sunrise?.length || !Number.isFinite(weather.offset)) return null;
  const stamp = time => Date.parse(time + 'Z') - weather.offset * 1000;
  const localDate = new Date(now + weather.offset * 1000).toISOString().slice(0,10);
  const i = weather.sunrise.findIndex(value => value?.startsWith(localDate));
  if (i < 0 || !weather.sunset[i]) return null;
  const minute = 60000;
  const rise = (stamp(weather.sunrise[i]) - now) / minute;
  const set = (stamp(weather.sunset[i]) - now) / minute;
  if (!Number.isFinite(rise) || !Number.isFinite(set)) return null;
  if ((rise <= 0 && rise >= -60) || (set >= 0 && set <= 60)) return ['golden','☀ 黄金时刻进行中'];
  if (rise >= 20 && rise <= 40) return ['dawn','◐ 蓝调时刻'];
  if (set <= -20 && set >= -40) return ['dusk','◐ 蓝调时刻'];
  if (rise > 0) return ['night','☀ 距黄金时刻 ' + Math.ceil(rise) + ' min'];
  if (set > 60) return ['day','☀ 距黄金时刻 ' + Math.ceil(set-60) + ' min'];
  const nextRise = weather.sunrise[i+1];
  return ['night',nextRise ? '☾ 明日日出 ' + nextRise.slice(11,16) : ''];
}

export function initNowBar(config, music) {
  const clock = document.getElementById('clock');
  const button = document.getElementById('nowWeather');
  const light = document.getElementById('nowLight');
  const desktopLight = document.getElementById('desktopWidgetLight');
  const player = document.getElementById('nowMusic');
  const timeFormat = new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const weekday = new Intl.DateTimeFormat('zh-CN',{weekday:'short'});
  const weekdayLabel = document.createElement('span');
  weekdayLabel.className = 'weekday';
  const timeLabel = document.createTextNode('');
  clock.replaceChildren(timeLabel,weekdayLabel);
  let weather;
  function tick() {
    const date = new Date();
    if (!clock.hidden) {
      timeLabel.data = timeFormat.format(date);
      weekdayLabel.textContent = ' ' + weekday.format(date);
    }
    const sun = sunlight(weather, +date);
    document.body.dataset.daypart = sun?.[0] || (date.getHours() < 6 || date.getHours() >= 19 ? 'night' : 'day');
    light.hidden = !sun?.[1];
    light.textContent = sun?.[1] || '';
    if (desktopLight && desktopLight.textContent !== light.textContent) {
      desktopLight.textContent = light.textContent;
      desktopLight.hidden = light.hidden;
    }
  }
  clock.hidden = !config.extras?.showClock;
  tick();
  window.setInterval(tick,1000);
  document.addEventListener('weather:update', event => {
    weather = event.detail;
    button.hidden = !weather;
    if (weather) {
      button.textContent = weather.icon + ' ' + weather.locationName + ' ' + weather.temp + '° ' + weather.label;
      button.title = (weather.stale ? '缓存天气 · ' : '') + '点击使用当前位置' + (weather.reverseGeocoded ? ' · 城市信息 © OpenStreetMap contributors' : '');
    }
    tick();
  });
  button.onclick = () => document.getElementById('desktopWeatherWidget').click();
  if (music?.hasTracks) {
    const update = ({ title, artist, playing }) => {
      document.getElementById('nowTrack').textContent = '♪ ' + title + ' — ' + artist;
      player.classList.toggle('playing',playing);
      player.setAttribute('aria-label',(playing ? '暂停 ' : '播放 ') + title + ' — ' + artist);
    };
    update(music.getState());
    document.addEventListener('music:state',event => update(event.detail));
    player.hidden = false;
    player.onclick = music.toggle;
  }
}
