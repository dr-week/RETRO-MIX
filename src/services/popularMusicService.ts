import { queryArchiveMusic } from './musicDiscoveryService'

export type TrendTrack = {
  id: string
  title: string
  artist: string
  cover: string
  duration: number
  license: string
  downloadUrl: string
}

export async function loadPopularMusic(): Promise<TrendTrack[]> {
  const key = 'retro-mix-open-audio-trending-v2'
  const cached = typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
  if (cached) {
    try {
      const value = JSON.parse(cached) as { at: number; tracks: TrendTrack[] }
      const tracks = value.tracks.filter(isMusicTrack)
      if (Date.now() - value.at < 60 * 60 * 1000) return tracks
    } catch { localStorage.removeItem(key) }
  }
  const tracks = (await queryArchiveMusic('', true)).map(track => ({
    id: track.id, title: track.title, artist: track.artist, cover: track.cover,
    duration: track.duration, license: track.license, downloadUrl: track.downloadUrl
  })).filter(isMusicTrack).slice(0, 10)
  if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify({ at: Date.now(), tracks }))
  return tracks
}

function isMusicTrack(track: TrendTrack): boolean {
  return track.duration >= 90 && track.duration <= 1800 &&
    !/\b(lectures?|audiobooks?|podcasts?|sermons?|quran|recitations?|speeches|books?|porn|adult|xxx|sex|charts?|various artists)\b/i.test(`${track.title} ${track.artist}`)
}
