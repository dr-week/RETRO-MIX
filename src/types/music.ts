export type Track = {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  src: string
  cover?: string
  genre?: string
  favorite?: boolean
  rating?: 'like' | 'dislike'
  local?: boolean
  size?: number
  youtubeUrl?: string
  nativeUri?: string
  bpm?: number
  skipCount?: number
}

export type AutoDjMode = 'off' | 'similar' | 'playlist' | 'endless'

export type DownloadTask = {
  id: string
  title: string
  artist: string
  progress: number
  status: 'downloading' | 'converting' | 'done' | 'error'
  estimatedSeconds?: number
  error?: string
}

export type GeneratedPlaylist = {
  id: string
  name: string
  description: string
  genre: string
  kind?: 'manual' | 'smart' | 'ai'
  prompt?: string
  cover?: string
  trackIds: string[]
  createdAt: number
}

export type StoredTrack = Omit<Track, 'src'> & { src: Blob | string }
export type NativeTrack = Omit<Track, 'src'> & { source?: string }

export interface NativeMusicLibrary {
  listTracks(): Promise<{ tracks: NativeTrack[] }>
  upsertTrack(options: { track: NativeTrack }): Promise<void>
  deleteTrack(options: { id: string }): Promise<void>
}

export type DiscoveryTrack = {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  cover: string
  link: string
  license: string
  downloadUrl: string
  keywords?: string
  downloads?: number
}

export type YouTubeResult = {
  id: string
  title: string
  artist: string
  duration: number
  cover: string
  url: string
  direct?: boolean
}

export interface AudioBridgePlugin {
  search(options: { query: string }): Promise<{ tracks: YouTubeResult[] }>
  play(options: { url: string }): Promise<{ title: string; artist: string; duration: number; cover?: string }>
  playLocal(options: { uri: string }): Promise<{ duration: number }>
  pause(): Promise<void>
  resume(): Promise<void>
  seek(options: { seconds: number }): Promise<void>
  position(): Promise<{ seconds: number; duration: number }>
  stop(): Promise<void>
  downloadYouTube(options: { url: string; id: string; title: string }): Promise<{ uri: string; size: number }>
  downloadFile(options: { url: string; title: string }): Promise<{ uri: string; size: number }>
  deleteFile(options: { uri: string }): Promise<void>
  beginImport(options: { id: string }): Promise<void>
  appendImportChunk(options: { id: string; base64: string }): Promise<void>
  finishImport(options: { id: string; title: string }): Promise<{ uri: string; size: number }>
  abortImport(options: { id: string }): Promise<void>
  addListener(eventName: 'ended', callback: () => void): Promise<{ remove: () => Promise<void> }>
}

export type Section = 'player' | 'library' | 'downloads' | 'discover' | 'playlist' | 'mixer'

export interface NavSection {
  id: Section
  label: string
  subtitle: string
  icon: any
}
