const DATA = window.PORRA_DATA;
const DEFAULT_API_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const API_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const adminParam = new URLSearchParams(window.location.search).get('admin');
const IS_ADMIN = new URLSearchParams(window.location.search).has('admin')
  && !['0', 'false', 'no'].includes(String(adminParam).toLowerCase());
const LS_KEYS = {
  mini: 'porra.miniResults.v1',
  apiUrl: 'porra.apiUrl.v1',
  lastUpdate: 'porra.lastUpdate.v1'
};

const TEAM_FLAGS = {
  'A. SAUDÍ': '🇸🇦',
  'ALEMANIA': '🇩🇪',
  'ARGELIA': '🇩🇿',
  'ARGENTINA': '🇦🇷',
  'AUSTRALIA': '🇦🇺',
  'AUSTRIA': '🇦🇹',
  'BOSNIA': '🇧🇦',
  'BRASIL': '🇧🇷',
  'BÉLGICA': '🇧🇪',
  'C. MARFIL': '🇨🇮',
  'CABO VERDE': '🇨🇻',
  'CANADÁ': '🇨🇦',
  'CATAR': '🇶🇦',
  'CHEQUIA': '🇨🇿',
  'COLOMBIA': '🇨🇴',
  'COREA': '🇰🇷',
  'CROACIA': '🇭🇷',
  'CURAZAO': '🇨🇼',
  'ECUADOR': '🇪🇨',
  'EE.UU.': '🇺🇸',
  'EGIPTO': '🇪🇬',
  'ESCOCIA': '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
  'ESPAÑA': '🇪🇸',
  'FRANCIA': '🇫🇷',
  'GHANA': '🇬🇭',
  'HAITÍ': '🇭🇹',
  'INGLATERRA': '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  'IRAK': '🇮🇶',
  'IRÁN': '🇮🇷',
  'JAPÓN': '🇯🇵',
  'JORDANIA': '🇯🇴',
  'MARRUECOS': '🇲🇦',
  'MÉXICO': '🇲🇽',
  'N. ZELANDA': '🇳🇿',
  'NORUEGA': '🇳🇴',
  'PANAMÁ': '🇵🇦',
  'PARAGUAY': '🇵🇾',
  'PAÍSES BAJOS': '🇳🇱',
  'PORTUGAL': '🇵🇹',
  'RD CONGO': '🇨🇩',
  'SENEGAL': '🇸🇳',
  'SUDÁFRICA': '🇿🇦',
  'SUECIA': '🇸🇪',
  'SUIZA': '🇨🇭',
  'TURQUÍA': '🇹🇷',
  'TÚNEZ': '🇹🇳',
  'URUGUAY': '🇺🇾',
  'UZBEKISTÁN': '🇺🇿'
};

const state = {
  apiUrl: localStorage.getItem(LS_KEYS.apiUrl) || DEFAULT_API_URL,
  miniResults: loadMiniResults(),
  apiResults: {},
  apiFixtures: [],
  activeTab: 'ranking'
};
let apiRefreshInProgress = false;

function normalize(s) {
  return String(s || '')
    .trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'AND')
    .replace(/\s+/g, ' ');
}

function apiNameFor(team) {
  return DATA.teamAliases[team] || team;
}

function teamKey(team) {
  const key = normalize(apiNameFor(team));
  return key === 'USA' ? 'UNITED STATES' : key;
}

function keyForTeams(a, b) {
  return `${teamKey(a)}__${teamKey(b)}`;
}

const TOURNAMENT_TEAM_KEYS = new Set(DATA.matches.flatMap(match => [match.team1, match.team2]).map(teamKey));
const KNOCKOUT_SCORING = {
  DIECISEISAVOS: { label: 'Dieciseisavos', apiRound: 'Round of 32', previousRound: null, points: 3, expected: 32 },
  OCTAVOS: { label: 'Octavos', apiRound: 'Round of 16', previousRound: 'Round of 32', points: 5, expected: 16 },
  CUARTOS: { label: 'Cuartos', apiRound: 'Quarter-final', previousRound: 'Round of 16', points: 7, expected: 8 },
  SEMIS: { label: 'Semifinales', apiRound: 'Semi-final', previousRound: 'Quarter-final', points: 10, expected: 4 },
  FINAL: { label: 'Final', apiRound: 'Final', previousRound: 'Semi-final', points: 12, expected: 2 },
  '1º': { label: 'Campeón', apiRound: null, previousRound: 'Final', points: 15, expected: 1 }
};

