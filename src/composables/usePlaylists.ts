import { computed, ref, type Ref } from 'vue'
import type { GeneratedPlaylist, Track } from '../types/music'
import { savePlaylist, deletePlaylist } from '../services/storageService'
import { buildPromptPlaylist, getBecauseYouPlayed, getMoreLikeYourLikes } from '../services/similarityService'
import { queryArchiveMusic } from '../services/musicDiscoveryService'
import { detectGenre } from '../services/playlistService'

export function usePlaylists(
  tracks: Ref<Track[]>,
  playlists: Ref<GeneratedPlaylist[]>,
  recentTracks: Ref<Track[]>,
  currentTrack: Ref<Track | undefined>
) {
  const aiGenerating = ref(false)
  const aiStatus = ref('')

  const manualPlaylists = computed(() => playlists.value.filter(p => p.kind === 'manual' || p.kind === 'ai'))
  const smartPlaylists = computed(() => playlists.value.filter(p => !p.kind || p.kind === 'smart'))

  const seedTrack = computed(() => currentTrack.value ?? recentTracks.value[0])
  const becauseYouPlayed = computed(() => getBecauseYouPlayed(seedTrack.value, tracks.value, 8))
  const moreLikeYourLikes = computed(() =>
    getMoreLikeYourLikes(tracks.value, recentTracks.value.map(t => t.id), 8)
  )

  async function persist(pl: GeneratedPlaylist) {
    const idx = playlists.value.findIndex(p => p.id === pl.id)
    if (idx >= 0) playlists.value.splice(idx, 1, pl)
    else playlists.value.unshift(pl)
    try {
      await savePlaylist(pl)
    } catch (err) {
      console.error('Could not save playlist', err)
    }
  }

  async function createPlaylist(
    name: string,
    options: { description?: string; genre?: string; trackIds?: string[]; kind?: 'manual' | 'ai'; prompt?: string } = {}
  ): Promise<GeneratedPlaylist> {
    const cleanName = name.trim() || 'Untitled Playlist'
    const ids = options.trackIds ?? []
    const cover = tracks.value.find(t => ids.includes(t.id) && t.cover)?.cover
    const pl: GeneratedPlaylist = {
      id: `${options.kind ?? 'manual'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      description: options.description || (options.kind === 'ai' ? `AI mix for "${options.prompt ?? cleanName}"` : 'Custom playlist'),
      genre: options.genre || 'Custom',
      kind: options.kind ?? 'manual',
      prompt: options.prompt,
      cover,
      trackIds: [...ids],
      createdAt: Date.now()
    }
    await persist(pl)
    return pl
  }

  async function renamePlaylist(id: string, name: string) {
    const pl = playlists.value.find(p => p.id === id)
    if (!pl || !name.trim()) return
    await persist({ ...pl, name: name.trim() })
  }

  async function removePlaylist(id: string) {
    playlists.value = playlists.value.filter(p => p.id !== id)
    try {
      await deletePlaylist(id)
    } catch (err) {
      console.error('Could not delete playlist', err)
    }
  }

  async function addTrackToPlaylist(playlistId: string, track: Track) {
    const pl = playlists.value.find(p => p.id === playlistId)
    if (!pl) return
    if (!tracks.value.some(t => t.id === track.id)) tracks.value.push(track)
    if (pl.trackIds.includes(track.id)) return
    const next: GeneratedPlaylist = {
      ...pl,
      cover: pl.cover || track.cover,
      trackIds: [...pl.trackIds, track.id]
    }
    await persist(next)
  }

  async function removeTrackFromPlaylist(playlistId: string, index: number) {
    const pl = playlists.value.find(p => p.id === playlistId)
    if (!pl || index < 0 || index >= pl.trackIds.length) return
    const nextIds = [...pl.trackIds]
    nextIds.splice(index, 1)
    await persist({ ...pl, trackIds: nextIds })
  }

  async function reorderPlaylistTrack(playlistId: string, fromIndex: number, toIndex: number) {
    const pl = playlists.value.find(p => p.id === playlistId)
    if (!pl || fromIndex === toIndex || toIndex < 0 || toIndex >= pl.trackIds.length) return
    const nextIds = [...pl.trackIds]
    const [moved] = nextIds.splice(fromIndex, 1)
    nextIds.splice(toIndex, 0, moved)
    await persist({ ...pl, trackIds: nextIds })
  }

  async function tryBackendAiPlaylist(prompt: string, catalog: Track[]): Promise<{ title?: string; trackIds?: string[]; searchQueries?: string[] } | null> {
    try {
      const compact = catalog.slice(0, 120).map(t => ({
        id: t.id, title: t.title, artist: t.artist, genre: t.genre || detectGenre(t), liked: Boolean(t.rating === 'like' || t.favorite)
      }))
      const res = await fetch('/api/ai/playlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, library: compact })
      })
      if (!res.ok) return null
      const data = await res.json()
      if (data?.fallback) return null
      return data
    } catch {
      return null
    }
  }

  async function generateAiPlaylist(prompt: string, includeDiscover = true): Promise<GeneratedPlaylist | null> {
    const clean = prompt.trim()
    if (!clean || aiGenerating.value) return null
    aiGenerating.value = true
    aiStatus.value = 'Building playlist…'
    try {
      const localResult = buildPromptPlaylist(clean, tracks.value)
      let chosen: Track[] = localResult.tracks
      let title = localResult.parsed.title
      let searchQueries: string[] = [clean]

      // Phase B: optional backend LLM if running with API key
      const remote = await tryBackendAiPlaylist(clean, tracks.value)
      if (remote) {
        if (remote.title) title = remote.title
        if (Array.isArray(remote.trackIds) && remote.trackIds.length) {
          const byId = new Map(tracks.value.map(t => [t.id, t]))
          const matched = remote.trackIds.map(id => byId.get(id)).filter((t): t is Track => Boolean(t))
          if (matched.length) chosen = matched
        }
        if (Array.isArray(remote.searchQueries) && remote.searchQueries.length) {
          searchQueries = remote.searchQueries.slice(0, 2)
        }
      }

      // Supplement with Discover (archive.org) when local library has fewer than requested tracks
      if (includeDiscover && chosen.length < localResult.parsed.count) {
        aiStatus.value = 'Searching Discover for matching tracks…'
        const existingIds = new Set(chosen.map(t => t.id))
        for (const q of searchQueries) {
          try {
            const found = await queryArchiveMusic(q)
            for (const item of found) {
              if (chosen.length >= localResult.parsed.count) break
              const id = `archive-${item.id}`
              if (existingIds.has(id)) continue
              const track: Track = {
                id,
                title: item.title,
                artist: item.artist,
                album: item.album || 'Open-license music',
                duration: item.duration,
                cover: item.cover,
                src: item.downloadUrl,
                genre: localResult.parsed.genre !== 'Mix' ? localResult.parsed.genre : detectGenre({
                  id, title: item.title, artist: item.artist, album: item.album, duration: item.duration, src: item.downloadUrl
                })
              }
              existingIds.add(id)
              if (!tracks.value.some(t => t.id === id)) tracks.value.push(track)
              chosen.push(track)
            }
          } catch {
            // Continue with local matches if network/Discover fails
          }
        }
      }

      if (!chosen.length) {
        aiStatus.value = 'No matching tracks found.'
        return null
      }

      const created = await createPlaylist(title, {
        description: `AI playlist from "${clean}" (${chosen.length} tracks)`,
        genre: localResult.parsed.genre,
        trackIds: chosen.map(t => t.id),
        kind: 'ai',
        prompt: clean
      })
      aiStatus.value = `Created "${created.name}" (${created.trackIds.length} tracks)`
      return created
    } finally {
      aiGenerating.value = false
    }
  }

  return {
    manualPlaylists,
    smartPlaylists,
    seedTrack,
    becauseYouPlayed,
    moreLikeYourLikes,
    aiGenerating,
    aiStatus,
    createPlaylist,
    renamePlaylist,
    removePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    reorderPlaylistTrack,
    generateAiPlaylist
  }
}
