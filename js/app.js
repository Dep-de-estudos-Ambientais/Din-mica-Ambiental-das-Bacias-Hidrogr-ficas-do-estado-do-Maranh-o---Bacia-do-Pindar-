const VALID_VIEWS = ['mapa','dados-orbitais','sobre'];
const viewPanels = [...document.querySelectorAll('[data-view-panel]')];
const navButtons = [...document.querySelectorAll('[data-view]')];
const mapOnlyControls = [...document.querySelectorAll('.map-only')];
const sidebarEl = document.getElementById('sidebar');

function normalizeView(value) {
  return VALID_VIEWS.includes(value) ? value : 'mapa';
}

function setView(view, updateHash=true) {
  view = normalizeView(view);
  viewPanels.forEach(panel => panel.classList.toggle('active', panel.dataset.viewPanel === view));
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  mapOnlyControls.forEach(el => el.classList.toggle('hidden', view !== 'mapa'));

  if (view === 'mapa') {
    setTimeout(() => window.pindareMap?.resize(), 80);
  } else if (window.innerWidth <= 760) {
    sidebarEl?.classList.add('closed');
    document.body.classList.add('sidebar-closed');
  }

  if (updateHash && location.hash !== `#${view}`) {
    history.replaceState(null, '', `#${view}`);
  }
}

navButtons.forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
document.getElementById('openOrbitalBtn')?.addEventListener('click', () => setView('dados-orbitais'));
window.addEventListener('hashchange', () => setView(location.hash.slice(1), false));

if (window.innerWidth <= 760) {
  sidebarEl?.classList.add('closed');
  document.body.classList.add('sidebar-closed');
}
setView(location.hash.slice(1) || 'mapa', false);
