// ============================================================================
// ATLAS DIGITAL DA BACIA DO RIO PINDARÉ
// Exportação MapBiomas Uso e Cobertura 2024 -> COG para o GitHub Pages
// ============================================================================

// 1) SUBSTITUA pelo Asset ID criado ao enviar bacia_pindare_earth_engine.zip.
var ASSET_BACIA = 'projects/SEU_PROJETO/assets/bacia_pindare';

// 2) Fonte oficial MapBiomas Brasil - Coleção 10.1.
var MAPBIOMAS_ASSET = 'projects/mapbiomas-public/assets/brazil/lulc/collection10_1/mapbiomas_brazil_collection10_1_coverage_v1';

var bacia = ee.FeatureCollection(ASSET_BACIA);
var mapbiomas = ee.Image(MAPBIOMAS_ASSET);

print('Bandas disponíveis:', mapbiomas.bandNames());
print('Limite da Bacia do Pindaré:', bacia);

// 3) Seleciona 2024 e mascara tudo que estiver fora da bacia.
var uso2024 = mapbiomas
  .select('classification_2024')
  .clipToCollection(bacia)
  .toUint16();

// Paleta para conferência visual no Earth Engine.
// As cores seguem a legenda MapBiomas nas classes já confirmadas.
var classIds = [3,4,5,6,49,11,12,32,29,50,15,39,20,40,62,41,46,47,35,48,9,21,23,24,30,2275,25,33,31,27];
var palette = [
  '1f8d49','7dc975','04381d','026975','02d659',
  '519799','d6bc74','fc8114','ffaa5f','ad5100',
  'edde8e','f5b3c8','db7093','c71585','ff69b4','f54ca9',
  'd68fe2','9932cc','9065d0','e6ccff','7a5900','ffefc3',
  'ffa07a','d4271e','9c0027','777777','db4d4f','2532e4','091077','ffffff'
];

var preview = uso2024.remap(classIds, ee.List.sequence(0, classIds.length - 1));
Map.centerObject(bacia, 7);
Map.addLayer(preview, {min: 0, max: classIds.length - 1, palette: palette}, 'MapBiomas 2024 - Bacia do Pindaré');
Map.addLayer(bacia.style({color: '173126', fillColor: '00000000', width: 2}), {}, 'Limite da bacia');

// 4) Prepara NoData = 0. O raster continua contendo apenas valores válidos dentro da bacia.
var exportImage = uso2024
  .unmask({value: 0, sameFootprint: false})
  .toUint16();

// 5) Exporta em Web Mercator (EPSG:3857) como Cloud Optimized GeoTIFF.
// O EPSG:3857 é importante para leitura direta no MapLibre COG Protocol.
Export.image.toDrive({
  image: exportImage,
  description: 'mapbiomas_2024_bacia_pindare',
  folder: 'Mapas_Pindare_WebGIS',
  fileNamePrefix: 'mapbiomas_2024',
  region: bacia.geometry().bounds(),
  scale: 30,
  crs: 'EPSG:3857',
  maxPixels: 1e10,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    cloudOptimized: true,
    noData: 0
  }
});
