const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED']);

function goalKey(matchId, goal) {
  const scorer = goal?.scorer?.name || goal?.scorer || '';
  const assist = goal?.assist?.name || goal?.assist || '';
  const score = goal?.score || {};
  return [
    String(matchId || ''),
    goal?.minute ?? '',
    goal?.injuryTime ?? '',
    goal?.type ?? '',
    scorer,
    assist,
    score.home ?? '',
    score.away ?? ''
  ].join('|');
}

function isLiveStatus(status) {
  return LIVE_STATUSES.has(String(status || ''));
}

export function collectLiveAlertEvents(previousSnapshot, currentSnapshot) {
  const previousMatches = new Map((previousSnapshot?.matches || []).map(match => [String(match.id), match]));
  const currentMatches = Array.isArray(currentSnapshot?.matches) ? currentSnapshot.matches : [];
  const events = [];

  for (const match of currentMatches) {
    const previousMatch = previousMatches.get(String(match.id));
    const currentGoals = Array.isArray(match.goals) ? match.goals : [];
    const previousGoalKeys = new Set((Array.isArray(previousMatch?.goals) ? previousMatch.goals : []).map(goal => goalKey(match.id, goal)));

    for (const goal of currentGoals) {
      const key = goalKey(match.id, goal);
      if (!previousGoalKeys.has(key)) {
        events.push({
          type: 'goal',
          match,
          goal,
          key
        });
      }
    }

    if (previousMatch && isLiveStatus(previousMatch.status) && String(match.status) === 'FINISHED') {
      events.push({
        type: 'final',
        match,
        key: `final:${match.id}:${match.score?.fullTime?.home ?? ''}-${match.score?.fullTime?.away ?? ''}`
      });
    }
  }

  return events;
}

export function buildGoalNotification(match, goal) {
  const home = match.homeTeam?.name || match.homeTeam?.shortName || 'Local';
  const away = match.awayTeam?.name || match.awayTeam?.shortName || 'Visitante';
  const score = goal?.score || match.score?.fullTime || {};
  const scorer = goal?.scorer?.name || 'Gol';
  const assist = goal?.assist?.name ? ` · asistencia de ${goal.assist.name}` : '';
  const minute = goal?.minute != null ? `${goal.minute}${goal.injuryTime ? `+${goal.injuryTime}` : ''}'` : '';

  return {
    title: `${home} ${score.home ?? 0} - ${score.away ?? 0} ${away}`,
    body: `${scorer}${assist}${minute ? ` · ${minute}` : ''}`,
    tag: `goal:${match.id}:${goalKey(match.id, goal)}`
  };
}

export function buildFinalNotification(match) {
  const home = match.homeTeam?.name || match.homeTeam?.shortName || 'Local';
  const away = match.awayTeam?.name || match.awayTeam?.shortName || 'Visitante';
  const score = match.score?.fullTime || {};

  return {
    title: `Final: ${home} ${score.home ?? 0} - ${score.away ?? 0} ${away}`,
    body: 'El partido ha terminado.',
    tag: `final:${match.id}`
  };
}
