<script setup lang="ts">
import { useArcSeek } from '../../composables/useArcSeek'
import WaveformSpectrum from './WaveformSpectrum.vue'
import MountainSpectrum from './MountainSpectrum.vue'
import { Play, Pause, Shuffle, Repeat2, ThumbsUp, ThumbsDown, SkipBack, SkipForward } from 'lucide-vue-next'
import type { Track } from '../../types/music'

const props = defineProps<{
  track?: Track
  isPlaying: boolean
  progress: number
  spectrum: number[]
  isShuffle: boolean
  repeat: boolean
  playbackError?: string
}>()

const emit = defineEmits<{
  (e: 'toggle-play'): void
  (e: 'toggle-shuffle'): void
  (e: 'toggle-repeat'): void
  (e: 'next-track'): void
  (e: 'prev-track'): void
  (e: 'seek', seconds: number): void
  (e: 'rate-track', rating: 'like' | 'dislike'): void
}>()

const { ARC_LENGTH, ARC_PATH, ARC_START, ARC_END, arcStrokeDashoffset, arcKnobPos, onArcPointerDown, onArcPointerMove, onArcPointerUp } =
  useArcSeek(() => props.track?.duration ?? 0, () => props.progress, seconds => emit('seek', seconds))

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
function seekByKeyboard(event: KeyboardEvent) {
  const duration = props.track?.duration ?? 0
  const step = event.shiftKey ? 15 : 5
  const values: Record<string, number> = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, Home: -props.progress, End: duration - props.progress }
  if (!(event.key in values)) return
  event.preventDefault()
  emit('seek', Math.max(0, Math.min(duration, props.progress + values[event.key])))
}
</script>

<template>
  <div class="player-wrapper">
    <MountainSpectrum :active="isPlaying" :progress="progress" :spectrum="spectrum" />
    <!-- Turntable composed as independent art, timeline, and transport layers. -->
    <div class="vinyl-stage">
      <div class="circular-deck-container">
        <div class="deck-outer-ring"></div>

        <div class="vinyl-art-layer">
          <div class="vinyl-disc" :class="{ spinning: isPlaying }">
            <div class="vinyl-texture"></div>
          </div>
        </div>

        <svg
          class="timeline-layer circular-seek-svg"
          viewBox="0 0 350 350"
          role="slider"
          tabindex="0"
          aria-label="Track position"
          aria-valuemin="0"
          :aria-valuemax="track?.duration ?? 0"
          :aria-valuenow="progress"
          :aria-valuetext="`${formatTime(progress)} of ${formatTime(track?.duration ?? 0)}`"
          @keydown="seekByKeyboard"
          @pointerdown="onArcPointerDown"
          @pointermove="onArcPointerMove"
          @pointerup="onArcPointerUp"
          @pointercancel="onArcPointerUp"
        >
          <defs>
            <linearGradient id="arcGradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#ff735d" />
              <stop offset="100%" stop-color="#ff4365" />
            </linearGradient>
            <filter id="arcGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="glow" />
              <feComposite in="SourceGraphic" in2="glow" operator="over" />
            </filter>
          </defs>

          <!-- Inactive Arc Track -->
          <path
            class="seek-track-bg"
            :d="ARC_PATH"
            fill="none"
          />

          <!-- Active Progress Arc Track -->
          <path
            class="seek-track-progress"
            :d="ARC_PATH"
            fill="none"
            stroke="url(#arcGradient)"
            :stroke-dasharray="ARC_LENGTH"
            :stroke-dashoffset="arcStrokeDashoffset"
            filter="url(#arcGlow)"
          />

          <circle class="seek-endpoint seek-endpoint-start" :cx="ARC_START.x" :cy="ARC_START.y" r="3" />
          <circle class="seek-endpoint seek-endpoint-end" :cx="ARC_END.x" :cy="ARC_END.y" r="3" />

          <!-- Glowing Progress Handle / Knob -->
          <circle
            class="seek-knob-outer"
            :cx="arcKnobPos.x"
            :cy="arcKnobPos.y"
            r="4"
          />
          <circle
            class="seek-knob-inner"
            :cx="arcKnobPos.x"
            :cy="arcKnobPos.y"
            r="4"
          />
        </svg>

        <button
          class="play-control-layer vinyl-center-hub"
          :aria-label="isPlaying ? 'Pause' : 'Play'"
          @click="emit('toggle-play')"
        >
          <span class="center-play-button">
            <Pause v-if="isPlaying" :size="22" fill="currentColor" />
            <Play v-else :size="22" fill="currentColor" class="play-icon-offset" />
          </span>
        </button>
      </div>
    </div>

    <!-- Track Info: Title & Artist -->
    <div class="track-info-centered">
      <h2>{{ track?.title ?? 'Nothing selected' }}</h2>
      <p>{{ track?.artist ?? 'Add a track to begin' }}</p>
    </div>

    <!-- Waveform Visualizer -->
    <WaveformSpectrum :active="isPlaying" />

    <div class="minimal-transport">
      <button class="neumorph-btn" :class="{ selected: track?.rating === 'like' }" :aria-pressed="track?.rating === 'like'" :disabled="!track" aria-label="Like" title="Like" @click="emit('rate-track', 'like')">
        <ThumbsUp :size="18" />
      </button>
      <button class="neumorph-btn" aria-label="Previous track" title="Previous" @click="emit('prev-track')">
        <SkipBack :size="18" />
      </button>
      <button
        class="neumorph-btn"
        :class="{ selected: isShuffle }"
        aria-label="Shuffle"
        title="Shuffle"
        @click="emit('toggle-shuffle')"
      >
        <Shuffle :size="18" />
      </button>
      <button class="neumorph-btn" aria-label="Next track" title="Next" @click="emit('next-track')">
        <SkipForward :size="18" />
      </button>
      <button
        class="neumorph-btn"
        :class="{ selected: repeat }"
        aria-label="Repeat"
        title="Repeat"
        @click="emit('toggle-repeat')"
      >
        <Repeat2 :size="18" />
      </button>
      <button class="neumorph-btn" :class="{ selected: track?.rating === 'dislike' }" :aria-pressed="track?.rating === 'dislike'" :disabled="!track" aria-label="Dislike" title="Dislike" @click="emit('rate-track', 'dislike')">
        <ThumbsDown :size="18" />
      </button>
    </div>

    <p v-if="playbackError" class="playback-error">{{ playbackError }}</p>
  </div>
</template>

