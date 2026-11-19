import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import type { Track } from '../types/music'
import { AudioBridge, recordHistoryTrack } from '../services/storageService'
import { extractYouTubeId, initYouTubeIframe } from '../services/youtubePlayerService'

export function usePlayback(tracks: Ref<Track[]>) {
  const currentIndex = ref(0)
  const isPlaying = ref(false)
  const playbackError = ref('')
  const isShuffle = ref(false)
  const repeat = ref(false)
  const progress = ref(0)
  const spectrum = ref<number[]>([])
  const currentTrack = computed(() => tracks.value[currentIndex.value])
  const audio = new Audio()
  audio.preload = 'metadata'
  let audioContext: AudioContext | undefined
  let analyser: AnalyserNode | undefined
  let analyserData: Uint8Array<ArrayBuffer> | undefined
  let spectrumFrame = 0
  let nativePlayingId: string | null = null
  let youtubePlayer: any
  let youtubeReady: Promise<any> | undefined
  let youtubeTimer: ReturnType<typeof setInterval> | undefined
  const usesNative = (track?: Track) => Capacitor.isNativePlatform() && !!(track?.youtubeUrl || track?.nativeUri)
  const usesYouTubeFrame = (track?: Track) => !Capacitor.isNativePlatform() && !!track?.youtubeUrl

  function ensureYouTubePlayer(): Promise<any> {
    if (youtubeReady) return youtubeReady
    const host = document.createElement('div')
    host.id = 'hidden-youtube-player'
    Object.assign(host.style, { position: 'fixed', width: '1px', height: '1px', left: '-9999px', top: '-9999px', opacity: '0', pointerEvents: 'none' })
    document.body.appendChild(host)
    youtubeReady = initYouTubeIframe(host.id, () => {
      repeat.value ? onSeek(0) : nextTrack()
    }).then(p => { youtubePlayer = p; return p })
    return youtubeReady
  }

  async function startYouTubeFrame(track: Track) {
    const id = track.youtubeUrl ? extractYouTubeId(track.youtubeUrl) : ''
    if (!id) { playbackError.value = 'Could not play this YouTube link.'; isPlaying.value = false; return }
    const player = await ensureYouTubePlayer()
    playbackError.value = ''
    player.loadVideoById(id)
    player.playVideo()
    isPlaying.value = true
    void recordHistoryTrack(track)
    if (youtubeTimer) clearInterval(youtubeTimer)
    youtubeTimer = setInterval(() => {
      if (!usesYouTubeFrame(currentTrack.value) || !youtubePlayer) return
      progress.value = youtubePlayer.getCurrentTime?.() || 0
      const duration = youtubePlayer.getDuration?.() || 0
      if (duration && currentTrack.value) currentTrack.value.duration = duration
    }, 500)
  }

  function startSpectrum() {
    if (usesNative(currentTrack.value) || !analyser || !analyserData) return
    cancelAnimationFrame(spectrumFrame)
    void audioContext?.resume()
    const sample = () => {
      if (!isPlaying.value || !analyser || !analyserData) return
      analyser.getByteFrequencyData(analyserData)
      spectrum.value = Array.from({ length: 48 }, (_, i) => 4 + Math.sqrt(analyserData![Math.floor(i * analyserData!.length / 48)] / 255) * 64)
      spectrumFrame = requestAnimationFrame(sample)
    }
    spectrumFrame = requestAnimationFrame(sample)
  }

  function prepareSpectrum() {
    if (analyser || !window.AudioContext) return
    try {
      audio.crossOrigin = 'anonymous'; audioContext = new AudioContext(); analyser = audioContext.createAnalyser()
      analyser.fftSize = 128; analyser.smoothingTimeConstant = 0.72
      audioContext.createMediaElementSource(audio).connect(analyser); analyser.connect(audioContext.destination)
      analyserData = new Uint8Array(analyser.frequencyBinCount)
    } catch { analyser = undefined; spectrum.value = [] }
  }

  async function startNative(track: Track) {
    nativePlayingId = track.id; playbackError.value = ''
    try {
      const info = track.nativeUri ? await AudioBridge.playLocal({ uri: track.nativeUri }) : await AudioBridge.play({ url: track.youtubeUrl! })
      if (currentTrack.value?.id !== track.id) { await AudioBridge.stop(); return }
      track.duration = info.duration || track.duration
      isPlaying.value = true; void recordHistoryTrack(track)
    } catch (error) {
      if (currentTrack.value?.id === track.id) { isPlaying.value = false; playbackError.value = error instanceof Error ? error.message : 'Could not play this track.' }
      nativePlayingId = null
    }
  }

  watch(currentTrack, track => {
    if (!track) return
    playbackError.value = ''
    progress.value = 0
    audio.pause()
    if (usesNative(track)) {
      spectrum.value = []
      audio.removeAttribute('src')
      if (isPlaying.value) void startNative(track)
    } else if (usesYouTubeFrame(track)) {
      spectrum.value = []
      audio.removeAttribute('src')
      if (nativePlayingId) { nativePlayingId = null; void AudioBridge.stop() }
      if (isPlaying.value) void startYouTubeFrame(track)
    } else {
      if (nativePlayingId) { nativePlayingId = null; void AudioBridge.stop() }
      youtubePlayer?.stopVideo?.()
      audio.crossOrigin = 'anonymous'
      audio.src = track.src
      if (isPlaying.value) audio.play().then(() => { void recordHistoryTrack(track); startSpectrum() }).catch(() => { isPlaying.value = false })
    }
  })

  audio.addEventListener('timeupdate', () => { progress.value = audio.currentTime })
  audio.addEventListener('loadedmetadata', () => { if (currentTrack.value && audio.duration) currentTrack.value.duration = audio.duration })
  let unplayedShuffleIndices: number[] = []

  function refillShufflePool() {
    unplayedShuffleIndices = tracks.value.map((_, i) => i).filter(i => i !== currentIndex.value)
    for (let i = unplayedShuffleIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[unplayedShuffleIndices[i], unplayedShuffleIndices[j]] = [unplayedShuffleIndices[j], unplayedShuffleIndices[i]]
    }
  }

  function toggleShuffle() {
    isShuffle.value = !isShuffle.value
    if (isShuffle.value) refillShufflePool()
  }

  function nextTrack() {
    const len = tracks.value.length
    if (!len) return
    if (isShuffle.value) {
      if (!unplayedShuffleIndices.length) refillShufflePool()
      currentIndex.value = unplayedShuffleIndices.pop() ?? (currentIndex.value + 1) % len
    } else {
      currentIndex.value = (currentIndex.value + 1) % len
    }
    isPlaying.value = true
  }

  function previousTrack() {
    const len = tracks.value.length
    if (!len) return
    currentIndex.value = (currentIndex.value - 1 + len) % len
    isPlaying.value = true
  }

  async function togglePlayback() {
    if (!currentTrack.value) return
    if (usesNative(currentTrack.value)) {
      if (isPlaying.value) { await AudioBridge.pause(); isPlaying.value = false; return }
      if (nativePlayingId === currentTrack.value.id) { await AudioBridge.resume(); isPlaying.value = true; void recordHistoryTrack(currentTrack.value) }
      else await startNative(currentTrack.value)
      return
    }
    if (usesYouTubeFrame(currentTrack.value)) {
      if (isPlaying.value) { youtubePlayer?.pauseVideo?.(); isPlaying.value = false; return }
      if (youtubePlayer?.playVideo) { youtubePlayer.playVideo(); isPlaying.value = true; void recordHistoryTrack(currentTrack.value) }
      else await startYouTubeFrame(currentTrack.value)
      return
    }
    if (isPlaying.value) { audio.pause(); isPlaying.value = false; return }
    prepareSpectrum()
    try { await audioContext?.resume(); await audio.play(); isPlaying.value = true; startSpectrum(); void recordHistoryTrack(currentTrack.value) } catch { isPlaying.value = false }
  }

  function selectTrack(track: Track) {
    if (currentTrack.value?.id === track.id) { if (!isPlaying.value) void togglePlayback(); return }
    let index = tracks.value.findIndex(item => item.id === track.id)
    if (index < 0) index = tracks.value.push(track) - 1
    if (!usesNative(track) && !usesYouTubeFrame(track)) prepareSpectrum()
    currentIndex.value = index
    isPlaying.value = true
    void audioContext?.resume()
  }

  function onSeek(seconds: number) {
    progress.value = seconds
    if (usesNative(currentTrack.value)) void AudioBridge.seek({ seconds })
    else if (usesYouTubeFrame(currentTrack.value)) youtubePlayer?.seekTo?.(seconds, true)
    else audio.currentTime = seconds
  }

  let positionTimer: ReturnType<typeof setInterval> | undefined
  if (Capacitor.isNativePlatform()) {
    positionTimer = setInterval(async () => {
      if (!isPlaying.value || !usesNative(currentTrack.value)) return
      try { progress.value = (await AudioBridge.position()).seconds } catch { /* Player may be stopping. */ }
    }, 800)
    void AudioBridge.addListener('ended', () => {
      if (repeat.value) onSeek(0)
      else nextTrack()
    })
  }
  onBeforeUnmount(() => {
    audio.pause(); youtubePlayer?.destroy?.(); cancelAnimationFrame(spectrumFrame); if (positionTimer) clearInterval(positionTimer); if (youtubeTimer) clearInterval(youtubeTimer)
    void audioContext?.close()
  })

  return { currentTrack, isPlaying, playbackError, isShuffle, repeat, progress, spectrum, togglePlayback, selectTrack, onSeek, nextTrack, previousTrack, toggleShuffle }
}
