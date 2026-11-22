<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Disc3, Search, Trash2, ArrowDownToLine, FolderOpen, Download, Upload, HardDrive } from 'lucide-vue-next'
import type { Track, DownloadTask } from '../../types/music'
import {
  exportPhoneDataBackup,
  getDeviceFolderSummary,
  importPhoneDataBackup,
  syncAllMetadataToOpfs,
  type DeviceFolderSummary
} from '../../services/deviceStorageService'

defineProps<{
  offlineTracks: Track[]
  offlineSize: number
  offlineQuery: string
  currentTrack?: Track
  isPlaying: boolean
  activeDownloads?: DownloadTask[]
}>()

const emit = defineEmits<{
  (e: 'update:offlineQuery', value: string): void
  (e: 'select-track', track: Track): void
  (e: 'remove-track', track: Track): void
  (e: 'go-discover'): void
  (e: 'add-files', event: Event): void
  (e: 'reload-library'): void
}>()

const folderSummary = ref<DeviceFolderSummary | null>(null)
const dataStatus = ref('')

async function refreshFolders() {
  await syncAllMetadataToOpfs()
  folderSummary.value = await getDeviceFolderSummary()
}

onMounted(() => { void refreshFolders() })

async function handleRestore(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const res = await importPhoneDataBackup(file)
    dataStatus.value = `Restored ${res.playlists} playlists & ${res.likes} likes on this phone.`
    emit('reload-library')
    await refreshFolders()
  } catch {
    dataStatus.value = 'Invalid backup file.'
  } finally {
    input.value = ''
  }
}

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

const formatSize = (size: number) =>
  size <= 0
    ? '0 B'
    : size < 1_000_000
    ? `${Math.max(1, Math.round(size / 1000))} KB`
    : `${(size / 1_000_000).toFixed(1)} MB`
</script>

<template>
  <div class="downloads-view">
    <div class="section-header">
      <h2 class="section-title">Downloads & Phone Storage</h2>
      <span v-if="offlineTracks.length" class="section-meta">{{ formatSize(offlineSize) }}</span>
    </div>

    <!-- Per-Phone Isolated Folders & Offline Import -->
    <section class="device-folders-card">
      <div class="folders-head">
        <span class="folders-title"><HardDrive :size="14" /> This Device's Private Storage</span>
        <span class="folders-tag">{{ folderSummary?.opfsSupported ? 'Separate OPFS Folders' : 'Private Local DB' }}</span>
      </div>
      <div class="folders-grid">
        <div class="folder-pill">
          <strong>Music Folder</strong>
          <code>{{ folderSummary?.musicFolder ?? 'retro-mix/music/' }}</code>
          <span>{{ offlineTracks.length }} offline files</span>
        </div>
        <div class="folder-pill">
          <strong>Data Folder</strong>
          <code>{{ folderSummary?.dataFolder ?? 'retro-mix/data/' }}</code>
          <span>likes.json · playlists.json · history.json</span>
        </div>
      </div>
      <div class="folder-actions">
        <label class="folder-btn">
          <FolderOpen :size="14" /> Scan Offline Audio
          <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac" multiple @change="emit('add-files', $event)" />
        </label>
        <label class="folder-btn">
          <FolderOpen :size="14" /> Scan Folder
          <input type="file" webkitdirectory multiple @change="emit('add-files', $event)" />
        </label>
        <button class="folder-btn" @click="exportPhoneDataBackup">
          <Download :size="14" /> Backup Likes & Playlists
        </button>
        <label class="folder-btn">
          <Upload :size="14" /> Restore Data
          <input type="file" accept="application/json,.json" @change="handleRestore" />
        </label>
      </div>
      <p v-if="dataStatus" class="data-status">{{ dataStatus }}</p>
    </section>

    <!-- Active In-Progress Downloads -->
    <div v-if="activeDownloads && activeDownloads.length > 0" class="active-downloads-section">
      <h3 class="subsection-title">
        <ArrowDownToLine :size="14" /> Downloading ({{ activeDownloads.length }})
      </h3>
      <div class="download-tasks-list">
        <div v-for="task in activeDownloads" :key="task.id" class="download-task-card">
          <div class="task-info">
            <span class="task-title">{{ task.title }}</span>
            <span class="task-status">
              <span v-if="task.status === 'converting'">Converting to MP3…</span>
              <span v-else-if="task.status === 'done'">Done</span>
              <span v-else-if="task.status === 'error'" class="error-text">{{ task.error || 'Failed' }}</span>
              <span v-else>{{ task.progress }}% • ~{{ task.estimatedSeconds ?? 5 }}s remaining</span>
            </span>
          </div>
          <div class="progress-bar-container">
            <div
              class="progress-bar-fill"
              :class="{ 'is-converting': task.status === 'converting', 'is-error': task.status === 'error' }"
              :style="{ width: `${task.progress}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="offlineTracks.length > 3 || offlineQuery" class="minimal-search">
      <Search :size="16" />
      <input
        :value="offlineQuery"
        type="search"
        placeholder="Filter offline…"
        @input="emit('update:offlineQuery', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div v-if="offlineTracks.length" class="minimal-list">
      <div
        v-for="track in offlineTracks"
        :key="track.id"
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
          :aria-label="`Delete ${track.title}`"
          title="Remove"
          @click.stop="emit('remove-track', track)"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <div v-else-if="offlineQuery" class="minimal-empty">
      <p>No matching tracks.</p>
    </div>

    <div v-else class="minimal-empty">
      <Disc3 :size="32" :stroke-width="1.4" />
      <p>No offline tracks.</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.active-downloads-section {
  margin-bottom: 20px;
  padding: 12px 14px;
  background: rgba(255, 95, 125, 0.05);
  border: 1px solid rgba(255, 95, 125, 0.2);
  border-radius: 8px;
}
.subsection-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: #ff85a1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.download-tasks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.download-task-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.task-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
.task-title {
  color: #f5edf1;
  font-weight: 500;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-status {
  font-size: 11px;
  color: #c9b8c2;
}
.task-status .error-text {
  color: #ff5f7d;
}
.progress-bar-container {
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff5f7d, #ff9eb5);
  border-radius: 2px;
  transition: width 0.3s ease;
}
.progress-bar-fill.is-converting {
  background: linear-gradient(90deg, #e5a93b, #ffd166);
}
.progress-bar-fill.is-error {
  background: #ff4757;
}
.device-folders-card {
  margin-bottom: 18px;
  padding: 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: grid;
  gap: 10px;
}
.folders-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.folders-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #ff85a1;
}
.folders-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(143, 240, 184, 0.12);
  color: #8ff0b8;
}
.folders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 8px;
}
.folder-pill {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.06);
  display: grid;
  gap: 3px;
  font-size: 11px;
  color: #b7a8b4;
}
.folder-pill strong { color: #f7eff4; font-size: 11px; }
.folder-pill code { font-size: 10px; color: #ffb3c4; }
.folder-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.folder-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 11px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #f7eff4;
  font-size: 11px;
  cursor: pointer;
  overflow: hidden;
}
.folder-btn:hover { border-color: rgba(255, 95, 125, 0.5); }
.folder-btn input[type='file'] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.data-status { margin: 0; font-size: 11px; color: #8ff0b8; }
</style>
