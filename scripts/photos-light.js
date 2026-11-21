const minute = 60_000;
const day = 1440 * minute;
const radians = Math.PI / 180;
const calendar = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
});
const clock = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

// NOAA fractional-year approximation. Input is a local calendar day, results are instants.
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
export function sunTimes(date, latitude, longitude) {
  const dateKey = date instanceof Date ? calendar.format(date) : date;
  const midnight = Date.parse(dateKey + 'T00:00:00Z');
  const year = new Date(midnight).getUTCFullYear();
  const january = Date.UTC(year, 0, 1);
  const gamma = 2 * Math.PI * (midnight - january) / (Date.UTC(year + 1, 0, 1) - january);
  const { cos, sin, tan, acos } = Math;
  const equation = 229.18 * (0.000075 + 0.001868 * cos(gamma) - 0.032077 * sin(gamma)
    - 0.014615 * cos(2 * gamma) - 0.040849 * sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * cos(gamma) + 0.070257 * sin(gamma)
    - 0.006758 * cos(2 * gamma) + 0.000907 * sin(2 * gamma)
    - 0.002697 * cos(3 * gamma) + 0.00148 * sin(3 * gamma);
  const lat = latitude * radians;
  const angle = acos(cos(90.833 * radians) / (cos(lat) * cos(declination))
    - tan(lat) * tan(declination)) / radians;
  if (!Number.isFinite(angle)) return { sunrise: null, sunset: null };
  const noon = midnight + (720 - 4 * longitude - equation) * minute;
  return { sunrise: new Date(noon - 4 * angle * minute), sunset: new Date(noon + 4 * angle * minute) };
}

export function lightAt(instant, { sunrise, sunset }) {
  if (!Number.isFinite(+instant) || instant == null || !sunrise || !sunset) return null;
  const afterRise = (instant - sunrise) / minute;
  const beforeSet = (sunset - instant) / minute;
  if (afterRise < -40 || beforeSet < -40) return 'night';
  if (afterRise < 0 || beforeSet < 0) return 'blue';
  if (afterRise <= 60 || beforeSet <= 60) return 'golden';
  return 'day';
}

export function renderCurrentLight(container, location, now = new Date()) {
  const { latitude, longitude, name } = location;
  const times = sunTimes(now, latitude, longitude);
  const state = lightAt(now, times);
  container.hidden = !state;
  if (!state) return;
  let nextEvent = '日落';
  let nextTime = times.sunset;
  let title;
  if (state === 'night') {
    const tomorrow = now > times.sunset;
    nextEvent = tomorrow ? '明日日出' : '今日日出';
    nextTime = tomorrow ? sunTimes(new Date(+now + day), latitude, longitude).sunrise : times.sunrise;
    title = nextEvent + ' ' + clock.format(nextTime);
  } else if (state === 'day') {
    title = '距黄金时刻 ' + Math.ceil((times.sunset - now) / minute - 60) + ' min';
  } else {
    title = state === 'golden' ? '黄金时刻进行中' : '蓝调时刻';
    if (now < times.sunrise) {
      nextEvent = '日出';
      nextTime = times.sunrise;
    }
  }
  container.dataset.light = state;
  container.querySelector('small').textContent = 'NOW · ' + name;
  container.querySelector('strong').textContent = title;
  container.querySelector('span').textContent = state === 'night' ? '北京时间 ' + clock.format(now)
    : clock.format(now) + ' · ' + nextEvent + ' ' + clock.format(nextTime);
}
