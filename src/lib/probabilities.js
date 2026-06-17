import { normalize, parseScore, signFromScore } from './statistics-utils.js';

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

const GROUP_STAGE_CONFIG = {
  groupExact: 3,
  groupSign: 2
};

const KNOCKOUT_SCORING = {
  DIECISEISAVOS: { label: 'Dieciseisavos', points: 3 },
  OCTAVOS: { label: 'Octavos', points: 5 },
  CUARTOS: { label: 'Cuartos', points: 7 },
  SEMIS: { label: 'Semifinales', points: 10 },
  FINAL: { label: 'Final', points: 12 },
  '1º': { label: 'Campeón', points: 15 }
};

const KNOCKOUT_FIXTURES = {
  round32: [
    { num: 73, team1: '2A', team2: '2B' },
    { num: 74, team1: '1E', team2: '3A/B/C/D/F' },
    { num: 75, team1: '1F', team2: '2C' },
    { num: 76, team1: '1C', team2: '2F' },
    { num: 77, team1: '1I', team2: '3C/D/F/G/H' },
    { num: 78, team1: '2E', team2: '2I' },
    { num: 79, team1: '1A', team2: '3C/E/F/H/I' },
    { num: 80, team1: '1L', team2: '3E/H/I/J/K' },
    { num: 81, team1: '1D', team2: '3B/E/F/I/J' },
    { num: 82, team1: '1G', team2: '3A/E/H/I/J' },
    { num: 83, team1: '2K', team2: '2L' },
    { num: 84, team1: '1H', team2: '2J' },
    { num: 85, team1: '1B', team2: '3E/F/G/I/J' },
    { num: 86, team1: '1J', team2: '2H' },
    { num: 87, team1: '1K', team2: '3D/E/I/J/L' },
    { num: 88, team1: '2D', team2: '2G' }
  ],
  round16: [
    { num: 89, team1: 'W74', team2: 'W77' },
    { num: 90, team1: 'W73', team2: 'W75' },
    { num: 91, team1: 'W76', team2: 'W78' },
    { num: 92, team1: 'W79', team2: 'W80' },
    { num: 93, team1: 'W81', team2: 'W85' },
    { num: 94, team1: 'W82', team2: 'W83' },
    { num: 95, team1: 'W84', team2: 'W86' },
    { num: 96, team1: 'W87', team2: 'W88' }
  ],
  quarterFinals: [
    { num: 97, team1: 'W89', team2: 'W90' },
    { num: 98, team1: 'W93', team2: 'W94' },
    { num: 99, team1: 'W91', team2: 'W92' },
    { num: 100, team1: 'W95', team2: 'W96' }
  ],
  semiFinals: [
    { num: 101, team1: 'W97', team2: 'W98' },
    { num: 102, team1: 'W99', team2: 'W100' }
  ],
  final: [
    { num: 104, team1: 'W101', team2: 'W102' }
  ]
};

const TEAM_ALIASES = {
  'ARABIA SAUDI': 'A SAUDI',
  'A SAUDI': 'A SAUDI',
  'A SAUDI ': 'A SAUDI',
  'COSTA DE MARFIL': 'C MARFIL',
  'C MARFIL': 'C MARFIL',
  'COREA DEL SUR': 'COREA',
  'COREA': 'COREA',
  'ESTADOS UNIDOS': 'EEUU',
  'USA': 'EEUU',
  'EE UU': 'EEUU',
  'EEUU': 'EEUU',
  'NUEVA ZELANDA': 'N ZELANDA',
  'N ZELANDA': 'N ZELANDA',
  'QATAR': 'CATAR',
  'CATAR': 'CATAR',
  'REPUBLICA CHECA': 'CHEQUIA',
  'R CHECA': 'CHEQUIA',
  'RCHECA': 'CHEQUIA',
  'REPUBLICA DEMOCRATICA DEL CONGO': 'RD CONGO',
  'RD DEL CONGO': 'RD CONGO',
  'CONGO': 'RD CONGO',
  'PAISES BAJOS': 'PAISES BAJOS',
  'UZBEKISTAN': 'UZBEKISTAN'
};

const TEAM_QUESTION_RANKINGS = {
  Q3: 'tarjetas-rojas',
  Q4: 'tarjetas-amarillas'
};

const PLAYER_QUESTION_RANKINGS = {
  Q9: 'tarjetas-amarillas',
  Q11: 'goles',
  Q14: 'goles'
};

