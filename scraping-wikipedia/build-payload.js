// Construye el payload de caché a partir del scrape crudo (wc2026-data.json).
// Salida: wc2026-payload.json con todas las secciones que consume la app nueva:
//   matches, scorers (ranking), standings (clasificaciones por grupo), knockout (cruces),
//   teams (catálogo con código FIFA), meta.
// El JSON crudo de partidos lo produce scrape.js a partir del HTML de Wikipedia.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'wc2026-data.json');
const OUT = path.join(__dirname, 'wc2026-payload.json');
const all = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const ROUND_ORDER = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Third place', 'Final'];

// ---- 1) Catálogo de equipos (nombre ES + código FIFA), de los partidos de grupo ----
const teamMap = new Map(); // code -> name
for (const m of all) {
  if (m.code1 && m.team1) teamMap.set(m.code1, m.team1);
  if (m.code2 && m.team2) teamMap.set(m.code2, m.team2);
}
const teams = [...teamMap.entries()]
  .filter(([code]) => /^[A-Z]{3}$/.test(code)) // solo equipos reales (no semillas)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name, 'es'));

// ---- 2) Partidos normalizados ----
const matches = all.map((m, i) => ({
  num: i + 1,
  stage: m.stage,                  // 'group' | 'Round of 32' | ... | 'Final'
  group: m.group || null,          // 'A'..'L' o null
  round: m.round || null,
  team1: m.team1,
  team2: m.team2,
  code1: m.code1 || null,
  code2: m.code2 || null,
  played: m.played,
  score_home: m.score_home,
  score_away: m.score_away,
  date: m.date || null,            // 'D/M'
  time: m.time || null,            // 'HH:MM (UTC-X)'
  stadium: m.stadium || null,
  city: m.city || null,
  report: m.report || null,
  goals: {
    home: (m.goals_home || []).map(normGoal),
    away: (m.goals_away || []).map(normGoal)
  }
}));

function normGoal(g) {
  return {
    name: g.player || g.name || '',
    minutes: g.minutes || [],
    penalty: !!g.penalty,
    owngoal: !!g.owngoal
  };
}

// ---- 3) Máximos goleadores (ranking agregado, sin autogoles) ----
const scorerMap = new Map();
for (const m of matches) {
  for (const [side, code] of [['home', m.code1], ['away', m.code2]]) {
    for (const g of m.goals[side]) {
      if (g.owngoal) continue;
      const key = `${g.name}|${code}`;
      const cur = scorerMap.get(key) || { name: g.name, team_code: code, team: teamMap.get(code) || code, goals: 0, penalties: 0 };
      const n = Math.max(1, g.minutes.length);
      cur.goals += n;
      if (g.penalty) cur.penalties += g.minutes.length || 1;
      scorerMap.set(key, cur);
    }
  }
}
const topScorers = [...scorerMap.values()]
  .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'es'));

// ---- 4) Clasificaciones por grupo (derivadas de los partidos jugados) ----
function emptyRow(code, name) {
  return { code, name, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
}
const standings = {};
const groupLetters = [...new Set(matches.filter(m => m.stage === 'group').map(m => m.group))].filter(Boolean).sort();
for (const g of groupLetters) {
  const rows = new Map();
  const gms = matches.filter(m => m.stage === 'group' && m.group === g);
  for (const m of gms) {
    for (const [code, name] of [[m.code1, m.team1], [m.code2, m.team2]]) {
      if (code && !rows.has(code)) rows.set(code, emptyRow(code, name));
    }
  }
  for (const m of gms) {
    if (!m.played) continue;
    const a = rows.get(m.code1), b = rows.get(m.code2);
    if (!a || !b) continue;
    a.pj++; b.pj++;
    a.gf += m.score_home; a.gc += m.score_away;
    b.gf += m.score_away; b.gc += m.score_home;
    if (m.score_home > m.score_away) { a.pg++; a.pts += 3; b.pp++; }
    else if (m.score_home < m.score_away) { b.pg++; b.pts += 3; a.pp++; }
    else { a.pe++; b.pe++; a.pts++; b.pts++; }
  }
  const list = [...rows.values()];
  list.forEach(r => { r.dg = r.gf - r.gc; });
  list.sort((x, y) => y.pts - x.pts || y.dg - x.dg || y.gf - x.gf || x.name.localeCompare(y.name, 'es'));
  standings[g] = list;
}

// ---- 5) Cruces (fase final), ordenados por ronda ----
const knockout = ROUND_ORDER
  .map(round => ({
    round,
    matches: matches
      .filter(m => m.round === round)
      .map(m => ({ num: m.num, team1: m.team1, team2: m.team2, code1: m.code1, code2: m.code2, played: m.played, score_home: m.score_home, score_away: m.score_away, date: m.date, time: m.time, stadium: m.stadium, city: m.city }))
  }))
  .filter(r => r.matches.length);

// ---- 6) Payload final ----
const payload = {
  source: 'wikipedia-es',
  sourceUrl: 'https://es.wikipedia.org/wiki/Copa_Mundial_de_Fútbol_de_2026',
  event: 'worldcup-2026',
  meta: {
    totalMatches: matches.length,
    playedMatches: matches.filter(m => m.played).length,
    totalGoals: topScorers.reduce((s, x) => s + x.goals, 0),
    groups: groupLetters.length
  },
  teams,
  matches,
  topScorers,
  standings,
  knockout
};

fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log('Payload escrito a', path.basename(OUT));
console.log('- Equipos:', teams.length);
console.log('- Partidos:', matches.length, '(' + payload.meta.playedMatches + ' jugados)');
console.log('- Goleadores:', topScorers.length, '| total goles:', payload.meta.totalGoals);
console.log('- Grupos con clasificación:', Object.keys(standings).length);
console.log('- Rondas de cruces:', knockout.map(k => `${k.round}(${k.matches.length})`).join(', '));
console.log('');
console.log('=== MUESTRA: clasificación Grupo A ===');
console.table(standings.A.map(r => ({ Sel: r.name, PJ: r.pj, Pts: r.pts, GF: r.gf, GC: r.gc, DG: r.dg })));
console.log('=== MUESTRA: top 5 goleadores ===');
console.table(topScorers.slice(0, 5));
