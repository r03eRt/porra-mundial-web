import { createClient } from 'npm:@supabase/supabase-js@2';

const JORNADA_URL = 'https://as.com/resultados/futbol/mundial/2026/jornada/';
const NEWS_PROXY_URL = 'https://r.jina.ai/http://as.com/noticias/mundial-futbol/';
const CACHE_TABLE = 'as_live_match_cache';
const CACHE_KIND = 'worldcup-2026';
const LIVE_REFRESH_MS = 45 * 1000;
const IDLE_REFRESH_MS = 15 * 60 * 1000;
const FINAL_GRACE_MS = 5 * 60 * 1000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

function decodeHtml(value: string) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value: string) {
  return decodeHtml(String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function escapeRegExp(value: string) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function fetchText(url: string, accept = 'text/html,application/xhtml+xml') {
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      'User-Agent': 'Porrazo2026 live cache (+https://github.com/r03eRt/porra-mundial-web)'
    }
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  return response.text();
}

function extractCurrentStageSlug(html: string) {
  return html.match(/n-dd_dd_li--sl"><a href="\/resultados\/futbol\/mundial\/2026\/jornada\/([^/"?#]+)\//)?.[1]
    || html.match(/<link rel="canonical" href="https:\/\/as\.com\/resultados\/futbol\/mundial\/2026\/jornada\/([^/"?#]+)\//)?.[1]
    || 'grupos_a_2';
}

function extractLiveMatchBlock(html: string) {
  const blocks = [...html.matchAll(/<li class="a_sc_l_it"[\s\S]*?<\/li>/g)].map(match => match[0]);
  return blocks.find(block => /a_sc_st_i[^>]*>\s*En juego\s*</i.test(block)) || null;
}

function extractMatchBlockById(html: string, matchId: string) {
  if (!matchId) return null;
  const blocks = [...html.matchAll(/<li class="a_sc_l_it"[\s\S]*?<\/li>/g)].map(match => match[0]);
  return blocks.find(block => block.includes(`data-id="${matchId}"`)) || null;
}

function parseScore(score: string) {
  const match = stripTags(score).match(/(\d+)\s*-\s*(\d+)/);
  return match ? { home: Number(match[1]), away: Number(match[2]) } : null;
}

function buildDirectUrl(stageSlug: string, matchId: string) {
  return `https://as.com/resultados/futbol/mundial/2026/directo/${stageSlug}_${matchId}/`;
}

function parseScorerSummary(block: string) {
  const scorerLines = [...block.matchAll(/<div class="a_sc_gs(?:\s+a_sc_gs-r)?">([\s\S]*?)<\/div>/g)]
    .map(match => stripTags(match[1] || ''))
    .filter(Boolean);
  return scorerLines.join(' · ');
}

function parseLiveMatchFromBlock(block: string, stageSlug: string) {
  const matchId = block.match(/data-id="([^"]+)"/)?.[1] || '';
  const homeTeam = decodeHtml(block.match(/data-team-home-name="([^"]+)"/)?.[1] || '');
  const awayTeam = decodeHtml(block.match(/data-team-away-name="([^"]+)"/)?.[1] || '');
  const group = stripTags(block.match(/<div class="a_sc_gp">([\s\S]*?)<\/div>/)?.[1] || '');
  const status = stripTags(block.match(/<div class="a_sc_st">([\s\S]*?)<\/div>/)?.[1] || '') || 'En juego';
  const score = parseScore(block.match(/<div class="a_sc_gl">([\s\S]*?)<\/div>/)?.[1] || '');
  const articleUrl = decodeHtml(
    block.match(/<div class="a_sc_vc"><a[^>]+href="([^"]+)"/)?.[1]
      || block.match(/<div class="a_sc_gl"><a[^>]+href="([^"]+)"/)?.[1]
      || ''
  );
  const scorerSummary = parseScorerSummary(block);

  if (!matchId || !homeTeam || !awayTeam || !score) {
    throw new Error('No se pudo parsear el partido en juego desde la jornada de AS.');
  }

  return {
    id: matchId,
    group,
    status,
    homeTeam,
    awayTeam,
    homeScore: score.home,
    awayScore: score.away,
    articleUrl,
    directUrl: buildDirectUrl(stageSlug, matchId),
    scorerSummary
  };
}

function parseMinuteFromLiveArticleMarkdown(markdown: string) {
  const afterHeading = markdown.match(/## [^\n]+\n\n([\s\S]+)/)?.[1] || markdown;
  const minuteMatch = afterHeading.match(/^\s*(\d{1,3})\s*$/m);
  return minuteMatch ? Number(minuteMatch[1]) : null;
}

function parseDirectTitle(markdown: string) {
  return markdown.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || '';
}

function parseHeadlineFromNewsMarkdown(markdown: string, articleUrl: string) {
  if (!articleUrl) return '';
  const pattern = new RegExp(`## \\[([^\\]]+)\\]\\(${escapeRegExp(articleUrl)}\\)`);
  return markdown.match(pattern)?.[1]?.trim() || '';
}

async function fetchHeadline(articleUrl: string) {
  if (!articleUrl) return '';
  const markdown = await fetchText(NEWS_PROXY_URL, 'text/plain');
  return parseHeadlineFromNewsMarkdown(markdown, articleUrl);
}

async function fetchLiveArticleDetails(articleUrl: string) {
  if (!articleUrl) {
    return {
      minute: null,
      directTitle: ''
    };
  }

  const proxyUrl = `https://r.jina.ai/http://${articleUrl.replace(/^https?:\/\//, '')}`;
  const markdown = await fetchText(proxyUrl, 'text/plain');
  return {
    minute: parseMinuteFromLiveArticleMarkdown(markdown),
    directTitle: parseDirectTitle(markdown)
  };
}

function refreshIntervalFor(payload: any) {
  return payload?.live || isFinalGraceActive(payload) ? LIVE_REFRESH_MS : IDLE_REFRESH_MS;
}

function isFinalGraceActive(payload: any) {
  if (!payload?.match || !payload?.showUntil) return false;
  const showUntilTs = new Date(payload.showUntil).getTime();
  return Number.isFinite(showUntilTs) && showUntilTs > Date.now();
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase env vars' }, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: cachedRow, error: cacheReadError } = await supabase
      .from(CACHE_TABLE)
      .select('kind,payload,updated_at')
      .eq('kind', CACHE_KIND)
      .maybeSingle();

    if (cacheReadError) throw cacheReadError;

    const now = Date.now();
    const cacheAgeMs = cachedRow?.updated_at
      ? now - new Date(cachedRow.updated_at).getTime()
      : Number.POSITIVE_INFINITY;

    if (cachedRow?.payload && cacheAgeMs < refreshIntervalFor(cachedRow.payload)) {
      return jsonResponse({
        ok: true,
        skipped: true,
        source: 'supabase-cache',
        updatedAt: cachedRow.updated_at,
        refreshIntervalMs: refreshIntervalFor(cachedRow.payload),
        live: Boolean(cachedRow.payload?.live)
      });
    }

    const jornadaHtml = await fetchText(JORNADA_URL);
    const stageSlug = extractCurrentStageSlug(jornadaHtml);
    const liveBlock = extractLiveMatchBlock(jornadaHtml);
    const scrapedAt = new Date().toISOString();

    let payload: Record<string, unknown>;

    if (!liveBlock) {
      const cachedMatch = cachedRow?.payload?.match || null;
      const shouldKeepFinal = Boolean((cachedRow?.payload?.live || isFinalGraceActive(cachedRow?.payload)) && cachedMatch);
      const finalWhistleAt = cachedRow?.payload?.finalWhistleAt || scrapedAt;
      const showUntil = cachedRow?.payload?.showUntil || new Date(new Date(finalWhistleAt).getTime() + FINAL_GRACE_MS).toISOString();
      const latestFinishedBlock = cachedMatch?.id ? extractMatchBlockById(jornadaHtml, cachedMatch.id) : null;
      let finalMatch = cachedMatch;

      if (latestFinishedBlock && cachedMatch) {
        try {
          const parsedFinalMatch = parseLiveMatchFromBlock(latestFinishedBlock, stageSlug);
          finalMatch = {
            ...cachedMatch,
            ...parsedFinalMatch
          };
        } catch (_error) {
          finalMatch = cachedMatch;
        }
      }

      payload = shouldKeepFinal && finalMatch
        ? {
          kind: CACHE_KIND,
          sourceUrl: JORNADA_URL,
          scrapedAt,
          stageSlug,
          live: false,
          finalWhistleAt,
          showUntil,
          match: {
            ...finalMatch,
            minute: null,
            status: 'Finalizado'
          }
        }
        : {
          kind: CACHE_KIND,
          sourceUrl: JORNADA_URL,
          scrapedAt,
          stageSlug,
          live: false,
          match: null
        };
    } else {
      const liveMatch = parseLiveMatchFromBlock(liveBlock, stageSlug);
      const [headline, liveArticleDetails] = await Promise.all([
        fetchHeadline(liveMatch.articleUrl),
        fetchLiveArticleDetails(liveMatch.articleUrl)
      ]);

      payload = {
        kind: CACHE_KIND,
        sourceUrl: JORNADA_URL,
        newsSourceUrl: 'https://as.com/noticias/mundial-futbol/',
        scrapedAt,
        stageSlug,
        live: true,
        finalWhistleAt: null,
        showUntil: null,
        match: {
          ...liveMatch,
          headline: headline || liveArticleDetails.directTitle || '',
          minute: liveArticleDetails.minute
        }
      };
    }

    const { error: upsertError } = await supabase.from(CACHE_TABLE).upsert([{
      kind: CACHE_KIND,
      payload,
      source: 'as.com',
      updated_at: scrapedAt
    }], { onConflict: 'kind' });

    if (upsertError) throw upsertError;

    return jsonResponse({
      ok: true,
      skipped: false,
      updatedAt: scrapedAt,
      live: Boolean(payload.live),
      refreshIntervalMs: refreshIntervalFor(payload)
    });
  } catch (error) {
    console.error('sync-as-live-match failed:', error);
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
});