export function simulateProbabilities({
  data,
  apiResults = {},
  apiFixtures = [],
  miniResults = {},
  playerRankings = null,
  teamRankings = null,
  iterations = 4000,
  seed = 20260617
}) {
  const context = buildContext({
    data,
    apiResults,
    apiFixtures,
    miniResults,
    playerRankings,
    teamRankings
  });
  const rng = createRng(seed);
  const playerStats = new Map(context.players.map(player => [player.id, { winShares: 0, totalPoints: 0 }]));
  const miniStats = new Map(context.players.map(player => [player.id, { winShares: 0, totalPoints: 0 }]));
  const teamStats = new Map(context.teams.map(team => [team, {
    dieciseisavos: 0,
    octavos: 0,
    cuartos: 0,
    semis: 0,
    final: 0,
    champion: 0
  }]));

  for (let index = 0; index < iterations; index += 1) {
    const simulation = simulateTournament(context, rng);
    const playerTotals = calculatePlayerTotals(context, simulation);
    const miniTotals = calculateMiniTotals(context, simulation, rng);

    for (const row of playerTotals) {
      const stats = playerStats.get(row.id);
      stats.totalPoints += row.total;
    }

    for (const row of miniTotals) {
      const stats = miniStats.get(row.id);
      stats.totalPoints += row.total;
    }

    const playerWinners = determineJointWinners(playerTotals, ['total', 'exacts', 'signs']);
    const miniWinners = determineJointWinners(miniTotals, ['total', 'correct']);

    const playerShare = playerWinners.length ? 1 / playerWinners.length : 0;
    for (const winner of playerWinners) {
      playerStats.get(winner.id).winShares += playerShare;
    }

    const miniShare = miniWinners.length ? 1 / miniWinners.length : 0;
    for (const winner of miniWinners) {
      miniStats.get(winner.id).winShares += miniShare;
    }

    for (const team of simulation.stageTeams.dieciseisavos) teamStats.get(team).dieciseisavos += 1;
    for (const team of simulation.stageTeams.octavos) teamStats.get(team).octavos += 1;
    for (const team of simulation.stageTeams.cuartos) teamStats.get(team).cuartos += 1;
    for (const team of simulation.stageTeams.semis) teamStats.get(team).semis += 1;
    for (const team of simulation.stageTeams.final) teamStats.get(team).final += 1;
    teamStats.get(simulation.champion).champion += 1;
  }

  return {
    players: context.players
      .map(player => {
        const stats = playerStats.get(player.id);
        return {
          ...player,
          currentPoints: context.currentPlayerStanding.get(player.id).total,
          winProbability: stats.winShares / iterations,
          averagePoints: stats.totalPoints / iterations
        };
      })
      .sort((a, b) => b.winProbability - a.winProbability || b.averagePoints - a.averagePoints || a.name.localeCompare(b.name, 'es')),
    teams: context.teams
      .map(team => {
        const stats = teamStats.get(team);
        return {
          team,
          dieciseisavos: stats.dieciseisavos / iterations,
          octavos: stats.octavos / iterations,
          cuartos: stats.cuartos / iterations,
          semis: stats.semis / iterations,
          final: stats.final / iterations,
          champion: stats.champion / iterations
        };
      })
      .sort((a, b) =>
        b.champion - a.champion
        || b.final - a.final
        || b.semis - a.semis
        || b.cuartos - a.cuartos
        || a.team.localeCompare(b.team, 'es')
      ),
    miniPlayers: context.players
      .map(player => {
        const stats = miniStats.get(player.id);
        return {
          ...player,
          currentPoints: context.currentMiniStanding.get(player.id).points,
          winProbability: stats.winShares / iterations,
          averagePoints: stats.totalPoints / iterations
        };
      })
      .sort((a, b) => b.winProbability - a.winProbability || b.averagePoints - a.averagePoints || a.name.localeCompare(b.name, 'es')),
    meta: {
      iterations,
      pendingMatches: context.pendingMatches.length,
      resolvedMiniQuestions: context.resolvedMiniQuestions
    }
  };
}

export function assignThirdPlaceTeams(fixtures, bestThirdGroups, thirdPlaceByGroup) {
  const placeholders = [];
  const qualifiedGroups = [...bestThirdGroups].sort();

  for (const fixture of fixtures) {
    for (const side of ['team1', 'team2']) {
      const groups = parseThirdPlaceGroups(fixture[side]);
      if (!groups.length) continue;
      placeholders.push({
        key: `${fixture.num}:${side}`,
        groups
      });
    }
  }

  const ordered = [...placeholders].sort((a, b) => {
    const candidatesA = a.groups.filter(group => qualifiedGroups.includes(group)).length;
    const candidatesB = b.groups.filter(group => qualifiedGroups.includes(group)).length;
    return candidatesA - candidatesB || a.key.localeCompare(b.key, 'es');
  });

  const used = new Set();
  const assignments = new Map();

  const solved = backtrackAssign(0);
  if (!solved) {
    throw new Error('No se pudo resolver la asignación de mejores terceros.');
  }

  return assignments;

  function backtrackAssign(index) {
    if (index >= ordered.length) return true;
    const placeholder = ordered[index];
    const candidates = qualifiedGroups.filter(group => !used.has(group) && placeholder.groups.includes(group));

    for (const group of candidates) {
      used.add(group);
      assignments.set(placeholder.key, thirdPlaceByGroup.get(group).team);
      if (backtrackAssign(index + 1)) return true;
      assignments.delete(placeholder.key);
      used.delete(group);
    }

    return false;
  }
}

