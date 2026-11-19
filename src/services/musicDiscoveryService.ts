import { Capacitor } from '@capacitor/core'
import { AudioBridge } from './storageService'
import type { DiscoveryTrack, YouTubeResult } from '../types/music'

type ArchiveMetadata = {
  metadata?: { licenseurl?: string | string[]; artist?: string; album?: string }
  files?: Array<{ name: string; format?: string; length?: string | number }>
}
const archiveMetadata = new Map<string, Promise<ArchiveMetadata | null>>()

function youtubeId(value: string): string {
  return runCatching(() => {
    const url = new URL(value)
    if (url.hostname === 'youtu.be') return url.pathname.slice(1)
    if (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com')) {
      if (url.pathname === '/watch') return url.searchParams.get('v') || ''
      if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] || ''
    }
    return ''
  })
}

function runCatching<T>(fn: () => T): T | '' {
  try { return fn() } catch { return '' }
}

function loadArchiveMetadata(id: string): Promise<ArchiveMetadata | null> {
  if (!archiveMetadata.has(id)) {
    const request = fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(15000) })
      .then(response => response.ok ? response.json() as Promise<ArchiveMetadata> : null)
      .catch(() => null)
    archiveMetadata.set(id, request)
    void request.then(result => { if (!result) archiveMetadata.delete(id) })
    if (archiveMetadata.size > 100) archiveMetadata.delete(archiveMetadata.keys().next().value!)
  }
  return archiveMetadata.get(id)!
}

export function parseDuration(lengthStr?: string | number): number {
  if (!lengthStr) return 0
  if (typeof lengthStr === 'number') return Math.round(lengthStr)
  if (lengthStr.includes(':')) {
    const parts = lengthStr.split(':').map(p => parseFloat(p) || 0)
    if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2])
    if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1])
  }
  return Math.round(parseFloat(lengthStr) || 0)
}

export function scoreMusicMatch(query: string, title: string, artist: string, keywords = ''): number {
  const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const q = normalize(query.replace(/^(?:similar(?:\s+music)?\s+to|songs?\s+like|music\s+like|sounds?\s+like)\s+/i, '').replace(/\b(?:music|songs?|tracks?)\b/gi, ' '))
  const t = normalize(title)
  const a = normalize(artist)
  const k = normalize(keywords)
  if (!q) return 0
  if (t === q) return 100
  if (t.includes(q)) return 80
  if (a === q || a.includes(q)) return 70
  const words = q.split(/\s+/)
  const metadata = `${t} ${a} ${k}`
  if (!words.every(word => metadata.includes(word))) return 0
  if (!words.some(word => `${t} ${a}`.includes(word)) && !k.includes(q)) return 0
  return words.reduce((sum, word) => sum + (t.includes(word) ? 8 : 0) + (a.includes(word) ? 6 : 0) + (k.includes(word) ? 2 : 0), 0)
}

