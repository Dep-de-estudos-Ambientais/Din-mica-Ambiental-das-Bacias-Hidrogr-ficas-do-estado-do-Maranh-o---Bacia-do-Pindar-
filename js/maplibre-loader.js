(() => {
  'use strict';

  const VERSION = '6.4.1';
  const SOURCES = [
    `https://cdn.jsdelivr.net/npm/maplibre-gl@${VERSION}/dist/maplibre-gl.js`,
    `https://unpkg.com/maplibre-gl@${VERSION}/dist/maplibre-gl.js`
  ];

  const errorBox = document.getElementById('mapError');
  const errorText = document.getElementById('mapErrorText');

  function showError(message) {
    console.error('[Atlas Pindaré]', message);
    if (errorText) errorText.textContent = message;
    if (errorBox) errorBox.classList.remove('hidden');
  }

  function loadAtlasMap() {
    if (!window.maplibregl) {
      showError('A biblioteca cartográfica MapLibre não foi carregada. Tente recarregar a página com Ctrl+F5.');
      return;
    }

    const script = document.createElement('script');
    script.src = 'js/map.js?v=4';
    script.defer = true;
    script.onload = () => {
      console.info('[Atlas Pindaré] map.js carregado com sucesso.');
      if (errorBox) errorBox.classList.add('hidden');
    };
    script.onerror = () => showError('O arquivo js/map.js não pôde ser carregado pelo GitHub Pages.');
    document.body.appendChild(script);
  }

  function trySource(index) {
    if (window.maplibregl) {
      loadAtlasMap();
      return;
    }

    if (index >= SOURCES.length) {
      showError('Não foi possível carregar o MapLibre pelos servidores de distribuição configurados.');
      return;
    }

    const url = SOURCES[index];
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      if (window.maplibregl) {
        console.info('[Atlas Pindaré] MapLibre carregado de:', url);
        loadAtlasMap();
      } else {
        console.warn('[Atlas Pindaré] O script carregou, mas maplibregl não foi definido:', url);
        trySource(index + 1);
      }
    };

    script.onerror = () => {
      console.warn('[Atlas Pindaré] Falha ao carregar MapLibre de:', url);
      trySource(index + 1);
    };

    document.head.appendChild(script);
  }

  trySource(0);
})();
