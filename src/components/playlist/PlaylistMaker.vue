<script setup lang="ts">
import { computed, ref } from 'vue'
import { Sparkles, Plus, Play, Trash2, ArrowUp, ArrowDown, Disc3, SlidersHorizontal, Check, Edit3 } from 'lucide-vue-next'
import type { GeneratedPlaylist, Track } from '../../types/music'

const props = defineProps<{
  tracks: Track[]
  manualPlaylists: GeneratedPlaylist[]
  seedTrack?: Track
  becauseYouPlayed: Track[]
  moreLikeYourLikes: Track[]
  aiGenerating: boolean
  aiStatus: string
}>()

const emit = defineEmits<{
  (e: 'create-playlist', name: string): void
  (e: 'rename-playlist', id: string, name: string): void
  (e: 'delete-playlist', id: string): void
  (e: 'add-track', playlistId: string, track: Track): void
  (e: 'remove-track', playlistId: string, index: number): void
  (e: 'reorder-track', playlistId: string, from: number, to: number): void
  (e: 'generate-ai', prompt: string, includeDiscover: boolean): void
  (e: 'load-playlist', playlist: GeneratedPlaylist): void
  (e: 'dj-playlist', playlist: GeneratedPlaylist): void
  (e: 'select-track', track: Track): void
}>()

const aiPrompt = ref('')
const includeDiscover = ref(true)
const newName = ref('')
const selectedId = ref<string | null>(null)
const editingName = ref('')
const renaming = ref(false)
const dragIndex = ref<number | null>(null)

const selectedPlaylist = computed(() =>
  props.manualPlaylists.find(p => p.id === selectedId.value) ?? props.manualPlaylists[0] ?? null
)

const selectedTracks = computed(() => {
  if (!selectedPlaylist.value) return []
  const byId = new Map(props.tracks.map(t => [t.id, t]))
  return selectedPlaylist.value.trackIds.map(id => byId.get(id)).filter((t): t is Track => Boolean(t))
})

function submitAi() {
  if (!aiPrompt.value.trim()) return
  emit('generate-ai', aiPrompt.value.trim(), includeDiscover.value)
}

function submitNew() {
  if (!newName.value.trim()) return
  emit('create-playlist', newName.value.trim())
  newName.value = ''
}

function startRename() {
  if (!selectedPlaylist.value) return
  editingName.value = selectedPlaylist.value.name
  renaming.value = true
}

function saveRename() {
  if (selectedPlaylist.value && editingName.value.trim()) {
    emit('rename-playlist', selectedPlaylist.value.id, editingName.value.trim())
  }
  renaming.value = false
}

function addFromSelect(e: Event) {
  const sel = e.target as HTMLSelectElement
  const track = props.tracks.find(t => t.id === sel.value)
  if (track && selectedPlaylist.value) emit('add-track', selectedPlaylist.value.id, track)
  sel.value = ''
}

function onDrop(targetIndex: number) {
  if (dragIndex.value !== null && selectedPlaylist.value && dragIndex.value !== targetIndex) {
    emit('reorder-track', selectedPlaylist.value.id, dragIndex.value, targetIndex)
  }
  dragIndex.value = null
}
</script>

