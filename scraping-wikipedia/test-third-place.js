// Tests mínimos de la lógica de terceros del Mundial 2026 (Anexo C FIFA).
// Reproduce las funciones de src/app.js y las valida contra la matriz real
// (data/third-place-matrix.js). Ejecutar: node scraping-wikipedia/test-third-place.js
const path = require('path');
global.window = {};
require(path.join(__dirname, '..', 'data', 'third-place-matrix.js'));

const BEST_THIRDS_QUALIFY_COUNT = 8;
const THIRD_SLOT_BY_GROUPSET = {
  ABCDF: '1E', CDFGH: '1I', CEFHI: '1A', EHIJK: '1L',
  BEFIJ: '1D', AEHIJ: '1G', EFGIJ: '1B', DEIJL: '1K'
};

function rankThirdPlacedTeams(teams) {
  return [...teams].sort((a, b) => {
    if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
    if ((b.goalDifference || 0) !== (a.goalDifference || 0)) return (b.goalDifference || 0) - (a.goalDifference || 0);
    if ((b.goalsFor || 0) !== (a.goalsFor || 0)) return (b.goalsFor || 0) - (a.goalsFor || 0);
    const fpA = a.fairPlayScore, fpB = b.fairPlayScore;
    if (fpA != null && fpB != null && fpB !== fpA) return fpB - fpA;
    const frA = a.fifaRanking, frB = b.fifaRanking;
    if (frA != null && frB != null && frA !== frB) return frA - frB;
    return (a.groupIndex ?? 0) - (b.groupIndex ?? 0);
  });
}
function getBestThirdPlacedTeams(teams) { return rankThirdPlacedTeams(teams).slice(0, 8); }
function getThirdPlaceCombination(best) { return best.map(t => t.group).sort().join(''); }
function assignThirdPlacedTeamsToRoundOf32(best) {
  if (!best || best.length !== BEST_THIRDS_QUALIFY_COUNT) return null;
  const combination = getThirdPlaceCombination(best);
  const entry = window.THIRD_PLACE_MATRIX[combination];
  if (!entry) throw new Error(`No third-place matrix entry found for combination ${combination}`);
  const byGroup = Object.fromEntries(best.map(t => [t.group, t]));
  return Object.entries(entry).map(([slot, thirdGroup]) => ({ slot, thirdGroup, thirdTeam: byGroup[thirdGroup] }));
}

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } }
function team(group, o = {}) {
  return { id: group, name: group, group, points: 3, goalDifference: 0, goalsFor: 2, groupIndex: group.charCodeAt(0) - 65, ...o };
}

console.log('Matriz cargada:', Object.keys(window.THIRD_PLACE_MATRIX).length, 'entradas');
console.log('');

// 1. 12 terceros -> exactamente 8
const twelve = 'ABCDEFGHIJKL'.split('').map((g, i) => team(g, { points: 12 - i }));
ok('Con 12 terceros devuelve exactamente 8', getBestThirdPlacedTeams(twelve).length === 8);

// 2. Empate a puntos -> gana mejor diferencia de goles
const t2 = [team('A', { points: 4, goalDifference: 1 }), team('B', { points: 4, goalDifference: 5 })];
ok('Empate a puntos: gana mejor DG', rankThirdPlacedTeams(t2)[0].group === 'B');

// 3. Empate en DG -> gana más GF
const t3 = [team('A', { points: 4, goalDifference: 2, goalsFor: 3 }), team('B', { points: 4, goalDifference: 2, goalsFor: 7 })];
ok('Empate en DG: gana más GF', rankThirdPlacedTeams(t3)[0].group === 'B');

// 4. Empate en GF -> gana mejor fairPlayScore (mayor = mejor)
const t4 = [team('A', { points: 4, goalDifference: 2, goalsFor: 3, fairPlayScore: -5 }), team('B', { points: 4, goalDifference: 2, goalsFor: 3, fairPlayScore: -1 })];
ok('Empate en GF: gana mejor fairPlay', rankThirdPlacedTeams(t4)[0].group === 'B');

// 5. Empate en fairPlay -> gana menor fifaRanking
const t5 = [team('A', { points: 4, goalDifference: 2, goalsFor: 3, fairPlayScore: -2, fifaRanking: 20 }), team('B', { points: 4, goalDifference: 2, goalsFor: 3, fairPlayScore: -2, fifaRanking: 5 })];
ok('Empate en fairPlay: gana menor ranking FIFA', rankThirdPlacedTeams(t5)[0].group === 'B');

// 6. La combinación siempre sale ordenada alfabéticamente
ok('Combinación ordenada alfabéticamente', getThirdPlaceCombination(['C', 'A', 'H', 'B', 'D', 'F', 'G', 'E'].map(g => team(g))) === 'ABCDEFGH');

// 7. Combinación inexistente lanza error
let threw = false;
try { assignThirdPlacedTeamsToRoundOf32('ABCDEFGH'.split('').map(g => team(g)).concat()); } catch { threw = true; }
// (ABCDEFGH sí existe; probamos una imposible de 8 grupos repetidos no aplica → usamos clave válida + alteramos)
threw = false;
try {
  const fake = 'ABCDEFGH'.split('').map(g => team(g));
  const orig = window.THIRD_PLACE_MATRIX['ABCDEFGH'];
  delete window.THIRD_PLACE_MATRIX['ABCDEFGH'];
  try { assignThirdPlacedTeamsToRoundOf32(fake); } finally { window.THIRD_PLACE_MATRIX['ABCDEFGH'] = orig; }
} catch { threw = true; }
ok('Combinación inexistente lanza error', threw);

// 8. assignThirdPlacedTeamsToRoundOf32 devuelve 8 cruces
const eight = 'ABCDEFGH'.split('').map(g => team(g));
const res = assignThirdPlacedTeamsToRoundOf32(eight);
ok('assign devuelve 8 cruces', res.length === 8);
ok('assign: sin equipos repetidos', new Set(res.map(r => r.thirdGroup)).size === 8);
ok('assign: cada slot recibe un tercero de la combinación', res.every(r => eight.some(t => t.group === r.thirdGroup)));

console.log('');
console.log(`Resultado: ${pass} OK, ${fail} fallos`);
process.exit(fail ? 1 : 0);
