<script setup lang="ts">
import { Disc3, Pause, Play, SkipForward } from 'lucide-vue-next'
import type { Track } from '../../types/music'

defineProps<{
  track: Track
  isPlaying: boolean
  progress: number
}>()

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'toggle-play'): void
  (e: 'next-track'): void
}>()
</script>

<template>
  <div class="mini-player" @click="emit('click')">
    <span
      class="mini-cover"
      :class="{ 'is-spinning': isPlaying }"
      :style="{ backgroundImage: track.cover ? `url(${track.cover})` : '' }"
    >
      <Disc3 v-if="!track.cover" :size="18" />
    </span>

    <div class="mini-copy">
      <strong>{{ track.title }}</strong>
      <small>{{ track.artist }}</small>
    </div>

    <button
      class="mini-play"
      :aria-label="isPlaying ? 'Pause' : 'Play'"
      @click.stop="emit('toggle-play')"
    >
      <Pause v-if="isPlaying" :size="16" fill="currentColor" />
      <Play v-else :size="16" fill="currentColor" class="offset-play" />
    </button>

    <button
      class="mini-skip"
      aria-label="Next track"
      title="Next"
      @click.stop="emit('next-track')"
    >
      <SkipForward :size="16" />
    </button>

    <div
      class="mini-progress"
      :style="{ '--mini-progress': `${track.duration ? (progress / track.duration) * 100 : 0}%` }"
    />
  </div>
</template>

<style scoped lang="scss">
.mini-player {
  position: fixed;
  left: max(16px, env(safe-area-inset-left));
  right: max(16px, env(safe-area-inset-right));
  max-width: 540px;
  margin: 0 auto;
  bottom: calc(14px + env(safe-area-inset-bottom));
  height: 60px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  background: rgba(22, 17, 24, 0.88);
  border: 1px solid rgba(255, 140, 165, 0.22);
  border-radius: 18px;
  box-shadow: 0 14px 38px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  z-index: 80;
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.2s;
  &:hover { transform: translateY(-2px); border-color: rgba(255, 140, 165, 0.4); }
}

.mini-cover {
  width: 40px;
  height: 40px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background-color: #1a161c;
  background-size: cover;
  background-position: center;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  &.is-spinning { animation: mini-spin 7s linear infinite; }
}

.mini-copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  strong {
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  small {
    color: #8b808a;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.mini-play {
  width: 36px;
  height: 36px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  cursor: pointer;
  transition: transform 0.18s, background 0.18s;
  &:hover { transform: scale(1.08); background: #ff5277; color: #fff; border-color: transparent; }
  &:active { transform: scale(0.92); }
}
.mini-skip {
  width: 32px;
  height: 32px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 0;
  background: transparent;
  color: #9a8f99;
  cursor: pointer;
  transition: transform 0.18s, color 0.18s;
  &:hover { transform: scale(1.08); color: #fff; }
  &:active { transform: scale(0.92); }
}
.offset-play { margin-left: 2px; }

.mini-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2.5px;
  background: linear-gradient(90deg, #ff5277 var(--mini-progress), rgba(255, 255, 255, 0.06) var(--mini-progress));
}

@keyframes mini-spin { to { transform: rotate(360deg); } }
</style>
