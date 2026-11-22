import { computed, reactive, ref, watch, onBeforeUnmount, type Ref } from 'vue'
import type { Track } from '../types/music'
import { computeTempoMatchRate, estimateBpmFromUrl, getCachedBpm } from '../services/similarityService'
import { createBeatEngine, triggerDjSfx, type BeatPattern, type DjSfxKind } from '../services/djFxService'

export type DeckId = 'A' | 'B'
export interface Deck {
  track: Track | null
  playing: boolean
  time: number
  duration: number
  volume: number
  low: number
  mid: number
  high: number
  filter: number // -1 = low-pass, 0 = flat, +1 = high-pass
  echo: number   // 0..0.6 wet echo mix
  rate: number
  bpm: number | null
  looping: boolean
  loopStart: number
  loopEnd: number
  error: string
}

const newDeck = (): Deck => ({
  track: null, playing: false, time: 0, duration: 0,
  volume: 0.9, low: 0, mid: 0, high: 0, filter: 0, echo: 0,
  rate: 1, bpm: null, looping: false, loopStart: 0, loopEnd: 0, error: ''
})

/** Two-deck DJ mixer: 3-band EQ, filter sweep, echo FX, 4-beat loop, BPM sync, SFX pads, and beat machine. */
export function useMixer(tracks: Ref<Track[]>, onPlayStart?: () => void) {
  const decks = reactive<Record<DeckId, Deck>>({ A: newDeck(), B: newDeck() })
  const crossfade = ref(0) // -1 = deck A, +1 = deck B
  const master = ref(0.9)
  const autoMixSeconds = ref(8)
  const autoMixing = ref(false)
  const beatPattern = ref<BeatPattern>('off')
  const beatVolume = ref(0.65)

  const activeDeck = computed<DeckId>(() => (crossfade.value <= 0 ? 'A' : 'B'))
  const idleDeck = computed<DeckId>(() => (activeDeck.value === 'A' ? 'B' : 'A'))
  const isAnyPlaying = computed(() => decks.A.playing || decks.B.playing)
  const activeBpm = computed(() => {
    const d = decks[activeDeck.value]
    return Math.round((d.bpm ?? 120) * d.rate)
  })

  let ctx: AudioContext | null = null
  let masterGain: GainNode
  let beatEngine: ReturnType<typeof createBeatEngine> | null = null
  const audio = {} as Record<DeckId, HTMLAudioElement>
  const nodes = {} as Record<DeckId, {
    low: BiquadFilterNode
    mid: BiquadFilterNode
    high: BiquadFilterNode
    fxFilter: BiquadFilterNode
    delay: DelayNode
    delayFeedback: GainNode
    delayWet: GainNode
    xf: GainNode
    vol: GainNode
  }>
  let raf = 0

  function setup() {
    if (ctx) return
    ctx = new AudioContext()
    masterGain = ctx.createGain()
    masterGain.connect(ctx.destination)
    beatEngine = createBeatEngine(ctx, masterGain)

    for (const id of ['A', 'B'] as DeckId[]) {
      const el = new Audio()
      el.crossOrigin = 'anonymous'
      el.preload = 'auto'
      el.addEventListener('loadedmetadata', () => {
        decks[id].duration = el.duration || decks[id].track?.duration || 0
      })
      el.addEventListener('ended', () => { decks[id].playing = false })
      el.addEventListener('error', () => {
        decks[id].error = 'Cannot load this track in the mixer'
        decks[id].playing = false
      })
      audio[id] = el
      const src = ctx.createMediaElementSource(el)
      const mk = (type: BiquadFilterType, f: number) => {
        const b = ctx!.createBiquadFilter()
        b.type = type
        b.frequency.value = f
        return b
      }
      const low = mk('lowshelf', 250)
      const mid = mk('peaking', 1200)
      const high = mk('highshelf', 4000)
      mid.Q.value = 0.8
      const fxFilter = mk('allpass', 1000)
      const delay = ctx.createDelay(1.0)
      delay.delayTime.value = 0.375
      const delayFeedback = ctx.createGain()
      delayFeedback.gain.value = 0.35
      const delayWet = ctx.createGain()
      delayWet.gain.value = 0

      const vol = ctx.createGain()
      const xf = ctx.createGain()

      src.connect(low); low.connect(mid); mid.connect(high); high.connect(fxFilter)
      // Dry path
      fxFilter.connect(vol)
      // Echo wet path
      fxFilter.connect(delay); delay.connect(delayFeedback); delayFeedback.connect(delay)
      delay.connect(delayWet); delayWet.connect(vol)

      vol.connect(xf); xf.connect(masterGain)
      nodes[id] = { low, mid, high, fxFilter, delay, delayFeedback, delayWet, xf, vol }
    }
    applyAll()
    const tick = () => {
      for (const id of ['A', 'B'] as DeckId[]) {
        if (audio[id]) {
          const t = audio[id].currentTime
          const d = decks[id]
          if (d.looping && d.loopEnd > d.loopStart && t >= d.loopEnd) {
            audio[id].currentTime = d.loopStart
          }
          d.time = audio[id].currentTime
        }
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
  }

  function applyAll() {
    if (!ctx) return
    masterGain.gain.value = master.value
    const p = (crossfade.value + 1) / 2
    nodes.A.xf.gain.value = Math.cos(p * Math.PI / 2)
    nodes.B.xf.gain.value = Math.sin(p * Math.PI / 2)
    for (const id of ['A', 'B'] as DeckId[]) {
      const d = decks[id]
      const n = nodes[id]
      n.vol.gain.value = d.volume
      n.low.gain.value = d.low
      n.mid.gain.value = d.mid
      n.high.gain.value = d.high
      n.delayWet.gain.value = d.echo
      // Sync echo delay time to 3/4 beat of deck BPM
      const deckBpm = (d.bpm ?? 120) * d.rate
      n.delay.delayTime.value = Math.min(0.95, Math.max(0.12, (60 / deckBpm) * 0.75))

      if (Math.abs(d.filter) < 0.05) {
        n.fxFilter.type = 'allpass'
      } else if (d.filter < 0) {
        n.fxFilter.type = 'lowpass'
        n.fxFilter.frequency.value = Math.max(180, 14000 * Math.pow(1 + d.filter, 2.5))
        n.fxFilter.Q.value = 1.6
      } else {
        n.fxFilter.type = 'highpass'
        n.fxFilter.frequency.value = 80 + 5200 * Math.pow(d.filter, 2)
        n.fxFilter.Q.value = 1.6
      }
      audio[id].playbackRate = d.rate
    }
    beatEngine?.setBpm(activeBpm.value)
    beatEngine?.setVolume(beatVolume.value)
  }

  watch([crossfade, master, beatVolume, activeBpm, () => decks.A, () => decks.B], applyAll, { deep: true })

  async function setBeatPattern(next: BeatPattern) {
    setup()
    await ctx!.resume()
    beatPattern.value = next
    beatEngine?.setBpm(activeBpm.value)
    beatEngine?.setVolume(beatVolume.value)
    beatEngine?.setPattern(next)
  }

  async function playSfx(kind: DjSfxKind) {
    setup()
    await ctx!.resume()
    triggerDjSfx(ctx!, masterGain, kind)
  }

  function toggleLoop(id: DeckId, beats = 4) {
    const d = decks[id]
    if (!d.track) return
    if (d.looping) {
      d.looping = false
      return
    }
    const bpm = (d.bpm ?? 120) * d.rate
    const len = (60 / bpm) * beats
    d.loopStart = d.time
    d.loopEnd = Math.min(d.duration || d.time + len, d.time + len)
    d.looping = d.loopEnd > d.loopStart + 0.2
  }

  async function load(id: DeckId, track: Track) {
    setup()
    const d = decks[id]
    audio[id].pause()
    d.error = ''
    d.track = track
    d.playing = false
    d.looping = false
    d.time = 0
    d.duration = track.duration
    d.rate = 1
    d.filter = 0
    d.echo = 0
    d.bpm = track.bpm ?? getCachedBpm(track.id) ?? null
    if (!track.src) {
      d.error = 'Track has no direct audio stream (download it first)'
      return
    }
    audio[id].src = track.src
    audio[id].load()
    if (!d.bpm) {
      void estimateBpmFromUrl(track.id, track.src).then(bpm => {
        if (bpm && decks[id].track?.id === track.id) {
          decks[id].bpm = bpm
          track.bpm = bpm
        }
      })
    }
  }

  function syncBpm(targetId: DeckId) {
    const refId: DeckId = targetId === 'A' ? 'B' : 'A'
    const targetBpm = decks[targetId].bpm
    const refBpm = decks[refId].bpm
    if (!targetBpm || !refBpm) return
    decks[targetId].rate = computeTempoMatchRate(targetBpm, refBpm * decks[refId].rate)
  }

  async function toggle(id: DeckId) {
    setup()
    if (!decks[id].track) return
    await ctx!.resume()
    if (audio[id].paused) {
      try {
        onPlayStart?.()
        await audio[id].play()
        decks[id].playing = true
      } catch {
        decks[id].error = 'Playback blocked or unavailable'
      }
    } else {
      audio[id].pause()
      decks[id].playing = false
    }
  }

  function stopAll() {
    for (const id of ['A', 'B'] as DeckId[]) {
      if (audio[id] && !audio[id].paused) audio[id].pause()
      decks[id].playing = false
    }
    beatPattern.value = 'off'
    beatEngine?.stop()
  }

  function seek(id: DeckId, t: number) {
    if (audio[id]) {
      audio[id].currentTime = t
      decks[id].time = t
    }
  }
  function cue(id: DeckId) { seek(id, 0) }

  /** Start the idle deck (with BPM sync if available) and glide the crossfader to it. */
  async function autoMix() {
    if (autoMixing.value) return
    const from: DeckId = crossfade.value <= 0 ? 'A' : 'B'
    const to: DeckId = from === 'A' ? 'B' : 'A'
    if (!decks[to].track) return
    autoMixing.value = true
    if (decks[from].bpm && decks[to].bpm) syncBpm(to)
    if (!decks[to].playing) await toggle(to)
    const start = crossfade.value
    const end = to === 'B' ? 1 : -1
    const t0 = performance.now()
    const ms = autoMixSeconds.value * 1000
    await new Promise<void>(res => {
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / ms)
        crossfade.value = start + (end - start) * k
        if (k < 1) requestAnimationFrame(step)
        else res()
      }
      requestAnimationFrame(step)
    })
    if (decks[from].playing) await toggle(from)
    autoMixing.value = false
  }

  onBeforeUnmount(() => {
    cancelAnimationFrame(raf)
    stopAll()
    void ctx?.close()
  })

  return {
    decks, crossfade, master, autoMixSeconds, autoMixing,
    activeDeck, idleDeck, isAnyPlaying, activeBpm,
    beatPattern, beatVolume, tracks,
    load, toggle, stopAll, seek, cue, syncBpm, toggleLoop,
    setBeatPattern, playSfx, autoMix
  }
}