function buildContext({ data, apiResults, apiFixtures, miniResults, playerRankings, teamRankings }) {
  const players = data.players || [];
  const teams = [...new Set((data.matches || []).flatMap(match => [match.team1, match.team2]))]
    .sort((a, b) => normalize(a).localeCompare(normalize(b), 'es'));
  const matches = data.matches || [];
  const pendingMatches = matches.filter(match => !apiResults[match.id]);
  const fixedMatches = matches.filter(match => apiResults[match.id]);
  const scoring = { ...GROUP_STAGE_CONFIG, ...(data.meta?.scoring || {}) };

  const pendingMatchModels = pendingMatches.map(match => ({
    id: match.id,
    group: match.group,
    team1: match.team1,
    team2: match.team2,
    scores: players
      .map(player => parseScore(match.predictions[player.id]?.score))
      .filter(Boolean)
  }));

  const fixedGroupResultMap = new Map(matches
    .filter(match => apiResults[match.id])
    .map(match => [match.id, { home: apiResults[match.id].home, away: apiResults[match.id].away }]));

  const playerStagePicks = new Map(players.map(player => [player.id, buildPlayerStagePicks(data.knockoutPredictions || [], player.id)]));
  const stageVoteCounts = buildStageVoteCounts(data.knockoutPredictions || []);
  const teamPower = buildTeamPower(stageVoteCounts);
  const actualKnockoutWinners = buildActualKnockoutWinners(apiFixtures);
  const currentPlayerStanding = new Map(calculateCurrentPlayerStanding(players, matches, apiResults, scoring, data.knockoutPredictions || [], actualKnockoutWinners).map(row => [row.id, row]));
  const rankingLookups = buildRankingLookups(playerRankings, teamRankings);
  const eventTimeline = buildGoalTimeline(apiFixtures);
  const currentMiniStanding = new Map(calculateCurrentMiniStanding(players, data.miniQuestions || [], miniResults).map(row => [row.id, row]));
  const miniQuestionModels = buildMiniQuestionModels({
    data,
    miniResults,
    rankingLookups,
    eventTimeline
  });

  return {
    data,
    players,
    teams,
    matches,
    scoring,
    pendingMatches,
    pendingMatchModels,
    fixedGroupResultMap,
    playerStagePicks,
    stageVoteCounts,
    teamPower,
    rankingLookups,
    eventTimeline,
    currentPlayerStanding,
    currentMiniStanding,
    miniQuestionModels,
    resolvedMiniQuestions: (data.miniQuestions || []).filter(question => String(miniResults[question.id] || '').trim()).length
  };
}

function buildPlayerStagePicks(knockoutPredictions, playerId) {
  const picks = {};
  for (const stage of Object.keys(KNOCKOUT_SCORING)) {
    picks[stage] = knockoutPredictions
      .filter(prediction => prediction.stage === stage)
      .map(prediction => prediction.predictions?.[playerId] || '')
      .filter(Boolean);
  }
  return picks;
}

function buildStageVoteCounts(knockoutPredictions) {
  const counts = {};

  for (const stage of Object.keys(KNOCKOUT_SCORING)) {
    counts[stage] = new Map();
  }

  for (const prediction of knockoutPredictions) {
    if (!counts[prediction.stage]) continue;
    for (const team of Object.values(prediction.predictions || {})) {
      const key = normalizeTeam(team);
      if (!key) continue;
      counts[prediction.stage].set(key, (counts[prediction.stage].get(key) || 0) + 1);
    }
  }

  return counts;
}

function buildTeamPower(stageVoteCounts) {
  const weights = {
    DIECISEISAVOS: 0.2,
    OCTAVOS: 0.35,
    CUARTOS: 0.5,
    SEMIS: 0.8,
    FINAL: 1,
    '1º': 1.2
  };
  const power = new Map();

  for (const [stage, weight] of Object.entries(weights)) {
    for (const [team, votes] of stageVoteCounts[stage].entries()) {
      power.set(team, (power.get(team) || 0) + votes * weight);
    }
  }

  return power;
}

function buildActualKnockoutWinners(apiFixtures) {
  const byNum = new Map((apiFixtures || [])
    .filter(fixture => Number.isFinite(fixture.num))
    .map(fixture => [fixture.num, fixture]));
  const winners = new Map();

  for (const fixtureGroup of Object.values(KNOCKOUT_FIXTURES)) {
    for (const fixture of fixtureGroup) {
      const actual = byNum.get(fixture.num);
      const winner = actual ? winnerFromFixture(actual, actual.team1, actual.team2) : null;
      if (winner) winners.set(fixture.num, winner);
    }
  }

  return winners;
}