export async function queryArchiveMusic(term: string, popular = false): Promise<DiscoveryTrack[]> {
  const cleanTerm = term.normalize('NFKC').replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim()
  if (!cleanTerm && !popular) return []
  const searchTerm = cleanTerm.replace(/^(?:similar(?:\s+music)?\s+to|songs?\s+like|music\s+like|sounds?\s+like)\s+/i, '').replace(/\b(?:music|songs?|tracks?)\b/gi, ' ').replace(/\s+/g, ' ').trim()
  if (!searchTerm && !popular) return []
  const fields = ['title', 'creator', 'subject']
  const exact = fields.map(field => `${field}:"${searchTerm}"`).join(' OR ')
  const allWords = searchTerm.split(/\s+/).map(word => `(${fields.map(field => `${field}:${word}`).join(' OR ')})`).join(' AND ')
  const query = popular ? 'mediatype:audio AND collection:netlabels' : `mediatype:audio AND (${exact} OR (${allWords}))`
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier,title,creator,subject,licenseurl,downloads&sort[]=downloads+desc&rows=50&page=1&output=json`
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error('The music catalogue is unavailable right now.')
  
  const data = await response.json()
  const items = (data.response?.docs ?? []) as Array<{
    identifier: string
    title: string
    creator?: string
    subject?: string | string[]
    licenseurl?: string | string[]
    downloads?: number
  }>

  const candidates = items
    .filter(item => {
      const license = Array.isArray(item.licenseurl) ? item.licenseurl.join(' ') : item.licenseurl ?? ''
      return !item.licenseurl || /creativecommons\.org\/licenses\//i.test(license) || /public.?domain/i.test(license)
    })
    .map(item => ({ item, keywords: Array.isArray(item.subject) ? item.subject.join(' ') : item.subject ?? '' }))
    .filter(({ item, keywords }) => popular || scoreMusicMatch(searchTerm, item.title, Array.isArray(item.creator) ? item.creator.join(' ') : item.creator ?? '', keywords) > 0)
    .sort((a, b) => (b.item.downloads ?? 0) - (a.item.downloads ?? 0))
    .slice(0, popular ? 12 : 8)

  const results = await Promise.all(
    candidates.map(async ({ item, keywords }) => {
      const metadata = await loadArchiveMetadata(item.identifier)
      if (!metadata) return null
      const license = Array.isArray(metadata.metadata?.licenseurl)
        ? metadata.metadata.licenseurl[0]
        : metadata.metadata?.licenseurl ?? ''
      if (!/creativecommons\.org\/licenses\//i.test(license) && !/public.?domain/i.test(license)) return null
      const mp3 = (metadata.files ?? []).find(
        (file: { name: string; format?: string; length?: string | number }) => {
          if (!file.name.toLowerCase().endsWith('.mp3') || file.format === 'Metadata') return false
          const dur = parseDuration(file.length)
          return dur >= 90 && dur <= 1800
        }
      )
      if (!mp3) return null

      const duration = parseDuration(mp3.length)
      if (duration < 90 || duration > 1800) return null
      const artist = Array.isArray(item.creator) ? item.creator.join(', ') : item.creator ?? metadata.metadata?.artist ?? 'Internet Archive contributor'
      const searchKeywords = [keywords, metadata.metadata?.album].filter(Boolean).join(' ')
      if (/\b(lectures?|audiobooks?|podcasts?|sermons?|quran|recitations?|speeches|books?|porn|adult|xxx|sex|free music charts|various artists)\b/i.test(`${item.title} ${artist} ${searchKeywords}`)) return null

      return {
        id: item.identifier,
        title: item.title,
        artist,
        album: 'Creative Commons collection',
        duration,
        cover: `https://archive.org/services/img/${encodeURIComponent(item.identifier)}`,
        link: `https://archive.org/details/${encodeURIComponent(item.identifier)}`,
        license,
        keywords: searchKeywords,
        downloads: item.downloads,
        downloadUrl: `https://archive.org/download/${encodeURIComponent(item.identifier)}/${mp3.name.split('/').map(encodeURIComponent).join('/')}`
      } satisfies DiscoveryTrack
    })
  )

  const tracks = results.filter(item => item !== null) as DiscoveryTrack[]
  return tracks.sort((a, b) => (popular ? 0 : scoreMusicMatch(searchTerm, b.title, b.artist, b.keywords) - scoreMusicMatch(searchTerm, a.title, a.artist, a.keywords)) || (b.downloads ?? 0) - (a.downloads ?? 0))
}

export async function queryYouTubeMusic(term: string): Promise<YouTubeResult[]> {
  const id = youtubeId(term)
  if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
    return [{
      id,
      title: 'YouTube video',
      artist: 'YouTube',
      duration: 0,
      cover: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
      direct: true
    }]
  }
  if (!Capacitor.isNativePlatform()) {
    const response = await fetch('/api/youtube/search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: term.trim() }), signal: AbortSignal.timeout(50000)
    }).catch(() => { throw new Error('YouTube search cannot connect. Start the audio backend and try again.') })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'YouTube search is unavailable.')
    return data.tracks || []
  }
  const result = await AudioBridge.search({ query: term })
  return result.tracks || []
}
