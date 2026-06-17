const COUNTRY_FLAGS = {
  'ALEMANIA': '🇩🇪',
  'ARABIA SAUDI': '🇸🇦',
  'AUSTRALIA': '🇦🇺',
  'BOSNIA': '🇧🇦',
  'BRASIL': '🇧🇷',
  'BELGICA': '🇧🇪',
  'C MARFIL': '🇨🇮',
  'CABO VERDE': '🇨🇻',
  'CANADA': '🇨🇦',
  'COREA DEL SUR': '🇰🇷',
  'CURAZAO': '🇨🇼',
  'EEUU': '🇺🇸',
  'ECUADOR': '🇪🇨',
  'EGIPTO': '🇪🇬',
  'ESCOCIA': '🏴',
  'ESPAÑA': '🇪🇸',
  'HAITI': '🇭🇹',
  'IRAN': '🇮🇷',
  'JAPON': '🇯🇵',
  'MARRUECOS': '🇲🇦',
  'MEXICO': '🇲🇽',
  'NUEVA ZELANDA': '🇳🇿',
  'PARAGUAY': '🇵🇾',
  'PAISES BAJOS': '🇳🇱',
  'QATAR': '🇶🇦',
  'R CHECA': '🇨🇿',
  'SUDAFRICA': '🇿🇦',
  'SUECIA': '🇸🇪',
  'SUIZA': '🇨🇭',
  'TURQUIA': '🇹🇷',
  'TUNEZ': '🇹🇳',
  'URUGUAY': '🇺🇾'
};

export function normalize(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'AND')
    .replace(/\s+/g, ' ');
}

export function statsCountryKey(value) {
  return normalize(value).replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

export function statsCountryFlag(value) {
  return COUNTRY_FLAGS[statsCountryKey(value)] || '🏳️';
}

export function statsCountryLabel(value) {
  return String(value || '')
    .replace(/\s+[A-ZÁÉÍÓÚÜÑ0-9.]{2,5}$/, '')
    .trim();
}

export function parseScore(score) {
  const match = String(score || '').trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

export function signFromScore(score) {
  const parsed = Array.isArray(score) ? score : parseScore(score);
  if (!parsed) return '';
  if (parsed[0] > parsed[1]) return '1';
  if (parsed[0] < parsed[1]) return '2';
  return 'X';
}

export function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function textFromHtml(value) {
  return decodeHtml(String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

export function slugLabel(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function normalizePlayerName(value) {
  const normalized = normalize(value)
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const aliases = {
    MESSI: 'LIONEL MESSI',
    'LEO MESSI': 'LIONEL MESSI',
    'L MESSI': 'LIONEL MESSI',
    'LIONEL ANDRES MESSI': 'LIONEL MESSI',
    LAMINE: 'LAMINE YAMAL',
    YAMAL: 'LAMINE YAMAL',
    'L YAMAL': 'LAMINE YAMAL',
    LAMIN: 'LAMINE YAMAL',
    'YAMINE LAMAL': 'LAMINE YAMAL'
  };

  return aliases[normalized] || normalized;
}

export function playerNamesMatch(left, right) {
  const first = normalizePlayerName(left);
  const second = normalizePlayerName(right);
  if (!first || !second) return false;
  if (first === second || first.includes(second) || second.includes(first)) return true;

  const firstTokens = first.split(' ');
  const secondTokens = second.split(' ');
  if (firstTokens.at(-1) !== secondTokens.at(-1)) return false;

  const firstName = firstTokens[0] || '';
  const secondName = secondTokens[0] || '';
  return firstName === secondName
    || firstName[0] === secondName[0]
    || secondName.startsWith(firstName)
    || firstName.startsWith(secondName);
}

export function parseRankingTable(html) {
  const table = html.match(/<table[\s\S]*?<\/table>/i)?.[0] || '';
  if (!table) return { headers: [], rows: [] };

  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
    .map(rowMatch => {
      const cells = [...rowMatch[0].matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi)]
        .map(cell => textFromHtml(cell[2]))
        .filter(Boolean);
      return cells;
    })
    .filter(row => row.length);

  return {
    headers: rows[0] || [],
    rows: rows.slice(1).map(row => ({
      position: row[0] || '',
      player: row[1] || '',
      team: row[2] || '',
      value: row.at(-1) || '',
      raw: row
    }))
  };
}
