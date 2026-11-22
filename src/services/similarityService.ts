import type { Track } from '../types/music'
import { detectGenre } from './playlistService'

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'mix', 'music',
  'song', 'songs', 'track', 'tracks', 'playlist', 'creative', 'commons', 'open', 'license'
])

const MOOD_GENRE_MAP: Array<{ genre: string; words: string[] }> = [
  { genre: 'Chill', words: ['chill', 'lofi', 'study', 'relax', 'calm', 'sleep', 'night', 'ambient', 'soft', 'focus', 'mellow', 'slow', 'rain'] },
  { genre: 'Pop', words: ['pop', 'upbeat', 'happy', 'party', 'dance', 'club', 'groove', 'synth', 'electro', 'summer', 'fun'] },
  { genre: 'Acoustic', words: ['acoustic', 'piano', 'guitar', 'folk', 'classical', 'violin', 'strings', 'unplugged', 'warm', 'coffee'] },
  { genre: 'Energy', words: ['energy', 'workout', 'gym', 'run', 'fast', 'hype', 'rock', 'bass', 'dubstep', 'rap', 'hard', 'pump', 'driving'] },
  { genre: 'Indie', words: ['indie', 'retro', 'vintage', 'jazz', 'soul', 'blues', 'wave', 'alt', 'dream', 'late'] }
]

const BPM_CACHE_KEY = 'retromix-bpm-cache'
const bpmMemoryCache = new Map<string, number>()

