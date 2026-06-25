const fs = require('fs');
const html = fs.readFileSync('wc2026.html', 'utf8');

// ---- 1) Marcadores de sección: usamos los headings reales ----
// Partidos de grupo viven bajo h2 "Fase_de_grupos" con subcabeceras h3 "Grupo_X_2".
// Fase final bajo h2 "Segunda_fase" con h3 por ronda.
const marks = [];
const reH = /<h([234])\b[^>]*\bid="([^"]+)"/g;
let h;
while ((h = reH.exec(html)) !== null) marks.push({ level: +h[1], id: h[2], pos: h.index });

// Encontrar offset de inicio de "Fase_de_grupos" (la sección de partidos, no la fase_grupal de presentación)
const faseGruposPos = marks.find(m => m.id === 'Fase_de_grupos')?.pos ?? 0;
const segundaFasePos = marks.find(m => m.id === 'Segunda_fase')?.pos ?? Infinity;

// Submarcas de grupo dentro de Fase_de_grupos: ids "Grupo_X_2"
const groupMarks = marks
  .filter(m => /^Grupo_[A-L]_2$/.test(m.id) && m.pos >= faseGruposPos)
  .map(m => ({ group: m.id.charAt(6), pos: m.pos }));
// Submarcas de ronda final
const roundMap = {
  Dieciseisavos_de_final: 'Round of 32',
  Octavos_de_final: 'Round of 16',
  Cuartos_de_final: 'Quarter-final',
  Semifinales: 'Semi-final',
  Tercer_puesto: 'Third place',
  Final: 'Final'
};
const roundMarks = marks
  .filter(m => roundMap[m.id] && m.pos >= segundaFasePos)
  .map(m => ({ round: roundMap[m.id], pos: m.pos }));

function groupFor(pos) {
  let g = null;
  for (const mk of groupMarks) { if (mk.pos <= pos) g = mk.group; else break; }
  return g;
}
function roundFor(pos) {
  let r = null;
  for (const mk of roundMarks) { if (mk.pos <= pos) r = mk.round; else break; }
  return r;
}

// ---- 2) Helpers de limpieza de wikitext ----
function clean(s) {
  if (!s) return '';
  return s
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1') // [[link|texto]] -> texto
    .replace(/\[\[([^\]]*)\]\]/g, '$1')           // [[link]] -> link
    .replace(/'''/g, '').replace(/''/g, '')
    .replace(/\{\{esd\}\}/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}
// Goleadores: "* [[X|Y]] {{gol|9}} {{gol|45+2}}" -> [{player:'Y', minutes:[9,45]}...]
function parseGoals(wt) {
  if (!wt) return [];
  const out = [];
  // Cada item suele empezar por "* " o estar en una sola línea
  const items = wt.split('\n').map(x => x.trim()).filter(Boolean);
  for (let it of items) {
    it = it.replace(/^\*\s*/, '');
    // {{gol|17||60||76}} usa doble pipe como separador de minutos (a veces coma/espacio).
    const golRe = /\{\{gol\|([^}]*)\}\}/g;
    const mins = [];
    let g;
    while ((g = golRe.exec(it)) !== null) {
      mins.push(...g[1].split(/[|,\s]+/).filter(Boolean));
    }
    const owngoal = /en propia|autogol|\(a\.?g\.?\)|o\.g\./i.test(it);
    const penalty = /penal|penalti|\(p\.?\)/i.test(it);
    const name = clean(it.replace(/\{\{gol\|[^}]*\}\}/g, '').replace(/\([^)]*\)/g, '')).trim();
    if (name) out.push({ player: name, minutes: mins, owngoal, penalty });
  }
  return out;
}

// ---- 3) Recorrer todas las plantillas Partido ----
const dmRe = /data-mw='([^']*)'/g;
let m;
const all = [];
while ((m = dmRe.exec(html)) !== null) {
  let raw = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&apos;/g, "'");
  if (!raw.includes('./Plantilla:Partido')) continue;
  const j = JSON.parse(raw);
  const p = j.parts[0].template.params;
  const pos = m.index;
  const isFinal = pos >= segundaFasePos;
  const resRaw = (p.resultado && p.resultado.wt || '');
  const resMatch = resRaw.match(/(\d+)\s*:\s*(\d+)/);
  all.push({
    stage: isFinal ? roundFor(pos) : 'group',
    group: isFinal ? null : groupFor(pos),
    round: isFinal ? roundFor(pos) : null,
    team1: clean(p.local && p.local.wt),
    team2: clean(p.visita && p.visita.wt),
    code1: p['paíslocal'] && p['paíslocal'].wt,
    code2: p['paísvisita'] && p['paísvisita'].wt,
    score_home: resMatch ? +resMatch[1] : null,
    score_away: resMatch ? +resMatch[2] : null,
    played: !!resMatch,
    date: clean((p.fecha && p.fecha.wt || '').replace(/\{\{fecha\|(\d+)\|(\d+)\}\}/, '$1/$2')),
    time: clean(p.hora && p.hora.wt),
    stadium: clean(p.estadio && p.estadio.wt),
    city: clean(p.ciudad && p.ciudad.wt),
    report: p.reporte && p.reporte.wt,
    goals_home: parseGoals(p.goleslocal && p.goleslocal.wt),
    goals_away: parseGoals(p.golesvisita && p.golesvisita.wt)
  });
}

// ---- 4) Resumen ----
const byGroup = {};
all.filter(x => x.stage === 'group').forEach(x => {
  byGroup[x.group] = byGroup[x.group] || new Set();
  byGroup[x.group].add(x.team1); byGroup[x.group].add(x.team2);
});
console.log('=== PARTIDOS ===');
console.log('Total:', all.length, '| grupo:', all.filter(x => x.stage === 'group').length, '| final:', all.filter(x => x.stage !== 'group').length);
console.log('Jugados:', all.filter(x => x.played).length);
console.log('');
console.log('=== GRUPOS (composición derivada de partidos) ===');
for (const g of Object.keys(byGroup).sort()) {
  console.log('Grupo ' + g + ':', [...byGroup[g]].join(', '), '(' + byGroup[g].size + ')');
}
console.log('');
console.log('=== GOLEADORES (ranking agregado, top 12) ===');
const scorers = {};
for (const mt of all) {
  for (const [side, code] of [['goals_home', mt.code1], ['goals_away', mt.code2]]) {
    for (const g of mt[side]) {
      if (g.owngoal) continue;
      const key = g.player + '|' + code;
      scorers[key] = scorers[key] || { player: g.player, team: code, goals: 0 };
      scorers[key].goals += Math.max(1, g.minutes.length);
    }
  }
}
Object.values(scorers).sort((a, b) => b.goals - a.goals).slice(0, 12)
  .forEach((s, i) => console.log(`  ${i + 1}. ${s.player} (${s.team}) - ${s.goals}`));
console.log('');
console.log('=== MUESTRA PARTIDO JUGADO (con goleadores) ===');
console.log(JSON.stringify(all.find(x => x.played && x.goals_home.length), null, 2));

fs.writeFileSync('wc2026-data.json', JSON.stringify(all, null, 2));
console.log('\n>> Dataset completo escrito a wc2026-data.json (' + all.length + ' partidos)');
