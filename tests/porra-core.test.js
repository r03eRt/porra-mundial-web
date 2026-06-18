import { describe, expect, it } from 'vitest';
import {
  calculateBestCurrentStreak,
  calculateMostChosenPrediction,
  historyPositionChange,
  pickNextPendingMatch,
  scorePrediction
} from '../src/lib/porra-core.js';

const scoring = { groupExact: 3, groupSign: 2 };

describe('porra core', () => {
  it('scores exact, sign and failed predictions', () => {
    expect(scorePrediction({ score: '2-1' }, { home: 2, away: 1 }, scoring)).toEqual({ points: 3, exact: true, sign: true });
    expect(scorePrediction({ score: '1-0' }, { home: 2, away: 1 }, scoring)).toEqual({ points: 2, exact: false, sign: true });
    expect(scorePrediction({ score: '0-1' }, { home: 2, away: 1 }, scoring)).toEqual({ points: 0, exact: false, sign: false });
  });

  it('computes position changes against the previous snapshot', () => {
    const previousSnapshot = {
      ranking: [
        { id: 'a', position: 1 },
        { id: 'b', position: 2 },
        { id: 'c', position: 3 }
      ]
    };

    expect(historyPositionChange({ id: 'b', position: 1 }, previousSnapshot)).toMatchObject({ symbol: '↑', delta: 1 });
    expect(historyPositionChange({ id: 'a', position: 2 }, previousSnapshot)).toMatchObject({ symbol: '↓', delta: 1 });
    expect(historyPositionChange({ id: 'c', position: 3 }, previousSnapshot)).toMatchObject({ symbol: '→', delta: 0 });
  });

  it('finds the most repeated prediction for a match', () => {
    const players = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }];
    const match = {
      predictions: {
        p1: { score: '2-1' },
        p2: { score: '1-1' },
        p3: { score: '2-1' },
        p4: { score: '2-1' }
      }
    };

    expect(calculateMostChosenPrediction(match, players)).toEqual({ score: '2-1', votes: 3 });
  });

  it('computes the best active streak from the latest played matches', () => {
    const players = [
      { id: 'a', name: 'Ana' },
      { id: 'b', name: 'Beto' }
    ];
    const playedMatches = [
      {
        predictions: {
          a: { score: '1-0' },
          b: { score: '0-1' }
        },
        result: { home: 1, away: 0 }
      },
      {
        predictions: {
          a: { score: '2-2' },
          b: { score: '1-0' }
        },
        result: { home: 2, away: 2 }
      },
      {
        predictions: {
          a: { score: '0-1' },
          b: { score: '0-2' }
        },
        result: { home: 0, away: 1 }
      }
    ];

    const best = calculateBestCurrentStreak(
      players,
      playedMatches,
      (match, player) => match.predictions[player.id],
      match => match.result,
      scoring
    );

    expect(best.player.name).toBe('Ana');
    expect(best.streak).toBe(3);
  });

  it('picks the nearest pending match by schedule timestamp', () => {
    const matches = [
      { id: 'm1', played: true, ts: 300 },
      { id: 'm2', played: false, ts: 200 },
      { id: 'm3', played: false, ts: 100 }
    ];

    const next = pickNextPendingMatch(matches, match => match.played, match => match.ts);
    expect(next.id).toBe('m3');
  });
});
