<script setup lang="ts">
import { Disc3, Trash2, ListMusic, Shuffle, Sparkles, Play } from 'lucide-vue-next'
import type { Track, GeneratedPlaylist } from '../../types/music'
import PlaylistMaker from './PlaylistMaker.vue'

defineProps<{
  tracks: Track[]
  currentTrack?: Track
  isPlaying: boolean
  playlists?: GeneratedPlaylist[]
  manualPlaylists: GeneratedPlaylist[]
  seedTrack?: Track
  becauseYouPlayed: Track[]
  moreLikeYourLikes: Track[]
  aiGenerating: boolean
  aiStatus: string
}>()

const emit = defineEmits<{
  (e: 'select-track', track: Track): void
  (e: 'remove-track', index: number): void
  (e: 'toggle-shuffle'): void
  (e: 'load-playlist', playlist: GeneratedPlaylist): void
  (e: 'dj-playlist', playlist: GeneratedPlaylist): void
  (e: 'create-playlist', name: string): void
  (e: 'rename-playlist', id: string, name: string): void
  (e: 'delete-playlist', id: string): void
  (e: 'add-playlist-track', playlistId: string, track: Track): void
  (e: 'remove-playlist-track', playlistId: string, index: number): void
  (e: 'reorder-playlist-track', playlistId: string, from: number, to: number): void
  (e: 'generate-ai', prompt: string, includeDiscover: boolean): void
}>()

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
</script>

<template>
  <div class="playlist-view">
    <PlaylistMaker
      :tracks="tracks"
      :manual-playlists="manualPlaylists"
      :seed-track="seedTrack"
      :because-you-played="becauseYouPlayed"
      :more-like-your-likes="moreLikeYourLikes"
      :ai-generating="aiGenerating"
      :ai-status="aiStatus"
      @create-playlist="name => emit('create-playlist', name)"
      @rename-playlist="(id, name) => emit('rename-playlist', id, name)"
      @delete-playlist="id => emit('delete-playlist', id)"
      @add-track="(plId, track) => emit('add-playlist-track', plId, track)"
      @remove-track="(plId, idx) => emit('remove-playlist-track', plId, idx)"
      @reorder-track="(plId, from, to) => emit('reorder-playlist-track', plId, from, to)"
      @generate-ai="(prompt, disc) => emit('generate-ai', prompt, disc)"
      @load-playlist="pl => emit('load-playlist', pl)"
      @dj-playlist="pl => emit('dj-playlist', pl)"
      @select-track="t => emit('select-track', t)"
    />

    <!-- Spotify-style Auto-Generated Mixes -->
    <section v-if="playlists && playlists.length > 0" class="auto-mix-section">
      <div class="mix-header">
        <h3 class="mix-title"><Sparkles :size="15" /> Daily Mixes & Vibes</h3>
      </div>
      <div class="mix-scroll-row">
        <div
          v-for="pl in playlists"
          :key="pl.id"
          class="mix-card"
          @click="emit('load-playlist', pl)"
        >
          <div class="mix-art" :style="{ backgroundImage: pl.cover ? `url(${pl.cover})` : '' }">
            <Disc3 v-if="!pl.cover" :size="24" />
            <button class="mix-play-badge" :aria-label="`Play ${pl.name}`">
              <Play :size="14" fill="currentColor" />
            </button>
          </div>
          <span class="mix-name">{{ pl.name }}</span>
          <span class="mix-sub">{{ pl.genre }} • {{ pl.trackIds.length }} tracks</span>
        </div>
      </div>
    </section>

    <div class="section-header">
      <h2 class="section-title">Queue</h2>
      <div class="playlist-header-actions">
        <span class="section-meta">{{ tracks.length }} tracks</span>
        <button
          v-if="tracks.length > 1"
          class="row-action-btn"
          title="Shuffle queue"
          aria-label="Shuffle queue"
          @click="emit('toggle-shuffle')"
        >
          <Shuffle :size="16" />
        </button>
      </div>
    </div>

    <div v-if="tracks.length" class="minimal-list">
      <div
        v-for="(track, index) in tracks"
        :key="`${track.id}-${index}`"
        class="minimal-row"
        :class="{ 'is-active': currentTrack?.id === track.id }"
        @click="emit('select-track', track)"
      >
        <span class="row-thumb" :style="{ backgroundImage: track.cover ? `url(${track.cover})` : '' }">
          <Disc3 v-if="!track.cover" :size="18" />
        </span>

        <div class="row-info">
          <span class="row-name">{{ track.title }}</span>
          <span class="row-artist">{{ track.artist }}</span>
        </div>

        <div v-if="currentTrack?.id === track.id && isPlaying" class="mini-waveform" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>

        <span class="row-time">{{ formatTime(track.duration) }}</span>

        <button
          class="row-action-btn"
          :aria-label="`Remove ${track.title} from queue`"
          title="Remove"
          @click.stop="emit('remove-track', index)"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <div v-else class="minimal-empty">
      <ListMusic :size="32" :stroke-width="1.4" />
      <p>Queue is empty.</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.auto-mix-section {
  margin-bottom: 24px;
}
.mix-header {
  margin-bottom: 12px;
}
.mix-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #ff85a1;
  margin: 0;
}
.mix-scroll-row {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
  scrollbar-width: none;
}
.mix-card {
  flex: 0 0 120px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 8px;
  transition: transform 0.2s, border-color 0.2s;
  &:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 95, 125, 0.4);
  }
}
.mix-art {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  background: #251e26;
  background-size: cover;
  background-position: center;
  display: grid;
  place-items: center;
  color: #7d6e79;
}
.mix-play-badge {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: #ff5f7d;
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.mix-name {
  font-size: 12px;
  font-weight: 600;
  color: #f7eff4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mix-sub {
  font-size: 10px;
  color: #9f919d;
}
.playlist-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
