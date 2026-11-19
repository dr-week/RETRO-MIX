<script setup lang="ts">
import { Disc3, Search, Heart, Plus, LoaderCircle, ThumbsUp, ThumbsDown, Clock3, Sparkles, Library, Play, Pause } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import type { Track } from '../../types/music'

const emit = defineEmits<{
  (e: 'update:query', value: string): void
  (e: 'select-track', track: Track): void
  (e: 'rate-track', track: Track, rating: 'like' | 'dislike'): void
  (e: 'add-files', event: Event): void
}>()

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const section = ref<'all' | 'liked' | 'recent' | 'suggested' | 'chill' | 'pop' | 'acoustic' | 'energy'>('all')
const props = defineProps<{
  filteredTracks: Track[]; recentTracks: Track[]; suggestedTracks: Track[]; currentTrack?: Track
  isPlaying: boolean; importing: boolean; query: string
}>()
const visibleTracks = computed(() => {
  if (section.value === 'liked') return props.filteredTracks.filter(track => track.rating === 'like' || track.favorite)
  if (section.value === 'recent') return props.recentTracks.filter(track => matchesQuery(track))
  if (section.value === 'suggested') return props.suggestedTracks.filter(matchesQuery)
  if (['chill', 'pop', 'acoustic', 'energy'].includes(section.value)) {
    return props.filteredTracks.filter(t => (t.genre || '').toLowerCase() === section.value && matchesQuery(t))
  }
  return props.filteredTracks.filter(track => track.rating !== 'dislike')
})
const matchesQuery = (track: Track) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(props.query.toLowerCase())
const groupBy = ref<'all' | 'artist' | 'album'>('all')
const groups = computed(() => {
  if (groupBy.value === 'all') return [{ name: '', tracks: visibleTracks.value }]
  const grouped = new Map<string, Track[]>()
  for (const track of visibleTracks.value) {
    const name = track[groupBy.value] || (groupBy.value === 'artist' ? 'Unknown artist' : 'Singles')
    const items = grouped.get(name) ?? []
    items.push(track)
    grouped.set(name, items)
  }
  return Array.from(grouped, ([name, tracks]) => ({ name, tracks })).sort((a, b) => a.name.localeCompare(b.name))
})
</script>

<template>
  <div class="library-view">
    <div class="section-header">
      <h2 class="section-title">Your library</h2>
      <label class="icon-import-btn" :title="importing ? 'Importing' : 'Import MP3'">
        <LoaderCircle v-if="importing" :size="16" class="loader" />
        <Plus v-else :size="16" />
        <input type="file" accept="audio/mpeg,.mp3" multiple :disabled="importing" @change="emit('add-files', $event)" />
      </label>
    </div>

    <nav class="library-sections" aria-label="Library sections">
      <button :class="{ active: section === 'all' }" @click="section = 'all'"><Library :size="15" /> All</button>
      <button :class="{ active: section === 'liked' }" @click="section = 'liked'"><Heart :size="15" /> Liked</button>
      <button :class="{ active: section === 'recent' }" @click="section = 'recent'"><Clock3 :size="15" /> Recent</button>
      <button :class="{ active: section === 'suggested' }" @click="section = 'suggested'"><Sparkles :size="15" /> For you</button>
      <button :class="{ active: section === 'chill' }" @click="section = 'chill'">☕ Chill</button>
      <button :class="{ active: section === 'pop' }" @click="section = 'pop'">⚡ Pop</button>
      <button :class="{ active: section === 'acoustic' }" @click="section = 'acoustic'">🎸 Acoustic</button>
      <button :class="{ active: section === 'energy' }" @click="section = 'energy'">🔥 Energy</button>
    </nav>

    <!-- Minimal Search -->
    <div class="minimal-search">
      <Search :size="16" />
      <input
        :value="query"
        type="search"
        aria-label="Search library"
        placeholder="Filter collection…"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <select v-model="groupBy" class="group-select" aria-label="Group library">
      <option value="all">Tracks</option><option value="artist">Artists</option><option value="album">Albums</option>
    </select>
    <section v-for="group in groups" :key="group.name" class="collection-group">
      <h3 v-if="group.name">{{ group.name }}</h3>
      <div class="collection-grid">
      <article
        v-for="track in group.tracks"
        :key="track.id"
        class="music-card"
        :class="{ 'is-active': currentTrack?.id === track.id }"
      >
        <button class="card-cover" :aria-label="(currentTrack?.id === track.id && isPlaying ? 'Pause ' : 'Play ') + track.title" @click="emit('select-track', track)">
          <Disc3 :size="48" :stroke-width="1" /><img v-if="track.cover" :src="track.cover" alt="" loading="lazy" @error="($event.target as HTMLImageElement).hidden = true" />
          <span class="card-play"><Pause v-if="currentTrack?.id === track.id && isPlaying" :size="20" fill="currentColor" /><Play v-else :size="20" fill="currentColor" /></span>
          <span class="card-duration">{{ formatTime(track.duration) }}</span>
        </button>

        <div class="row-info">
          <span class="row-name">{{ track.title }}</span>
          <span class="row-artist">{{ track.artist }}</span>
        </div>


        <div class="rating-actions">
          <button class="row-action-btn" :class="{ 'is-active': track.rating === 'like' || track.favorite }" :aria-label="track.rating === 'like' || track.favorite ? 'Remove from liked songs' : 'Like and save track'" @click.stop="emit('rate-track', track, 'like')"><ThumbsUp :size="15" /></button>
          <button class="row-action-btn" :class="{ 'is-active': track.rating === 'dislike' }" :aria-label="track.rating === 'dislike' ? 'Remove dislike' : 'Dislike track'" @click.stop="emit('rate-track', track, 'dislike')"><ThumbsDown :size="15" /></button>
        </div>
      </article>
      </div>
    </section>

      <div v-if="visibleTracks.length === 0" class="minimal-empty">
        <Disc3 :size="32" :stroke-width="1.4" />
        <p>{{ section === 'liked' ? 'Liked tracks are saved here automatically.' : section === 'suggested' ? 'Play or like a few tracks to get suggestions.' : 'No tracks found.' }}</p>
      </div>
  </div>
