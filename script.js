'use strict';

const $ = (id) => document.getElementById(id);

const state = {
  unit: 'c',
  city: null,
  coords: null,
  timer: null,
  activeResult: -1,
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

const timeFmt = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false });
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
  if (!btn) return;
  if (show) {
    btn.disabled = true;
    btn.textContent = 'refreshing...';
  } else {
    btn.disabled = false;
    btn.textContent = 'refresh';
  }
}
    /* ---------- Main ---------- */


async function geocode(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('geocode failed');
  const data = await res.json();
  return data.results || [];
}

async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m',
    hourly: 'temperature_2m,weather_code,precipitation_probability,uv_index,visibility',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,wind_speed_10m_max',
    forecast_days: '7',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error('weather failed');
  return res.json();
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

function renderHero(w, city) {
  const c = w.current;
  $('city-name').textContent = city.name;
  $('city-region').textContent = [city.admin1, city.country].filter(Boolean).join(', ');
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

input.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = input.value.trim();
  if (q.length < 2) { results.hidden = true; return; }
  searchTimer = setTimeout(async () => {
    try {
      const list = await geocode(q);
      state.activeResult = -1;
      if (!list.length) { results.hidden = true; return; }
      results.innerHTML = '';
      list.forEach((c, i) => {
        const li = document.createElement('li');
        li.role = 'option';
        li.innerHTML = `<strong>${c.name}</strong><small>${[c.admin1, c.country].filter(Boolean).join(', ')}</small>`;
        li.addEventListener('click', () => {
          results.hidden = true;
          input.value = c.name;
          loadWeather(c);
          scheduleRefresh();
        });
        results.appendChild(li);
      });
      results.hidden = false;
    } catch { results.hidden = true; }
  }, 280);
});

input.addEventListener('keydown', (e) => {
  const items = results.querySelectorAll('li');
  if (results.hidden || !items.length) {
    if (e.key === 'Enter') runDefault();
    return;
  }
  if (e.key === 'ArrowDown') { e.preventDefault(); state.activeResult = (state.activeResult + 1) % items.length; }
  else if (e.key === 'ArrowUp') { e.preventDefault(); state.activeResult = (state.activeResult - 1 + items.length) % items.length; }
  else if (e.key === 'Enter') { e.preventDefault(); if (state.activeResult >= 0) items[state.activeResult].click(); else runDefault(); }
  else if (e.key === 'Escape') { results.hidden = true; return; }
  else return;
  items.forEach((li, i) => li.classList.toggle('is-active', i === state.activeResult));
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search')) results.hidden = true;
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
  try {
    const list = await geocode(input.value.trim() || 'London');
    if (list.length) { input.value = list[0].name; loadWeather(list[0]); scheduleRefresh(); }
  } catch { toast('Search unavailable right now.'); }
}

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
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${city.latitude}&longitude=${city.longitude}&count=1&language=en&format=json`);
        const j = await r.json();
        if (j.results?.[0]) Object.assign(city, j.results[0]);
      } catch {}
      loadWeather(city);
      scheduleRefresh();
    },
    () => runDefault(),
    { timeout: 5000 }
  );
}

tryGeolocation();