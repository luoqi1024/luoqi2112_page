import { readJson, writeJson } from './storage.js?v=20260918-test1';

const LOCATION_KEY = 'weatherLocation';
const CACHE_KEY = 'weatherCache';
const MAX_FALLBACK_AGE = 6 * 60 * 60 * 1000;

const WEATHER_CODES = new Map([
  [0, { label: '晴', dayIcon: '☀️', nightIcon: '🌙' }],
  [1, { label: '晴间多云', dayIcon: '🌤️', nightIcon: '🌙' }],
  [2, { label: '多云', dayIcon: '⛅', nightIcon: '☁️' }],
  [3, { label: '阴', dayIcon: '☁️', nightIcon: '☁️' }],
  [45, { label: '雾', dayIcon: '🌫️', nightIcon: '🌫️' }],
  [48, { label: '雾凇', dayIcon: '🌫️', nightIcon: '🌫️' }],
  [51, { label: '毛毛雨', dayIcon: '🌦️', nightIcon: '🌧️' }],
  [53, { label: '毛毛雨', dayIcon: '🌦️', nightIcon: '🌧️' }],
  [55, { label: '较强毛毛雨', dayIcon: '🌧️', nightIcon: '🌧️' }],
  [56, { label: '冻毛毛雨', dayIcon: '🌧️', nightIcon: '🌧️' }],
  [57, { label: '强冻毛毛雨', dayIcon: '🌧️', nightIcon: '🌧️' }],
  [61, { label: '小雨', dayIcon: '🌦️', nightIcon: '🌧️' }],
  [63, { label: '中雨', dayIcon: '🌧️', nightIcon: '🌧️' }],
  [65, { label: '大雨', dayIcon: '🌧️', nightIcon: '🌧️' }],
  [66, { label: '冻雨', dayIcon: '🌧️', nightIcon: '🌧️' }],
  [67, { label: '强冻雨', dayIcon: '🌧️', nightIcon: '🌧️' }],
  [71, { label: '小雪', dayIcon: '🌨️', nightIcon: '🌨️' }],
  [73, { label: '中雪', dayIcon: '🌨️', nightIcon: '🌨️' }],
  [75, { label: '大雪', dayIcon: '❄️', nightIcon: '❄️' }],
  [77, { label: '雪粒', dayIcon: '🌨️', nightIcon: '🌨️' }],
  [80, { label: '阵雨', dayIcon: '🌦️', nightIcon: '🌧️' }],
  [81, { label: '较强阵雨', dayIcon: '🌧️', nightIcon: '🌧️' }],
  [82, { label: '强阵雨', dayIcon: '⛈️', nightIcon: '⛈️' }],
  [85, { label: '阵雪', dayIcon: '🌨️', nightIcon: '🌨️' }],
  [86, { label: '强阵雪', dayIcon: '❄️', nightIcon: '❄️' }],
  [95, { label: '雷雨', dayIcon: '⛈️', nightIcon: '⛈️' }],
  [96, { label: '雷暴伴冰雹', dayIcon: '⛈️', nightIcon: '⛈️' }],
  [99, { label: '强雷暴伴冰雹', dayIcon: '⛈️', nightIcon: '⛈️' }]
]);

function finiteCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeLocation(value, fallbackName = '默认城市') {
  const latitude = finiteCoordinate(value?.latitude);
  const longitude = finiteCoordinate(value?.longitude);
  if (latitude === null || longitude === null) return null;
  return {
    name: String(value?.name || fallbackName),
    latitude,
    longitude,
    reverseGeocoded: Boolean(value?.reverseGeocoded)
  };
}

function sameLocation(a, b) {
  return Boolean(
    a &&
    b &&
    Math.abs(a.latitude - b.latitude) < 0.002 &&
    Math.abs(a.longitude - b.longitude) < 0.002
  );
}

function describeWeather(code, isDay) {
  const weather = WEATHER_CODES.get(Number(code)) || {
    label: '天气未知',
    dayIcon: '☁️',
    nightIcon: '☁️'
  };
  return {
    label: weather.label,
    icon: isDay ? weather.dayIcon : weather.nightIcon
  };
}

async function requestWeather(location) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,is_day,weather_code'
  );
  url.searchParams.set('temperature_unit', 'celsius');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '1');

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Weather API ${response.status}`);
    const data = await response.json();
    if (!data?.current) throw new Error('Weather API returned no current data');
    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function requestCityName(location) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'geocodejson');
  url.searchParams.set('lat', String(location.latitude));
  url.searchParams.set('lon', String(location.longitude));
  url.searchParams.set('zoom', '10');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('layer', 'address');
  url.searchParams.set('accept-language', 'zh-CN');

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Reverse geocoding API ${response.status}`);
    const data = await response.json();
    const address = data?.features?.[0]?.properties?.geocoding || {};
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.locality ||
      address.county ||
      address.state ||
      address.admin?.level4;
    if (!city) throw new Error('Reverse geocoding returned no city');
    return String(city);
  } finally {
    window.clearTimeout(timeout);
  }
}

