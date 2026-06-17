import { describe, expect, it } from 'vitest';
import { assignThirdPlaceTeams } from '../src/lib/probabilities.js';

describe('probabilities helpers', () => {
  it('assigns qualified third-placed groups to the round-of-32 placeholders', () => {
    const fixtures = [
      { num: 74, team1: '1E', team2: '3A/B/C/D/F' },
      { num: 77, team1: '1I', team2: '3C/D/F/G/H' },
      { num: 79, team1: '1A', team2: '3C/E/F/H/I' },
      { num: 80, team1: '1L', team2: '3E/H/I/J/K' },
      { num: 81, team1: '1D', team2: '3B/E/F/I/J' },
      { num: 82, team1: '1G', team2: '3A/E/H/I/J' },
      { num: 85, team1: '1B', team2: '3E/F/G/I/J' },
      { num: 87, team1: '1K', team2: '3D/E/I/J/L' }
    ];
    const thirdPlaceByGroup = new Map([
      ['D', { team: 'PARAGUAY' }],
      ['E', { team: 'PORTUGAL' }],
      ['F', { team: 'GHANA' }],
      ['G', { team: 'NORUEGA' }],
      ['H', { team: 'MARRUECOS' }],
      ['I', { team: 'ECUADOR' }],
      ['J', { team: 'TUNEZ' }],
      ['K', { team: 'PANAMA' }]
    ]);

    const assignments = assignThirdPlaceTeams(fixtures, new Set(thirdPlaceByGroup.keys()), thirdPlaceByGroup);

    expect(assignments.size).toBe(8);
    expect(new Set(assignments.values())).toEqual(new Set([
      'PARAGUAY',
      'PORTUGAL',
      'GHANA',
      'NORUEGA',
      'MARRUECOS',
      'ECUADOR',
      'TUNEZ',
      'PANAMA'
    ]));
  });
});
