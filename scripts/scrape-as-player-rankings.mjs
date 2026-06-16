import { mkdir, writeFile } from 'node:fs/promises';

const SOURCES = [
  {
    kind: 'players',
    sourceUrl: 'https://as.com/resultados/futbol/mundial/2026/ranking/jugadores/',
    outputPath: new URL('../data/as-player-rankings.json', import.meta.url)
  },
  {
    kind: 'teams',
    sourceUrl: 'https://as.com/resultados/futbol/mundial/2026/ranking/equipos/',
    outputPath: new URL('../data/as-team-rankings.json', import.meta.url)
  }
];

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function textFromHtml(value) {
  return decodeHtml(String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function slugLabel(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Porrazo2026 stats cache (+https://github.com/r03eRt/porra-mundial-web)'
    }
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

function rankingUrlsFromMain(html, sourceUrl) {
  const urls = new Set();
  const hrefPattern = /href=["']([^"']*\/resultados\/futbol\/mundial\/2026\/ranking\/(jugadores|equipos)\/[^"']*)["']/g;
  let match;

  while ((match = hrefPattern.exec(html))) {
    const url = new URL(match[1], sourceUrl);
    if (url.href === sourceUrl) continue;
    if (!url.pathname.startsWith('/resultados/futbol/mundial/2026/ranking/')) continue;
    const slug = url.pathname.split('/').filter(Boolean).at(-1);
    if (!slug || slug === 'jugadores' || slug === 'equipos') continue;
    urls.add(url.href);
  }

  return [...urls].sort();
}

function parseTable(html) {
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

async function scrapeSource({ kind, sourceUrl, outputPath }) {
  const mainHtml = await fetchHtml(sourceUrl);
  const urls = rankingUrlsFromMain(mainHtml, sourceUrl);
  const rankings = [];

  for (const [index, url] of urls.entries()) {
    const slug = new URL(url).pathname.split('/').filter(Boolean).at(-1);
    console.log(`[${kind}] [${index + 1}/${urls.length}] ${slug}`);
    const html = await fetchHtml(url);
    const table = parseTable(html);
    const label = table.headers.at(-1) || slugLabel(slug);
    rankings.push({
      slug,
      label,
      url,
      headers: table.headers,
      rows: table.rows
    });
  }

  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({
    source: sourceUrl,
    scrapedAt: new Date().toISOString(),
    rankings
  }, null, 2)}\n`);

  console.log(`Wrote ${rankings.length} rankings to ${outputPath.pathname}`);
}

async function main() {
  for (const source of SOURCES) {
    await scrapeSource(source);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
