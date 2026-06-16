import { describe, expect, it } from 'vitest';
import { buildFinalNotification, buildGoalNotification, collectLiveAlertEvents } from '../src/lib/live-alerts.js';

describe('live alerts', () => {
  it('detects a new goal and a finished match', () => {
    const previous = {
      matches: [
        {
          id: '1',
          status: 'IN_PLAY',
          goals: [
            { minute: 12, scorer: { name: 'Player One' }, score: { home: 1, away: 0 } }
          ]
        }
      ]
    };

    const current = {
      matches: [
        {
          id: '1',
          status: 'FINISHED',
          goals: [
            { minute: 12, scorer: { name: 'Player One' }, score: { home: 1, away: 0 } },
            { minute: 77, scorer: { name: 'Player Two' }, assist: { name: 'Player One' }, score: { home: 2, away: 0 } }
          ],
          score: { fullTime: { home: 2, away: 0 } },
          homeTeam: { name: 'Team A' },
          awayTeam: { name: 'Team B' }
        }
      ]
    };

    const events = collectLiveAlertEvents(previous, current);
    expect(events.map(event => event.type)).toEqual(['goal', 'final']);
  });

  it('builds a goal notification with scorer and score', () => {
    const notification = buildGoalNotification(
      { id: '1', homeTeam: { name: 'Team A' }, awayTeam: { name: 'Team B' } },
      { minute: 77, scorer: { name: 'Player Two' }, assist: { name: 'Player One' }, score: { home: 2, away: 0 } }
    );

    expect(notification.title).toBe('Team A 2 - 0 Team B');
    expect(notification.body).toContain('Player Two');
    expect(notification.body).toContain('asistencia de Player One');
  });

  it('builds a final notification with the score', () => {
    const notification = buildFinalNotification({
      homeTeam: { name: 'Team A' },
      awayTeam: { name: 'Team B' },
      score: { fullTime: { home: 2, away: 1 } }
    });

    expect(notification.title).toBe('Final: Team A 2 - 1 Team B');
  });
});
