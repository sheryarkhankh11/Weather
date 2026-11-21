'use strict';

const $ = (id) => document.getElementById(id);

const state = {
  unit: 'c',
  city: null,
  timer: null,
  activeResult: -1,
  searchController: null,
  searchPromise: null,
  searchQuery: '',
};

const WEATHER_CODES = {
  0:  { label: 'Clear sky',          glyph: '0' },
  1:  { label: 'Mainly clear',       glyph: '1' },
  2:  { label: 'Partly cloudy',      glyph: '2' },
  3:  { label: 'Overcast',           glyph: '3' },
  45: { label: 'Fog',                glyph: 'fog' },
  48: { label: 'Rime fog',           glyph: 'fog' },
  51: { label: 'Light drizzle',      glyph: 'rain' },
  53: { label: 'Drizzle',            glyph: 'rain' },
  55: { label: 'Dense drizzle',      glyph: 'rain' },
  56: { label: 'Freezing drizzle',   glyph: 'rain' },
  57: { label: 'Freezing drizzle',   glyph: 'rain' },
  61: { label: 'Slight rain',        glyph: 'rain' },
  63: { label: 'Rain',               glyph: 'rain' },
  65: { label: 'Heavy rain',         glyph: 'rain' },
  66: { label: 'Freezing rain',      glyph: 'rain' },
  67: { label: 'Freezing rain',      glyph: 'rain' },
  71: { label: 'Slight snow',        glyph: 'snow' },
  73: { label: 'Snow',               glyph: 'snow' },
  75: { label: 'Heavy snow',         glyph: 'snow' },
  77: { label: 'Snow grains',        glyph: 'snow' },
  80: { label: 'Rain showers',       glyph: 'rain' },
  81: { label: 'Rain showers',       glyph: 'rain' },
  82: { label: 'Violent showers',    glyph: 'rain' },
  85: { label: 'Snow showers',       glyph: 'snow' },
  86: { label: 'Snow showers',       glyph: 'snow' },
  95: { label: 'Thunderstorm',       glyph: 'storm' },
  96: { label: 'Thunderstorm + hail',glyph: 'storm' },
  99: { label: 'Thunderstorm + hail',glyph: 'storm' },
};

const codeInfo = (c) => WEATHER_CODES[c] || WEATHER_CODES[0];

const toUnit = (c) => state.unit === 'f' ? c * 9 / 5 + 32 : c;
const round = (n) => Math.round(n);
const fmtTemp = (c) => `${round(toUnit(c))}°`;

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
const dayFmt = new Intl.DateTimeFormat('en', { weekday: 'short' });
const dateFmt = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'short', day: 'numeric' });

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('is-show');
  t.hidden = false;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('is-show'), 3200);
}

function showLoader(show) {
  const btn = $('refresh-btn');
  const loader = $('loader');
  if (!btn) return;
  if (show) {
    btn.disabled = true;
    btn.textContent = 'refreshing...';
    if (loader) loader.hidden = false;
  } else {
    btn.disabled = false;
    btn.textContent = 'refresh';
    if (loader) loader.hidden = true;
  }
}

/* ---------- Main ---------- */

const geocodeCache = new Map();

