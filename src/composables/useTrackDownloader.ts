import { ref, type Ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import type { Track, DiscoveryTrack, YouTubeResult, Section, DownloadTask } from '../types/music'
import { AudioBridge, fetchPlayHistory, persistTrack, removeStoredTrack } from '../services/storageService'

const STORAGE_CAP_KEY = 'retromix-storage-cap-mb'
const DEFAULT_CAP_MB = 500

export function useTrackDownloader(tracks: Ref<Track[]>, activeTab: Ref<Section>, currentTrackId?: Ref<string | undefined>) {
  const downloading = ref<string | null>(null)
  const downloadError = ref('')
  const importing = ref(false)
  const activeDownloads = ref<DownloadTask[]>([])
  const storageCapMb = ref<number>(Math.max(50, Number(localStorage.getItem(STORAGE_CAP_KEY)) || DEFAULT_CAP_MB))

  function setStorageCapMb(mb: number) {
    const clamped = Math.max(50, Math.min(5000, Math.round(mb)))
    storageCapMb.value = clamped
    localStorage.setItem(STORAGE_CAP_KEY, String(clamped))
    void enforceStorageCap()
  }

  async function enforceStorageCap(protectedId?: string) {
    const capBytes = storageCapMb.value * 1024 * 1024
    const offline = tracks.value.filter(t => t.local)
    let total = offline.reduce((sum, t) => sum + (t.size ?? 0), 0)
    if (total <= capBytes) return

    const history = await fetchPlayHistory().catch(() => [])
    const lastPlayed = new Map<string, number>()
    for (const h of history) {
      const prev = lastPlayed.get(h.id) ?? 0
      if (h.playedAt > prev) lastPlayed.set(h.id, h.playedAt)
    }

    const candidates = offline
      .filter(t => t.id !== protectedId && t.id !== currentTrackId?.value)
      .sort((a, b) => (lastPlayed.get(a.id) ?? 0) - (lastPlayed.get(b.id) ?? 0))

    for (const victim of candidates) {
      if (total <= capBytes) break
      try {
        await removeStoredTrack(victim)
        total -= victim.size ?? 0
        tracks.value = tracks.value.filter(t => t.id !== victim.id)
      } catch {
        break
      }
    }
  }

  async function saveAndSelect(track: Track, source: Blob | string, kind: 'import' | 'download' = 'download', silent = false) {
    await persistTrack(track, source, kind)
    const idx = tracks.value.findIndex(item => item.id === track.id)
    if (idx >= 0) tracks.value.splice(idx, 1, track)
    else tracks.value.push(track)
    if (kind === 'download' && !silent) activeTab.value = 'downloads'
    await enforceStorageCap(track.id)
  }

  function startTask(id: string, title: string, artist: string): DownloadTask {
    const existing = activeDownloads.value.find(t => t.id === id)
    if (existing) { existing.progress = 5; existing.status = 'downloading'; return existing }
    const task: DownloadTask = { id, title, artist, progress: 5, status: 'downloading', estimatedSeconds: 8 }
    activeDownloads.value.push(task)
    return task
  }

  function completeTask(id: string) {
    const task = activeDownloads.value.find(t => t.id === id)
    if (task) { task.progress = 100; task.status = 'done'; task.estimatedSeconds = 0 }
    setTimeout(() => { activeDownloads.value = activeDownloads.value.filter(t => t.id !== id) }, 2000)
  }

  function failTask(id: string, message: string) {
    const task = activeDownloads.value.find(t => t.id === id)
    if (task) { task.status = 'error'; task.error = message }
    setTimeout(() => { activeDownloads.value = activeDownloads.value.filter(t => t.id !== id) }, 4000)
  }

  async function downloadYouTube(result: YouTubeResult, silent = false) {
    downloading.value = result.id
    downloadError.value = ''
    const task = startTask(result.id, result.title, result.artist)
    const timer = setInterval(() => {
      if (task.progress < 75) {
        task.progress += 8
        task.estimatedSeconds = Math.max(1, Math.round((100 - task.progress) / 10))
      } else if (task.progress < 92) {
        task.status = 'converting'
        task.progress += 3
        task.estimatedSeconds = 2
      }
    }, 600)
    try {
      const id = `youtube-${result.id}`
      if (Capacitor.isNativePlatform()) {
        const saved = await AudioBridge.downloadYouTube({ url: result.url, id: result.id, title: result.title })
        await saveAndSelect({ id, title: result.title, artist: result.artist, album: 'YouTube · MP3', duration: result.duration, cover: result.cover, src: saved.uri, nativeUri: saved.uri, local: true, size: saved.size }, saved.uri, 'download', silent)
      } else {
        const res = await fetch('/api/youtube/convert', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: result.url, title: result.title })
        })
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `Conversion failed (${res.status}).`)
        const blob = await res.blob()
        if (!blob.size || !blob.type.includes('audio')) throw new Error('Backend did not return MP3 audio.')
        await saveAndSelect({ id, title: result.title, artist: result.artist, album: 'YouTube · MP3', duration: result.duration, cover: result.cover, src: URL.createObjectURL(blob), local: true, size: blob.size }, blob, 'download', silent)
      }
      completeTask(result.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Could not download “${result.title}”.`
      downloadError.value = msg
      failTask(result.id, msg)
    } finally {
      clearInterval(timer)
      downloading.value = null
    }
  }

  async function downloadArchive(track: DiscoveryTrack, silent = false) {
    downloading.value = track.id
    downloadError.value = ''
    const task = startTask(track.id, track.title, track.artist)
    const timer = setInterval(() => {
      if (task.progress < 90) {
        task.progress += 10
        task.estimatedSeconds = Math.max(1, Math.round((100 - task.progress) / 12))
      }
    }, 500)
    try {
      const id = `archive-${track.id}`
      if (Capacitor.isNativePlatform()) {
        const saved = await AudioBridge.downloadFile({ url: track.downloadUrl, title: track.title })
        await saveAndSelect({ id, title: track.title, artist: track.artist, album: track.album, duration: track.duration, src: saved.uri, nativeUri: saved.uri, cover: track.cover, local: true, size: saved.size }, saved.uri, 'download', silent)
      } else {
        const res = await fetch(track.downloadUrl)
        if (!res.ok) throw new Error(`Music download failed (${res.status}).`)
        const blob = await res.blob()
        if (!blob.size || blob.size > 150_000_000 || blob.type.includes('text/html')) throw new Error('The source did not return a valid audio file.')
        await saveAndSelect({ id, title: track.title, artist: track.artist, album: track.album, duration: track.duration, src: URL.createObjectURL(blob), cover: track.cover, local: true, size: blob.size }, blob, 'download', silent)
      }
      completeTask(track.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Could not download “${track.title}”.`
      downloadError.value = msg
      failTask(track.id, msg)
    } finally {
      clearInterval(timer)
      downloading.value = null
    }
  }

  // Auto-download: cache streamed tracks the user plays or queues so they are available offline.
  const autoDownload = ref(localStorage.getItem('autoDownload') !== 'off')
  const autoTried = new Set<string>()
  function setAutoDownload(on: boolean) { autoDownload.value = on; localStorage.setItem('autoDownload', on ? 'on' : 'off') }

  async function autoDownloadTrack(track?: Track | null) {
    if (!autoDownload.value || !track || track.local || autoTried.has(track.id)) return
    if (tracks.value.some(t => t.id === track.id && t.local)) return
    autoTried.add(track.id)
    try {
      if (track.youtubeUrl) {
        const vid = track.id.replace(/^youtube-/, '')
        await downloadYouTube({ id: vid, title: track.title, artist: track.artist, duration: track.duration, cover: track.cover ?? '', url: track.youtubeUrl }, true)
      } else if (/^https?:/.test(track.src)) {
        await downloadArchive({ id: track.id.replace(/^archive-/, ''), title: track.title, artist: track.artist, album: track.album, duration: track.duration, cover: track.cover ?? '', link: '', license: '', downloadUrl: track.src }, true)
      }
    } catch { /* failures are surfaced via downloadError / task list */ }
  }

  // Pre-fetch up to 2 upcoming queued tracks in the background so DJ crossfades never stall.
  let prefetchRunning = false
  async function prefetchTracks(upcoming: Track[]) {
    if (!autoDownload.value || prefetchRunning) return
    const targets = upcoming.filter(t => !t.local && !autoTried.has(t.id)).slice(0, 2)
    if (!targets.length) return
    prefetchRunning = true
    try {
      for (const track of targets) {
        if (!autoDownload.value) break
        await autoDownloadTrack(track)
      }
    } finally {
      prefetchRunning = false
    }
  }

  async function importMp3Files(event: Event) {
    const input = event.target as HTMLInputElement
    const audioRe = /\.(mp3|m4a|wav|ogg|flac|aac|opus)$/i
    const files = Array.from(input.files ?? []).filter(f => audioRe.test(f.name) || f.type.startsWith('audio/'))
    if (!files.length) return
    importing.value = true
    try {
      for (const file of files) {
        const id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        const base = file.name.replace(audioRe, '').trim()
        const [artist, title] = base.includes(' - ') ? base.split(' - ') : ['Local Storage', base]
        const track: Track = { id, title: title.trim(), artist: artist.trim(), album: 'Local Audio', duration: 0, src: URL.createObjectURL(file), local: true, size: file.size }
        await saveAndSelect(track, file, 'import')
      }
    } finally {
      importing.value = false
      input.value = ''
    }
  }

  async function removeOffline(track: Track, onRemovedCurrent?: () => void) {
    await removeStoredTrack(track)
    tracks.value = tracks.value.filter(t => t.id !== track.id)
    onRemovedCurrent?.()
  }

  return {
    autoDownload, setAutoDownload, autoDownloadTrack, prefetchTracks,
    storageCapMb, setStorageCapMb,
    downloading, downloadError, importing, activeDownloads,
    downloadYouTube, downloadArchive, importMp3Files, removeOffline
  }
}
