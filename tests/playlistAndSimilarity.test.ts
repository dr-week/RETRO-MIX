import { describe, expect, test } from 'bun:test'
import {
  tokenize,
  scoreSimilarity,
  getSimilarTracks,
  getBecauseYouPlayed,
  getMoreLikeYourLikes,
  parsePlaylistPrompt,
  buildPromptPlaylist,
  computeTempoMatchRate
} from '../src/services/similarityService'
import { detectGenre, generateSmartPlaylists } from '../src/services/playlistService'
import type { Track } from '../src/types/music'

const catalog: Track[] = [
  { id: 't1', title: 'Midnight Lofi Study', artist: 'Luna', album: 'Late Night', duration: 185, src: 'https://example.com/1.mp3', genre: 'Chill', bpm: 90, rating: 'like', favorite: true },
  { id: 't2', title: 'Rainy Night Calm', artist: 'Luna', album: 'Late Night', duration: 200, src: 'https://example.com/2.mp3', genre: 'Chill', bpm: 92, local: true },
  { id: 't3', title: 'Warm Acoustic Guitar', artist: 'Sol', album: 'Unplugged', duration: 210, src: 'https://example.com/3.mp3', genre: 'Acoustic', bpm: 105 },
  { id: 't4', title: 'Gym Pump Bass', artist: 'Volt', album: 'Hard Workout', duration: 190, src: 'https://example.com/4.mp3', genre: 'Energy', bpm: 140 },
  { id: 't5', title: 'Disliked Noise', artist: 'Luna', album: 'Late Night', duration: 180, src: 'https://example.com/5.mp3', genre: 'Chill', bpm: 90, rating: 'dislike' },
  { id: 't6', title: 'Soft Dream Focus', artist: 'Milo', album: 'Study Beats', duration: 175, src: 'https://example.com/6.mp3', genre: 'Chill', bpm: 180 }
]

describe('similarityService', () => {
  test('tokenize removes stop words and punctuation', () => {
    expect(tokenize('The Midnight-Lofi & Study Mix!')).toEqual(['midnight', 'lofi', 'study'])
  })

  test('scoreSimilarity ranks same artist/genre/BPM highest and excludes disliked', () => {
    const close = scoreSimilarity(catalog[1], catalog[0])
    const far = scoreSimilarity(catalog[3], catalog[0])
    const disliked = scoreSimilarity(catalog[4], catalog[0])
    expect(close).toBeGreaterThan(far)
    expect(disliked).toBeLessThan(-100)
  })

  test('getSimilarTracks excludes seed, disliked tracks, and explicit excludeIds', () => {
    const res = getSimilarTracks(catalog[0], catalog, new Set(['t2']), 5)
    const ids = res.map(t => t.id)
    expect(ids).not.toContain('t1')
    expect(ids).not.toContain('t2')
    expect(ids).not.toContain('t5')
    expect(ids[0]).toBe('t6') // Chill + double-time BPM (180 vs 90)
  })

  test('getBecauseYouPlayed and getMoreLikeYourLikes return relevant candidates', () => {
    const because = getBecauseYouPlayed(catalog[0], catalog, 3)
    expect(because[0].id).toBe('t2')

    const more = getMoreLikeYourLikes(catalog, [], 3)
    expect(more.map(t => t.id)).not.toContain('t1') // already liked
    expect(more.map(t => t.id)).not.toContain('t5') // disliked
    expect(more[0].id).toBe('t2')
  })

  test('parsePlaylistPrompt extracts title, genre, count, and keywords', () => {
    const parsed = parsePlaylistPrompt('chill study, 15 tracks')
    expect(parsed.genre).toBe('Chill')
    expect(parsed.count).toBe(15)
    expect(parsed.title).toBe('Chill study')
    expect(parsed.keywords).toContain('study')
  })

  test('buildPromptPlaylist returns matching tracks up to requested count', () => {
    const { tracks } = buildPromptPlaylist('chill study, 2 tracks', catalog)
    expect(tracks.length).toBe(2)
    expect(tracks.every(t => t.genre === 'Chill')).toBe(true)
    expect(tracks.map(t => t.id)).not.toContain('t5')
  })

  test('computeTempoMatchRate clamps to ±8% and supports half/double time', () => {
    expect(computeTempoMatchRate(92, 90)).toBeCloseTo(0.978, 3)
    expect(computeTempoMatchRate(180, 90)).toBe(1) // half-time exact match
    expect(computeTempoMatchRate(85, 100)).toBe(1.08) // clamped upper bound
    expect(computeTempoMatchRate(120, 100)).toBe(0.92) // clamped lower bound
  })
})

import { detectBpmFromSamples } from '../src/services/similarityService'
import { BEAT_PATTERNS, stepDurationSeconds } from '../src/services/djFxService'

function makeKickTrack(bpm: number, seconds = 12, sr = 22050): Float32Array {
  const buf = new Float32Array(sr * seconds)
  const beatInterval = Math.round((60 / bpm) * sr)
  const pulseLen = Math.round(sr * 0.04)
  for (let pos = 0; pos + pulseLen < buf.length; pos += beatInterval) {
    for (let i = 0; i < pulseLen; i++) {
      const env = Math.exp(-i / (sr * 0.012))
      buf[pos + i] = env * Math.sin((2 * Math.PI * 80 * i) / sr)
    }
  }
  return buf
}

describe('playlistService', () => {
  test('detectGenre infers genre from metadata when missing', () => {
    const inferred = detectGenre({ id: 'x', title: 'Piano Solo', artist: 'Anon', album: 'Classical', duration: 100, src: '' })
    expect(inferred).toBe('Acoustic')
  })

  test('generateSmartPlaylists tags playlists with kind="smart"', () => {
    const smart = generateSmartPlaylists(catalog)
    expect(smart.length).toBeGreaterThan(0)
    expect(smart.every(p => p.kind === 'smart')).toBe(true)
  })
})

describe('DJ BPM detection & beat machine', () => {
  test('detectBpmFromSamples accurately detects 90, 120, and 140 BPM synthesized audio', () => {
    const b90 = detectBpmFromSamples(makeKickTrack(90), 22050)
    const b120 = detectBpmFromSamples(makeKickTrack(120), 22050)
    const b140 = detectBpmFromSamples(makeKickTrack(140), 22050)
    expect(Math.abs((b90 ?? 0) - 90)).toBeLessThanOrEqual(2)
    expect(Math.abs((b120 ?? 0) - 120)).toBeLessThanOrEqual(2)
    expect(Math.abs((b140 ?? 0) - 140)).toBeLessThanOrEqual(3)
  })

  test('djFxService beat patterns have valid 16-step grids and accurate BPM step timing', () => {
    for (const pattern of Object.values(BEAT_PATTERNS)) {
      expect(pattern.kick.length).toBe(16)
      expect(pattern.snare.length).toBe(16)
      expect(pattern.hat.length).toBe(16)
      expect(pattern.clap.length).toBe(16)
    }
    expect(stepDurationSeconds(120)).toBeCloseTo(0.125, 4) // 16th note at 120 BPM = 125ms
    expect(stepDurationSeconds(90)).toBeCloseTo(0.1667, 3)
  })
})
