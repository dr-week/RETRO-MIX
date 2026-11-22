import { ref, watch, type Ref } from 'vue'
import type { AutoDjMode, Track } from '../types/music'
import { getSimilarTracks } from '../services/similarityService'
import { queryArchiveMusic } from '../services/musicDiscoveryService'
import { detectGenre } from '../services/playlistService'
import type { useMixer } from './useMixer'

type MixerApi = ReturnType<typeof useMixer>

export function useAutoDj(
  mixer: MixerApi,
  tracks: Ref<Track[]>,
  onPrefetch?: (upcoming: Track[]) => void
) {
  const mode = ref<AutoDjMode>('off')
  const queue = ref<Track[]>([])
  const status = ref('')
  const playedIds = new Set<string>()
  let playlistSource: Track[] = []
  let loadingEndless = false
  let triggeringMix = false

  function playableCatalog(): Track[] {
    return tracks.value.filter(t => Boolean(t.src) && t.rating !== 'dislike')
  }

  async function replenishQueue(seed?: Track | null) {
    if (mode.value === 'off') return
    const active = seed ?? mixer.decks[mixer.activeDeck.value].track ?? playableCatalog()[0]
    if (!active) return

    const exclude = new Set<string>([
      ...playedIds,
      active.id,
      ...queue.value.map(t => t.id)
    ])
    const idleTrack = mixer.decks[mixer.idleDeck.value].track
    if (idleTrack) exclude.add(idleTrack.id)

    if (mode.value === 'playlist') {
      const remaining = playlistSource.filter(t => t.src && !exclude.has(t.id))
      if (remaining.length) queue.value.push(...remaining.slice(0, 6))
    } else {
      const similar = getSimilarTracks(active, playableCatalog(), exclude, 6)
      queue.value.push(...similar)

      // Endless mode: fetch more matching tracks from Discover if local pool runs low
      if (mode.value === 'endless' && queue.value.length < 3 && !loadingEndless) {
        loadingEndless = true
        status.value = 'Finding more similar tracks…'
        try {
          const genre = active.genre || detectGenre(active)
          const q = `${active.artist} ${genre}`.trim()
          const found = await queryArchiveMusic(q)
          for (const item of found) {
            const id = `archive-${item.id}`
            if (exclude.has(id)) continue
            const track: Track = {
              id,
              title: item.title,
              artist: item.artist,
              album: item.album || 'Open-license music',
              duration: item.duration,
              cover: item.cover,
              src: item.downloadUrl,
              genre
            }
            exclude.add(id)
            if (!tracks.value.some(t => t.id === id)) tracks.value.push(track)
            queue.value.push(track)
            if (queue.value.length >= 6) break
          }
        } catch {
          // Stay resilient if offline
        } finally {
          loadingEndless = false
          status.value = ''
        }
      }
    }

    // Background pre-fetch next 2 queued tracks so crossfades never stall
    if (queue.value.length) onPrefetch?.(queue.value.slice(0, 2))
  }

  async function cueNextOnIdleDeck() {
    if (mode.value === 'off' || mixer.autoMixing.value) return
    const idle = mixer.idleDeck.value
    if (mixer.decks[idle].playing) return
    if (!queue.value.length) await replenishQueue()
    const next = queue.value[0]
    if (!next) return
    if (mixer.decks[idle].track?.id !== next.id) {
      await mixer.load(idle, next)
    }
  }

  async function startMode(nextMode: AutoDjMode, options: { seed?: Track; playlist?: Track[] } = {}) {
    mode.value = nextMode
    if (nextMode === 'off') {
      status.value = ''
      return
    }
    playedIds.clear()
    queue.value = []
    playlistSource = options.playlist ?? playableCatalog()

    const activeId = mixer.activeDeck.value
    const startTrack = options.seed ?? mixer.decks[activeId].track ?? playlistSource[0] ?? playableCatalog()[0]
    if (!startTrack) {
      status.value = 'No streamable tracks available for Auto-DJ.'
      return
    }

    playedIds.add(startTrack.id)
    if (mixer.decks[activeId].track?.id !== startTrack.id) {
      await mixer.load(activeId, startTrack)
    }
    if (!mixer.decks[activeId].playing) {
      await mixer.toggle(activeId)
    }
    await replenishQueue(startTrack)
    await cueNextOnIdleDeck()
    status.value = `Auto-DJ active (${nextMode})`
  }

  async function mixNextNow() {
    if (triggeringMix || mixer.autoMixing.value) return
    triggeringMix = true
    try {
      const idle = mixer.idleDeck.value
      if (!mixer.decks[idle].track) await cueNextOnIdleDeck()
      const incoming = mixer.decks[idle].track
      if (!incoming) return
      if (queue.value[0]?.id === incoming.id) queue.value.shift()
      playedIds.add(incoming.id)
      await mixer.autoMix()
      await replenishQueue(incoming)
      await cueNextOnIdleDeck()
    } finally {
      triggeringMix = false
    }
  }

  // Watch active deck progress to trigger smooth crossfade near track end
  watch(
    () => {
      const d = mixer.decks[mixer.activeDeck.value]
      return { playing: d.playing, time: d.time, duration: d.duration }
    },
    ({ playing, time, duration }) => {
      if (mode.value === 'off' || !playing || mixer.autoMixing.value || triggeringMix) return
      if (!duration || duration < 12) return
      const remaining = duration - time
      const triggerAt = Math.min(mixer.autoMixSeconds.value + 1.2, duration * 0.35)
      if (remaining <= triggerAt && remaining > 0.2) {
        void mixNextNow()
      }
    }
  )

  return { mode, queue, status, startMode, mixNextNow, replenishQueue }
}
