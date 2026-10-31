const DATA_URL = './soil_points.geojson';

const map = new ol.Map({
  target: 'map',
  layers: [new ol.layer.Tile({ source: new ol.source.OSM() })],
  view: new ol.View({ center: ol.proj.fromLonLat([57.5, 58.8]), zoom: 10 }),
  controls: ol.control.defaults.defaults({ attribution: false })
});

const vectorSource = new ol.source.Vector({
  url: DATA_URL,
  format: new ol.format.GeoJSON()
});

const pointStyle = new ol.style.Style({
  image: new ol.style.Circle({
    radius: 7,
    fill: new ol.style.Fill({ color: '#477b5c' }),
    stroke: new ol.style.Stroke({ color: '#ffffff', width: 2.2 })
  })
});
const selectedStyle = new ol.style.Style({
  image: new ol.style.Circle({
    radius: 10,
    fill: new ol.style.Fill({ color: '#c29b55' }),
    stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 })
  })
});

const pointsLayer = new ol.layer.Vector({ source: vectorSource, style: pointStyle });
map.addLayer(pointsLayer);

const listElement = document.getElementById('profile-list');
const countElement = document.getElementById('profile-count');
const detailsElement = document.getElementById('profile-details');
const emptyElement = document.getElementById('empty-state');
const searchElement = document.getElementById('search');
let selectedFeature = null;
let allFeatures = [];

function prop(feature, key) {
  const value = feature.get(key);
  return value === undefined || value === null || value === '' ? '—' : value;
}
function safeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}
function featureTitle(feature) {
  const razrez = prop(feature, 'razrez');
  return `Разрез ${razrez}`;
}
function selectFeature(feature, zoom = true) {
  if (!feature) return;
  selectedFeature = feature;
  pointsLayer.changed();
  renderList(searchElement.value);
  renderDetails(feature);
  if (zoom) {
    const geometry = feature.getGeometry();
    map.getView().animate({ center: geometry.getCoordinates(), zoom: Math.max(map.getView().getZoom(), 14), duration: 450 });
  }
}

pointsLayer.setStyle(feature => feature === selectedFeature ? selectedStyle : pointStyle);

function renderList(query = '') {
  const q = query.trim().toLocaleLowerCase('ru');
  const filtered = allFeatures.filter(feature => {
    const p = feature.getProperties();
    return [p.razrez, p.name, p.baseg, p.relief, p.plants].filter(Boolean)
      .some(value => String(value).toLocaleLowerCase('ru').includes(q));
  });
  listElement.innerHTML = '';
  countElement.textContent = `${filtered.length} / ${allFeatures.length}`;
  if (!filtered.length) {
    listElement.innerHTML = '<div class="loading">Совпадений не найдено</div>';
    return;
  }
  filtered.forEach(feature => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `profile-item${feature === selectedFeature ? ' active' : ''}`;
    const number = safeText(prop(feature, 'razrez'));
    const name = safeText(prop(feature, 'name'));
    const baseg = safeText(prop(feature, 'baseg'));
    button.innerHTML = `<span class="profile-number">${number}</span><span><strong>${name}</strong><small>${baseg}</small></span>`;
    button.addEventListener('click', () => selectFeature(feature));
    listElement.appendChild(button);
  });
}

function renderDetails(feature) {
  emptyElement.hidden = true;
  detailsElement.hidden = false;
  const horizons = feature.get('horizons') || [];
  const altitude = prop(feature, 'altitude_m');
  const coords = ol.proj.toLonLat(feature.getGeometry().getCoordinates());
  const coordinateText = `${coords[1].toFixed(5)}° с.ш. · ${coords[0].toFixed(5)}° в.д.`;

  let horizonHtml = '';
  horizons.forEach((horizon, index) => {
    const measurements = Array.isArray(horizon.measurements) ? horizon.measurements : [];
    const rows = measurements.map(item => {
      const value = typeof item.value === 'number' ? Number(item.value.toFixed(3)).toString() : item.value;
      return `<div class="metric-row"><span class="metric-label">${safeText(item.label || item.code)}</span><span class="metric-value">${safeText(value)}</span></div>`;
    }).join('');
    horizonHtml += `<article class="horizon-card">
      <div class="horizon-head"><span class="horizon-name">${safeText(horizon.horizon_name || `Горизонт ${index + 1}`)}</span><span class="horizon-id">ID ${safeText(horizon.horizon_id)}</span></div>
      <div class="metric-list">${rows || '<div class="no-data">Аналитические показатели не указаны</div>'}</div>
    </article>`;
  });

  detailsElement.innerHTML = `
    <div class="detail-kicker">ПАСПОРТ ПОЧВЕННОГО РАЗРЕЗА</div>
    <h2 class="detail-title">${safeText(featureTitle(feature))}</h2>
    <div class="detail-subtitle">${safeText(prop(feature, 'name'))}</div>
    <div class="meta-grid">
      <div class="meta-card"><span>Номер разреза</span><strong>${safeText(prop(feature, 'razrez'))}</strong></div>
      <div class="meta-card"><span>Высота, м</span><strong>${safeText(altitude)}</strong></div>
      <div class="meta-card"><span>Участок</span><strong>${safeText(prop(feature, 'baseg'))}</strong></div>
      <div class="meta-card"><span>Горизонтов</span><strong>${horizons.length}</strong></div>
    </div>
    <div class="description-block"><h3>Положение в рельефе</h3><p>${safeText(prop(feature, 'relief'))}</p></div>
    <div class="description-block"><h3>Растительность</h3><p>${safeText(prop(feature, 'plants'))}</p></div>
    <div class="description-block"><h3>Координаты</h3><p>${safeText(coordinateText)}</p></div>
    <div class="horizons-heading"><h3>Строение почвенного профиля</h3><span>${horizons.length} гориз.</span></div>
    ${horizonHtml || '<div class="no-data">Для этого разреза горизонты не найдены</div>'}
  `;
}

let dataLoaded = false;
vectorSource.on('change', () => {
  if (!dataLoaded && vectorSource.getState() === 'ready') {
    dataLoaded = true;
    allFeatures = vectorSource.getFeatures().sort((a, b) =>
      String(a.get('razrez') ?? '').localeCompare(String(b.get('razrez') ?? ''), 'ru', { numeric: true })
    );
    renderList();
    if (allFeatures.length) {
      const extent = vectorSource.getExtent();
      map.getView().fit(extent, { padding: [45, 45, 45, 45], maxZoom: 12, duration: 350 });
    }
  }
});

vectorSource.on('featuresloaderror', () => {
  listElement.innerHTML = '<div class="error">Не удалось загрузить soil_points.geojson. Проверьте, что файл лежит рядом с index.html и приложение запущено через локальный веб-сервер.</div>';
});

map.on('singleclick', event => {
  let hit = null;
  map.forEachFeatureAtPixel(event.pixel, feature => { hit = feature; return true; }, { layerFilter: layer => layer === pointsLayer });
  if (hit) selectFeature(hit, false);
});

searchElement.addEventListener('input', () => renderList(searchElement.value));
document.getElementById('points-toggle').addEventListener('change', event => pointsLayer.setVisible(event.target.checked));
document.getElementById('show-all').addEventListener('click', () => {
  if (vectorSource.getFeatures().length) {
    map.getView().fit(vectorSource.getExtent(), { padding: [45, 45, 45, 45], maxZoom: 12, duration: 450 });
  }
});
