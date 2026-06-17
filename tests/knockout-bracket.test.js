import { describe, expect, it } from 'vitest';
import { buildPlayerKnockoutBracket } from '../src/lib/knockout-bracket.js';

function stagePredictions(stage, teams) {
  return teams.map((team, index) => ({
    stage,
    slot: index + 1,
    predictions: { marty: team }
  }));
}

describe('knockout bracket', () => {
  it('rebuilds Marty bracket from each previous matchup', () => {
    const knockoutPredictions = [
      ...stagePredictions('DIECISEISAVOS', [
        'ALEMANIA', 'EE.UU.', 'FRANCIA', 'JAPÓN',
        'CHEQUIA', 'BOSNIA', 'PAÍSES BAJOS', 'MARRUECOS',
        'COLOMBIA', 'CROACIA', 'ESPAÑA', 'AUSTRIA',
        'PARAGUAY', 'C. MARFIL', 'BÉLGICA', 'CABO VERDE',
        'BRASIL', 'SUECIA', 'ECUADOR', 'NORUEGA',
        'MÉXICO', 'ESCOCIA', 'INGLATERRA', 'SENEGAL',
        'ARGENTINA', 'URUGUAY', 'TURQUÍA', 'EGIPTO',
        'SUIZA', 'ARGELIA', 'PORTUGAL', 'GHANA'
      ]),
      ...stagePredictions('OCTAVOS', [
        'ALEMANIA', 'BRASIL', 'NORUEGA', 'FRANCIA',
        'CHEQUIA', 'MÉXICO', 'INGLATERRA', 'PAÍSES BAJOS',
        'CROACIA', 'ARGENTINA', 'TURQUÍA', 'ESPAÑA',
        'PARAGUAY', 'SUIZA', 'PORTUGAL', 'BÉLGICA'
      ]),
      ...stagePredictions('CUARTOS', [
        'FRANCIA', 'PAÍSES BAJOS', 'ESPAÑA', 'BÉLGICA',
        'NORUEGA', 'INGLATERRA', 'TURQUÍA', 'PORTUGAL'
      ]),
      ...stagePredictions('SEMIS', ['FRANCIA', 'ESPAÑA', 'INGLATERRA', 'PORTUGAL']),
      ...stagePredictions('FINAL', ['ESPAÑA', 'PORTUGAL'])
    ];

    const bracket = buildPlayerKnockoutBracket(knockoutPredictions, 'marty');

    expect(bracket.OCTAVOS).toEqual([
      'ALEMANIA', 'FRANCIA', 'CHEQUIA', 'PAÍSES BAJOS',
      'CROACIA', 'ESPAÑA', 'PARAGUAY', 'BÉLGICA',
      'BRASIL', 'NORUEGA', 'MÉXICO', 'INGLATERRA',
      'ARGENTINA', 'TURQUÍA', 'SUIZA', 'PORTUGAL'
    ]);
    expect(bracket.CUARTOS).toEqual([
      'FRANCIA', 'PAÍSES BAJOS', 'ESPAÑA', 'BÉLGICA',
      'NORUEGA', 'INGLATERRA', 'TURQUÍA', 'PORTUGAL'
    ]);
    expect(bracket.SEMIS).toEqual(['FRANCIA', 'ESPAÑA', 'INGLATERRA', 'PORTUGAL']);
    expect(bracket.FINAL).toEqual(['ESPAÑA', 'PORTUGAL']);
  });
});
