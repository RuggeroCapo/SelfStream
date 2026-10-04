import { request } from 'undici';
import { config } from './config';

export interface Match {
    id: string;
    title: string;
    category: string;
    date: number;
    poster?: string;
    popular?: boolean;
    teams?: { home?: { name: string; badge?: string }; away?: { name: string; badge?: string } } | null;
    sources: { source: string; id: string }[];
}

export interface StreamInfo {
    id: string;
    streamNo: number;
    language: string;
    hd: boolean;
    embedUrl: string;
    source: string;
    viewers: number;
}

const cache = new Map<string, { exp: number; data: any }>();
const matchIndex = new Map<string, Match>();

async function getJson<T>(path: string, ttlMs: number): Promise<T> {
    const hit = cache.get(path);
    if (hit && hit.exp > Date.now()) return hit.data;
    const { body, statusCode } = await request(config.apiBase + path, {
        headers: { 'User-Agent': config.userAgent, Accept: 'application/json' },
    });
    if (statusCode !== 200) {
        await body.dump();
        throw new Error(`streamed API ${path} -> ${statusCode}`);
    }
    const data = (await body.json()) as T;
    cache.set(path, { exp: Date.now() + ttlMs, data });
    return data;
}

export async function getMatches(list: string): Promise<Match[]> {
    // "live" and "all-today" are aggregate lists; anything else is a sport id
    const path = list === 'live' || list === 'all-today' || list === 'all'
        ? `/api/matches/${list}`
        : `/api/matches/${encodeURIComponent(list)}`;
    const matches = await getJson<Match[]>(path, 60 * 1000);
    for (const m of matches) matchIndex.set(m.id, m);
    return matches;
}

export async function getMatch(id: string): Promise<Match | undefined> {
    if (!matchIndex.has(id)) {
        await getMatches('live').catch(() => {});
        if (!matchIndex.has(id)) await getMatches('all-today').catch(() => {});
    }
    return matchIndex.get(id);
}

export async function getStreams(source: string, id: string): Promise<StreamInfo[]> {
    return getJson<StreamInfo[]>(`/api/stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`, 30 * 1000);
}

export function imageUrl(m: Match): string | undefined {
    if (m.poster) return config.apiBase + m.poster;
    const badge = m.teams?.home?.badge;
    return badge ? `${config.apiBase}/api/images/badge/${badge}.webp` : undefined;
}
