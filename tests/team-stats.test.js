import { describe, expect, it } from 'vitest';
import { calculateTeamStats, getTournamentTeams, TEAM_DETAIL_METRICS } from '../src/lib/team-stats.js';

describe('team stats', () => {
  const matches = [
    { id: 'G-1', team1: 'Alemania', team2: 'Suecia' },
    { id: 'G-2', team1: 'Alemania', team2: 'EE.UU' },
    { id: 'G-3', team1: 'Suecia', team2: 'EE.UU' }
  ];

  const results = {
    'G-1': { home: 2, away: 1 },
    'G-2': { home: 0, away: 0 },
    'G-3': { home: 1, away: 3 }
  };

  const getResult = match => results[match.id] || null;

  it('lists unique teams sorted alphabetically', () => {
    expect(getTournamentTeams(matches)).toEqual(['Alemania', 'EE.UU', 'Suecia']);
  });

  it('calculates a team profile from results', () => {
    expect(calculateTeamStats('Alemania', matches, getResult)).toMatchObject({
      scheduled: 2,
      played: 2,
      wins: 1,
      draws: 1,
      losses: 0,
      goalsFor: 2,
      goalsAgainst: 1,
      goalDifference: 1,
      points: 4,
      cleanSheets: 1,
      failedToScore: 1
    });
  });

  it('exposes chart metrics for the detail page', () => {
    expect(TEAM_DETAIL_METRICS.map(metric => metric.key)).toContain('pointsPerMatch');
  });
});