function calculateCurrentPlayerStanding(players, matches, apiResults, scoring, knockoutPredictions, actualKnockoutWinners) {
  const reachedTeams = getKnownReachedTeams(actualKnockoutWinners, knockoutPredictions);

  return players.map(player => {
    const group = matches.reduce((acc, match) => {
      if (!apiResults[match.id]) return acc;
      const result = { home: apiResults[match.id].home, away: apiResults[match.id].away };
      const score = scorePrediction(match.predictions[player.id], result, scoring);
      acc.points += score.points;
      acc.exacts += score.exact ? 1 : 0;
      acc.signs += (!score.exact && score.sign) ? 1 : 0;
      return acc;
    }, { points: 0, exacts: 0, signs: 0 });

    let knockoutPoints = 0;
    for (const [stage, config] of Object.entries(KNOCKOUT_SCORING)) {
      const picks = knockoutPredictions
        .filter(prediction => prediction.stage === stage)
        .map(prediction => prediction.predictions?.[player.id] || '')
        .filter(Boolean);
      const reached = reachedTeams[stage];
      knockoutPoints += picks.filter(team => reached.has(normalizeTeam(team))).length * config.points;
    }

    return {
      ...player,
      total: group.points + knockoutPoints,
      exacts: group.exacts,
      signs: group.signs
    };
  });
}

function getKnownReachedTeams(actualKnockoutWinners, knockoutPredictions) {
  const reached = {
    DIECISEISAVOS: new Set(),
    OCTAVOS: new Set(),
    CUARTOS: new Set(),
    SEMIS: new Set(),
    FINAL: new Set(),
    '1º': new Set()
  };
  const winners = new Map(actualKnockoutWinners);

  for (const fixture of KNOCKOUT_FIXTURES.round32) {
    const winner = winners.get(fixture.num);
    if (!winner) continue;
    reached.OCTAVOS.add(normalizeTeam(winner));
  }
  for (const fixture of KNOCKOUT_FIXTURES.round16) {
    const winner = winners.get(fixture.num);
    if (!winner) continue;
    reached.CUARTOS.add(normalizeTeam(winner));
  }
  for (const fixture of KNOCKOUT_FIXTURES.quarterFinals) {
    const winner = winners.get(fixture.num);
    if (!winner) continue;
    reached.SEMIS.add(normalizeTeam(winner));
  }
  for (const fixture of KNOCKOUT_FIXTURES.semiFinals) {
    const winner = winners.get(fixture.num);
    if (!winner) continue;
    reached.FINAL.add(normalizeTeam(winner));
  }
  const champion = winners.get(104);
  if (champion) reached['1º'].add(normalizeTeam(champion));

  const initial = knockoutPredictions
    .filter(prediction => prediction.stage === 'DIECISEISAVOS')
    .flatMap(prediction => Object.values(prediction.predictions || {}))
    .filter(Boolean);
  for (const team of initial) reached.DIECISEISAVOS.add(normalizeTeam(team));

  return reached;
}

function buildGoalTimeline(apiFixtures) {
  const goals = [];
  for (const fixture of apiFixtures || []) {
    const kickoff = parseFixtureTime(fixture);
    if (!kickoff) continue;
    collectGoals(goals, fixture, kickoff, fixture.team1, fixture.goals1);
    collectGoals(goals, fixture, kickoff, fixture.team2, fixture.goals2);
  }
  goals.sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name, 'es'));
  return goals;
}

function collectGoals(target, fixture, kickoff, team, goals) {
  for (const goal of goals || []) {
    const minute = parseGoalMinute(goal.minute);
    target.push({
      team,
      name: goal.name,
      penalty: Boolean(goal.penalty),
      ownGoal: Boolean(goal.owngoal),
      sortKey: kickoff + minute
    });
  }
}

function parseGoalMinute(value) {
  const text = String(value || '0').trim();
  const [base, extra] = text.split('+').map(Number);
  return ((Number.isFinite(base) ? base : 0) * 60_000) + ((Number.isFinite(extra) ? extra : 0) * 60_000);
}