function loadBpmCache(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(BPM_CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveBpmCache(id: string, bpm: number) {
  bpmMemoryCache.set(id, bpm)
  try {
    const cache = loadBpmCache()
    cache[id] = bpm
    localStorage.setItem(BPM_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore storage quota errors for metadata cache
  }
}

export function getCachedBpm(id: string): number | undefined {
  if (bpmMemoryCache.has(id)) return bpmMemoryCache.get(id)
  const cached = loadBpmCache()[id]
  if (typeof cached === 'number' && cached > 0) {
    bpmMemoryCache.set(id, cached)
    return cached
  }
  return undefined
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

export interface SimilarityContext {
  recentIds?: string[]
  likedArtists?: Set<string>
}

export function scoreSimilarity(candidate: Track, seed: Track, ctx: SimilarityContext = {}): number {
  if (candidate.id === seed.id) return -1000
  if (candidate.rating === 'dislike') return -500

  let score = 0
  const seedGenre = (seed.genre || detectGenre(seed)).toLowerCase()
  const candGenre = (candidate.genre || detectGenre(candidate)).toLowerCase()

  if (candidate.artist.toLowerCase() === seed.artist.toLowerCase()) score += 35
  if (candGenre === seedGenre) score += 25

  const seedTokens = new Set(tokenize(`${seed.title} ${seed.artist} ${seed.album}`))
  const candTokens = tokenize(`${candidate.title} ${candidate.artist} ${candidate.album}`)
  let overlap = 0
  for (const tok of candTokens) {
    if (seedTokens.has(tok)) overlap++
  }
  score += Math.min(24, overlap * 6)

  const seedBpm = seed.bpm ?? getCachedBpm(seed.id)
  const candBpm = candidate.bpm ?? getCachedBpm(candidate.id)
  if (seedBpm && candBpm) {
    const ratio = candBpm / seedBpm
    if (Math.abs(ratio - 1) <= 0.08) score += 20
    else if (Math.abs(ratio - 0.5) <= 0.08 || Math.abs(ratio - 2) <= 0.08) score += 10
    else if (Math.abs(ratio - 1) > 0.25) score -= 8
  }

  if (candidate.rating === 'like' || candidate.favorite) score += 12
  if (ctx.likedArtists?.has(candidate.artist.toLowerCase())) score += 8
  if (candidate.local) score += 4 // Slightly prefer offline-ready tracks for seamless playback
  if (candidate.skipCount) score -= Math.min(20, candidate.skipCount * 5)

  const recentIdx = ctx.recentIds?.indexOf(candidate.id) ?? -1
  if (recentIdx >= 0 && recentIdx < 5) score -= (5 - recentIdx) * 8

  return score
}

export function getSimilarTracks(
  seed: Track,
  catalog: Track[],
  excludeIds: Set<string> = new Set(),
  limit = 10,
  ctx: SimilarityContext = {}
): Track[] {
  return catalog
    .filter(t => t.id !== seed.id && !excludeIds.has(t.id) && t.rating !== 'dislike')
    .map(track => ({ track, score: scoreSimilarity(track, seed, ctx) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.track)
}

export function getBecauseYouPlayed(recentTrack: Track | undefined, catalog: Track[], limit = 8): Track[] {
  if (!recentTrack) return []
  return getSimilarTracks(recentTrack, catalog, new Set([recentTrack.id]), limit)
}

export function getMoreLikeYourLikes(catalog: Track[], recentIds: string[] = [], limit = 8): Track[] {
  const liked = catalog.filter(t => t.rating === 'like' || t.favorite)
  if (!liked.length) return []
  const likedIds = new Set(liked.map(t => t.id))
  const likedArtists = new Set(liked.map(t => t.artist.toLowerCase()))
  const candidates = catalog.filter(t => !likedIds.has(t.id) && t.rating !== 'dislike')

  return candidates
    .map(cand => {
      const avg = liked.reduce((sum, seed) => sum + scoreSimilarity(cand, seed, { recentIds, likedArtists }), 0) / liked.length
      return { track: cand, score: avg }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.track)
}

export interface ParsedPrompt {
  title: string
  genre: string
  count: number
  keywords: string[]
}

export function parsePlaylistPrompt(prompt: string): ParsedPrompt {
  const cleaned = prompt.trim()
  const countMatch = cleaned.match(/\b(\d{1,2})\s*(?:tracks?|songs?)?\b/i)
  const count = countMatch ? Math.max(3, Math.min(40, parseInt(countMatch[1], 10))) : 12
  const keywords = tokenize(cleaned)

  let matchedGenre = 'Mix'
  let bestHits = 0
  for (const entry of MOOD_GENRE_MAP) {
    const hits = entry.words.filter(w => cleaned.toLowerCase().includes(w)).length
    if (hits > bestHits) {
      bestHits = hits
      matchedGenre = entry.genre
    }
  }

  const label = cleaned.replace(/\b\d{1,2}\s*(?:tracks?|songs?)\b/gi, '').replace(/[,\s]+$/g, '').trim()
  const title = label ? label.charAt(0).toUpperCase() + label.slice(1) : `${matchedGenre} AI Mix`
  return { title, genre: matchedGenre, count, keywords }
}

export function buildPromptPlaylist(prompt: string, catalog: Track[]): { parsed: ParsedPrompt; tracks: Track[] } {
  const parsed = parsePlaylistPrompt(prompt)
  const scored = catalog
    .filter(t => t.rating !== 'dislike')
    .map(track => {
      let score = 0
      const genre = (track.genre || detectGenre(track)).toLowerCase()
      const text = `${track.title} ${track.artist} ${track.album} ${genre}`.toLowerCase()
      if (parsed.genre !== 'Mix' && genre === parsed.genre.toLowerCase()) score += 30
      for (const kw of parsed.keywords) {
        if (text.includes(kw)) score += 14
      }
      if (track.rating === 'like' || track.favorite) score += 8
      if (track.local) score += 3
      // Slight tie-breaker jitter for variety
      score += Math.random() * 2
      return { track, score }
    })
    .sort((a, b) => b.score - a.score)

  const strongMatches = scored.filter(s => s.score >= 12).map(s => s.track)
  const selected = (strongMatches.length >= Math.min(3, parsed.count) ? strongMatches : scored.map(s => s.track))
    .slice(0, parsed.count)

  return { parsed, tracks: selected }
}

/**
 * Estimate track BPM in the browser using onset-energy autocorrelation on the first ~30s.
 * Returns null if audio cannot be fetched (e.g., CORS blocked) or decoded.
 */
export async function estimateBpmFromUrl(id: string, src: string): Promise<number | null> {
  const cached = getCachedBpm(id)
  if (cached) return cached
  if (!src || src.startsWith('content://')) return null

  try {
    const res = await fetch(src)
    if (!res.ok) return null
    const arrayBuf = await res.arrayBuffer()
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return null
    const ctx = new AudioCtx()
    try {
      const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0))
      const data = audioBuf.getChannelData(0)
      const sr = audioBuf.sampleRate
      const maxSamples = Math.min(data.length, sr * 30)
      const hop = Math.max(256, Math.floor(sr / 100)) // ~100 Hz envelope
      const envLen = Math.floor(maxSamples / hop)
      if (envLen < 100) return null

      const env = new Float32Array(envLen)
      let prev = 0
      for (let i = 0; i < envLen; i++) {
        let sum = 0
        const start = i * hop
        for (let j = 0; j < hop; j++) {
          const v = data[start + j]
          sum += v * v
        }
        const rms = Math.sqrt(sum / hop)
        env[i] = Math.max(0, rms - prev)
        prev = rms
      }

      const envRate = sr / hop
      const minLag = Math.floor((envRate * 60) / 170)
      const maxLag = Math.floor((envRate * 60) / 70)
      let bestLag = minLag
      let bestCorr = -1

      for (let lag = minLag; lag <= maxLag; lag++) {
        let corr = 0
        for (let i = 0; i < envLen - lag; i++) {
          corr += env[i] * env[i + lag]
        }
        if (corr > bestCorr) {
          bestCorr = corr
          bestLag = lag
        }
      }

      if (bestCorr <= 0) return null
      const bpm = Math.round((envRate * 60) / bestLag)
      if (bpm >= 65 && bpm <= 180) {
        saveBpmCache(id, bpm)
        return bpm
      }
      return null
    } finally {
      void ctx.close()
    }
  } catch {
    return null
  }
}

/**
 * Compute playbackRate for incoming deck (clamped to ±8%) to beat-match reference deck BPM.
 */
export function computeTempoMatchRate(incomingBpm: number, referenceEffectiveBpm: number): number {
  if (!incomingBpm || !referenceEffectiveBpm) return 1
  const candidates = [
    referenceEffectiveBpm / incomingBpm,
    referenceEffectiveBpm / (incomingBpm * 2),
    referenceEffectiveBpm / (incomingBpm * 0.5)
  ]
  const best = candidates.reduce((a, b) => (Math.abs(b - 1) < Math.abs(a - 1) ? b : a))
  return Math.max(0.92, Math.min(1.08, Number(best.toFixed(3))))
}
