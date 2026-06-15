const DATA = window.PORRA_DATA;
const DEFAULT_API_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const LS_KEYS = {
  pluses: 'porra.plusResults.v1',
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
  plusResults: loadPlusResults(),
  miniResults: loadMiniResults(),
  apiResults: {},
  apiFixtures: [],
  activeTab: 'ranking'
};

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

function keyForTeams(a, b) {
  return `${normalize(apiNameFor(a))}__${normalize(apiNameFor(b))}`;
}

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

const PLUS_FIELD_TYPES = {
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

const KNOCKOUT_STAGES = new Set(['DIECISEISAVOS', 'OCTAVOS', 'CUARTOS', 'SEMIS', 'FINAL', '1º']);

function loadPlusResults() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEYS.pluses) || '{}');
  } catch {
    return {};
  }
}

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

function calculateRanking() {
  const plusPointsByPlayer = new Map(calculatePlusRanking().map(player => [player.id, player.plusPoints]));
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
    const plusPoints = plusPointsByPlayer.get(player.id) || 0;
    const knockoutPoints = 0;
    return {
      ...player,
      groupPoints: group.points,
      knockoutPoints,
      plusPoints,
      total: group.points + knockoutPoints + plusPoints,
      exacts: group.exacts,
      signs: group.signs,
      played: group.played
    };
  }).sort((a,b) => b.total - a.total || b.exacts - a.exacts || b.signs - a.signs || a.name.localeCompare(b.name));
}