function teamLabel(team) {
  return `${TEAM_FLAGS[team] || '🏳️'} ${team}`;
}

function parseScore(score) {
  const m = String(score || '').trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function signFromScore(score) {
  const s = Array.isArray(score) ? score : parseScore(score);
  if (!s) return '';
  if (s[0] > s[1]) return '1';
  if (s[0] < s[1]) return '2';
  return 'X';
}

const MINI_FIELD_TYPES = {
  Q1: 'player',
  Q2: 'team',
  Q3: 'team',
  Q4: 'team',
  Q5: 'number',
  Q6: 'team',
  Q7: 'team',
  Q8: 'number',
  Q9: 'player',
  Q10: 'player',
  Q11: 'player',
  Q12: 'number',
  Q13: 'number',
  Q14: 'player',
  Q15: 'player'
};

function loadMiniResults() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEYS.mini) || '{}');
  } catch {
    return {};
  }
}

function getResult(match) {
  const api = state.apiResults[match.id];
  if (api && Number.isFinite(api.home) && Number.isFinite(api.away)) return { ...api, source: 'api' };
  return null;
}

function scorePrediction(prediction, result) {
  if (!result) return { points: 0, exact: false, sign: false };
  const p = parseScore(prediction.score);
  if (!p) return { points: 0, exact: false, sign: false };
  const exact = p[0] === result.home && p[1] === result.away;
  const sign = signFromScore(p) === signFromScore([result.home, result.away]);
  return { points: exact ? DATA.meta.scoring.groupExact : (sign ? DATA.meta.scoring.groupSign : 0), exact, sign };
}

function isTournamentTeam(team) {
  return TOURNAMENT_TEAM_KEYS.has(teamKey(team));
}

function winnerFromApiMatch(match) {
  if (!match || !isTournamentTeam(match.team1) || !isTournamentTeam(match.team2)) return null;
  const score = match.score || {};
  const decidingScore = [score.p, score.et, score.ft]
    .find(value => Array.isArray(value) && value.length >= 2 && Number(value[0]) !== Number(value[1]));
  if (!decidingScore) return null;
  return Number(decidingScore[0]) > Number(decidingScore[1]) ? match.team1 : match.team2;
}

function getKnockoutReality() {
  const reality = {};

  for (const [stage, config] of Object.entries(KNOCKOUT_SCORING)) {
    const teams = new Set();

    if (config.apiRound) {
      state.apiFixtures
        .filter(match => match.round === config.apiRound)
        .flatMap(match => [match.team1, match.team2])
        .filter(isTournamentTeam)
        .forEach(team => teams.add(teamKey(team)));
    }

    if (config.previousRound) {
      state.apiFixtures
        .filter(match => match.round === config.previousRound)
        .map(winnerFromApiMatch)
        .filter(Boolean)
        .forEach(team => teams.add(teamKey(team)));
    }

    reality[stage] = {
      ...config,
      teams,
      resolved: teams.size,
      complete: teams.size >= config.expected
    };
  }

  return reality;
}

function calculatePlayerKnockout(playerId, reality = getKnockoutReality()) {
  const breakdown = {};
  let points = 0;

  for (const [stage, stageReality] of Object.entries(reality)) {
    const predictions = DATA.knockoutPredictions
      .filter(prediction => prediction.stage === stage)
      .map(prediction => prediction.predictions[playerId])
      .filter(Boolean);
    const hits = predictions.filter(team => stageReality.teams.has(teamKey(team))).length;
    const stagePoints = hits * stageReality.points;
    breakdown[stage] = { ...stageReality, hits, points: stagePoints };
    points += stagePoints;
  }

  return { points, breakdown };
}

function calculateRanking() {
  const knockoutReality = getKnockoutReality();
  return DATA.players.map(player => {
    const group = DATA.matches.reduce((acc, match) => {
      const result = getResult(match);
      const sc = scorePrediction(match.predictions[player.id], result);
      acc.points += sc.points;
      acc.exacts += sc.exact ? 1 : 0;
      acc.signs += (!sc.exact && sc.sign) ? 1 : 0;
      acc.played += result ? 1 : 0;
      return acc;
    }, { points: 0, exacts: 0, signs: 0, played: 0 });
    const knockout = calculatePlayerKnockout(player.id, knockoutReality);
    return {
      ...player,
      groupPoints: group.points,
      knockoutPoints: knockout.points,
      knockoutBreakdown: knockout.breakdown,
      total: group.points + knockout.points,
      exacts: group.exacts,
      signs: group.signs,
      played: group.played
    };
  }).sort((a,b) => b.total - a.total || b.exacts - a.exacts || b.signs - a.signs || a.name.localeCompare(b.name));
}

