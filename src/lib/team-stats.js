import { normalize } from './statistics-utils.js';

export const TEAM_DETAIL_METRICS = [
  { key: 'played', label: 'Partidos jugados' },
  { key: 'wins', label: 'Victorias' },
  { key: 'draws', label: 'Empates' },
  { key: 'losses', label: 'Derrotas' },
  { key: 'goalsFor', label: 'Goles a favor' },
  { key: 'goalsAgainst', label: 'Goles en contra' },
  { key: 'goalDifference', label: 'Diferencia de goles' },
  { key: 'points', label: 'Puntos' },
  { key: 'cleanSheets', label: 'Porterías a cero' },
  { key: 'failedToScore', label: 'Partidos sin marcar' },
  { key: 'winRate', label: '% Victorias' },
  { key: 'pointsPerMatch', label: 'Puntos por partido' }
];

export function getTournamentTeams(matches) {
  return [...new Set((matches || []).flatMap(match => [match.team1, match.team2]))]
    .sort((a, b) => normalize(a).localeCompare(normalize(b), 'es'));
}

export function calculateTeamStats(team, matches, getResult) {
  const teamMatches = (matches || []).filter(match => match.team1 === team || match.team2 === team);
  let played = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let cleanSheets = 0;
  let failedToScore = 0;

  for (const match of teamMatches) {
    const result = getResult(match);
    if (!result) continue;

    const isHome = match.team1 === team;
    const teamGoals = isHome ? result.home : result.away;
    const opponentGoals = isHome ? result.away : result.home;

    played += 1;
    goalsFor += teamGoals;
    goalsAgainst += opponentGoals;
    if (opponentGoals === 0) cleanSheets += 1;
    if (teamGoals === 0) failedToScore += 1;

    if (teamGoals > opponentGoals) wins += 1;
    else if (teamGoals < opponentGoals) losses += 1;
    else draws += 1;
  }

  const goalDifference = goalsFor - goalsAgainst;
  const points = wins * 3 + draws;

  return {
    team,
    scheduled: teamMatches.length,
    played,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference,
    points,
    cleanSheets,
    failedToScore,
    winRate: played ? (wins / played) * 100 : 0,
    pointsPerMatch: played ? points / played : 0
  };
}
