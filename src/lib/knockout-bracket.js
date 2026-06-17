export const KNOCKOUT_STAGES = ['DIECISEISAVOS', 'OCTAVOS', 'CUARTOS', 'SEMIS', 'FINAL'];

export function getStagePredictions(knockoutPredictions, stage, playerId) {
  return knockoutPredictions
    .filter(prediction => prediction.stage === stage)
    .sort((a, b) => a.slot - b.slot)
    .map(prediction => prediction.predictions[playerId] || '');
}

export function buildPlayerKnockoutBracket(knockoutPredictions, playerId, keyFn = defaultKey) {
  const bracket = {};
  bracket.DIECISEISAVOS = getStagePredictions(knockoutPredictions, 'DIECISEISAVOS', playerId);

  let previousRound = bracket.DIECISEISAVOS;
  for (const stage of KNOCKOUT_STAGES.slice(1)) {
    const selectedTeams = getStagePredictions(knockoutPredictions, stage, playerId);
    const selectedKeys = new Set(selectedTeams.map(keyFn).filter(Boolean));

    bracket[stage] = [];
    for (let index = 0; index < previousRound.length; index += 2) {
      const pair = [previousRound[index], previousRound[index + 1]];
      const winner = pair.find(team => selectedKeys.has(keyFn(team))) || selectedTeams[index / 2] || '';
      bracket[stage].push(winner);
    }

    previousRound = bracket[stage];
  }

  return bracket;
}

function defaultKey(value) {
  return String(value || '').trim().toUpperCase();
}