</template>

<style scoped lang="scss">
.group-select { margin:16px 0; padding:9px 12px; border:1px solid #ffffff20; border-radius:6px; background:#211c22; color:#e8dfe5; font:inherit; font-size:12px; }
.collection-group { margin-bottom:24px; }
.collection-group h3 { font-size:14px; font-weight:550; margin:0 0 14px; }
.collection-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(145px,1fr)); gap:22px 16px; }
.music-card { min-width:0; border-radius:8px; }
.card-cover { position:relative; display:grid; place-items:center; width:100%; aspect-ratio:1; padding:0; overflow:hidden; border:1px solid #ffffff12; border-radius:8px; background:#29222a; color:#b5a4b0; }
.card-cover img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.card-cover { background-image:url('../../assets/vinyl-texture.png'); background-size:cover; }
.card-play { position:absolute; right:10px; bottom:10px; display:grid; place-items:center; width:38px; height:38px; border-radius:50%; background:#18121cdc; color:white; transition:transform .25s; }
.card-cover:hover .card-play { transform:scale(1.08); }
.is-active .card-cover { border-color:#ed9cb2; }
.card-duration { position:absolute; left:8px; bottom:12px; padding:3px 5px; border-radius:4px; background:#0009; color:#eee7eb; font-size:10px; }
.music-card .row-info { display:grid; gap:5px; min-width:0; padding:10px 0 4px; }
.music-card .row-name,.music-card .row-artist { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.music-card .row-name { font-size:12px; color:#f6edf2; }.music-card .row-artist { font-size:11px; color:#a99ca5; }
@media(max-width:440px) { .collection-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px 12px; } }
@media(prefers-reduced-motion:reduce) { .card-play { transition:none; } }
.icon-import-btn {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  display: grid;
  place-items: center;
  color: #9b8f9a;
  cursor: pointer;
  transition: all 0.2s;
  input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  &:hover { border-color: rgba(255, 95, 125, 0.4); color: #fff; background: rgba(255, 95, 125, 0.1); }
}
.library-sections { display: flex; gap: 8px; overflow-x: auto; margin: 16px 0 12px; scrollbar-width: none; }
.library-sections button { display: inline-flex; align-items: center; gap: 7px; padding: 9px 12px; border: 1px solid rgba(255,255,255,.09); border-radius: 999px; color: #b8aeb8; background: rgba(255,255,255,.035); white-space: nowrap; cursor: pointer; }
.library-sections button.active { color: #fff; border-color: rgba(255,95,125,.48); background: rgba(255,95,125,.13); }
.rating-actions { display: flex; gap: 2px; }
.row-action-btn { border: 0; background: transparent; color: #938995; cursor: pointer; padding: 7px; border-radius: 50%; }
.row-action-btn:hover, .row-action-btn.is-active { color: #ff6487; background: rgba(255,100,135,.12); }
.loader { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