async function geocode(query, signal) {
  const key = query.trim().toLocaleLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  const res = await fetch(`/api/geocode?name=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error('geocode failed');
  const data = await res.json();
  const matches = data.results || [];
  if (geocodeCache.size >= 40) geocodeCache.delete(geocodeCache.keys().next().value);
  geocodeCache.set(key, matches);
  return matches;
}

async function fetchWeather(lat, lon) {
  const res = await fetch(`/api/forecast?latitude=${lat}&longitude=${lon}`);
  if (!res.ok) throw new Error('weather failed');
  return res.json();
}

async function reverseGeocode(lat, lon) {
  const res = await fetch(`/api/reverse?latitude=${lat}&longitude=${lon}`);
  if (!res.ok) throw new Error('reverse geocode failed');
  const data = await res.json();
  return data.results || [];
}

function setGlyph(el, code) {
  const g = el.querySelector('.weather-glyph') || el;
  if (g.classList.contains('weather-glyph')) g.dataset.w = codeInfo(code).glyph;
}

function makeGlyph(code, size) {
  const d = document.createElement('div');
  d.className = 'weather-glyph';
  d.dataset.w = codeInfo(code).glyph;
  if (size) { d.style.width = size; d.style.height = size; }
  return d;
}

function setWeatherAtmosphere(code, isDay) {
  let atmosphere = 'clear';
  if (code >= 95) atmosphere = 'storm';
  else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) atmosphere = 'rain';
  else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) atmosphere = 'snow';
  else if (code === 2 || code === 3 || code === 45 || code === 48) atmosphere = 'cloudy';
  else if (code <= 1 && isDay === 1) atmosphere = 'sunny';
  document.documentElement.dataset.weather = atmosphere;
}

function renderHero(w, city) {
  const c = w.current;
  setWeatherAtmosphere(c.weather_code, c.is_day);
  $('city-name').textContent = city.name;
  $('city-region').textContent = [city.admin1, city.country]
    .filter((value) => value && value !== city.name)
    .join(', ');
  $('hero-temp').textContent = round(toUnit(c.temperature_2m));
  $('hero-condition').textContent = codeInfo(c.weather_code).label;
  setGlyph($('hero-icon'), c.weather_code);

  $('stat-feels').textContent = fmtTemp(c.apparent_temperature);
  $('stat-humidity').textContent = `${c.relative_humidity_2m}%`;
  $('stat-wind').textContent = `${round(c.wind_speed_10m)} km/h`;
  $('stat-pressure').textContent = `${round(c.pressure_msl)} hPa`;
  $('stat-cloud').textContent = `${c.cloud_cover}%`;
  $('stat-precip').textContent = `${c.precipitation.toFixed(1)} mm`;

  const now = new Date();
  $('local-time').textContent = timeFmt.format(now);
  $('local-date').textContent = dateFmt.format(now);

  $('last-updated').textContent = `updated ${timeFmt.format(now)}`;
}

function renderHourly(w) {
  const track = $('hourly-track');
  track.innerHTML = '';
  const times = w.hourly.time;
  const nowIdx = times.findIndex((t) => new Date(t) >= new Date());
  const start = Math.max(0, nowIdx);
  for (let i = start; i < Math.min(start + 24, times.length); i++) {
    const h = document.createElement('div');
    h.className = 'hour';
    if (i === nowIdx) h.classList.add('is-now');
    const t = new Date(times[i]);
    h.innerHTML = `<time>${i === nowIdx ? 'now' : timeFmt.format(t)}</time>`;
    const ic = document.createElement('div');
    ic.className = 'h-icon';
    ic.appendChild(makeGlyph(w.hourly.weather_code[i]));
    h.appendChild(ic);
    const tp = document.createElement('div');
    tp.className = 'h-temp';
    tp.textContent = fmtTemp(w.hourly.temperature_2m[i]);
    h.appendChild(tp);
    const pp = document.createElement('div');
    pp.className = 'h-precip';
    const prob = w.hourly.precipitation_probability[i];
    pp.textContent = prob > 0 ? `${prob}%` : '';
    h.appendChild(pp);
    track.appendChild(h);
  }
}

function renderDaily(w) {
  const list = $('daily-list');
  list.innerHTML = '';
  const days = w.daily.time;
  const allMax = Math.max(...w.daily.temperature_2m_max);
  const allMin = Math.min(...w.daily.temperature_2m_min);
  const span = allMax - allMin || 1;
  for (let i = 0; i < days.length; i++) {
    const d = new Date(days[i]);
    const row = document.createElement('div');
    row.className = 'day';
    const name = document.createElement('div');
    name.className = 'day__name';
    name.innerHTML = `${i === 0 ? 'Today' : dayFmt.format(d)}<small>${d.getDate()}/${d.getMonth() + 1}</small>`;
    row.appendChild(name);
    const ic = document.createElement('div');
    ic.className = 'day__icon';
    ic.appendChild(makeGlyph(w.daily.weather_code[i]));
    row.appendChild(ic);
    const bar = document.createElement('div');
    bar.className = 'day__bar';
    const lo = w.daily.temperature_2m_min[i], hi = w.daily.temperature_2m_max[i];
    const fill = document.createElement('span');
    fill.style.left = `${((lo - allMin) / span) * 100}%`;
    fill.style.width = `${((hi - lo) / span) * 100}%`;
    bar.appendChild(fill);
    row.appendChild(bar);
    const temps = document.createElement('div');
    temps.className = 'day__temps';
    temps.innerHTML = `<span class="max">${fmtTemp(hi)}</span><span class="min">${fmtTemp(lo)}</span>`;
    row.appendChild(temps);
    list.appendChild(row);
  }
}

function renderDetails(w) {
  const c = w.current, d = w.daily;
  const sunrise = new Date(d.sunrise[0]).getTime();
  const sunset = new Date(d.sunset[0]).getTime();
  $('sun-rise').textContent = timeFmt.format(new Date(sunrise));
  $('sun-set').textContent = timeFmt.format(new Date(sunset));
  const now = Date.now();
  const progress = Math.min(1, Math.max(0, (now - sunrise) / (sunset - sunrise)));
  const ang = progress * 180;
  const cx = 10 + 180 * progress;
  const cy = 80 - Math.sin(Math.PI * progress) * 70;
  const dot = $('sun-dot');
  dot.setAttribute('cx', cx);
  dot.setAttribute('cy', cy);

  const dir = c.wind_direction_10m;
  $('wind-needle').style.transform = `translate(-50%,-100%) rotate(${dir}deg)`;
  $('wind-speed').textContent = round(c.wind_speed_10m);
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  $('wind-dir').textContent = dirs[Math.round(dir / 22.5) % 16];

  const uv = d.uv_index_max[0] ?? 0;
  $('uv-num').textContent = round(uv);
  const uvArc = $('uv-arc');
  const circ = 2 * Math.PI * 52;
  uvArc.setAttribute('stroke-dashoffset', circ - Math.min(uv, 11) / 11 * circ);
  const uvLabels = ['Low','Low','Low','Mod','Mod','Mod','High','High','High','V.High','V.High','Extreme','Extreme'];
  $('uv-label').textContent = uvLabels[Math.min(round(uv), 12)] || '—';

  const vis = w.hourly.visibility?.[0] ?? 0;
  const km = vis / 1000;
  $('vis-value').textContent = `${round(km)} km`;
  $('vis-fill').style.width = `${Math.min(100, (km / 20) * 100)}%`;
  $('vis-label').textContent = km > 10 ? 'Excellent' : km > 4 ? 'Moderate' : 'Poor';
}

function render(w, city) {
  renderHero(w, city);
  renderHourly(w);
  renderDaily(w);
  renderDetails(w);
}

async function loadWeather(city, silent) {
  try {
    if (!silent) showLoader(true);
    const w = await fetchWeather(city.latitude, city.longitude);
    state.city = city;
    render(w, city);
    if (!silent) toast(`Live data for ${city.name}`);
  } catch (e) {
    toast('Could not fetch weather. Check your connection.');
    console.error(e);
  } finally {
    showLoader(false);
  }
}

function scheduleRefresh() {
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(() => { if (state.city) loadWeather(state.city, true); }, 5 * 60 * 1000);
}

/* ---------- Search ---------- */
const input = $('search-input');
const results = $('search-results');
let searchTimer = null;

function showSearchStatus(message) {
  results.replaceChildren();
  const item = document.createElement('li');
  item.className = 'search__status';
  item.setAttribute('role', 'status');
  item.textContent = message;
  results.appendChild(item);
  results.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function selectCity(city) {
  clearTimeout(searchTimer);
  state.searchController?.abort();
  state.searchController = null;
  state.searchPromise = null;
  state.searchQuery = '';
  results.hidden = true;
  input.setAttribute('aria-expanded', 'false');
  input.value = city.name;
  loadWeather(city);
  scheduleRefresh();
}

input.addEventListener('input', () => {
  clearTimeout(searchTimer);
  state.searchController?.abort();
  const q = input.value.trim();
  state.searchController = null;
  state.searchPromise = null;
  state.searchQuery = '';
  state.activeResult = -1;
  if (q.length < 2) {
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    return;
  }
  showSearchStatus('Searching worldwide locations…');
  searchTimer = setTimeout(async () => {
    const controller = new AbortController();
    state.searchController = controller;
    state.searchQuery = q;
    state.searchPromise = geocode(q, controller.signal);
    try {
      const list = await state.searchPromise;
      if (input.value.trim() !== q) return;
      state.activeResult = -1;
      if (!list.length) { showSearchStatus('No matching places found. Try another spelling.'); return; }
      results.replaceChildren();
      list.forEach((city) => {
        const li = document.createElement('li');
        li.role = 'option';
        const name = document.createElement('strong');
        name.textContent = city.name;
        const location = document.createElement('small');
        location.textContent = [
          city.feature_code === 'country' ? '' : city.feature_code,
          city.admin1,
          city.country === city.name ? '' : city.country,
        ].filter(Boolean).join(' · ');
        li.append(name, location);
        li.addEventListener('click', () => selectCity(city));
        results.appendChild(li);
      });
      results.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error(error);
      showSearchStatus('Search unavailable. Please try again.');
    } finally {
      if (state.searchController === controller) {
        state.searchController = null;
        state.searchPromise = null;
        state.searchQuery = '';
      }
    }
  }, 300);
});

input.addEventListener('keydown', (e) => {
  const items = results.querySelectorAll('li');
  if (!results.hidden && items.length && items[0].getAttribute('role') !== 'option') {
    if (e.key === 'Enter') { e.preventDefault(); runDefault(); }
    return;
  }
  if (results.hidden || !items.length) {
    if (e.key === 'Enter') { e.preventDefault(); runDefault(); }
    return;
  }
  if (e.key === 'ArrowDown') { e.preventDefault(); state.activeResult = (state.activeResult + 1) % items.length; }
  else if (e.key === 'ArrowUp') { e.preventDefault(); state.activeResult = (state.activeResult - 1 + items.length) % items.length; }
  else if (e.key === 'Enter') {
    e.preventDefault();
    if (state.activeResult >= 0) items[state.activeResult].click();
    else if (items[0].role === 'option') items[0].click();
    else runDefault();
  }
  else if (e.key === 'Escape') {
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    return;
  }
  else return;
  items.forEach((li, i) => li.classList.toggle('is-active', i === state.activeResult));
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search')) {
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  }
});

/* ---------- Units ---------- */
$('unit-c').addEventListener('click', () => switchUnit('c'));
$('unit-f').addEventListener('click', () => switchUnit('f'));

function switchUnit(u) {
  if (state.unit === u) return;
  state.unit = u;
  $('unit-c').classList.toggle('is-active', u === 'c');
  $('unit-f').classList.toggle('is-active', u === 'f');
  $('unit-c').setAttribute('aria-pressed', u === 'c');
  $('unit-f').setAttribute('aria-pressed', u === 'f');
  if (state.city) loadWeather(state.city, true);
}

/* ---------- Refresh / default ---------- */
$('refresh-btn').addEventListener('click', () => { if (state.city) loadWeather(state.city); });

async function runDefault() {
  const query = input.value.trim() || 'London';
  const pending = state.searchQuery === query ? state.searchPromise : null;
  clearTimeout(searchTimer);
  if (!pending) {
    state.searchController?.abort();
    state.searchController = null;
    state.searchPromise = null;
    state.searchQuery = '';
    showSearchStatus('Searching worldwide locations…');
  }
  const controller = pending ? state.searchController : new AbortController();
  if (!pending) {
    state.searchController = controller;
    state.searchQuery = query;
    state.searchPromise = geocode(query, controller.signal);
  }
  try {
    const list = await state.searchPromise;
    if (list.length) selectCity(list[0]);
    else showSearchStatus('No matching places found. Try another spelling.');
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.error(error);
    showSearchStatus('Search unavailable. Please try again.');
  } finally {
    if (state.searchController === controller) {
      state.searchController = null;
      state.searchPromise = null;
      state.searchQuery = '';
    }
  }
}

/* ---------- Theme ---------- */
const themeToggle = $('theme-toggle');
const savedTheme = localStorage.getItem('verdant-theme');
document.documentElement.dataset.theme = savedTheme === 'light' ? 'light' : 'dark';

function updateThemeButton() {
  const isLight = document.documentElement.dataset.theme === 'light';
  themeToggle.textContent = isLight ? '☾ Dark' : '☀ Light';
  themeToggle.setAttribute('aria-pressed', isLight);
  themeToggle.setAttribute('aria-label', `Switch to ${isLight ? 'dark' : 'light'} mode`);
}

themeToggle.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem('verdant-theme', nextTheme);
  updateThemeButton();
});
updateThemeButton();

/* ---------- Geolocation ---------- */
function tryGeolocation() {
  if (!navigator.geolocation) return runDefault();
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const city = {
        name: 'Your location', admin1: '', country: '',
        latitude: pos.coords.latitude, longitude: pos.coords.longitude,
      };
      try {
        const results = await reverseGeocode(city.latitude, city.longitude);
        if (results?.[0]) Object.assign(city, results[0]);
      } catch {}
      loadWeather(city);
      scheduleRefresh();
    },
    () => runDefault(),
    { timeout: 5000 }
  );
}

tryGeolocation();