function parseFixtureTime(fixture) {
  const rawDate = fixture?.utcDate || fixture?.date;
  if (!rawDate) return null;
  if (fixture.utcDate) {
    const date = new Date(fixture.utcDate);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  const dateMatch = String(rawDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(fixture.time || '').match(/^(\d{2}):(\d{2})(?:\s+UTC([+-]\d+))?$/i);
  if (!dateMatch) {
    const date = new Date(rawDate);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  const [, year, month, day] = dateMatch;
  if (!timeMatch) {
    return Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
  }

  const [, hours, minutes, offset] = timeMatch;
  const utcHour = Number(hours) - Number(offset || 0);
  return Date.UTC(Number(year), Number(month) - 1, Number(day), utcHour, Number(minutes), 0);
}

function buildRankingLookups(playerRankings, teamRankings) {
  return {
    players: buildRankingMaps(playerRankings, 'players'),
    teams: buildRankingMaps(teamRankings, 'teams')
  };
}

function buildRankingMaps(dataset, type) {
  const maps = new Map();
  for (const ranking of dataset?.rankings || []) {
    const entries = ranking.rows.map(row => {
      const raw = row.raw || [];
      const name = type === 'players' ? raw[1] || row.player || '' : raw[1] || row.player || '';
      const team = type === 'players' ? raw[2] || row.team || '' : raw[1] || row.player || '';
      return {
        name,
        key: type === 'players' ? normalizeLoose(name) : normalizeTeam(name),
        team: normalizeTeam(team),
        value: parseNumericValue(row.value)
      };
    }).filter(entry => entry.key);
    maps.set(ranking.slug, entries);
  }
  return maps;
}

function buildMiniQuestionModels({ data, miniResults, rankingLookups, eventTimeline }) {
  return new Map((data.miniQuestions || []).map(question => {
    const explicit = String(miniResults[question.id] || '').trim();
    if (explicit) {
      return [question.id, { type: 'fixed', value: explicit }];
    }

    const resolvedValue = deriveCurrentQuestionValue(question.id, eventTimeline);
    if (resolvedValue) {
      return [question.id, { type: 'fixed', value: resolvedValue }];
    }

    if (['Q6', 'Q7', 'Q8'].includes(question.id)) {
      return [question.id, { type: 'group-sim' }];
    }

    const distribution = buildWeightedQuestionDistribution(question, rankingLookups);
    return [question.id, { type: 'weighted', distribution }];
  }));
}

function deriveCurrentQuestionValue(questionId, eventTimeline) {
  if (questionId === 'Q1') {
    return eventTimeline.find(goal => !goal.ownGoal)?.name || '';
  }
  if (questionId === 'Q2') {
    return eventTimeline.find(goal => goal.penalty)?.team || '';
  }
  if (questionId === 'Q10') {
    return eventTimeline.find(goal => normalizeTeam(goal.team) === normalizeTeam('ESPAÑA') && !goal.ownGoal)?.name || '';
  }
  return '';
}

function buildWeightedQuestionDistribution(question, rankingLookups) {
  const frequency = new Map();
  for (const answer of Object.values(question.answers || {})) {
    const key = String(answer || '').trim();
    if (!key) continue;
    frequency.set(key, (frequency.get(key) || 0) + 1);
  }

  const impossibleFloor = getCurrentMinimum(question.id, rankingLookups);

  return [...frequency.entries()].map(([answer, count]) => ({
    answer,
    weight: count * getAnswerBoost(question.id, answer, rankingLookups, impossibleFloor)
  })).filter(item => item.weight > 0);
}

function getCurrentMinimum(questionId, rankingLookups) {
  if (questionId === 'Q5') {
    return sumRankingValues(rankingLookups.teams.get('tarjetas-rojas'));
  }
  if (questionId === 'Q12') {
    return getTeamRankingValue(rankingLookups.teams.get('goles'), 'ESPAÑA');
  }
  if (questionId === 'Q13') {
    return getTeamRankingValue(rankingLookups.teams.get('goles-encajados'), 'ESPAÑA');
  }
  return 0;
}

function getAnswerBoost(questionId, answer, rankingLookups, impossibleFloor) {
  if (MINI_FIELD_TYPES[questionId] === 'number') {
    const numeric = parseNumericAnswer(answer);
    if (Number.isFinite(numeric) && numeric < impossibleFloor) return 0;
    return 1;
  }

  const teamSlug = TEAM_QUESTION_RANKINGS[questionId];
  if (teamSlug) {
    const value = getTeamRankingValue(rankingLookups.teams.get(teamSlug), answer);
    return 1 + value / 10;
  }

  const playerSlug = PLAYER_QUESTION_RANKINGS[questionId];
  if (playerSlug) {
    const value = getPlayerRankingValue(rankingLookups.players.get(playerSlug), answer, questionId === 'Q11' ? 'ESPAÑA' : '');
    return 1 + value / 10;
  }

  if (questionId === 'Q15') {
    const value = getPlayerRankingValue(rankingLookups.players.get('goles'), answer);
    return 1 + value / 20;
  }

  return 1;
}

function simulateTournament(context, rng) {
  const resultMap = new Map(context.fixedGroupResultMap);
  for (const match of context.pendingMatchModels) {
    const sampled = samplePendingScore(match, rng);
    resultMap.set(match.id, sampled);
  }

  const standingsByGroup = new Map();
  for (const group of [...new Set(context.matches.map(match => match.group))].sort()) {
    standingsByGroup.set(group, calculateGroupStandings(context.matches.filter(match => match.group === group), resultMap));
  }

  const thirdPlaceByGroup = new Map();
  const placements = new Map();
  for (const [group, standings] of standingsByGroup.entries()) {
    placements.set(`1${group}`, standings[0].team);
    placements.set(`2${group}`, standings[1].team);
    thirdPlaceByGroup.set(group, standings[2]);
  }

  const bestThirds = [...thirdPlaceByGroup.values()]
    .sort((a, b) =>
      b.points - a.points
      || b.goalDifference - a.goalDifference
      || b.goalsFor - a.goalsFor
      || a.group.localeCompare(b.group, 'es')
    )
    .slice(0, 8);
  const bestThirdGroups = new Set(bestThirds.map(team => team.group));
  const thirdPlaceAssignments = assignThirdPlaceTeams(KNOCKOUT_FIXTURES.round32, bestThirdGroups, thirdPlaceByGroup);

  const stageTeams = {
    dieciseisavos: new Set(),
    octavos: new Set(),
    cuartos: new Set(),
    semis: new Set(),
    final: new Set()
  };
  const winners = new Map();
  const groupTotals = buildGroupTotals(context.matches, resultMap);

  for (const fixture of KNOCKOUT_FIXTURES.round32) {
    const team1 = resolveRound32Team(fixture, 'team1', placements, thirdPlaceAssignments);
    const team2 = resolveRound32Team(fixture, 'team2', placements, thirdPlaceAssignments);
    stageTeams.dieciseisavos.add(team1);
    stageTeams.dieciseisavos.add(team2);
    winners.set(fixture.num, sampleKnockoutWinner(team1, team2, context.stageVoteCounts.OCTAVOS, context.teamPower, rng));
    stageTeams.octavos.add(winners.get(fixture.num));
  }

  for (const fixture of KNOCKOUT_FIXTURES.round16) {
    const team1 = resolveWinnerToken(fixture.team1, winners);
    const team2 = resolveWinnerToken(fixture.team2, winners);
    winners.set(fixture.num, sampleKnockoutWinner(team1, team2, context.stageVoteCounts.CUARTOS, context.teamPower, rng));
    stageTeams.cuartos.add(winners.get(fixture.num));
  }

  for (const fixture of KNOCKOUT_FIXTURES.quarterFinals) {
    const team1 = resolveWinnerToken(fixture.team1, winners);
    const team2 = resolveWinnerToken(fixture.team2, winners);
    winners.set(fixture.num, sampleKnockoutWinner(team1, team2, context.stageVoteCounts.SEMIS, context.teamPower, rng));
    stageTeams.semis.add(winners.get(fixture.num));
  }

  for (const fixture of KNOCKOUT_FIXTURES.semiFinals) {
    const team1 = resolveWinnerToken(fixture.team1, winners);
    const team2 = resolveWinnerToken(fixture.team2, winners);
    winners.set(fixture.num, sampleKnockoutWinner(team1, team2, context.stageVoteCounts.FINAL, context.teamPower, rng));
    stageTeams.final.add(winners.get(fixture.num));
  }

  const finalFixture = KNOCKOUT_FIXTURES.final[0];
  const finalTeam1 = resolveWinnerToken(finalFixture.team1, winners);
  const finalTeam2 = resolveWinnerToken(finalFixture.team2, winners);
  const champion = sampleKnockoutWinner(finalTeam1, finalTeam2, context.stageVoteCounts['1º'], context.teamPower, rng);
  winners.set(finalFixture.num, champion);

  return {
    resultMap,
    stageTeams,
    champion,
    groupTotals
  };
}

function buildGroupTotals(matches, resultMap) {
  const byTeam = new Map();
  let maxGoalsMatch = 0;

  for (const match of matches) {
    const result = resultMap.get(match.id);
    if (!result) continue;

    maxGoalsMatch = Math.max(maxGoalsMatch, result.home + result.away);
    const home = byTeam.get(match.team1) || { team: match.team1, goalsFor: 0, goalsAgainst: 0 };
    const away = byTeam.get(match.team2) || { team: match.team2, goalsFor: 0, goalsAgainst: 0 };
    home.goalsFor += result.home;
    home.goalsAgainst += result.away;
    away.goalsFor += result.away;
    away.goalsAgainst += result.home;
    byTeam.set(match.team1, home);
    byTeam.set(match.team2, away);
  }

  return { byTeam, maxGoalsMatch };
}

function calculatePlayerTotals(context, simulation) {
  return context.players.map(player => {
    let points = 0;
    let exacts = 0;
    let signs = 0;

    for (const match of context.matches) {
      const result = simulation.resultMap.get(match.id);
      const score = scorePrediction(match.predictions[player.id], result, context.scoring);
      points += score.points;
      exacts += score.exact ? 1 : 0;
      signs += (!score.exact && score.sign) ? 1 : 0;
    }

    const stageSets = {
      DIECISEISAVOS: simulation.stageTeams.dieciseisavos,
      OCTAVOS: simulation.stageTeams.octavos,
      CUARTOS: simulation.stageTeams.cuartos,
      SEMIS: simulation.stageTeams.semis,
      FINAL: simulation.stageTeams.final,
      '1º': new Set([simulation.champion])
    };

    const picks = context.playerStagePicks.get(player.id);
    for (const [stage, config] of Object.entries(KNOCKOUT_SCORING)) {
      const reached = stageSets[stage];
      points += (picks[stage] || []).filter(team => reached.has(team)).length * config.points;
    }

    return {
      id: player.id,
      name: player.name,
      total: points,
      exacts,
      signs
    };
  });
}

function calculateMiniTotals(context, simulation, rng) {
  const simulatedAnswers = new Map();
  for (const question of context.data.miniQuestions || []) {
    const model = context.miniQuestionModels.get(question.id);
    if (!model) continue;
    if (model.type === 'fixed') {
      simulatedAnswers.set(question.id, model.value);
      continue;
    }
    if (model.type === 'group-sim') {
      simulatedAnswers.set(question.id, deriveGroupSimQuestion(question.id, simulation.groupTotals));
      continue;
    }
    simulatedAnswers.set(question.id, sampleWeightedAnswer(model.distribution, rng));
  }

  return context.players.map(player => {
    const score = (context.data.miniQuestions || []).reduce((acc, question) => {
      const result = simulatedAnswers.get(question.id) || '';
      const answerScore = scoreMiniAnswer(question, question.answers[player.id], result);
      acc.points += answerScore.points;
      acc.correct += answerScore.correct ? 1 : 0;
      return acc;
    }, { points: 0, correct: 0 });

    return {
      id: player.id,
      name: player.name,
      total: score.points,
      correct: score.correct
    };
  });
}

function deriveGroupSimQuestion(questionId, groupTotals) {
  const teams = [...groupTotals.byTeam.values()];

  if (questionId === 'Q6') {
    const max = Math.max(...teams.map(team => team.goalsFor));
    return teams.filter(team => team.goalsFor === max).map(team => team.team).join('|');
  }
  if (questionId === 'Q7') {
    const max = Math.max(...teams.map(team => team.goalsAgainst));
    return teams.filter(team => team.goalsAgainst === max).map(team => team.team).join('|');
  }
  if (questionId === 'Q8') {
    return String(groupTotals.maxGoalsMatch);
  }
  return '';
}

function calculateCurrentMiniStanding(players, miniQuestions, miniResults) {
  return players.map(player => {
    const score = miniQuestions.reduce((acc, question) => {
      const result = String(miniResults[question.id] || '').trim();
      const answerScore = scoreMiniAnswer(question, question.answers[player.id], result);
      acc.points += answerScore.points;
      acc.correct += answerScore.correct ? 1 : 0;
      return acc;
    }, { points: 0, correct: 0 });

    return {
      id: player.id,
      points: score.points,
      correct: score.correct
    };
  });
}

function scorePrediction(prediction, result, scoring) {
  if (!prediction || !result) return { points: 0, exact: false, sign: false };
  const parsed = parseScore(prediction.score);
  if (!parsed) return { points: 0, exact: false, sign: false };
  const exact = parsed[0] === result.home && parsed[1] === result.away;
  const sign = signFromScore(parsed) === signFromScore([result.home, result.away]);
  return {
    points: exact ? scoring.groupExact : (sign ? scoring.groupSign : 0),
    exact,
    sign
  };
}

function calculateGroupStandings(matches, resultMap) {
  const teams = [...new Set(matches.flatMap(match => [match.team1, match.team2]))];
  const table = teams.map((team, index) => ({
    team,
    group: matches[0]?.group || '',
    originalIndex: index,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0
  }));
  const byTeam = new Map(table.map(row => [row.team, row]));

  for (const match of matches) {
    const result = resultMap.get(match.id);
    if (!result) continue;
    const home = byTeam.get(match.team1);
    const away = byTeam.get(match.team2);
    home.goalsFor += result.home;
    home.goalsAgainst += result.away;
    away.goalsFor += result.away;
    away.goalsAgainst += result.home;

    if (result.home > result.away) home.points += 3;
    else if (result.home < result.away) away.points += 3;
    else {
      home.points += 1;
      away.points += 1;
    }
  }

  for (const row of table) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  }

  return table.sort((a, b) =>
    b.points - a.points
    || b.goalDifference - a.goalDifference
    || b.goalsFor - a.goalsFor
    || a.originalIndex - b.originalIndex
  );
}

function samplePendingScore(match, rng) {
  if (!match.scores.length) return { home: 1, away: 1 };
  const index = Math.floor(rng() * match.scores.length);
  const score = match.scores[index];
  return { home: score[0], away: score[1] };
}

function sampleKnockoutWinner(team1, team2, stageVotes, teamPower, rng) {
  const key1 = normalizeTeam(team1);
  const key2 = normalizeTeam(team2);
  const weight1 = 1 + (stageVotes.get(key1) || 0) + (teamPower.get(key1) || 0) * 0.05;
  const weight2 = 1 + (stageVotes.get(key2) || 0) + (teamPower.get(key2) || 0) * 0.05;
  return rng() < (weight1 / (weight1 + weight2)) ? team1 : team2;
}

function resolveRound32Team(fixture, side, placements, thirdPlaceAssignments) {
  const token = fixture[side];
  const placeholderGroups = parseThirdPlaceGroups(token);
  if (placeholderGroups.length) {
    return thirdPlaceAssignments.get(`${fixture.num}:${side}`);
  }
  return placements.get(token) || token;
}

function resolveWinnerToken(token, winners) {
  const matchWinner = String(token || '').match(/^W(\d+)$/);
  return matchWinner ? winners.get(Number(matchWinner[1])) : token;
}

function parseThirdPlaceGroups(token) {
  const text = String(token || '').trim();
  if (!/^3[A-L](?:\/[A-L])+$/.test(text)) return [];
  return text.slice(1).split('/');
}

function winnerFromFixture(fixture, team1, team2) {
  const decidingScore = [fixture.score?.p, fixture.score?.et, fixture.score?.ft]
    .find(score => Array.isArray(score) && score.length >= 2 && Number(score[0]) !== Number(score[1]));
  if (!decidingScore) return null;
  return Number(decidingScore[0]) > Number(decidingScore[1]) ? team1 : team2;
}

function determineJointWinners(rows, keys) {
  const sorted = [...rows].sort((a, b) => compareByKeys(a, b, keys));
  const best = sorted[0];
  return sorted.filter(row => keys.every(key => row[key] === best[key]));
}

function compareByKeys(a, b, keys) {
  for (const key of keys) {
    const diff = Number(b[key]) - Number(a[key]);
    if (diff) return diff;
  }
  return a.name.localeCompare(b.name, 'es');
}

function sampleWeightedAnswer(distribution, rng) {
  if (!distribution.length) return '';
  const total = distribution.reduce((sum, item) => sum + item.weight, 0);
  let remaining = rng() * total;
  for (const item of distribution) {
    remaining -= item.weight;
    if (remaining <= 0) return item.answer;
  }
  return distribution.at(-1).answer;
}

function scoreMiniAnswer(question, answer, result) {
  if (!result) return { points: 0, correct: false };
  const acceptedAnswers = String(result).split('|').map(value => value.trim()).filter(Boolean);
  const type = MINI_FIELD_TYPES[question.id];
  let correct = false;

  if (type === 'number') {
    const predicted = String(answer || '').trim();
    const minimumMatch = predicted.match(/^\+\s*(\d+)$/);
    const actual = Number(result);
    correct = Number.isFinite(actual) && (minimumMatch ? actual >= Number(minimumMatch[1]) : Number(predicted) === actual);
  } else if (type === 'team') {
    correct = acceptedAnswers.map(normalizeTeam).includes(normalizeTeam(answer));
  } else {
    correct = acceptedAnswers.some(candidate => playerNameMatches(answer, candidate));
  }

  return { points: correct ? question.points : 0, correct };
}

function normalizeTeam(value) {
  const normalized = normalizeLoose(value);
  return TEAM_ALIASES[normalized] || normalized;
}

function normalizeLoose(value) {
  return normalize(value).replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function parseNumericValue(value) {
  const parsed = Number(String(value || '').replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNumericAnswer(value) {
  const match = String(value || '').trim().match(/\d+/);
  return match ? Number(match[0]) : NaN;
}

function sumRankingValues(entries = []) {
  return entries.reduce((total, entry) => total + (entry.value || 0), 0);
}

function getTeamRankingValue(entries = [], answer) {
  const key = normalizeTeam(answer);
  const entry = entries.find(item => item.key === key);
  return entry?.value || 0;
}

function getPlayerRankingValue(entries = [], answer, teamFilter = '') {
  const teamKey = teamFilter ? normalizeTeam(teamFilter) : '';
  const entry = entries.find(item =>
    (!teamKey || item.team === teamKey)
    && playerNameMatches(answer, item.name)
  );
  return entry?.value || 0;
}

function playerNameMatches(answer, candidate) {
  const left = normalizeLoose(answer);
  const right = normalizeLoose(candidate);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;

  const leftTokens = left.split(' ');
  const rightTokens = right.split(' ');
  if (leftTokens.at(-1) !== rightTokens.at(-1)) return false;

  const leftFirst = leftTokens[0] || '';
  const rightFirst = rightTokens[0] || '';
  return leftFirst === rightFirst
    || leftFirst[0] === rightFirst[0]
    || rightFirst.startsWith(leftFirst)
    || leftFirst.startsWith(rightFirst);
}

function createRng(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = Math.imul(value ^ value >>> 15, 1 | value);
    result ^= result + Math.imul(result ^ result >>> 7, 61 | result);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}
