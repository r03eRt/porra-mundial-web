import { describe, expect, it } from 'vitest';
import {
  normalize,
  normalizePlayerName,
  parseRankingTable,
  parseScore,
  playerNamesMatch,
  signFromScore,
  slugLabel,
  statsCountryFlag,
  statsCountryLabel
} from '../src/lib/statistics-utils.js';

describe('statistics utils', () => {
  it('normalizes accents, symbols and whitespace', () => {
    expect(normalize('  Países   Bajos &  México ')).toBe('PAISES BAJOS AND MEXICO');
  });

  it('parses scores and derives the match sign', () => {
    expect(parseScore('2-1')).toEqual([2, 1]);
    expect(parseScore(' 0 - 0 ')).toEqual([0, 0]);
    expect(signFromScore('2-1')).toBe('1');
    expect(signFromScore([1, 3])).toBe('2');
    expect(signFromScore('0-0')).toBe('X');
  });

  it('maps countries to flags and readable labels', () => {
    expect(statsCountryLabel('Suecia SUE')).toBe('Suecia');
    expect(statsCountryFlag('Suecia')).toBe('🇸🇪');
    expect(statsCountryFlag('EE.UU')).toBe('🇺🇸');
  });

  it('creates a human label from a slug', () => {
    expect(slugLabel('goles-encajados')).toBe('Goles Encajados');
  });

  it('normalizes player aliases for Messi and Lamine Yamal', () => {
    expect(normalizePlayerName('Messi')).toBe('LIONEL MESSI');
    expect(normalizePlayerName('Leo Messi')).toBe('LIONEL MESSI');
    expect(normalizePlayerName('Yamal')).toBe('LAMINE YAMAL');
    expect(normalizePlayerName('Lamin')).toBe('LAMINE YAMAL');
    expect(playerNamesMatch('Lionel Messi', 'Messi')).toBe(true);
    expect(playerNamesMatch('Lamine Yamal', 'Yamal')).toBe(true);
    expect(playerNamesMatch('Lamine Yamal', 'Lamine')).toBe(true);
  });

  it('parses a ranking table from html', () => {
    const table = parseRankingTable(`
      <table>
        <tr><th>Pos.</th><th>Equipo</th><th>Goles</th></tr>
        <tr><td>1</td><td>Alemania GER</td><td>7</td></tr>
        <tr><td>2</td><td>Suecia SUE</td><td>5</td></tr>
      </table>
    `);

    expect(table.headers).toEqual(['Pos.', 'Equipo', 'Goles']);
    expect(table.rows).toEqual([
      { position: '1', player: 'Alemania GER', team: '7', value: '7', raw: ['1', 'Alemania GER', '7'] },
      { position: '2', player: 'Suecia SUE', team: '5', value: '5', raw: ['2', 'Suecia SUE', '5'] }
    ]);
  });
});
