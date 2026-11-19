<script setup lang="ts">
import { ref, watch } from 'vue'
import { Sparkles, ListMusic, FolderHeart, Disc3 } from 'lucide-vue-next'
import type { Section, NavSection, GeneratedPlaylist } from './types/music'
import { usePlayback } from './composables/usePlayback'
import { useDiscovery } from './composables/useDiscovery'
import { useTrackDownloader } from './composables/useTrackDownloader'
import { useLibrary } from './composables/useLibrary'

import TopBar from './components/layout/TopBar.vue'
import SceneryLayers from './components/layout/SceneryLayers.vue'
import SidebarDock from './components/navigation/SidebarDock.vue'
import VinylPlayer from './components/player/VinylPlayer.vue'
import MiniPlayer from './components/player/MiniPlayer.vue'
import LibraryView from './components/library/LibraryView.vue'
import DownloadsView from './components/downloads/DownloadsView.vue'
import DiscoverView from './components/discover/DiscoverView.vue'
import PlaylistView from './components/playlist/PlaylistView.vue'

const tracks = ref<any[]>([])
const activeTab = ref<Section>('player')
const previousTab = ref<Section>('player')

watch(activeTab, tab => {
  const locked = tab === 'player'
  document.documentElement.classList.toggle('player-mode', locked)
  document.body.classList.toggle('player-mode', locked)
}, { immediate: true })

function toggleDownloads() {
  if (activeTab.value === 'downloads') {
    activeTab.value = previousTab.value === 'downloads' ? 'player' : previousTab.value
  } else {
    previousTab.value = activeTab.value
    activeTab.value = 'downloads'
  }
}

const navSections: NavSection[] = [
  { id: 'discover', label: 'Discover', subtitle: 'Search Music', icon: Sparkles },
  { id: 'playlist', label: 'Playlist', subtitle: 'Queue & Mix', icon: ListMusic },
  { id: 'library', label: 'Library', subtitle: 'Collection', icon: FolderHeart },
  { id: 'player', label: 'Listen', subtitle: 'Turntable Player', icon: Disc3 }
]

const { currentTrack, isPlaying, playbackError, isShuffle, repeat, progress, spectrum, togglePlayback, selectTrack, onSeek, nextTrack, previousTrack, toggleShuffle } = usePlayback(tracks)
const { discoverQuery, discoverTracks, youtubeTracks, searching, discoverError, trends, loadingTrends, trendError, clearDiscovery, playTrend } = useDiscovery(selectTrack, () => activeTab.value = 'player')
const { downloading, downloadError, importing, activeDownloads, downloadYouTube, downloadArchive, importMp3Files, removeOffline } = useTrackDownloader(tracks, activeTab)
const { query, offlineQuery, playlists, filteredTracks, recentTracks, suggestedTracks, offlineTracks, offlineSize, initLibrary, rateTrack } = useLibrary(tracks, trends)

void initLibrary()

function loadPlaylist(pl: GeneratedPlaylist) {
  const subset = tracks.value.filter(t => pl.trackIds.includes(t.id))
  if (subset.length > 0) {
    tracks.value = [...subset]
    selectTrack(subset[0])
    activeTab.value = 'player'
  }
}
</script>

<template>
  <div class="app-shell" :data-active-tab="activeTab">
    <SceneryLayers :playing="isPlaying && activeTab === 'player'" />
    <TopBar :is-playing="isPlaying" :is-downloads-open="activeTab === 'downloads'" @go-player="activeTab = 'player'" @toggle-downloads="toggleDownloads" />
    <SidebarDock :sections="navSections" :active-tab="activeTab" :is-playing="isPlaying" :current-time="progress" :duration="currentTrack?.duration ?? 0" @select="s => activeTab = s" />

    <main class="layout" :data-active-tab="activeTab">
      <section v-show="activeTab === 'player'" class="player-column">
        <VinylPlayer
          :track="currentTrack" :is-playing="isPlaying" :progress="progress" :spectrum="spectrum"
          :is-shuffle="isShuffle" :repeat="repeat" :playback-error="playbackError"
          @toggle-play="togglePlayback" @toggle-shuffle="toggleShuffle" @toggle-repeat="repeat = !repeat"
          @seek="onSeek" @next-track="nextTrack" @prev-track="previousTrack"
          @rate-track="rating => currentTrack && rateTrack(currentTrack, rating)"
        />
      </section>

      <section v-show="activeTab !== 'player'" class="library-column">
        <PlaylistView
          v-if="activeTab === 'playlist'" :tracks="tracks" :current-track="currentTrack"
          :is-playing="isPlaying" :playlists="playlists"
          @select-track="selectTrack" @remove-track="idx => tracks.splice(idx, 1)"
          @toggle-shuffle="toggleShuffle" @load-playlist="loadPlaylist"
        />

        <LibraryView
          v-if="activeTab === 'library'" v-model:query="query"
          :filtered-tracks="filteredTracks" :recent-tracks="recentTracks" :suggested-tracks="suggestedTracks"
          :current-track="currentTrack" :is-playing="isPlaying" :importing="importing"
          @select-track="selectTrack" @rate-track="rateTrack" @add-files="importMp3Files"
        />

        <transition name="vortex">
          <DownloadsView
            v-if="activeTab === 'downloads'" v-model:offline-query="offlineQuery"
            :offline-tracks="offlineTracks" :offline-size="offlineSize"
            :current-track="currentTrack" :is-playing="isPlaying" :active-downloads="activeDownloads"
            @select-track="selectTrack" @remove-track="t => removeOffline(t, () => { if (currentTrack?.id === t.id) isPlaying = false })"
            @go-discover="activeTab = 'discover'"
          />
        </transition>

        <DiscoverView
          v-if="activeTab === 'discover'" v-model:discover-query="discoverQuery"
          :discover-tracks="discoverTracks" :youtube-tracks="youtubeTracks" :searching="searching"
          :downloading="downloading" :discover-error="discoverError || downloadError"
          :trends="trends" :loading-trends="loadingTrends" :trend-error="trendError"
          @clear="clearDiscovery" @play-trend="playTrend"
          @select-archive="track => { selectTrack({ id: `archive-${track.id}`, title: track.title, artist: track.artist, album: track.album, duration: track.duration, cover: track.cover, src: track.downloadUrl }); activeTab = 'player' }"
          @select-youtube="track => { selectTrack({ id: `youtube-${track.id}`, title: track.title, artist: track.artist, album: 'YouTube', duration: track.duration, cover: track.cover, src: '', youtubeUrl: track.url }); activeTab = 'player' }"
          @download-youtube="downloadYouTube" @download-archive="downloadArchive"
        />
      </section>
    </main>

    <MiniPlayer
      v-if="activeTab !== 'player' && currentTrack" :track="currentTrack"
      :is-playing="isPlaying" :progress="progress"
      @click="activeTab = 'player'" @toggle-play="togglePlayback"
      @next-track="nextTrack" @prev-track="previousTrack"
    />
  </div>
</template>