<template>
  <div class="maker-wrap">
    <!-- AI Prompt Playlist Maker -->
    <section class="panel ai-panel">
      <div class="panel-head">
        <h3><Sparkles :size="15" /> AI Playlist Maker</h3>
        <label class="toggle-inline">
          <input type="checkbox" v-model="includeDiscover" /> Search Discover
        </label>
      </div>
      <form class="inline-form" @submit.prevent="submitAi">
        <input
          v-model="aiPrompt"
          type="text"
          placeholder="e.g. chill study, 15 tracks · upbeat retro · acoustic night"
          :disabled="aiGenerating"
        />
        <button type="submit" class="primary-btn" :disabled="aiGenerating || !aiPrompt.trim()">
          {{ aiGenerating ? 'Generating…' : 'Generate' }}
        </button>
      </form>
      <p v-if="aiStatus" class="status-note">{{ aiStatus }}</p>
    </section>

    <!-- Manual & AI Playlists Manager -->
    <section class="panel">
      <div class="panel-head">
        <h3>Your Playlists ({{ manualPlaylists.length }})</h3>
      </div>
      <form class="inline-form" @submit.prevent="submitNew">
        <input v-model="newName" type="text" placeholder="New playlist name…" />
        <button type="submit" class="ghost-btn" :disabled="!newName.trim()"><Plus :size="14" /> Create</button>
      </form>

      <div v-if="manualPlaylists.length" class="pl-chips">
        <button
          v-for="pl in manualPlaylists"
          :key="pl.id"
          class="pl-chip"
          :class="{ active: selectedPlaylist?.id === pl.id }"
          @click="selectedId = pl.id; renaming = false"
        >
          <span>{{ pl.kind === 'ai' ? '✦ ' : '' }}{{ pl.name }}</span>
          <small>{{ pl.trackIds.length }}</small>
        </button>
      </div>

      <div v-if="selectedPlaylist" class="pl-editor">
        <div class="editor-bar">
          <div v-if="renaming" class="rename-row">
            <input v-model="editingName" @keyup.enter="saveRename" />
            <button class="icon-btn" title="Save name" @click="saveRename"><Check :size="14" /></button>
          </div>
          <div v-else class="editor-title">
            <strong>{{ selectedPlaylist.name }}</strong>
            <button class="icon-btn" title="Rename" @click="startRename"><Edit3 :size="13" /></button>
          </div>
          <div class="editor-actions">
            <button class="ghost-btn" @click="emit('load-playlist', selectedPlaylist)"><Play :size="13" /> Play</button>
            <button class="ghost-btn" @click="emit('dj-playlist', selectedPlaylist)"><SlidersHorizontal :size="13" /> Auto-DJ</button>
            <button class="icon-btn danger" title="Delete playlist" @click="emit('delete-playlist', selectedPlaylist.id)"><Trash2 :size="14" /></button>
          </div>
        </div>

        <select class="add-select" @change="addFromSelect">
          <option value="">+ Add a track to "{{ selectedPlaylist.name }}"…</option>
          <option v-for="t in tracks" :key="t.id" :value="t.id">{{ t.title }} — {{ t.artist }}</option>
        </select>

        <div v-if="selectedTracks.length" class="pl-tracks">
          <div
            v-for="(track, idx) in selectedTracks"
            :key="`${track.id}-${idx}`"
            class="pl-track-row"
            draggable="true"
            @dragstart="dragIndex = idx"
            @dragover.prevent
            @drop="onDrop(idx)"
          >
            <span class="drag-num">{{ idx + 1 }}</span>
            <div class="pl-track-meta" @click="emit('select-track', track)">
              <span class="t-title">{{ track.title }}</span>
              <span class="t-artist">{{ track.artist }}</span>
            </div>
            <button class="icon-btn" :disabled="idx === 0" title="Move up" @click="emit('reorder-track', selectedPlaylist.id, idx, idx - 1)"><ArrowUp :size="13" /></button>
            <button class="icon-btn" :disabled="idx === selectedTracks.length - 1" title="Move down" @click="emit('reorder-track', selectedPlaylist.id, idx, idx + 1)"><ArrowDown :size="13" /></button>
            <button class="icon-btn danger" title="Remove" @click="emit('remove-track', selectedPlaylist.id, idx)"><Trash2 :size="13" /></button>
          </div>
        </div>
        <p v-else class="status-note">No tracks in this playlist yet. Add from above or click + on any song.</p>
      </div>
    </section>

    <!-- Personalized Suggestions -->
    <section v-if="becauseYouPlayed.length && seedTrack" class="panel">
      <div class="panel-head">
        <h3>Because you played “{{ seedTrack.title }}”</h3>
      </div>
      <div class="suggest-row">
        <div v-for="t in becauseYouPlayed" :key="t.id" class="suggest-card">
          <div class="s-art" :style="{ backgroundImage: t.cover ? `url(${t.cover})` : '' }" @click="emit('select-track', t)">
            <Disc3 v-if="!t.cover" :size="20" />
          </div>
          <div class="s-info" @click="emit('select-track', t)">
            <span class="t-title">{{ t.title }}</span>
            <span class="t-artist">{{ t.artist }}</span>
          </div>
          <button
            v-if="selectedPlaylist"
            class="icon-btn"
            :title="`Add to ${selectedPlaylist.name}`"
            @click="emit('add-track', selectedPlaylist.id, t)"
          ><Plus :size="14" /></button>
        </div>
      </div>
    </section>

    <section v-if="moreLikeYourLikes.length" class="panel">
      <div class="panel-head">
        <h3>More like your likes</h3>
      </div>
      <div class="suggest-row">
        <div v-for="t in moreLikeYourLikes" :key="t.id" class="suggest-card">
          <div class="s-art" :style="{ backgroundImage: t.cover ? `url(${t.cover})` : '' }" @click="emit('select-track', t)">
            <Disc3 v-if="!t.cover" :size="20" />
          </div>
          <div class="s-info" @click="emit('select-track', t)">
            <span class="t-title">{{ t.title }}</span>
            <span class="t-artist">{{ t.artist }}</span>
          </div>
          <button
            v-if="selectedPlaylist"
            class="icon-btn"
            :title="`Add to ${selectedPlaylist.name}`"
            @click="emit('add-track', selectedPlaylist.id, t)"
          ><Plus :size="14" /></button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.maker-wrap { display: grid; gap: 16px; margin-bottom: 24px; }
