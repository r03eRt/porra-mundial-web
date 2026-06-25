const fs = require('fs');
const html = fs.readFileSync('ko.html', 'utf8');
const idx = html.indexOf('Combinations_of_matches_in_the_round_of_32');
const after = html.slice(idx);
const tStart = after.indexOf('<table');
const table = after.slice(tStart, after.indexOf('</table>', tStart) + 8);
const rows = table.match(/<tr[\s\S]*?<\/tr>/g) || [];

// Slots de salida en el orden de las columnas (cabecera): 1A,1B,1D,1E,1G,1I,1K,1L
const SLOTS = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L'];

const matrix = {};
let parsed = 0, skipped = 0;
const seenKeys = new Set();

for (let r = 1; r < rows.length; r++) {
  // Celdas td (cuerpo)
  const cells = (rows[r].match(/<td[\s\S]*?<\/td>/g) || [])
    .map(c => c.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim());
  if (!cells.length) continue;

  // Estructura: [No, grupo1..grupo8 (8 celdas), "Yes/No"(?), 3X..3X (8 celdas)]
  // Más robusto: extraer del texto plano de la fila.
  const flat = rows[r].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  // Letras de grupo que clasifican: las 8 letras sueltas tras el número, antes de Yes/No
  // 3X tokens: todos los "3[A-L]"
  const thirds = (flat.match(/3([A-L])/g) || []).map(t => t[1]);
  if (thirds.length !== 8) { skipped++; continue; }

  // Las 8 columnas (SLOTS) en orden -> grupo del tercero
  const entry = {};
  SLOTS.forEach((slot, i) => { entry[slot] = thirds[i]; });

  // Clave: grupos clasificados ordenados alfabéticamente
  const key = [...thirds].sort().join('');
  if (key.length !== 8) { skipped++; continue; }
  if (seenKeys.has(key)) { console.log('Clave duplicada:', key, 'fila', r); }
  seenKeys.add(key);
  matrix[key] = entry;
  parsed++;
}

console.log('Filas parseadas:', parsed, '| saltadas:', skipped);
console.log('Claves únicas:', Object.keys(matrix).length);
console.log('');
console.log('=== Muestra: clave ABCDEFGH ===');
console.log(JSON.stringify(matrix['ABCDEFGH'], null, 2));
console.log('=== Muestra: primera clave ===');
const k0 = Object.keys(matrix)[0];
console.log(k0, '->', JSON.stringify(matrix[k0]));

// Validación: cada entry debe usar exactamente los 8 grupos de la clave, sin repetir
let bad = 0;
for (const [key, entry] of Object.entries(matrix)) {
  const used = Object.values(entry).sort().join('');
  if (used !== key) { bad++; if (bad <= 3) console.log('INCONSISTENTE:', key, '!=', used); }
}
console.log('Entradas inconsistentes (grupos no casan):', bad);

// Escribe el módulo de datos que consume la legacy (window.THIRD_PLACE_MATRIX).
const path = require('path');
const SLOTS = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L'];
const lines = Object.keys(matrix).sort().map(k => {
  const inner = SLOTS.map(s => `"${s}":"${matrix[k][s]}"`).join(',');
  return `  ${k}:{${inner}}`;
});
const header = `// Matriz oficial FIFA del Anexo C — asignación de los 8 mejores terceros a los
// dieciseisavos del Mundial 2026 (48 equipos, 12 grupos). 495 combinaciones.
// Clave: los 8 grupos cuyos terceros clasifican, ordenados alfabéticamente.
// Valor: { <slot 1X>: <grupo del tercero que juega ahí> }, slots 1A,1B,1D,1E,1G,1I,1K,1L.
// Fuente: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage
//   (seccion "Combinations of matches in the round of 32").
// Generado por scraping-wikipedia/parse-matrix.js — NO editar a mano.
window.THIRD_PLACE_MATRIX = {\n`;
// Legacy: global window.THIRD_PLACE_MATRIX (cargado como <script> en index.html).
const legacyOut = header + lines.join(',\n') + '\n};\n';
fs.writeFileSync(path.join(__dirname, '..', 'data', 'third-place-matrix.js'), legacyOut);
console.log('\n>> Escrito data/third-place-matrix.js (' + Object.keys(matrix).length + ' entradas)');

// admin-next y public-next: ES module (export const). Mismo contenido, distinto preámbulo.
const esHeader = header.replace('window.THIRD_PLACE_MATRIX =', 'export const THIRD_PLACE_MATRIX =');
const esOut = esHeader + lines.join(',\n') + '\n};\n';
for (const app of ['admin-next', 'public-next']) {
  fs.writeFileSync(path.join(__dirname, '..', app, 'src', 'third-place-matrix.js'), esOut);
  console.log('>> Escrito ' + app + '/src/third-place-matrix.js (' + Object.keys(matrix).length + ' entradas)');
}
