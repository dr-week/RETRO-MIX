import { computed, ref, type Ref } from 'vue'
import type { Track, GeneratedPlaylist } from '../types/music'
import { fetchAllStoredTracks, fetchPlayHistory, fetchTrackRatings, saveTrackRating } from '../services/storageService'
import { detectGenre, syncSmartPlaylists } from '../services/playlistService'

const seed: Track[] = [
  { id: 'archive-vexento-spark', title: 'Spark', artist: 'Vexento', album: 'Creative Commons · BY 4.0', duration: 208, genre: 'Pop', src: 'https://archive.org/download/vexento-spark/Vexento-Spark.mp3', cover: 'https://archive.org/services/img/vexento-spark' },
  { id: 'archive-kai-engel-maree', title: 'Maree', artist: 'Kai Engel', album: 'Creative Commons · BY 4.0', duration: 245, genre: 'Acoustic', src: 'https://archive.org/download/kai-engel-maree/KaiEngel-Maree.mp3', cover: 'https://archive.org/services/img/kai-engel-maree' },
  { id: 'archive-leonard-richter-crime-time', title: 'Crime Time', artist: 'Leonard Richter', album: 'Creative Commons · BY 4.0', duration: 215, genre: 'Energy', src: 'https://archive.org/download/leonard-richter-crime-time/LeonardRichter-CrimeTime.mp3', cover: 'https://archive.org/services/img/leonard-richter-crime-time' },
]

export function useLibrary(tracks: Ref<Track[]>, trends: Ref<any[]>) {
  const recentIds = ref<string[]>([])
  const query = ref('')
  const offlineQuery = ref('')
  const playlists = ref<GeneratedPlaylist[]>([])

  const filteredTracks = computed(() => tracks.value.filter(t => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(query.value.toLowerCase())))
  const recentTracks = computed(() => recentIds.value.map(id => tracks.value.find(t => t.id === id)).filter((t): t is Track => !!t).slice(0, 5))
  const offlineTracks = computed(() => tracks.value.filter(t => t.local && `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(offlineQuery.value.toLowerCase())))
  const offlineSize = computed(() => tracks.value.filter(t => t.local).reduce((sum, t) => sum + (t.size ?? 0), 0))

  const suggestedTracks = computed(() => {
    const likedArtists = tracks.value.filter(t => t.rating === 'like' || t.favorite).map(t => t.artist.toLowerCase())
    const recentArtists = recentTracks.value.map(t => t.artist.toLowerCase())
    const rated = new Map(tracks.value.map(t => [t.id, t.rating]))
    const catalog: Track[] = [...tracks.value, ...trends.value.map(t => ({
      id: `archive-${t.id}`, title: t.title, artist: t.artist, album: 'Open-license music', duration: t.duration, cover: t.cover, src: t.downloadUrl, genre: detectGenre(t)
    }))].filter((track, index, all) => all.findIndex(item => item.id === track.id) === index)
    return catalog.filter(t => rated.get(t.id) !== 'dislike' && rated.get(t.id) !== 'like' && !t.favorite)
      .sort((a, b) => (likedArtists.includes(b.artist.toLowerCase()) ? 2 : 0) + (recentArtists.includes(b.artist.toLowerCase()) ? 1 : 0) - ((likedArtists.includes(a.artist.toLowerCase()) ? 2 : 0) + (recentArtists.includes(a.artist.toLowerCase()) ? 1 : 0)))
      .slice(0, 12)
  })

  async function initLibrary() {
    const saved = await fetchAllStoredTracks()
    const history = await fetchPlayHistory()
    const ratings = await fetchTrackRatings()
    recentIds.value = history.sort((a, b) => b.playedAt - a.playedAt).map(h => h.id)
    const restored = [...seed, ...saved.filter(s => !seed.some(t => t.id === s.id)).map(s => ({
      ...s,
      genre: s.genre || detectGenre(s as any),
      src: typeof s.src === 'string' ? s.src : URL.createObjectURL(s.src)
    }))]
    for (const rating of ratings) {
      const existing = restored.find(track => track.id === rating.id)
      if (existing) Object.assign(existing, { rating: rating.rating, favorite: rating.favorite })
      else if (!rating.local) restored.push({ ...rating, genre: rating.genre || detectGenre(rating as any) })
    }
    tracks.value = restored
    try { playlists.value = await syncSmartPlaylists(restored) } catch { /* ignore */ }
  }

  async function rateTrack(track: Track, rating: 'like' | 'dislike') {
    const next = track.rating === rating ? undefined : rating
    Object.assign(track, { rating: next, favorite: next === 'like' })
    if (!tracks.value.some(item => item.id === track.id)) tracks.value.push(track)
    try { await saveTrackRating(track, next) } catch (error) { console.error('Could not save track feedback', error) }
  }

  return { query, offlineQuery, playlists, filteredTracks, recentTracks, suggestedTracks, offlineTracks, offlineSize, initLibrary, rateTrack }
}
