import { parseScore, signFromScore } from './statistics-utils.js';

export function scorePrediction(prediction, result, scoring) {
  if (!result || !scoring) return { points: 0, exact: false, sign: false };
  const parsed = parseScore(prediction?.score);
  if (!parsed) return { points: 0, exact: false, sign: false };
  const exact = parsed[0] === result.home && parsed[1] === result.away;
  const sign = signFromScore(parsed) === signFromScore([result.home, result.away]);
  return {
    points: exact ? scoring.groupExact : (sign ? scoring.groupSign : 0),
    exact,
    sign
  };
}

export function historyPositionChange(player, previousSnapshot) {
  if (!previousSnapshot) return { symbol: '•', delta: 0, className: 'muted', label: 'Primera foto' };
  const previous = previousSnapshot.ranking.find(item => item.id === player.id);
  if (!previous) return { symbol: '•', delta: 0, className: 'muted', label: 'Sin referencia' };

  const delta = previous.position - player.position;
  if (delta > 0) return { symbol: '↑', delta, className: 'ok', label: `Sube ${delta}` };
  if (delta < 0) return { symbol: '↓', delta: Math.abs(delta), className: 'bad', label: `Baja ${Math.abs(delta)}` };
  return { symbol: '→', delta: 0, className: 'muted', label: 'Se mantiene' };
}

export function calculateMostChosenPrediction(match, players) {
  if (!match?.predictions || !Array.isArray(players)) return null;

  const counts = new Map();
  for (const player of players) {
    const score = String(match.predictions[player.id]?.score || '').trim();
    if (!score) continue;
    counts.set(score, (counts.get(score) || 0) + 1);
  }

  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
  if (!entries.length) return null;

  const [score, votes] = entries[0];
  return { score, votes };
}

export function calculateBestCurrentStreak(players, playedMatches, getPrediction, getResult, scoring) {
  if (!Array.isArray(players) || !Array.isArray(playedMatches) || !playedMatches.length) return null;

  const streaks = players.map(player => {
    let streak = 0;
    for (let index = playedMatches.length - 1; index >= 0; index -= 1) {
      const score = scorePrediction(getPrediction(playedMatches[index], player), getResult(playedMatches[index]), scoring);
      if (score.points > 0) streak += 1;
      else break;
    }
    return { player, streak };
  }).sort((a, b) => b.streak - a.streak || a.player.name.localeCompare(b.player.name, 'es'));

  return streaks[0]?.streak > 0 ? streaks[0] : null;
}

export function pickNextPendingMatch(matches, getResult, getTimestamp) {
  if (!Array.isArray(matches)) return null;
  return matches
    .filter(match => !getResult(match))
    .sort((a, b) => getTimestamp(a) - getTimestamp(b))[0] || null;
}