.panel { background: rgba(255, 255, 255, 0.025); border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 12px; padding: 14px; display: grid; gap: 10px; }
.ai-panel { border-color: rgba(255, 95, 125, 0.25); background: linear-gradient(135deg, rgba(255, 95, 125, 0.06), rgba(22, 19, 28, 0.5)); }
.panel-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.panel-head h3 { margin: 0; font-size: 13px; font-weight: 600; color: #ff85a1; display: flex; align-items: center; gap: 6px; }
.toggle-inline { font-size: 11px; color: #c7b8c3; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
.inline-form { display: flex; gap: 8px; }
.inline-form input, .rename-row input, .add-select { flex: 1; min-width: 0; background: #1c1721; color: #f7eff4; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 8px 10px; font-size: 12px; }
.primary-btn { background: #ff5f7d; color: #fff; border: 0; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
.primary-btn:disabled, .ghost-btn:disabled { opacity: 0.45; cursor: default; }
.ghost-btn { display: inline-flex; align-items: center; gap: 5px; background: rgba(255, 255, 255, 0.06); color: #f7eff4; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
.ghost-btn:hover { border-color: rgba(255, 95, 125, 0.5); }
.status-note { margin: 0; font-size: 11px; color: #b7a8b4; }
.pl-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.pl-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); color: #e8dce4; font-size: 12px; cursor: pointer; }
.pl-chip.active { background: rgba(255, 95, 125, 0.18); border-color: #ff5f7d; color: #fff; }
.pl-chip small { opacity: 0.7; font-size: 10px; }
.pl-editor { display: grid; gap: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.07); }
.editor-bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; }
.editor-title, .editor-actions, .rename-row { display: flex; align-items: center; gap: 6px; }
.editor-title strong { font-size: 13px; color: #fff; }
.pl-tracks { display: grid; gap: 4px; max-height: 240px; overflow-y: auto; }
.pl-track-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.025); cursor: grab; }
.pl-track-row:hover { background: rgba(255, 255, 255, 0.05); }
.drag-num { font-size: 11px; color: #8c7d89; width: 18px; text-align: center; }
.pl-track-meta { flex: 1; min-width: 0; display: grid; cursor: pointer; }
.t-title { font-size: 12px; color: #f7eff4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t-artist { font-size: 10px; color: #9f919d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.icon-btn { border: 0; background: transparent; color: #a799a5; cursor: pointer; padding: 5px; border-radius: 6px; display: grid; place-items: center; }
.icon-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
.icon-btn.danger:hover { color: #ff708d; }
.icon-btn:disabled { opacity: 0.3; cursor: default; }
.suggest-row { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
.suggest-card { flex: 0 0 185px; display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); }
.s-art { width: 38px; height: 38px; flex: 0 0 38px; border-radius: 6px; background: #261e28; background-size: cover; background-position: center; display: grid; place-items: center; color: #8c7d89; cursor: pointer; }
.s-info { flex: 1; min-width: 0; display: grid; cursor: pointer; }
</style>