function getPlusResult(question) {
  return String(state.plusResults[question.id] || '').trim();
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

function scorePlusAnswer(question, answer, result) {
  if (!result) return { points: 0, correct: false };
  const fieldType = PLUS_FIELD_TYPES[question.id];
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

function calculatePlusRanking() {
  return DATA.players.map(player => {
    const score = DATA.plusQuestions.reduce((acc, question) => {
      const result = getPlusResult(question);
      const answerScore = scorePlusAnswer(question, question.answers[player.id], result);
      acc.points += answerScore.points;
      acc.correct += answerScore.correct ? 1 : 0;
      acc.resolved += result ? 1 : 0;
      return acc;
    }, { points: 0, correct: 0, resolved: 0 });
    return { ...player, plusPoints: score.points, plusCorrect: score.correct, plusResolved: score.resolved };
  }).sort((a,b) => b.plusPoints - a.plusPoints || b.plusCorrect - a.plusCorrect || a.name.localeCompare(b.name));
}

function getMiniResult(question) {
  return String(state.miniResults[question.id] || '').trim();
}

function calculateMiniRanking() {
  return DATA.players.map(player => {
    const score = DATA.miniQuestions.reduce((acc, question) => {
      const result = getMiniResult(question);
      const answerScore = scorePlusAnswer(question, question.answers[player.id], result);
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
    <thead><tr><th>#</th><th>Participante</th><th>Total</th><th>1ª fase</th><th>Exactos</th><th>Signos</th><th>Cruces</th><th>Pluses</th></tr></thead>
    <tbody>${rows.map((p,i)=> html`<tr class="${i===0?'rank-1':i===1?'rank-2':''}"><td>${i+1}</td><td>${p.name}</td><td class="points">${p.total}</td><td>${p.groupPoints}</td><td>${p.exacts}</td><td>${p.signs}</td><td>${p.knockoutPoints}</td><td>${p.plusPoints}</td></tr>`).join('')}</tbody>
  `;
}

function renderFilters() {
  const groupSelect = document.getElementById('groupFilter');
  if (groupSelect.options.length === 1) {
    [...new Set(DATA.matches.map(m => m.group))].forEach(g => groupSelect.insertAdjacentHTML('beforeend', `<option value="${g}">Grupo ${g}</option>`));
  }
  const playerSelect = document.getElementById('playerSelect');
  if (!playerSelect.options.length) DATA.players.forEach(p => playerSelect.insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.name}</option>`));
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
  document.getElementById('playerTable').innerHTML = html`
    <thead><tr><th>Grupo</th><th>Partido</th><th>Resultado</th><th>Predicción</th><th>Signo</th><th>Puntos</th></tr></thead>
    <tbody>${DATA.matches.map(m => {
      const r = getResult(m); const pred = m.predictions[playerId]; const sc = scorePrediction(pred, r);
      return html`<tr><td>${m.group}</td><td>${teamLabel(m.team1)} - ${teamLabel(m.team2)}</td><td>${r ? `${r.home}-${r.away}` : '<span class="muted">pendiente</span>'}</td><td>${pred.score}</td><td>${pred.sign}</td><td class="${sc.points?'ok':'muted'}">${sc.points}</td></tr>`;
    }).join('')}</tbody>`;
}

function renderKnockout() {
  const samplePlayers = DATA.players.slice(0, 8);
  const knockoutPredictions = DATA.knockoutPredictions.filter(prediction => KNOCKOUT_STAGES.has(prediction.stage));
  document.getElementById('knockoutTable').innerHTML = html`
    <thead><tr><th>Ronda</th><th>Slot</th>${samplePlayers.map(p=>`<th>${p.name}</th>`).join('')}</tr></thead>
    <tbody>${knockoutPredictions.map(k => html`<tr><td>${k.stage}</td><td>${k.slot}</td>${samplePlayers.map(p=>`<td>${k.predictions[p.id] || ''}</td>`).join('')}</tr>`).join('')}</tbody>`;
}

function renderQuestionInput(question, result, dataAttribute) {
  const escapedResult = escapeHtml(result);
  const fieldType = PLUS_FIELD_TYPES[question.id];
  if (fieldType === 'number') {
    return `<input type="number" min="0" step="1" inputmode="numeric" ${dataAttribute}="${question.id}" value="${escapedResult}" placeholder="Cantidad" />`;
  }
  if (fieldType === 'team') {
    return `<input type="text" list="teamOptions" ${dataAttribute}="${question.id}" value="${escapedResult}" placeholder="Selección" />`;
  }
  return `<input type="text" ${dataAttribute}="${question.id}" value="${escapedResult}" placeholder="Jugador o variantes" />`;
}

function plusFieldLabel(question) {
  const labels = { number: 'Cantidad', team: 'Selección', player: 'Jugador' };
  return labels[PLUS_FIELD_TYPES[question.id]];
}

function renderPluses() {
  const q = normalize(document.getElementById('plusRankingSearch').value);
  const ranking = calculatePlusRanking();
  const rows = ranking.filter(player => normalize(player.name).includes(q));
  const resolved = DATA.plusQuestions.filter(getPlusResult).length;
  const maxPoints = DATA.plusQuestions.reduce((total, question) => total + question.points, 0);

  document.getElementById('teamOptions').innerHTML = [...new Set(DATA.matches.flatMap(match => [match.team1, match.team2]))]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map(team => `<option value="${escapeHtml(team)}"></option>`)
    .join('');

  document.getElementById('plusSummaryCards').innerHTML = html`
    <article class="card"><b>${resolved}/${DATA.plusQuestions.length}</b><span>pluses resueltos</span></article>
    <article class="card"><b>${ranking[0]?.name || '-'}</b><span>más puntos extra</span></article>
    <article class="card"><b>${ranking[0]?.plusPoints || 0}</b><span>puntos extra del líder</span></article>
    <article class="card"><b>${maxPoints}</b><span>puntos máximos</span></article>
  `;

  document.getElementById('plusRankingTable').innerHTML = html`
    <thead><tr><th>#</th><th>Participante</th><th>Puntos</th><th>Aciertos</th><th>Corregidas</th></tr></thead>
    <tbody>${rows.map((player, index) => html`
      <tr class="${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : ''}">
        <td>${index + 1}</td>
        <td>${player.name}</td>
        <td class="points">${player.plusPoints}</td>
        <td>${player.plusCorrect}</td>
        <td>${player.plusResolved}/${DATA.plusQuestions.length}</td>
      </tr>`).join('')}
    </tbody>
  `;

  document.getElementById('plusResultsList').innerHTML = DATA.plusQuestions.map(question => html`
    <article class="plus-result-card">
      <div>
        <span class="pill">${question.id} · ${question.points} puntos</span>
        <h4>${question.question}</h4>
        <span class="field-type">${plusFieldLabel(question)}</span>
      </div>
      <div class="plus-result-actions">
        ${renderQuestionInput(question, getPlusResult(question), 'data-plus-result')}
        <button data-save-plus="${question.id}">Guardar</button>
        <button data-clear-plus="${question.id}">Limpiar</button>
      </div>
    </article>
  `).join('');

  document.getElementById('plusTable').innerHTML = html`
    <thead><tr><th>Pregunta</th><th>Resultado</th><th>Puntos</th>${DATA.players.map(p=>`<th>${p.name}</th>`).join('')}</tr></thead>
    <tbody>${DATA.plusQuestions.map(question => {
      const result = getPlusResult(question);
      return html`<tr>
        <td>${question.question}</td>
        <td>${result ? escapeHtml(result) : '<span class="muted">pendiente</span>'}</td>
        <td>${question.points}</td>
        ${DATA.players.map(player => {
          const answer = question.answers[player.id] || '';
          const score = scorePlusAnswer(question, answer, result);
          return `<td class="${result ? (score.correct ? 'ok' : 'muted') : ''}">${escapeHtml(answer)}${score.correct ? ` (+${score.points})` : ''}</td>`;
        }).join('')}
      </tr>`;
    }).join('')}</tbody>`;
}

function renderMini() {
  const q = normalize(document.getElementById('miniRankingSearch').value);
  const ranking = calculateMiniRanking();
  const rows = ranking.filter(player => normalize(player.name).includes(q));
  const resolved = DATA.miniQuestions.filter(getMiniResult).length;
  const maxPoints = DATA.miniQuestions.reduce((total, question) => total + question.points, 0);

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
        <span class="field-type">${plusFieldLabel(question)}</span>
      </div>
      <div class="mini-result-actions">
        ${renderQuestionInput(question, getMiniResult(question), 'data-mini-result')}
        <button data-save-mini="${question.id}">Guardar</button>
        <button data-clear-mini="${question.id}">Limpiar</button>
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
          const score = scorePlusAnswer(question, answer, result);
          return `<td class="${result ? (score.correct ? 'ok' : 'muted') : ''}">${escapeHtml(answer)}${score.correct ? ` (+${score.points})` : ''}</td>`;
        }).join('')}
      </tr>`;
    }).join('')}</tbody>`;
}

function renderSettings() {
  document.getElementById('apiUrlInput').value = state.apiUrl;
}

function renderAll() { renderSummary(); renderFilters(); renderRanking(); renderMatches(); renderPlayerDetail(); renderKnockout(); renderPluses(); renderMini(); renderSettings(); }

async function refreshFromApi() {
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
    alert('No se pudieron actualizar los resultados automáticos. Error: ' + err.message);
  } finally { btn.disabled = false; btn.textContent = 'Actualizar desde API'; }
}