function normalizeTeam(value) {
  const aliases = {
    'ARABIA SAUDI': 'A SAUDI',
    'COSTA DE MARFIL': 'C MARFIL',
    'COREA DEL SUR': 'COREA',
    'ESTADOS UNIDOS': 'EEUU',
    'NUEVA ZELANDA': 'N ZELANDA',
    'QATAR': 'CATAR',
    'REPUBLICA CHECA': 'CHEQUIA',
    'R CHECA': 'CHEQUIA',
    'RCHECA': 'CHEQUIA',
    'RD DEL CONGO': 'RD CONGO',
    'REPUBLICA DEMOCRATICA DEL CONGO': 'RD CONGO',
    'CONGO': 'RD CONGO',
    'UZBEKISTAN': 'UZBEKISTAN'
  };
  const normalized = normalize(value).replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  return aliases[normalized] || normalized;
}

function scoreMiniAnswer(question, answer, result) {
  if (!result) return { points: 0, correct: false };
  const fieldType = MINI_FIELD_TYPES[question.id];
  const acceptedAnswers = result.split('|').map(value => value.trim()).filter(Boolean);
  let correct = false;

  if (fieldType === 'number') {
    const predicted = String(answer || '').trim();
    const actual = Number(result);
    const minimumMatch = predicted.match(/^\+\s*(\d+)$/);
    correct = Number.isFinite(actual) && (minimumMatch ? actual >= Number(minimumMatch[1]) : Number(predicted) === actual);
  } else if (fieldType === 'team') {
    correct = acceptedAnswers.map(normalizeTeam).includes(normalizeTeam(answer));
  } else {
    correct = acceptedAnswers.map(normalize).includes(normalize(answer));
  }

  return { points: correct ? question.points : 0, correct };
}

function getMiniResult(question) {
  return String(state.miniResults[question.id] || '').trim();
}

function calculateMiniRanking() {
  return DATA.players.map(player => {
    const score = DATA.miniQuestions.reduce((acc, question) => {
      const result = getMiniResult(question);
      const answerScore = scoreMiniAnswer(question, question.answers[player.id], result);
      acc.points += answerScore.points;
      acc.correct += answerScore.correct ? 1 : 0;
      acc.resolved += result ? 1 : 0;
      return acc;
    }, { points: 0, correct: 0, resolved: 0 });
    return { ...player, miniPoints: score.points, miniCorrect: score.correct, miniResolved: score.resolved };
  }).sort((a,b) => b.miniPoints - a.miniPoints || b.miniCorrect - a.miniCorrect || a.name.localeCompare(b.name));
}

function html(strings, ...values) {
  return strings.map((s, i) => s + (values[i] ?? '')).join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function applyAdminMode() {
  document.querySelectorAll('[data-admin-only]').forEach(element => {
    element.hidden = !IS_ADMIN;
  });
  document.body.classList.toggle('admin-mode', IS_ADMIN);
}

function renderSummary() {
  const played = DATA.matches.filter(getResult).length;
  const ranking = calculateRanking();
  document.getElementById('summaryCards').innerHTML = html`
    <article class="card"><b>${DATA.players.length}</b><span>participantes</span></article>
    <article class="card"><b>${played}/${DATA.matches.length}</b><span>partidos con resultado</span></article>
    <article class="card"><b>${ranking[0]?.name || '-'}</b><span>líder actual</span></article>
    <article class="card"><b>${ranking[0]?.total || 0}</b><span>puntos del líder</span></article>
  `;
  document.getElementById('lastUpdate').textContent = localStorage.getItem(LS_KEYS.lastUpdate) || 'sin actualizar';
}

function renderRanking() {
  const q = normalize(document.getElementById('rankingSearch').value);
  const rows = calculateRanking().filter(p => normalize(p.name).includes(q));
  document.getElementById('rankingTable').innerHTML = html`
    <thead><tr><th>#</th><th>Participante</th><th>Total</th><th>1ª fase</th><th>Exactos</th><th>Signos</th><th>Cruces</th></tr></thead>
    <tbody>${rows.map((p,i)=> html`<tr class="${i===0?'rank-1':i===1?'rank-2':''}"><td>${i+1}</td><td>${p.name}</td><td class="points">${p.total}</td><td>${p.groupPoints}</td><td>${p.exacts}</td><td>${p.signs}</td><td>${p.knockoutPoints}</td></tr>`).join('')}</tbody>
  `;
}

function renderFilters() {
  const groupSelect = document.getElementById('groupFilter');
  if (groupSelect.options.length === 1) {
    [...new Set(DATA.matches.map(m => m.group))].forEach(g => groupSelect.insertAdjacentHTML('beforeend', `<option value="${g}">Grupo ${g}</option>`));
  }
  const playerSelect = document.getElementById('playerSelect');
  if (!playerSelect.options.length) DATA.players.forEach(p => playerSelect.insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.name}</option>`));
  const knockoutPlayerSelect = document.getElementById('knockoutPlayerSelect');
  if (!knockoutPlayerSelect.options.length) DATA.players.forEach(p => knockoutPlayerSelect.insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.name}</option>`));
}