export function initWeather(config = {}) {
  const widget = document.getElementById('desktopWeatherWidget');
  const temperature = document.getElementById('desktopWeatherTemp');
  const icon = document.getElementById('desktopWeatherIcon');
  const locationLabel = document.getElementById('desktopWeatherLocation');
  const detail = document.getElementById('desktopWeatherDetail');
  const attribution = document.getElementById('desktopWeatherAttribution');

  if (!widget || !temperature || !icon || !locationLabel || !detail || !attribution) {
    return null;
  }

  const defaultLocation = normalizeLocation(config?.defaultLocation, '默认城市');
  if (config?.enabled === false || !defaultLocation) {
    widget.hidden = true;
    document.body.dataset.weatherState = 'hidden';
    return null;
  }

  const refreshMinutes = Math.min(180, Math.max(10, Number(config?.refreshMinutes) || 30));
  const refreshMs = refreshMinutes * 60 * 1000;
  const savedLocationCandidate = normalizeLocation(readJson(LOCATION_KEY, null), '');
  const savedLocation =
    savedLocationCandidate &&
    !['当前位置', '当前城市'].includes(savedLocationCandidate.name.trim())
      ? savedLocationCandidate
      : null;
  let activeLocation = savedLocation || defaultLocation;
  let lastUpdatedAt = 0;

  const showWidget = () => {
    widget.hidden = false;
    document.body.dataset.weatherState = 'ready';
  };

  const hideWidget = () => {
    widget.hidden = true;
    document.body.dataset.weatherState = 'hidden';
  };

  const render = (data, location, { stale = false } = {}) => {
    const current = data?.current;
    const currentTemperature = Number(current?.temperature_2m);
    const apparentTemperature = Number(current?.apparent_temperature);
    if (!Number.isFinite(currentTemperature)) throw new Error('Invalid weather temperature');

    const weather = describeWeather(current?.weather_code, Number(current?.is_day) === 1);
    temperature.textContent = `${Math.round(currentTemperature)}°`;
    icon.textContent = weather.icon;
    locationLabel.textContent = `${location.name} · ${weather.label}`;
    detail.textContent = Number.isFinite(apparentTemperature)
      ? `体感 ${Math.round(apparentTemperature)}°${stale ? ' · 缓存' : ''}`
      : stale
        ? '缓存天气'
        : '实时天气';
    widget.setAttribute(
      'aria-label',
      `${location.name}，${weather.label}，${Math.round(currentTemperature)} 摄氏度。点击使用当前位置`
    );
    widget.title = location.reverseGeocoded
      ? '点击重新定位'
      : '点击使用当前位置';
    attribution.hidden = !location?.reverseGeocoded;
    lastUpdatedAt = Number(data?.fetchedAt) || Date.now();
    showWidget();
  };

  const readCache = (location) => {
    const cached = readJson(CACHE_KEY, null);
    if (!cached || !sameLocation(cached.location, location) || !cached.data) return null;
    const age = Date.now() - Number(cached.fetchedAt || 0);
    if (!Number.isFinite(age) || age > MAX_FALLBACK_AGE) return null;
    return { ...cached, age };
  };

  const load = async (location, { force = false } = {}) => {
    activeLocation = location;
    const cached = readCache(location);
    if (cached) {
      render({ ...cached.data, fetchedAt: cached.fetchedAt }, location, {
        stale: cached.age >= refreshMs
      });
      if (!force && cached.age < refreshMs) return;
    } else {
      document.body.dataset.weatherState = 'loading';
      widget.hidden = false;
      temperature.textContent = '--°';
      icon.textContent = '…';
      locationLabel.textContent = `${location.name} · 获取中`;
      detail.textContent = '正在更新天气';
      attribution.hidden = !location.reverseGeocoded;
    }

    try {
      const data = await requestWeather(location);
      const fetchedAt = Date.now();
      writeJson(CACHE_KEY, { location, data, fetchedAt });
      render({ ...data, fetchedAt }, location);
    } catch {
      if (!cached) hideWidget();
    }
  };

  const locate = () => {
    if (widget.dataset.locating === 'true') return;
    if (!navigator.geolocation) {
      widget.title = '当前浏览器无法使用定位';
      return;
    }

    const previousLocationText = locationLabel.textContent;
    widget.dataset.locating = 'true';
    widget.setAttribute('aria-busy', 'true');
    locationLabel.textContent = '正在识别城市…';
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coordinates = normalizeLocation({
          name: '',
          latitude: Number(position.coords.latitude.toFixed(3)),
          longitude: Number(position.coords.longitude.toFixed(3))
        });
        if (!coordinates) {
          widget.dataset.locating = 'false';
          widget.removeAttribute('aria-busy');
          locationLabel.textContent = previousLocationText;
          return;
        }

        try {
          const city = await requestCityName(coordinates);
          const location = {
            ...coordinates,
            name: city,
            reverseGeocoded: true
          };
          writeJson(LOCATION_KEY, location);
          await load(location, { force: true });
        } catch {
          locationLabel.textContent = previousLocationText;
          widget.title = '未能识别当前位置城市，请稍后重试';
        } finally {
          widget.dataset.locating = 'false';
          widget.removeAttribute('aria-busy');
        }
      },
      () => {
        widget.dataset.locating = 'false';
        widget.removeAttribute('aria-busy');
        locationLabel.textContent = previousLocationText;
        widget.title = '定位未授权，点击可以重试';
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 15 * 60 * 1000
      }
    );
  };

  widget.addEventListener('click', locate);
  widget.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      locate();
    }
  });

  window.setInterval(() => load(activeLocation, { force: true }), refreshMs);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastUpdatedAt >= refreshMs) {
      load(activeLocation, { force: true });
    }
  });

  load(activeLocation);

  return {
    refresh() {
      return load(activeLocation, { force: true });
    },
    useDefaultLocation() {
      activeLocation = defaultLocation;
      writeJson(LOCATION_KEY, null);
      return load(defaultLocation, { force: true });
    }
  };
}
