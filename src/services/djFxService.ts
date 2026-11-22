export type DjSfxKind = 'airhorn' | 'riser' | 'drop' | 'scratch' | 'laser' | 'clap'
export type BeatPattern = 'off' | 'house' | 'lofi' | 'trap' | 'breakbeat'

export interface DrumPatternSpec {
  kick: number[]
  snare: number[]
  hat: number[]
  clap: number[]
}

export const BEAT_PATTERNS: Record<Exclude<BeatPattern, 'off'>, DrumPatternSpec> = {
  house: {
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1]
  },
  lofi: {
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
  },
  trap: {
    kick: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1],
    clap: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]
  },
  breakbeat: {
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
  }
}

export function stepDurationSeconds(bpm: number): number {
  const safeBpm = Math.max(60, Math.min(200, bpm || 120))
  return 60 / safeBpm / 4 // 16th-note step
}

function makeNoiseBuffer(ctx: AudioContext, seconds = 0.5): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const ch = buf.getChannelData(0)
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1
  return buf
}

function playKick(ctx: AudioContext, dest: AudioNode, time: number, gainLevel = 0.75) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(145, time)
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.14)
  gain.gain.setValueAtTime(gainLevel, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24)
  osc.connect(gain); gain.connect(dest)
  osc.start(time); osc.stop(time + 0.25)
}

function playSnare(ctx: AudioContext, dest: AudioNode, time: number, gainLevel = 0.45) {
  const noise = ctx.createBufferSource()
  noise.buffer = makeNoiseBuffer(ctx, 0.22)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'; filter.frequency.value = 1800
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(gainLevel, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18)
  noise.connect(filter); filter.connect(gain); gain.connect(dest)
  noise.start(time); noise.stop(time + 0.2)

  const body = ctx.createOscillator()
  const bg = ctx.createGain()
  body.type = 'triangle'
  body.frequency.setValueAtTime(210, time)
  body.frequency.exponentialRampToValueAtTime(110, time + 0.09)
  bg.gain.setValueAtTime(gainLevel * 0.5, time)
  bg.gain.exponentialRampToValueAtTime(0.001, time + 0.1)
  body.connect(bg); bg.connect(dest)
  body.start(time); body.stop(time + 0.11)
}

function playHat(ctx: AudioContext, dest: AudioNode, time: number, gainLevel = 0.22) {
  const noise = ctx.createBufferSource()
  noise.buffer = makeNoiseBuffer(ctx, 0.08)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'; hp.frequency.value = 7200
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(gainLevel, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055)
  noise.connect(hp); hp.connect(gain); gain.connect(dest)
  noise.start(time); noise.stop(time + 0.06)
}

function playClap(ctx: AudioContext, dest: AudioNode, time: number, gainLevel = 0.4) {
  for (let burst = 0; burst < 3; burst++) {
    const t = time + burst * 0.012
    const noise = ctx.createBufferSource()
    noise.buffer = makeNoiseBuffer(ctx, 0.15)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 1250; bp.Q.value = 1.4
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(gainLevel * (burst === 2 ? 1 : 0.6), t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + (burst === 2 ? 0.14 : 0.03))
    noise.connect(bp); bp.connect(gain); gain.connect(dest)
    noise.start(t); noise.stop(t + 0.15)
  }
}

/** Synthesize classic DJ one-shot sound effects directly via Web Audio API. */
export function triggerDjSfx(ctx: AudioContext, dest: AudioNode, kind: DjSfxKind) {
  const now = ctx.currentTime
  if (kind === 'airhorn') {
    const freqs = [392, 493.88, 587.33]
    for (const f of freqs) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(f * 0.94, now)
      osc.frequency.linearRampToValueAtTime(f, now + 0.05)
      osc.frequency.setValueAtTime(f, now + 0.45)
      osc.frequency.linearRampToValueAtTime(f * 0.96, now + 0.65)
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(0.14, now + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68)
      osc.connect(gain); gain.connect(dest)
      osc.start(now); osc.stop(now + 0.7)
    }
  } else if (kind === 'riser') {
    const noise = ctx.createBufferSource()
    noise.buffer = makeNoiseBuffer(ctx, 1.8)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.Q.value = 4
    bp.frequency.setValueAtTime(220, now)
    bp.frequency.exponentialRampToValueAtTime(4200, now + 1.6)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.01, now)
    gain.gain.linearRampToValueAtTime(0.32, now + 1.5)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.75)
    noise.connect(bp); bp.connect(gain); gain.connect(dest)
    noise.start(now); noise.stop(now + 1.8)
  } else if (kind === 'drop') {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(110, now)
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.9)
    gain.gain.setValueAtTime(0.7, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1)
    osc.connect(gain); gain.connect(dest)
    osc.start(now); osc.stop(now + 1.15)
  } else if (kind === 'scratch') {
    const osc = ctx.createOscillator()
    const bp = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(160, now)
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.09)
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.19)
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.28)
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 2
    gain.gain.setValueAtTime(0.28, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32)
    osc.connect(bp); bp.connect(gain); gain.connect(dest)
    osc.start(now); osc.stop(now + 0.34)
  } else if (kind === 'laser') {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(1800, now)
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.28)
    gain.gain.setValueAtTime(0.25, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
    osc.connect(gain); gain.connect(dest)
    osc.start(now); osc.stop(now + 0.32)
  } else if (kind === 'clap') {
    playClap(ctx, dest, now, 0.55)
  }
}

/** BPM-synced 16-step beat machine layered onto the DJ mixer output. */
export function createBeatEngine(ctx: AudioContext, dest: AudioNode) {
  const bus = ctx.createGain()
  bus.gain.value = 0.65
  bus.connect(dest)

  let pattern: BeatPattern = 'off'
  let bpm = 120
  let step = 0
  let nextTime = 0
  let timer: ReturnType<typeof setInterval> | null = null

  function tick() {
    if (pattern === 'off') return
    const spec = BEAT_PATTERNS[pattern]
    const lookahead = 0.12
    while (nextTime < ctx.currentTime + lookahead) {
      if (spec.kick[step]) playKick(ctx, bus, nextTime)
      if (spec.snare[step]) playSnare(ctx, bus, nextTime)
      if (spec.hat[step]) playHat(ctx, bus, nextTime)
      if (spec.clap[step]) playClap(ctx, bus, nextTime)
      nextTime += stepDurationSeconds(bpm)
      step = (step + 1) % 16
    }
  }

  return {
    setPattern(next: BeatPattern) {
      pattern = next
      if (next === 'off') {
        if (timer) { clearInterval(timer); timer = null }
      } else {
        step = 0
        nextTime = ctx.currentTime + 0.04
        if (!timer) timer = setInterval(tick, 30)
      }
    },
    setBpm(nextBpm: number) {
      if (nextBpm >= 60 && nextBpm <= 200) bpm = nextBpm
    },
    setVolume(vol: number) {
      bus.gain.value = Math.max(0, Math.min(1, vol))
    },
    stop() {
      pattern = 'off'
      if (timer) { clearInterval(timer); timer = null }
    }
  }
}