function getMatchday(match) {
  const matchNumber = Number(match.id.split('-').pop());
  return Math.ceil(matchNumber / 2);
}

function renderMatchCard(match) {
  const result = getResult(match);
  return html`<article class="match-card">
    <span class="pill">Grupo ${match.group} · ${match.id}</span>
    <h3 class="teams"><span>${teamLabel(match.team1)}</span><span class="versus">-</span><span>${teamLabel(match.team2)}</span></h3>
    <div class="match-score ${result ? '' : 'pending'}">${result ? `${result.home} - ${result.away}` : 'Pendiente'}</div>
    <div class="source">${result ? 'Resultado actualizado automáticamente' : 'Sin resultado disponible en la API'}</div>
  </article>`;
}

function renderMatches() {
  const group = document.getElementById('groupFilter').value;
  const status = document.getElementById('statusFilter').value;
  let matches = DATA.matches.filter(m => group === 'all' || m.group === group);
  matches = matches.filter(m => status === 'all' || (status === 'played' ? !!getResult(m) : !getResult(m)));

  const matchdays = [1, 2, 3]
    .map(number => {
      const matchdayMatches = matches.filter(match => getMatchday(match) === number);
      const groups = [...new Set(matchdayMatches.map(match => match.group))]
        .sort()
        .map(groupName => ({
          name: groupName,
          matches: matchdayMatches.filter(match => match.group === groupName)
        }));
      return { number, matches: matchdayMatches, groups };
    })
    .filter(matchday => matchday.matches.length);

  document.getElementById('matchesList').innerHTML = matchdays.length
    ? matchdays.map(matchday => html`
      <section class="matchday">
        <div class="matchday-head">
          <h3>Jornada ${matchday.number}</h3>
          <span>${matchday.matches.length} partidos</span>
        </div>
        <div class="matchday-groups">
          ${matchday.groups.map(groupBlock => html`
            <section class="match-group">
              <div class="match-group-head">
                <h4>Grupo ${groupBlock.name}</h4>
                <span>${groupBlock.matches.length} partidos</span>
              </div>
              <div class="match-grid">${groupBlock.matches.map(renderMatchCard).join('')}</div>
            </section>
          `).join('')}
        </div>
      </section>
    `).join('')
    : '<p class="empty-state">No hay partidos que coincidan con los filtros.</p>';
}

