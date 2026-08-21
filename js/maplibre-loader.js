(() => {
  'use strict';

  // IMPORTANTE:
  // O Atlas usa a API global "maplibregl" em js/map.js.
  // Por isso fixamos MapLibre GL JS 5.24.0, última linha v5 compatível
  // com carregamento clássico via <script src=".../maplibre-gl.js">.
  // MapLibre v6 é ESM-only e não publica mais o bundle UMD maplibre-gl.js.
  const VERSION = '5.24.0';

  const SOURCES = [
    {
      name: 'UNPKG',
      js: `https://unpkg.com/maplibre-gl@${VERSION}/dist/maplibre-gl.js`,
      css: `https://unpkg.com/maplibre-gl@${VERSION}/dist/maplibre-gl.css`
    },
    {
      name: 'cdnjs',
      js: `https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/${VERSION}/maplibre-gl.min.js`,
      css: `https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/${VERSION}/maplibre-gl.min.css`
    },
    {
      name: 'jsDelivr',
      js: `https://cdn.jsdelivr.net/npm/maplibre-gl@${VERSION}/dist/maplibre-gl.js`,
      css: `https://cdn.jsdelivr.net/npm/maplibre-gl@${VERSION}/dist/maplibre-gl.css`
    }
  ];

  const errorBox = document.getElementById('mapError');
  const errorText = document.getElementById('mapErrorText');

  function showError(message) {
    console.error('[Atlas Pindaré]', message);
    if (errorText) errorText.textContent = message;
    if (errorBox) errorBox.classList.remove('hidden');
  }

  function hideError() {
    if (errorBox) errorBox.classList.add('hidden');
  }

  function loadCss(url, sourceName) {
    const old = document.getElementById('maplibreCss');
    if (old) old.remove();

    const link = document.createElement('link');
    link.id = 'maplibreCss';
    link.rel = 'stylesheet';
    link.href = url;
    link.onload = () => console.info(`[Atlas Pindaré] CSS MapLibre carregado de ${sourceName}.`);
    link.onerror = () => console.warn(`[Atlas Pindaré] CSS MapLibre não carregou de ${sourceName}; o mapa ainda pode funcionar, mas os controles podem ficar sem estilo.`);
    document.head.appendChild(link);
  }

  function loadAtlasMap() {
    if (!window.maplibregl) {
      showError('A biblioteca cartográfica MapLibre não foi inicializada. Recarregue a página com Ctrl+F5.');
      return;
    }

    // Evita inclusão duplicada ao navegar/recarregar parcialmente.
    if (document.getElementById('atlasMapScript')) return;

    const script = document.createElement('script');
    script.id = 'atlasMapScript';
    script.src = 'js/map.js?v=5';
    script.defer = true;

    script.onload = () => {
      console.info('[Atlas Pindaré] map.js carregado com sucesso.');
      hideError();
    };

    script.onerror = () => {
      showError('O arquivo js/map.js não pôde ser carregado pelo GitHub Pages.');
    };

    document.body.appendChild(script);
  }

  function trySource(index) {
    if (window.maplibregl) {
      loadAtlasMap();
      return;
    }

    if (index >= SOURCES.length) {
      showError('Não foi possível carregar a biblioteca MapLibre. Foram testados UNPKG, cdnjs e jsDelivr. Verifique bloqueios de rede/extensões e recarregue a página.');
      return;
    }

    const source = SOURCES[index];
    console.info(`[Atlas Pindaré] Tentando carregar MapLibre ${VERSION} via ${source.name}...`);

    loadCss(source.css, source.name);

    const script = document.createElement('script');
    script.src = source.js;
    script.async = true;

    script.onload = () => {
      if (window.maplibregl) {
        console.info(`[Atlas Pindaré] MapLibre ${window.maplibregl.version || VERSION} carregado via ${source.name}.`);
        hideError();
        loadAtlasMap();
      } else {
        console.warn(`[Atlas Pindaré] ${source.name} respondeu, mas window.maplibregl não foi definido.`);
        script.remove();
        trySource(index + 1);
      }
    };

    script.onerror = () => {
      console.warn(`[Atlas Pindaré] Falha ao carregar MapLibre via ${source.name}: ${source.js}`);
      script.remove();
      trySource(index + 1);
    };

    document.head.appendChild(script);
  }

  trySource(0);
})();
