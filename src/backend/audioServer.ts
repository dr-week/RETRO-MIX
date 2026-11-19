declare const Bun: any

const PORT = Number(process.env.RETROMIX_AUDIO_PORT || 8787)
const TOOL_ROOT = process.env.RETROMIX_TOOL_ROOT || 'C:\\software\\retromix-ytdlp'
const YTDLP = process.env.RETROMIX_YTDLP || `${TOOL_ROOT}\\Scripts\\yt-dlp.exe`
const FFMPEG = process.env.RETROMIX_FFMPEG || `${TOOL_ROOT}\\Lib\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe`
const OUT_DIR = process.env.RETROMIX_AUDIO_CACHE || `${TOOL_ROOT}\\cache`
const MAX_MS = 8 * 60 * 1000

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  })
}

function cleanName(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'retro-mix'
}

function validYouTubeUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'youtu.be' || url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com'))
  } catch {
    return false
  }
}

async function convert(url: string, title: string): Promise<File> {
  await Bun.$`mkdir -p ${OUT_DIR}`.quiet()
  const base = `${Date.now()}-${crypto.randomUUID()}`
  const template = `${OUT_DIR}\\${base}.%(ext)s`
  const proc = Bun.spawn([
    YTDLP,
    '--no-playlist',
    '--max-filesize', '150M',
    '--remote-components', 'ejs:github',
    '-f', 'bestaudio[ext=m4a]/bestaudio',
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '--ffmpeg-location', FFMPEG,
    '-o', template,
    url
  ], { stderr: 'pipe' })

  const timeout = setTimeout(() => proc.kill(), MAX_MS)
  const [code, error] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
  clearTimeout(timeout)
  if (code !== 0) throw new Error(error.split(/\r?\n/).filter(Boolean).slice(-2).join(' ') || 'Conversion failed')

  const file = Bun.file(`${OUT_DIR}\\${base}.mp3`)
  if (!await file.exists() || file.size === 0) throw new Error('MP3 was not created')
  return new File([file], `${cleanName(title)}.mp3`, { type: 'audio/mpeg' })
}

Bun.serve({
  port: PORT,
  async fetch(request: Request) {
    if (request.method === 'OPTIONS') return json({})
    if (new URL(request.url).pathname === '/api/youtube/search' && request.method === 'POST') {
      try {
        const body = await request.json() as { query?: unknown }
        if (typeof body.query !== 'string' || !body.query.trim() || body.query.length > 120) return json({ error: 'Enter a search of up to 120 characters' }, 400)
        const proc = Bun.spawn([YTDLP, '--flat-playlist', '--dump-json', '--no-warnings', '--socket-timeout', '15', '--retries', '1', `ytsearch15:${body.query.trim()}`], { stdout: 'pipe', stderr: 'pipe' })
        const timeout = setTimeout(() => proc.kill(), 45000)
        let code: number, output: string, error: string
        try { [code, output, error] = await Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()]) }
        finally { clearTimeout(timeout) }
        if (code !== 0) throw new Error(error.split(/\r?\n/).filter(Boolean).slice(-1)[0] || 'YouTube search timed out')
        const tracks = output.split(/\r?\n/).filter(line => line.trim().startsWith('{')).map(line => JSON.parse(line)).filter(item => /^[A-Za-z0-9_-]{11}$/.test(item.id)).map(item => ({
          id: item.id, title: item.title || 'Untitled', artist: item.channel || item.uploader || 'YouTube',
          duration: Number(item.duration) || 0, cover: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`, url: `https://www.youtube.com/watch?v=${item.id}`
        }))
        return json({ tracks })
      } catch (error) { return json({ error: error instanceof Error ? error.message : 'Search failed' }, 502) }
    }
    if (new URL(request.url).pathname !== '/api/youtube/convert' || request.method !== 'POST') return json({ error: 'Not found' }, 404)

    try {
      const body = await request.json() as { url?: string; title?: string }
      if (!body.url || !validYouTubeUrl(body.url)) return json({ error: 'Valid YouTube URL required' }, 400)
      const file = await convert(body.url, body.title || 'Retro Mix track')
      return new Response(file, {
        headers: {
          'content-type': 'audio/mpeg',
          'content-disposition': `attachment; filename="${file.name}"`,
          'access-control-allow-origin': '*'
        }
      })
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Conversion failed' }, 500)
    }
  }
})

console.log(`Retro Mix audio backend listening on http://127.0.0.1:${PORT}`)
