import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.2.0/dist/maplibre-gl.mjs';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [-46.04, -4.47],
  zoom: 6.2,
  attributionControl: true
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-right');

const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menuBtn');
const toggleBacia = document.getElementById('toggleBacia');

menuBtn.addEventListener('click', () => {
  sidebar.classList.toggle('closed');
  document.body.classList.toggle('sidebar-closed');
  window.setTimeout(() => map.resize(), 260);
});

async function carregarBacia() {
  const response = await fetch('./data/limite_bacia_pindare.geojson');
  if (!response.ok) throw new Error('Não foi possível carregar o limite da bacia.');
  const geojson = await response.json();

  map.addSource('bacia-pindare', {
    type: 'geojson',
    data: geojson
  });

  map.addLayer({
    id: 'bacia-fill',
    type: 'fill',
    source: 'bacia-pindare',
    paint: {
      'fill-color': '#2f8f61',
      'fill-opacity': 0.08
    }
  });

  map.addLayer({
    id: 'bacia-outline',
    type: 'line',
    source: 'bacia-pindare',
    paint: {
      'line-color': '#176b45',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        5, 2,
        9, 4
      ]
    }
  });

  const bounds = new maplibregl.LngLatBounds();
  const addCoords = (coords) => {
    if (typeof coords[0] === 'number') {
      bounds.extend(coords);
      return;
    }
    coords.forEach(addCoords);
  };
  geojson.features.forEach(f => addCoords(f.geometry.coordinates));

  map.fitBounds(bounds, {
    padding: { top: 45, right: 45, bottom: 45, left: 45 },
    duration: 900
  });

  map.on('click', 'bacia-fill', (e) => {
    const p = e.features?.[0]?.properties || {};
    const area = Number(p.area_total || p.area_km2 || 0).toLocaleString('pt-BR', {
      maximumFractionDigits: 1
    });

    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <h3 class="popup-title">${p.nome_bacia || 'Bacia do Rio Pindaré'}</h3>
        <div class="popup-grid">
          <span>Curso principal</span><strong>${p.curso_prin || 'Rio Pindaré'}</strong>
          <span>Área</span><strong>${area} km²</strong>
          <span>Suprabacia</span><strong>${p.suprabacia || '—'}</strong>
          <span>Cód. Otto</span><strong>${p.cod_otto || '—'}</strong>
        </div>
      `)
      .addTo(map);
  });

  map.on('mouseenter', 'bacia-fill', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'bacia-fill', () => map.getCanvas().style.cursor = '');
}

map.on('load', async () => {
  try {
    await carregarBacia();
  } catch (err) {
    console.error(err);
    alert('Erro ao carregar o limite da Bacia do Pindaré.');
  }
});

toggleBacia.addEventListener('change', (e) => {
  const visibility = e.target.checked ? 'visible' : 'none';
  ['bacia-fill', 'bacia-outline'].forEach(id => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
  });
});
