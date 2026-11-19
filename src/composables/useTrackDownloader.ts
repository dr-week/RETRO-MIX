import { ref, type Ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import type { Track, DiscoveryTrack, YouTubeResult, Section, DownloadTask } from '../types/music'
import { AudioBridge, persistTrack, removeStoredTrack } from '../services/storageService'

export function useTrackDownloader(tracks: Ref<Track[]>, activeTab: Ref<Section>) {
  const downloading = ref<string | null>(null)
  const downloadError = ref('')
  const importing = ref(false)
  const activeDownloads = ref<DownloadTask[]>([])

  async function saveAndSelect(track: Track, source: Blob | string, kind: 'import' | 'download' = 'download') {
    await persistTrack(track, source, kind)
    const idx = tracks.value.findIndex(item => item.id === track.id)
    if (idx >= 0) tracks.value.splice(idx, 1, track)
    else tracks.value.push(track)
    if (kind === 'download') activeTab.value = 'downloads'
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

  async function downloadYouTube(result: YouTubeResult) {
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
        await saveAndSelect({ id, title: result.title, artist: result.artist, album: 'YouTube · MP3', duration: result.duration, cover: result.cover, src: saved.uri, nativeUri: saved.uri, local: true, size: saved.size }, saved.uri)
      } else {
        const res = await fetch('/api/youtube/convert', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: result.url, title: result.title })
        })
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `Conversion failed (${res.status}).`)
        const blob = await res.blob()
        if (!blob.size || !blob.type.includes('audio')) throw new Error('Backend did not return MP3 audio.')
        await saveAndSelect({ id, title: result.title, artist: result.artist, album: 'YouTube · MP3', duration: result.duration, cover: result.cover, src: URL.createObjectURL(blob), local: true, size: blob.size }, blob)
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

  async function downloadArchive(track: DiscoveryTrack) {
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
        await saveAndSelect({ id, title: track.title, artist: track.artist, album: track.album, duration: track.duration, src: saved.uri, nativeUri: saved.uri, cover: track.cover, local: true, size: saved.size }, saved.uri)
      } else {
        const res = await fetch(track.downloadUrl)
        if (!res.ok) throw new Error(`Music download failed (${res.status}).`)
        const blob = await res.blob()
        if (!blob.size || blob.size > 150_000_000 || blob.type.includes('text/html')) throw new Error('The source did not return a valid audio file.')
        await saveAndSelect({ id, title: track.title, artist: track.artist, album: track.album, duration: track.duration, src: URL.createObjectURL(blob), cover: track.cover, local: true, size: blob.size }, blob)
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

  async function importMp3Files(event: Event) {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files ?? []).filter(f => f.name.toLowerCase().endsWith('.mp3'))
    if (!files.length) return
    importing.value = true
    try {
      for (const file of files) {
        const id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        const base = file.name.replace(/\.mp3$/i, '').trim()
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

  return { downloading, downloadError, importing, activeDownloads, downloadYouTube, downloadArchive, importMp3Files, removeOffline }
}