function savePlusResult(id) {
  const result = document.querySelector(`[data-plus-result="${id}"]`).value.trim();
  if (!result) return alert('Introduce la respuesta correcta.');
  state.plusResults[id] = result;
  localStorage.setItem(LS_KEYS.pluses, JSON.stringify(state.plusResults));
  renderAll();
}

function clearPlusResult(id) {
  delete state.plusResults[id];
  localStorage.setItem(LS_KEYS.pluses, JSON.stringify(state.plusResults));
  renderAll();
}

function saveMiniResult(id) {
  const result = document.querySelector(`[data-mini-result="${id}"]`).value.trim();
  if (!result) return alert('Introduce la respuesta correcta.');
  state.miniResults[id] = result;
  localStorage.setItem(LS_KEYS.mini, JSON.stringify(state.miniResults));
  renderAll();
}

function clearMiniResult(id) {
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
  const savePlus = e.target.dataset.savePlus; if (savePlus) savePlusResult(savePlus);
  const clearPlus = e.target.dataset.clearPlus; if (clearPlus) clearPlusResult(clearPlus);
  const saveMini = e.target.dataset.saveMini; if (saveMini) saveMiniResult(saveMini);
  const clearMini = e.target.dataset.clearMini; if (clearMini) clearMiniResult(clearMini);
});

document.getElementById('refreshApiBtn').addEventListener('click', refreshFromApi);
document.getElementById('rankingSearch').addEventListener('input', renderRanking);
document.getElementById('plusRankingSearch').addEventListener('input', renderPluses);
document.getElementById('miniRankingSearch').addEventListener('input', renderMini);
document.getElementById('groupFilter').addEventListener('change', renderMatches);
document.getElementById('statusFilter').addEventListener('change', renderMatches);
document.getElementById('playerSelect').addEventListener('change', renderPlayerDetail);
document.getElementById('saveApiUrlBtn').addEventListener('click', () => { state.apiUrl = document.getElementById('apiUrlInput').value.trim() || DEFAULT_API_URL; localStorage.setItem(LS_KEYS.apiUrl, state.apiUrl); alert('URL guardada'); });
document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ plusResults: state.plusResults, miniResults: state.miniResults, apiUrl: state.apiUrl }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'porra-estado.json'; a.click(); URL.revokeObjectURL(a.href);
});
document.getElementById('importInput').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  const json = JSON.parse(await file.text());
  state.plusResults = json.plusResults || state.plusResults;
  state.miniResults = json.miniResults || state.miniResults;
  state.apiUrl = json.apiUrl || state.apiUrl;
  localStorage.setItem(LS_KEYS.pluses, JSON.stringify(state.plusResults));
  localStorage.setItem(LS_KEYS.mini, JSON.stringify(state.miniResults));
  localStorage.setItem(LS_KEYS.apiUrl, state.apiUrl);
  renderAll();
});

renderAll();
refreshFromApi();
