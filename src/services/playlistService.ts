import type { Track, GeneratedPlaylist } from '../types/music'
import { savePlaylist, fetchPlaylists } from './storageService'

const GENRE_RULES: Array<{ genre: string; keywords: string[] }> = [
  { genre: 'Chill', keywords: ['chill', 'lofi', 'relax', 'ambient', 'calm', 'night', 'sleep', 'soft', 'slow', 'peace', 'dream', 'quiet'] },
  { genre: 'Pop', keywords: ['pop', 'dance', 'hit', 'party', 'disco', 'club', 'beat', 'groove', 'synth', 'electro'] },
  { genre: 'Acoustic', keywords: ['acoustic', 'piano', 'guitar', 'unplugged', 'folk', 'orchestra', 'classical', 'strings', 'violin'] },
  { genre: 'Energy', keywords: ['energy', 'rock', 'bass', 'workout', 'fast', 'hard', 'hype', 'dubstep', 'rap', 'hip hop'] },
  { genre: 'Indie', keywords: ['indie', 'retro', 'wave', 'soul', 'jazz', 'blues', 'vintage', 'classic', 'alt'] }
]

export function detectGenre(track: Track): string {
  if (track.genre) return track.genre
  const text = `${track.title} ${track.artist} ${track.album}`.toLowerCase()
  for (const rule of GENRE_RULES) {
    if (rule.keywords.some(kw => text.includes(kw))) return rule.genre
  }
  return 'Chill'
}

export function generateSmartPlaylists(tracks: Track[]): GeneratedPlaylist[] {
  if (!tracks.length) return []
  const enriched = tracks.map(t => ({ ...t, genre: detectGenre(t) }))
  const buckets: Record<string, Track[]> = { Chill: [], Pop: [], Acoustic: [], Energy: [], Indie: [] }
  for (const track of enriched) {
    const g = track.genre && buckets[track.genre] ? track.genre : 'Chill'
    buckets[g].push(track)
  }
  const descriptions: Record<string, string> = {
    Chill: 'Mellow grooves, quiet beats & late night vibes.',
    Pop: 'Upbeat tracks, hook-laden melodies & rhythms.',
    Acoustic: 'Organic instruments, warm tones & melodies.',
    Energy: 'High tempo, pulse-driving tracks & bass.',
    Indie: 'Atmospheric, retro soundscapes & deep cuts.'
  }
  const playlists: GeneratedPlaylist[] = []
  for (const [genre, list] of Object.entries(buckets)) {
    const count = list.length
    if (count === 0) continue
    const shuffled = [...list].sort(() => 0.5 - Math.random())
    const cover = shuffled.find(t => t.cover)?.cover
    playlists.push({
      id: `mix-${genre.toLowerCase()}-${Date.now().toString(36)}`,
      name: `${genre} Mix`,
      description: descriptions[genre] || `${genre} selections just for you.`,
      genre,
      cover,
      trackIds: shuffled.slice(0, 15).map(t => t.id),
      createdAt: Date.now()
    })
  }
  return playlists
}

export async function syncSmartPlaylists(tracks: Track[]): Promise<GeneratedPlaylist[]> {
  const existing = await fetchPlaylists()
  if (existing.length > 0 && Math.random() > 0.4) return existing
  const fresh = generateSmartPlaylists(tracks)
  for (const pl of fresh) await savePlaylist(pl)
  return fresh
}
