import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Track, StoredTrack, NativeMusicLibrary, AudioBridgePlugin, GeneratedPlaylist } from '../types/music'

export const NativeLibrary = registerPlugin<NativeMusicLibrary>('MusicLibrary')
export const AudioBridge = registerPlugin<AudioBridgePlugin>('AudioBridge')

export const DB_NAME = 'afterglow-audio'
export const STORE = 'tracks'
export const HISTORY_STORE = 'history'
export const RATINGS_STORE = 'ratings'
export const PLAYLIST_STORE = 'playlists'

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 4)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'id' })
      }
      if (!request.result.objectStoreNames.contains(HISTORY_STORE)) {
        request.result.createObjectStore(HISTORY_STORE, { keyPath: 'id' })
      }
      if (!request.result.objectStoreNames.contains(RATINGS_STORE)) {
        request.result.createObjectStore(RATINGS_STORE, { keyPath: 'id' })
      }
      if (!request.result.objectStoreNames.contains(PLAYLIST_STORE)) {
        request.result.createObjectStore(PLAYLIST_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function fetchTrackRatings(): Promise<Track[]> {
  const db = await openDatabase()
  const ratings: Track[] = await new Promise((resolve, reject) => {
    const req = db.transaction(RATINGS_STORE).objectStore(RATINGS_STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return ratings
}

export async function saveTrackRating(track: Track, rating?: 'like' | 'dislike'): Promise<void> {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RATINGS_STORE, 'readwrite')
    if (rating) tx.objectStore(RATINGS_STORE).put({ ...track, src: track.local ? '' : track.src, rating, favorite: rating === 'like' })
    else tx.objectStore(RATINGS_STORE).delete(track.id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function fetchPlaylists(): Promise<GeneratedPlaylist[]> {
  const db = await openDatabase()
  const playlists: GeneratedPlaylist[] = await new Promise((resolve, reject) => {
    const req = db.transaction(PLAYLIST_STORE).objectStore(PLAYLIST_STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return playlists
}

export async function savePlaylist(playlist: GeneratedPlaylist): Promise<void> {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PLAYLIST_STORE, 'readwrite')
    tx.objectStore(PLAYLIST_STORE).put(playlist)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function fetchAllStoredTracks(): Promise<StoredTrack[]> {
  const db = await openDatabase()
  const tracks: StoredTrack[] = await new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return tracks
}

export async function fetchPlayHistory(): Promise<{ id: string; playedAt: number; track?: Track }[]> {
  const db = await openDatabase()
  const history: { id: string; playedAt: number; track?: Track }[] = await new Promise((resolve, reject) => {
    const req = db.transaction(HISTORY_STORE).objectStore(HISTORY_STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return history
}

export async function recordHistoryTrack(track: Track): Promise<void> {
  try {
    const db = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(HISTORY_STORE, 'readwrite')
      tx.objectStore(HISTORY_STORE).put({
        id: track.id,
        playedAt: Date.now(),
        track: track.youtubeUrl && !track.local ? { ...track, src: '' } : undefined
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // Graceful fallback when storage is inaccessible
  }
}

export async function persistTrack(track: Track, source: Blob | string, kind: 'import' | 'download' = 'download'): Promise<void> {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ ...track, src: source })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()

  if (Capacitor.isNativePlatform()) {
    const { src: _src, ...metadata } = track
    await NativeLibrary.upsertTrack({ track: { ...metadata, source: kind } })
  }
}

export async function removeStoredTrack(track: Track): Promise<void> {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(track.id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()

  if (Capacitor.isNativePlatform()) {
    if (track.nativeUri) {
      try {
        await AudioBridge.deleteFile({ uri: track.nativeUri })
      } catch {}
    }
    await NativeLibrary.deleteTrack({ id: track.id })
  }
}
