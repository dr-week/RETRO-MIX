import { onBeforeUnmount, ref, watch } from 'vue'
import type { DiscoveryTrack, Track, YouTubeResult } from '../types/music'
import { queryArchiveMusic, queryYouTubeMusic } from '../services/musicDiscoveryService'
import { loadPopularMusic, type TrendTrack } from '../services/popularMusicService'

export function useDiscovery(selectTrack: (track: Track) => void, openPlayer: () => void) {
  const discoverQuery = ref('')
  const discoverTracks = ref<DiscoveryTrack[]>([])
  const youtubeTracks = ref<YouTubeResult[]>([])
  const searching = ref(false)
  const discoverError = ref('')
  const downloading = ref<string | null>(null)
  const trends = ref<TrendTrack[]>([])
  const loadingTrends = ref(false)
  const trendError = ref('')
  let searchTimer: ReturnType<typeof setTimeout> | undefined
  let searchRequest = 0
  let trendRequest = 0

  async function refreshTrends() {
    const request = ++trendRequest
    loadingTrends.value = true
    trendError.value = ''
    try {
      const next = await loadPopularMusic()
      if (request === trendRequest) trends.value = next
    } catch {
      if (request === trendRequest) { trends.value = []; trendError.value = 'Popular music is unavailable. Try again.' }
    } finally {
      if (request === trendRequest) loadingTrends.value = false
    }
  }

  watch(discoverQuery, value => {
    clearTimeout(searchTimer)
    clearDiscovery()
    if (value.trim()) searchTimer = setTimeout(() => { void searchMusic() }, 350)
  })
  void refreshTrends()
  onBeforeUnmount(() => { clearTimeout(searchTimer); searchRequest++; trendRequest++ })

  async function searchMusic() {
    const term = discoverQuery.value.trim()
    if (!term) return
    const request = ++searchRequest
    searching.value = true
    discoverError.value = ''
    discoverTracks.value = []
    youtubeTracks.value = []
    try {
      const archive = queryArchiveMusic(term).then(tracks => {
        if (request === searchRequest) discoverTracks.value = tracks
        return tracks
      })
      const youtube = queryYouTubeMusic(term).then(tracks => {
        if (request === searchRequest) youtubeTracks.value = tracks
        return tracks
      })
      const [openAudio, videoSearch] = await Promise.allSettled([archive, youtube])
      if (request !== searchRequest) return
      if (openAudio.status === 'fulfilled') discoverTracks.value = openAudio.value
      if (videoSearch.status === 'fulfilled') youtubeTracks.value = videoSearch.value
      if (!discoverTracks.value.length && !youtubeTracks.value.length) {
        const failure = videoSearch.status === 'rejected' ? videoSearch.reason : openAudio.status === 'rejected' ? openAudio.reason : null
        if (failure) discoverError.value = failure instanceof Error ? failure.message : 'Search is unavailable.'
      }
    } finally { if (request === searchRequest) searching.value = false }
  }

  function clearDiscovery() {
    searchRequest++
    searching.value = false
    discoverTracks.value = []
    youtubeTracks.value = []
    discoverError.value = ''
  }
  async function playTrend(track: TrendTrack) {
    const selected: Track = {
      id: `archive-${track.id}`, title: track.title, artist: track.artist,
      album: 'Open-license music', duration: track.duration, cover: track.cover,
      src: track.downloadUrl
    }
    selectTrack(selected)
    openPlayer()
  }

  return { discoverQuery, discoverTracks, youtubeTracks, searching, discoverError, downloading, trends, loadingTrends, trendError, searchMusic, clearDiscovery, playTrend }
}