function renderPlayerDetail() {
  const playerId = document.getElementById('playerSelect').value || DATA.players[0].id;
  const groups = [...new Set(DATA.matches.map(match => match.group))].sort();

  document.getElementById('playerGroups').innerHTML = groups.map(group => {
    const matches = DATA.matches.filter(match => match.group === group);
    const groupPoints = matches.reduce((total, match) => {
      return total + scorePrediction(match.predictions[playerId], getResult(match)).points;
    }, 0);

    return html`
      <section class="player-group">
        <div class="player-group-head">
          <h3>Grupo ${group}</h3>
          <span>${groupPoints} puntos</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Partido</th><th>Resultado</th><th>Predicción</th><th>Signo</th><th>Puntos</th></tr></thead>
            <tbody>${matches.map(match => {
              const result = getResult(match);
              const prediction = match.predictions[playerId];
              const score = scorePrediction(prediction, result);
              return html`
                <tr>
                  <td>${teamLabel(match.team1)} - ${teamLabel(match.team2)}</td>
                  <td>${result ? `${result.home}-${result.away}` : '<span class="muted">pendiente</span>'}</td>
                  <td>${prediction.score}</td>
                  <td>${prediction.sign}</td>
                  <td class="${score.points ? 'ok' : 'muted'}">${score.points}</td>
                </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </section>`;
  }).join('');
}

function knockoutPredictionStatus(team, stageReality) {
  if (!team || !stageReality.resolved) return 'pending';
  if (stageReality.teams.has(teamKey(team))) return 'correct';
  return stageReality.complete ? 'wrong' : 'pending';
}

function renderBracketTeam(team, status = 'pending') {
  const statusMark = status === 'correct' ? '✓' : (status === 'wrong' ? '×' : '');
  return `<div class="bracket-team ${status}"><span class="bracket-flag">${TEAM_FLAGS[team] || '🏳️'}</span><span>${escapeHtml(team || 'Por definir')}</span><span class="bracket-status">${statusMark}</span></div>`;
}

function renderBracketRound(stage, playerId, stageScore) {
  const teams = DATA.knockoutPredictions
    .filter(prediction => prediction.stage === stage)
    .sort((a, b) => a.slot - b.slot)
    .map(prediction => prediction.predictions[playerId] || '');

  const matches = [];
  for (let index = 0; index < teams.length; index += 2) {
    matches.push(html`
      <article class="bracket-match">
        <span class="bracket-match-number">Cruce ${index / 2 + 1}</span>
        ${renderBracketTeam(teams[index], knockoutPredictionStatus(teams[index], stageScore))}
        ${renderBracketTeam(teams[index + 1], knockoutPredictionStatus(teams[index + 1], stageScore))}
      </article>
    `);
  }

  return html`
    <section class="bracket-round" style="--matches:${matches.length}">
      <div class="bracket-round-head">
        <h3>${stageScore.label}</h3>
        <span>${stageScore.hits} aciertos · +${stageScore.points} pts</span>
        <small>${stageScore.resolved}/${stageScore.expected} selecciones confirmadas</small>
      </div>
      <div class="bracket-matches">${matches.join('')}</div>
    </section>
  `;
}

function renderKnockout() {
  const playerId = document.getElementById('knockoutPlayerSelect').value || DATA.players[0].id;
  const player = DATA.players.find(item => item.id === playerId) || DATA.players[0];
  const champion = DATA.knockoutPredictions.find(prediction => prediction.stage === '1º')?.predictions[playerId] || '';
  const knockout = calculatePlayerKnockout(playerId);
  const rounds = ['DIECISEISAVOS', 'OCTAVOS', 'CUARTOS', 'SEMIS', 'FINAL'];
  const championScore = knockout.breakdown['1º'];

  document.getElementById('knockoutScoreSummary').innerHTML = html`
    <article class="knockout-total">
      <b>${knockout.points}</b>
      <span>puntos en cruces</span>
    </article>
    ${Object.entries(knockout.breakdown).map(([, score]) => html`
      <article>
        <strong>${score.label}</strong>
        <span>${score.hits} aciertos · +${score.points} pts</span>
      </article>
    `).join('')}
  `;

  document.getElementById('knockoutBracket').innerHTML = html`
    <div class="bracket-title">
      <span>Pronóstico de</span>
      <strong>${escapeHtml(player.name)}</strong>
    </div>
    <div class="bracket">
      ${rounds.map(stage => renderBracketRound(stage, playerId, knockout.breakdown[stage])).join('')}
      <section class="bracket-round champion-round">
        <div class="bracket-round-head">
          <h3>Campeón</h3>
          <span>${championScore.hits} aciertos · +${championScore.points} pts</span>
          <small>${championScore.resolved}/${championScore.expected} confirmado</small>
        </div>
        <div class="bracket-matches">
          <article class="bracket-match champion-card">
            <span class="trophy" aria-hidden="true">★</span>
            ${renderBracketTeam(champion, knockoutPredictionStatus(champion, championScore))}
          </article>
        </div>
      </section>
    </div>
  `;
}

function renderQuestionInput(question, result, dataAttribute) {
  const escapedResult = escapeHtml(result);
  const fieldType = MINI_FIELD_TYPES[question.id];
  const readOnly = IS_ADMIN ? '' : ' readonly aria-readonly="true"';
  if (fieldType === 'number') {
    return `<input type="number" min="0" step="1" inputmode="numeric" ${dataAttribute}="${question.id}" value="${escapedResult}" placeholder="Cantidad"${readOnly} />`;
  }
  if (fieldType === 'team') {
    return `<input type="text" list="teamOptions" ${dataAttribute}="${question.id}" value="${escapedResult}" placeholder="Selección"${readOnly} />`;
  }
  return `<input type="text" ${dataAttribute}="${question.id}" value="${escapedResult}" placeholder="Jugador o variantes"${readOnly} />`;
}

function questionFieldLabel(question) {
  const labels = { number: 'Cantidad', team: 'Selección', player: 'Jugador' };
  return labels[MINI_FIELD_TYPES[question.id]];
}

function renderMini() {
  const q = normalize(document.getElementById('miniRankingSearch').value);
  const ranking = calculateMiniRanking();
  const rows = ranking.filter(player => normalize(player.name).includes(q));
  const resolved = DATA.miniQuestions.filter(getMiniResult).length;
  const maxPoints = DATA.miniQuestions.reduce((total, question) => total + question.points, 0);

  document.getElementById('miniResultsHint').innerHTML = IS_ADMIN
    ? 'Puedes indicar variantes o empates con <strong>|</strong>.'
    : 'Resultados visibles en modo consulta. Solo el administrador puede modificarlos.';

  document.getElementById('teamOptions').innerHTML = [...new Set(DATA.matches.flatMap(match => [match.team1, match.team2]))]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map(team => `<option value="${escapeHtml(team)}"></option>`)
    .join('');

  document.getElementById('miniSummaryCards').innerHTML = html`
    <article class="card"><b>${resolved}/${DATA.miniQuestions.length}</b><span>preguntas resueltas</span></article>
    <article class="card"><b>${ranking[0]?.name || '-'}</b><span>líder mini-porra</span></article>
    <article class="card"><b>${ranking[0]?.miniPoints || 0}</b><span>puntos del líder</span></article>
    <article class="card"><b>${maxPoints}</b><span>puntos máximos</span></article>
  `;

  document.getElementById('miniRankingTable').innerHTML = html`
    <thead><tr><th>#</th><th>Participante</th><th>Puntos</th><th>Aciertos</th><th>Corregidas</th></tr></thead>
    <tbody>${rows.map((player, index) => html`
      <tr class="${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : ''}">
        <td>${index + 1}</td>
        <td>${player.name}</td>
        <td class="points">${player.miniPoints}</td>
        <td>${player.miniCorrect}</td>
        <td>${player.miniResolved}/${DATA.miniQuestions.length}</td>
      </tr>`).join('')}
    </tbody>
  `;

  document.getElementById('miniResultsList').innerHTML = DATA.miniQuestions.map(question => html`
    <article class="mini-result-card">
      <div>
        <span class="pill">${question.id} · ${question.points} puntos</span>
        <h4>${question.question}</h4>
        <span class="field-type">${questionFieldLabel(question)}</span>
      </div>
      <div class="mini-result-actions">
        ${renderQuestionInput(question, getMiniResult(question), 'data-mini-result')}
        ${IS_ADMIN ? html`
          <button data-save-mini="${question.id}">Guardar</button>
          <button data-clear-mini="${question.id}">Limpiar</button>
        ` : ''}
      </div>
    </article>
  `).join('');

  document.getElementById('miniTable').innerHTML = html`
    <thead><tr><th>Pregunta</th><th>Resultado</th><th>Puntos</th>${DATA.players.map(p=>`<th>${p.name}</th>`).join('')}</tr></thead>
    <tbody>${DATA.miniQuestions.map(question => {
      const result = getMiniResult(question);
      return html`<tr>
        <td>${question.question}</td>
        <td>${result ? escapeHtml(result) : '<span class="muted">pendiente</span>'}</td>
        <td>${question.points}</td>
        ${DATA.players.map(player => {
          const answer = question.answers[player.id] || '';
          const score = scoreMiniAnswer(question, answer, result);
          return `<td class="${result ? (score.correct ? 'ok' : 'muted') : ''}">${escapeHtml(answer)}${score.correct ? ` (+${score.points})` : ''}</td>`;
        }).join('')}
      </tr>`;
    }).join('')}</tbody>`;
}

function renderSettings() {
  document.getElementById('apiUrlInput').value = state.apiUrl;
}

function renderAll() { renderSummary(); renderFilters(); renderRanking(); renderMatches(); renderPlayerDetail(); renderKnockout(); renderMini(); renderSettings(); }

async function refreshFromApi(options = {}) {
  const silent = options?.silent === true;
  if (apiRefreshInProgress) return;
  apiRefreshInProgress = true;
  const btn = document.getElementById('refreshApiBtn');
  btn.disabled = true; btn.textContent = 'Actualizando...';
  try {
    const res = await fetch(state.apiUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    state.apiFixtures = json.matches || [];
    const resultByKey = {};
    for (const apiMatch of state.apiFixtures) {
      if (!apiMatch.score?.ft) continue;
      resultByKey[keyForTeams(apiMatch.team1, apiMatch.team2)] = { home: Number(apiMatch.score.ft[0]), away: Number(apiMatch.score.ft[1]), date: apiMatch.date };
    }
    state.apiResults = {};
    for (const m of DATA.matches) {
      const found = resultByKey[keyForTeams(m.team1, m.team2)];
      if (found) state.apiResults[m.id] = found;
    }
    localStorage.setItem(LS_KEYS.lastUpdate, new Date().toLocaleString('es-ES'));
    renderAll();
  } catch (err) {
    if (!silent) alert('No se pudieron actualizar los resultados automáticos. Error: ' + err.message);
    console.error('Error al actualizar los resultados automáticos:', err);
  } finally {
    apiRefreshInProgress = false;
    btn.disabled = false;
    btn.textContent = 'Actualizar desde API';
  }
}

function saveMiniResult(id) {
  if (!IS_ADMIN) return;
  const result = document.querySelector(`[data-mini-result="${id}"]`).value.trim();
  if (!result) return alert('Introduce la respuesta correcta.');
  state.miniResults[id] = result;
  localStorage.setItem(LS_KEYS.mini, JSON.stringify(state.miniResults));
  renderAll();
}

function clearMiniResult(id) {
  if (!IS_ADMIN) return;
  delete state.miniResults[id];
  localStorage.setItem(LS_KEYS.mini, JSON.stringify(state.miniResults));
  renderAll();
}

document.addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (tab) {
    document.querySelectorAll('.tab,.panel').forEach(el => el.classList.remove('active'));
    tab.classList.add('active'); document.getElementById(tab.dataset.tab).classList.add('active');
  }
  const saveMini = e.target.dataset.saveMini; if (saveMini) saveMiniResult(saveMini);
  const clearMini = e.target.dataset.clearMini; if (clearMini) clearMiniResult(clearMini);
});

document.getElementById('refreshApiBtn').addEventListener('click', refreshFromApi);
document.getElementById('rankingSearch').addEventListener('input', renderRanking);
document.getElementById('miniRankingSearch').addEventListener('input', renderMini);
document.getElementById('groupFilter').addEventListener('change', renderMatches);
document.getElementById('statusFilter').addEventListener('change', renderMatches);
document.getElementById('playerSelect').addEventListener('change', renderPlayerDetail);
document.getElementById('knockoutPlayerSelect').addEventListener('change', renderKnockout);
document.getElementById('saveApiUrlBtn').addEventListener('click', () => {
  if (!IS_ADMIN) return;
  state.apiUrl = document.getElementById('apiUrlInput').value.trim() || DEFAULT_API_URL;
  localStorage.setItem(LS_KEYS.apiUrl, state.apiUrl);
  alert('URL guardada');
});
document.getElementById('exportBtn').addEventListener('click', () => {
  if (!IS_ADMIN) return;
  const blob = new Blob([JSON.stringify({ miniResults: state.miniResults, apiUrl: state.apiUrl }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'porra-estado.json'; a.click(); URL.revokeObjectURL(a.href);
});
document.getElementById('importInput').addEventListener('change', async e => {
  if (!IS_ADMIN) return;
  const file = e.target.files[0]; if (!file) return;
  const json = JSON.parse(await file.text());
  state.miniResults = json.miniResults || state.miniResults;
  state.apiUrl = json.apiUrl || state.apiUrl;
  localStorage.setItem(LS_KEYS.mini, JSON.stringify(state.miniResults));
  localStorage.setItem(LS_KEYS.apiUrl, state.apiUrl);
  renderAll();
});

applyAdminMode();
renderAll();
refreshFromApi();
setInterval(() => refreshFromApi({ silent: true }), API_REFRESH_INTERVAL_MS);
