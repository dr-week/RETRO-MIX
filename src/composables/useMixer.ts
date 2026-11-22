import { reactive, ref, watch, onBeforeUnmount, type Ref } from 'vue'
import type { Track } from '../types/music'

export type DeckId = 'A' | 'B'
export interface Deck {
  track: Track | null; playing: boolean; time: number; duration: number
  volume: number; low: number; mid: number; high: number; rate: number; error: string
}
const newDeck = (): Deck => ({ track: null, playing: false, time: 0, duration: 0, volume: 0.9, low: 0, mid: 0, high: 0, rate: 1, error: '' })

/** Two-deck DJ mixer: per-deck 3-band EQ, tempo, equal-power crossfader and timed auto-mix. */
export function useMixer(tracks: Ref<Track[]>) {
  const decks = reactive<Record<DeckId, Deck>>({ A: newDeck(), B: newDeck() })
  const crossfade = ref(0) // -1 = deck A, +1 = deck B
  const master = ref(0.9)
  const autoMixSeconds = ref(8)
  const autoMixing = ref(false)

  let ctx: AudioContext | null = null
  let masterGain: GainNode
  const audio = {} as Record<DeckId, HTMLAudioElement>
  const nodes = {} as Record<DeckId, { low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode; xf: GainNode; vol: GainNode }>
  let raf = 0

  function setup() {
    if (ctx) return
    ctx = new AudioContext()
    masterGain = ctx.createGain()
    masterGain.connect(ctx.destination)
    for (const id of ['A', 'B'] as DeckId[]) {
      const el = new Audio(); el.crossOrigin = 'anonymous'; el.preload = 'auto'
      el.addEventListener('loadedmetadata', () => { decks[id].duration = el.duration || decks[id].track?.duration || 0 })
      el.addEventListener('ended', () => { decks[id].playing = false })
      el.addEventListener('error', () => { decks[id].error = 'Cannot load this track in the mixer'; decks[id].playing = false })
      audio[id] = el
      const src = ctx.createMediaElementSource(el)
      const mk = (type: BiquadFilterType, f: number) => { const b = ctx!.createBiquadFilter(); b.type = type; b.frequency.value = f; return b }
      const low = mk('lowshelf', 250), mid = mk('peaking', 1200), high = mk('highshelf', 4000)
      mid.Q.value = 0.8
      const vol = ctx.createGain(), xf = ctx.createGain()
      src.connect(low); low.connect(mid); mid.connect(high); high.connect(vol); vol.connect(xf); xf.connect(masterGain)
      nodes[id] = { low, mid, high, xf, vol }
    }
    applyAll()
    const tick = () => { for (const id of ['A', 'B'] as DeckId[]) if (audio[id]) decks[id].time = audio[id].currentTime; raf = requestAnimationFrame(tick) }
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
      nodes[id].vol.gain.value = d.volume
      nodes[id].low.gain.value = d.low; nodes[id].mid.gain.value = d.mid; nodes[id].high.gain.value = d.high
      audio[id].playbackRate = d.rate
    }
  }
  watch([crossfade, master, () => decks.A, () => decks.B], applyAll, { deep: true })

  async function load(id: DeckId, track: Track) {
    setup()
    const d = decks[id]
    audio[id].pause()
    d.error = ''; d.track = track; d.playing = false; d.time = 0; d.duration = track.duration
    audio[id].src = track.src
    audio[id].load()
  }
  async function toggle(id: DeckId) {
    setup()
    if (!decks[id].track) return
    await ctx!.resume()
    if (audio[id].paused) { try { await audio[id].play(); decks[id].playing = true } catch { decks[id].error = 'Playback blocked or unavailable' } }
    else { audio[id].pause(); decks[id].playing = false }
  }
  function seek(id: DeckId, t: number) { if (audio[id]) { audio[id].currentTime = t; decks[id].time = t } }
  function cue(id: DeckId) { seek(id, 0) }

  /** Start the idle deck and glide the crossfader to it. */
  async function autoMix() {
    if (autoMixing.value) return
    const from: DeckId = crossfade.value <= 0 ? 'A' : 'B'
    const to: DeckId = from === 'A' ? 'B' : 'A'
    if (!decks[to].track) return
    autoMixing.value = true
    if (!decks[to].playing) await toggle(to)
    const start = crossfade.value, end = to === 'B' ? 1 : -1, t0 = performance.now(), ms = autoMixSeconds.value * 1000
    await new Promise<void>(res => {
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / ms)
        crossfade.value = start + (end - start) * k
        if (k < 1) requestAnimationFrame(step); else res()
      }
      requestAnimationFrame(step)
    })
    if (decks[from].playing) await toggle(from)
    autoMixing.value = false
  }

  onBeforeUnmount(() => { cancelAnimationFrame(raf); for (const id of ['A', 'B'] as DeckId[]) audio[id]?.pause(); ctx?.close() })
  return { decks, crossfade, master, autoMixSeconds, autoMixing, tracks, load, toggle, seek, cue, autoMix }
}
