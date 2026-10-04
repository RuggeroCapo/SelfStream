import { AsyncLocalStorage } from 'async_hooks';
import express from 'express';
import { addonBuilder, getRouter } from 'stremio-addon-sdk';
import { config } from './config';
import { getMatches, getMatch, getStreams, imageUrl, Match } from './api';
import { extractM3u8 } from './extract';
import { decodeToken, proxyFetch } from './proxy';

const SPORTS: [string, string][] = [
    ['football', 'Football'], ['basketball', 'Basketball'], ['american-football', 'American Football'],
    ['hockey', 'Hockey'], ['baseball', 'Baseball'], ['motor-sports', 'Motor Sports'],
    ['fight', 'Fight (UFC, Boxing)'], ['tennis', 'Tennis'], ['rugby', 'Rugby'], ['golf', 'Golf'],
];

const manifest = {
    id: 'org.streamedaddon.events',
    version: '0.1.0',
    name: 'Streamed Events',
    description: 'Live sport events, played through your own HLS proxy',
    resources: ['catalog', 'meta', 'stream'],
    types: ['tv'],
    idPrefixes: ['streamed:'],
    catalogs: [
        { type: 'tv', id: 'streamed-live', name: 'Streamed • Live now' },
        { type: 'tv', id: 'streamed-today', name: 'Streamed • Today' },
        ...SPORTS.map(([id, name]) => ({ type: 'tv', id: `streamed-sport-${id}`, name: `Streamed • ${name}` })),
    ],
};

const fmtDate = (ts: number) =>
    new Date(ts).toLocaleString('it-IT', { timeZone: process.env.TZ || 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' });

const toMeta = (m: Match) => ({
    id: `streamed:${m.id}`,
    type: 'tv',
    name: m.title,
    poster: imageUrl(m),
    posterShape: 'landscape',
    background: imageUrl(m),
    description: `${m.category} • ${fmtDate(m.date)}`,
    releaseInfo: fmtDate(m.date),
});

const builder = new addonBuilder(manifest as any);

builder.defineCatalogHandler(async ({ id }: any) => {
    let list = 'live';
    if (id === 'streamed-today') list = 'all-today';
    else if (id.startsWith('streamed-sport-')) list = id.slice('streamed-sport-'.length);
    const matches = await getMatches(list);
    return { metas: matches.filter((m) => m.sources?.length).sort((a, b) => a.date - b.date).map(toMeta), cacheMaxAge: 60 };
});

builder.defineMetaHandler(async ({ id }: any) => {
    const m = await getMatch(id.replace(/^streamed:/, ''));
    return { meta: m ? toMeta(m) : null, cacheMaxAge: 60 };
});

// Base URL of this server as seen by the caller. Resolved per request (never shared between
// requests) so one client's Host header can't change the links handed to another.
const requestBase = new AsyncLocalStorage<string>();
const baseOf = (req: express.Request) => process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
const addonBase = () => requestBase.getStore() || process.env.PUBLIC_URL || '';

builder.defineStreamHandler(async ({ id }: any) => {
    const m = await getMatch(id.replace(/^streamed:/, ''));
    if (!m) return { streams: [] };
    const lists = await Promise.all(m.sources.map((s) => getStreams(s.source, s.id).catch(() => [])));
    const streams = lists.flat().sort((a, b) => b.viewers - a.viewers).map((s) => ({
        name: `Streamed${s.hd ? ' HD' : ''}`,
        title: `${s.source} #${s.streamNo} • ${s.language}\n👁 ${s.viewers}`,
        url: `${addonBase()}/play/${Buffer.from(s.embedUrl).toString('base64url')}.m3u8`,
    }));
    return { streams, cacheMaxAge: 15 };
});

const app = express();
app.set('trust proxy', true);
app.use((req, _res, next) => requestBase.run(baseOf(req), next));

// Lazy resolution: the embed page is only opened when the user actually hits play.
app.get('/play/:e.m3u8', async (req, res) => {
    try {
        const embedUrl = Buffer.from(req.params.e, 'base64url').toString();
        if (!/^https:\/\/embed\.st\//.test(embedUrl)) return res.sendStatus(400);
        const { url, headers } = await extractM3u8(embedUrl);
        await proxyFetch(url, headers, baseOf(req), res);
    } catch (e: any) {
        console.error('[play]', e.message);
        res.status(502).send(e.message);
    }
});

app.get('/proxy/:token', async (req, res) => {
    const t = decodeToken(req.params.token.replace(/\.m3u8$/, ''));
    if (!t) return res.sendStatus(400);
    try {
        await proxyFetch(t.u, t.h, baseOf(req), res, req.headers.range as string | undefined);
    } catch (e: any) {
        if (!res.headersSent) res.sendStatus(502);
    }
});

app.use(getRouter(builder.getInterface()));

app.listen(config.port, () => console.log(`Streamed addon on http://127.0.0.1:${config.port}/manifest.json`));
