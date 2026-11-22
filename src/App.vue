<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Sparkles, ListMusic, FolderHeart, Disc3, SlidersHorizontal } from 'lucide-vue-next'
import type { Section, NavSection, GeneratedPlaylist, Track } from './types/music'
import { usePlayback } from './composables/usePlayback'
import { useDiscovery } from './composables/useDiscovery'
import { useTrackDownloader } from './composables/useTrackDownloader'
import { useLibrary } from './composables/useLibrary'
import { usePlaylists } from './composables/usePlaylists'
import { useMixer } from './composables/useMixer'
import { useAutoDj } from './composables/useAutoDj'

import TopBar from './components/layout/TopBar.vue'
import SceneryLayers from './components/layout/SceneryLayers.vue'
import DesktopShowcase from './components/layout/DesktopShowcase.vue'
import SidebarDock from './components/navigation/SidebarDock.vue'
import VinylPlayer from './components/player/VinylPlayer.vue'
import MiniPlayer from './components/player/MiniPlayer.vue'
import LibraryView from './components/library/LibraryView.vue'
import DownloadsView from './components/downloads/DownloadsView.vue'
import DiscoverView from './components/discover/DiscoverView.vue'
import MixerView from './components/mixer/MixerView.vue'
import PlaylistView from './components/playlist/PlaylistView.vue'

const tracks = ref<Track[]>([])
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
  { id: 'mixer', label: 'Mixer', subtitle: 'DJ Decks', icon: SlidersHorizontal },
  { id: 'player', label: 'Listen', subtitle: 'Turntable Player', icon: Disc3 }
]

const { currentTrack, isPlaying, playbackError, isShuffle, repeat, progress, spectrum, togglePlayback, selectTrack, onSeek, nextTrack, previousTrack, toggleShuffle } = usePlayback(tracks)
const currentTrackId = computed(() => currentTrack.value?.id)
const { discoverQuery, discoverTracks, youtubeTracks, searching, discoverError, trends, loadingTrends, trendError, clearDiscovery, playTrend } = useDiscovery(selectTrack, () => activeTab.value = 'player')
const { autoDownload, setAutoDownload, autoDownloadTrack, prefetchTracks, storageCapMb, setStorageCapMb, downloading, downloadError, importing, activeDownloads, downloadYouTube, downloadArchive, importMp3Files, removeOffline } = useTrackDownloader(tracks, activeTab, currentTrackId)
const { query, offlineQuery, playlists, filteredTracks, recentTracks, suggestedTracks, offlineTracks, offlineSize, initLibrary, rateTrack } = useLibrary(tracks, trends)

const {
  manualPlaylists, smartPlaylists, seedTrack, becauseYouPlayed, moreLikeYourLikes,
  aiGenerating, aiStatus, createPlaylist, renamePlaylist, removePlaylist,
  addTrackToPlaylist, removeTrackFromPlaylist, reorderPlaylistTrack, generateAiPlaylist
} = usePlaylists(tracks, playlists, recentTracks, currentTrack)

const mixer = useMixer(tracks, () => {
  if (isPlaying.value) void togglePlayback()
})
const autoDj = useAutoDj(mixer, tracks, prefetchTracks)

// Keep main turntable player and DJ mixer mutually exclusive
watch(isPlaying, playing => {
  if (playing && mixer.isAnyPlaying.value) mixer.stopAll()
})

void initLibrary()
watch(currentTrack, t => { void autoDownloadTrack(t) })

function resolvePlaylistTracks(pl: GeneratedPlaylist): Track[] {
  const byId = new Map(tracks.value.map(t => [t.id, t]))
  return pl.trackIds.map(id => byId.get(id)).filter((t): t is Track => Boolean(t))
}

function loadPlaylist(pl: GeneratedPlaylist) {
  const ordered = resolvePlaylistTracks(pl)
  if (ordered.length > 0) {
    const idSet = new Set(ordered.map(t => t.id))
    const rest = tracks.value.filter(t => !idSet.has(t.id))
    tracks.value = [...ordered, ...rest]
    selectTrack(ordered[0])
    activeTab.value = 'player'
    void prefetchTracks(ordered.slice(1, 3))
  }
}

function launchDjPlaylist(pl: GeneratedPlaylist) {
  const ordered = resolvePlaylistTracks(pl)
  if (!ordered.length) return
  activeTab.value = 'mixer'
  void autoDj.startMode('playlist', { seed: ordered[0], playlist: ordered })
}

const installPrompt = ref<any>(null)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    installPrompt.value = e
  })
}
async function installWebApp() {
  if (!installPrompt.value) return
  installPrompt.value.prompt()
  await installPrompt.value.userChoice
  installPrompt.value = null
}

async function handleAddToPlaylist(track: Track, playlistId?: string) {
  if (playlistId) {
    await addTrackToPlaylist(playlistId, track)
  } else {
    const existing = manualPlaylists.value[0]
    if (existing) await addTrackToPlaylist(existing.id, track)
    else await createPlaylist('My Playlist', { trackIds: [track.id], kind: 'manual' })
  }
}
</script>

