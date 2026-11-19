export function extractYouTubeId(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1)
    if (parsed.pathname === '/watch') return parsed.searchParams.get('v') || ''
    if (parsed.pathname.startsWith('/shorts/') || parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || ''
  } catch { /* Invalid URL */ }
  return ''
}

export function initYouTubeIframe(hostId: string, onEnded: () => void): Promise<any> {
  return new Promise(resolve => {
    let player: any
    const create = () => {
      player = new (window as any).YT.Player(hostId, {
        height: '1', width: '1', playerVars: { playsinline: 1, controls: 0, rel: 0 },
        events: {
          onReady: () => resolve(player),
          onStateChange: (event: { data: number }) => {
            if (event.data === (window as any).YT.PlayerState.ENDED) onEnded()
          }
        }
      })
    }
    if ((window as any).YT?.Player) create()
    else {
      ;(window as any).onYouTubeIframeAPIReady = create
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(script)
    }
  })
}
