<script setup lang="ts">
import { computed } from 'vue'
import { Search, LoaderCircle, X, Download, Play } from 'lucide-vue-next'
import type { DiscoveryTrack, YouTubeResult } from '../../types/music'
import type { TrendTrack } from '../../services/popularMusicService'
import { scoreMusicMatch } from '../../services/musicDiscoveryService'

const props = defineProps<{
  discoverQuery: string; discoverTracks: DiscoveryTrack[]; youtubeTracks: YouTubeResult[]
  searching: boolean; downloading: string | null; discoverError: string
  trends: TrendTrack[]; loadingTrends: boolean; trendError: string
}>()

const emit = defineEmits<{
  (e: 'update:discoverQuery', val: string): void; (e: 'clear'): void
  (e: 'select-youtube', track: YouTubeResult): void; (e: 'download-youtube', track: YouTubeResult): void
  (e: 'select-archive', track: DiscoveryTrack): void
  (e: 'download-archive', track: DiscoveryTrack): void; (e: 'play-trend', track: TrendTrack): void
}>()

function formatDuration(sec: number): string {
  if (!sec || isNaN(sec)) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const results = computed(() => {
  const combined = [
    ...props.discoverTracks.map(track => ({ key: `archive-${track.id}`, source: 'archive' as const, track })),
    ...props.youtubeTracks.map(track => ({ key: `youtube-${track.id}`, source: 'youtube' as const, track }))
  ]

  if (!props.discoverQuery.trim()) return combined
  const score = (result: typeof combined[number]) => scoreMusicMatch(
    props.discoverQuery, result.track.title, result.track.artist,
    result.source === 'archive' ? result.track.keywords : ''
  )
  return combined.filter(result => result.source === 'youtube' || score(result) > 0).sort((a, b) => score(b) - score(a))
})
</script>

<template>
  <div class="discover-view">
    <div class="section-header">
      <h2 class="section-title">Discover</h2>
      <span v-if="!discoverQuery" class="section-meta">Popular · open license</span>
      <span v-else class="section-meta">Search</span>
    </div>

    <!-- Minimal Search Bar -->
    <div class="minimal-search">
      <Search :size="16" />
      <input
        :value="discoverQuery"
        type="search"
        aria-label="Search music"
        placeholder="Search music…"
        @input="emit('update:discoverQuery', ($event.target as HTMLInputElement).value)"
      />
      <button v-if="discoverQuery" class="clear-btn" aria-label="Clear" @click="emit('update:discoverQuery', ''); emit('clear')">
        <X :size="15" />
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="(searching && !results.length) || (!discoverQuery && loadingTrends)" class="minimal-empty">
      <LoaderCircle :size="24" class="loader" />
      <p>{{ searching ? 'Searching…' : 'Loading…' }}</p>
    </div>
    <div v-else-if="discoverQuery && discoverError" class="minimal-empty"><p>{{ discoverError }}</p></div>
    <div v-else-if="trendError && !discoverQuery" class="minimal-empty"><p>{{ trendError }}</p></div>

    <!-- Search Results List -->
    <div v-else-if="discoverQuery && results.length" class="minimal-list">
      <div
        v-for="result in results"
        :key="result.key"
        class="minimal-row"
        @click="result.source === 'youtube' ? emit('select-youtube', result.track) : emit('select-archive', result.track)"
      >
        <img :src="result.track.cover" class="row-thumb" alt="" />
        <div class="row-info">
          <span class="row-name">{{ result.track.title }}</span>
          <span class="row-artist">{{ result.track.artist }}</span>
        </div>

        <span v-if="result.track.duration" class="row-time">{{ formatDuration(result.track.duration) }}</span>

        <button
          class="row-action-btn"
          :disabled="downloading === result.track.id"
          :title="downloading === result.track.id ? 'Downloading' : 'Download'"
          @click.stop="result.source === 'youtube' ? emit('download-youtube', result.track) : emit('download-archive', result.track)"
        >
          <LoaderCircle v-if="downloading === result.track.id" :size="15" class="loader" />
          <Download v-else :size="15" />
        </button>
      </div>
    </div>

    <!-- Trending List -->
    <div v-else-if="!discoverQuery && trends.length" class="minimal-list">
      <div
        v-for="(track, index) in trends"
        :key="track.id"
        class="minimal-row"
        @click="emit('play-trend', track)"
      >
        <span class="rank-num">{{ String(index + 1).padStart(2, '0') }}</span>
        <img :src="track.cover" class="row-thumb" alt="" />
        <div class="row-info">
          <span class="row-name">{{ track.title }}</span>
          <span class="row-artist">{{ track.artist }}</span>
        </div>

        <button class="row-action-btn" :aria-label="`Play ${track.title}`" @click.stop="emit('play-trend', track)">
          <Play :size="14" fill="currentColor" />
        </button>
      </div>
    </div>

    <!-- Empty Results -->
    <div v-else-if="discoverQuery" class="minimal-empty">
      <p>No results found.</p>
    </div>
    <div v-else class="minimal-empty"><p>No popular open-license tracks found.</p></div>
  </div>
</template>

<style scoped lang="scss">
.clear-btn {
  display: grid;
  place-items: center;
  color: #7b717a;
  cursor: pointer;
  border: 0;
  background: transparent;
  padding: 0;
  &:hover { color: #fff; }
}
.rank-num {
  width: 20px;
  flex: none;
  color: #554b54;
  font: 500 11px 'IBM Plex Mono', monospace;
  text-align: center;
}
.loader { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