<template>
  <div class="app-shell" :data-active-tab="activeTab">
    <SceneryLayers :playing="isPlaying && activeTab === 'player'" />
    <TopBar :is-playing="isPlaying" :is-downloads-open="activeTab === 'downloads'" @go-player="activeTab = 'player'" @toggle-downloads="toggleDownloads" />
    <SidebarDock :sections="navSections" :active-tab="activeTab" :is-playing="isPlaying" :current-time="progress" :duration="currentTrack?.duration ?? 0" @select="s => activeTab = s" />

    <div class="auto-dl-bar">
      <button v-if="installPrompt" class="install-btn" @click="installWebApp">Install App</button>
      <label class="auto-dl">
        <input type="checkbox" :checked="autoDownload" @change="setAutoDownload(($event.target as HTMLInputElement).checked)" />
        Auto-download
      </label>
      <select
        class="cap-select"
        :value="storageCapMb"
        title="Offline storage cap (evicts least-recently-played)"
        aria-label="Offline storage cap"
        @change="setStorageCapMb(Number(($event.target as HTMLSelectElement).value))"
      >
        <option :value="250">250 MB</option>
        <option :value="500">500 MB</option>
        <option :value="1000">1 GB</option>
        <option :value="2000">2 GB</option>
      </select>
    </div>

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
        <div v-if="activeTab === 'player'" class="desktop-only-showcase">
          <DesktopShowcase
            :tracks="tracks"
            :current-track="currentTrack"
            :is-playing="isPlaying"
            :smart-playlists="smartPlaylists"
            :manual-playlists="manualPlaylists"
            :because-you-played="becauseYouPlayed"
            :seed-track="seedTrack"
            @select-track="selectTrack"
            @load-playlist="loadPlaylist"
            @dj-playlist="launchDjPlaylist"
            @add-to-playlist="t => void handleAddToPlaylist(t)"
            @navigate="s => activeTab = s"
          />
        </div>

        <MixerView v-if="activeTab === 'mixer'" :tracks="tracks" :mixer="mixer" :auto-dj="autoDj" />

        <PlaylistView
          v-if="activeTab === 'playlist'" :tracks="tracks" :current-track="currentTrack"
          :is-playing="isPlaying" :playlists="smartPlaylists" :manual-playlists="manualPlaylists"
          :seed-track="seedTrack" :because-you-played="becauseYouPlayed" :more-like-your-likes="moreLikeYourLikes"
          :ai-generating="aiGenerating" :ai-status="aiStatus"
          @select-track="selectTrack" @remove-track="idx => tracks.splice(idx, 1)"
          @toggle-shuffle="toggleShuffle" @load-playlist="loadPlaylist" @dj-playlist="launchDjPlaylist"
          @create-playlist="name => void createPlaylist(name)"
          @rename-playlist="(id, name) => void renamePlaylist(id, name)"
          @delete-playlist="id => void removePlaylist(id)"
          @add-playlist-track="(plId, track) => void addTrackToPlaylist(plId, track)"
          @remove-playlist-track="(plId, idx) => void removeTrackFromPlaylist(plId, idx)"
          @reorder-playlist-track="(plId, from, to) => void reorderPlaylistTrack(plId, from, to)"
          @generate-ai="(prompt, disc) => void generateAiPlaylist(prompt, disc)"
        />

        <LibraryView
          v-if="activeTab === 'library'" v-model:query="query"
          :filtered-tracks="filteredTracks" :recent-tracks="recentTracks" :suggested-tracks="suggestedTracks"
          :current-track="currentTrack" :is-playing="isPlaying" :importing="importing" :manual-playlists="manualPlaylists"
          @select-track="selectTrack" @rate-track="rateTrack" @add-files="importMp3Files"
          @add-to-playlist="handleAddToPlaylist"
        />

        <transition name="vortex">
          <DownloadsView
            v-if="activeTab === 'downloads'" v-model:offline-query="offlineQuery"
            :offline-tracks="offlineTracks" :offline-size="offlineSize"
            :current-track="currentTrack" :is-playing="isPlaying" :active-downloads="activeDownloads"
            @select-track="selectTrack" @remove-track="t => removeOffline(t, () => { if (currentTrack?.id === t.id) isPlaying = false })"
            @go-discover="activeTab = 'discover'" @add-files="importMp3Files" @reload-library="() => void initLibrary()"
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

<style scoped>
.auto-dl-bar { position: fixed; left: 12px; bottom: 12px; z-index: 40; display: flex; align-items: center; gap: 6px; background: #16131ccc; border: 1px solid #d5b7c13d; border-radius: 999px; padding: 5px 10px; backdrop-filter: blur(12px); }
.install-btn { background: #ff5f7d; color: #fff; border: 0; border-radius: 999px; padding: 3px 9px; font-size: .72rem; font-weight: 600; cursor: pointer; }
.auto-dl { font-size: .74rem; color: #f3e6ee; display: inline-flex; gap: 5px; align-items: center; cursor: pointer; }
.cap-select { background: transparent; color: #d8c7d2; border: 0; border-left: 1px solid #d5b7c133; padding-left: 6px; font-size: .72rem; cursor: pointer; outline: none; }
.cap-select option { background: #1c1721; color: #f3e6ee; }
</style>
