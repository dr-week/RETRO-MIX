import type { GeneratedPlaylist, Track } from '../types/music'
import { fetchPlayHistory, fetchPlaylists, fetchTrackRatings, recordHistoryTrack, savePlaylist, saveTrackRating } from './storageService'

export interface DeviceFolderSummary {
  opfsSupported: boolean
  musicFolder: string
  dataFolder: string
  musicFiles: number
  dataFiles: string[]
}

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null
    return await navigator.storage.getDirectory()
  } catch {
    return null
  }
}

async function getSubDir(name: 'music' | 'data'): Promise<FileSystemDirectoryHandle | null> {
  const root = await getOpfsRoot()
  if (!root) return null
  try {
    const appDir = await root.getDirectoryHandle('retro-mix', { create: true })
    return await appDir.getDirectoryHandle(name, { create: true })
  } catch {
    return null
  }
}

function safeFileName(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100) || 'track'
}

/** Store a downloaded/imported audio blob inside this device's private `retro-mix/music/` folder. */
export async function syncMusicToOpfs(id: string, blob: Blob): Promise<void> {
  const dir = await getSubDir('music')
  if (!dir) return
  try {
    const handle = await dir.getFileHandle(`${safeFileName(id)}.audio`, { create: true })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
  } catch {
    // IndexedDB remains primary store if OPFS write is unavailable
  }
}

export async function removeMusicFromOpfs(id: string): Promise<void> {
  const dir = await getSubDir('music')
  if (!dir) return
  try {
    await dir.removeEntry(`${safeFileName(id)}.audio`)
  } catch {
    // Ignore if entry does not exist
  }
}

/** Store individual phone metadata (likes, playlists, history) in `retro-mix/data/<file>`. */
export async function syncDataFileToOpfs(fileName: 'likes.json' | 'playlists.json' | 'history.json', payload: unknown): Promise<void> {
  const dir = await getSubDir('data')
  if (!dir) return
  try {
    const handle = await dir.getFileHandle(fileName, { create: true })
    const writable = await handle.createWritable()
    await writable.write(JSON.stringify(payload, null, 2))
    await writable.close()
  } catch {
    // Non-fatal fallback
  }
}

export async function syncAllMetadataToOpfs(): Promise<void> {
  try {
    const [likes, playlists, history] = await Promise.all([
      fetchTrackRatings(),
      fetchPlaylists(),
      fetchPlayHistory()
    ])
    await Promise.all([
      syncDataFileToOpfs('likes.json', likes),
      syncDataFileToOpfs('playlists.json', playlists),
      syncDataFileToOpfs('history.json', history)
    ])
  } catch {
    // Ignore when running outside browser
  }
}

export async function getDeviceFolderSummary(): Promise<DeviceFolderSummary> {
  const musicDir = await getSubDir('music')
  const dataDir = await getSubDir('data')
  if (!musicDir || !dataDir) {
    return {
      opfsSupported: false,
      musicFolder: 'IndexedDB / tracks',
      dataFolder: 'IndexedDB / ratings + playlists + history',
      musicFiles: 0,
      dataFiles: []
    }
  }
  let musicFiles = 0
  const dataFiles: string[] = []
  try {
    for await (const _ of (musicDir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) {
      musicFiles++
    }
    for await (const entry of (dataDir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) {
      dataFiles.push(entry.name)
    }
  } catch {
    // Ignore iteration errors on older mobile browsers
  }
  return {
    opfsSupported: true,
    musicFolder: 'retro-mix/music/',
    dataFolder: 'retro-mix/data/',
    musicFiles,
    dataFiles: dataFiles.sort()
  }
}

export interface PhoneDataBackup {
  version: number
  exportedAt: string
  likes: Track[]
  playlists: GeneratedPlaylist[]
  history: Array<{ id: string; playedAt: number; track?: Track }>
}

export async function exportPhoneDataBackup(): Promise<void> {
  const [likes, playlists, history] = await Promise.all([
    fetchTrackRatings(),
    fetchPlaylists(),
    fetchPlayHistory()
  ])
  const backup: PhoneDataBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    likes,
    playlists,
    history
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `retromix-phone-data-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function importPhoneDataBackup(file: File): Promise<{ likes: number; playlists: number }> {
  const parsed = JSON.parse(await file.text()) as Partial<PhoneDataBackup>
  let likes = 0
  let playlists = 0
  if (Array.isArray(parsed.likes)) {
    for (const track of parsed.likes) {
      if (track?.id && (track.rating === 'like' || track.rating === 'dislike')) {
        await saveTrackRating(track, track.rating)
        likes++
      }
    }
  }
  if (Array.isArray(parsed.playlists)) {
    for (const pl of parsed.playlists) {
      if (pl?.id && pl?.name && Array.isArray(pl.trackIds)) {
        await savePlaylist(pl)
        playlists++
      }
    }
  }
  if (Array.isArray(parsed.history)) {
    for (const h of parsed.history.slice(0, 50)) {
      if (h?.track?.id) await recordHistoryTrack(h.track)
    }
  }
  await syncAllMetadataToOpfs()
  return { likes, playlists }
}
