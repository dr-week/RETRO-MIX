<script setup lang="ts">
import { computed, ref } from 'vue'
import { Disc3, Play, Pause, Sparkles, SlidersHorizontal, HardDriveDownload, Compass, Plus, ListMusic } from 'lucide-vue-next'
import type { GeneratedPlaylist, Section, Track } from '../../types/music'

const props = defineProps<{
  tracks: Track[]
  currentTrack?: Track
  isPlaying: boolean
  smartPlaylists: GeneratedPlaylist[]
  manualPlaylists: GeneratedPlaylist[]
  becauseYouPlayed: Track[]
  seedTrack?: Track
}>()

const emit = defineEmits<{
  (e: 'select-track', track: Track): void
  (e: 'load-playlist', playlist: GeneratedPlaylist): void
  (e: 'dj-playlist', playlist: GeneratedPlaylist): void
  (e: 'add-to-playlist', track: Track): void
  (e: 'navigate', section: Section): void
}>()

const activeFilter = ref<'all' | 'albums' | 'playlists'>('all')

const allPlaylists = computed(() => [...props.manualPlaylists, ...props.smartPlaylists])

const albumGroups = computed(() => {
  const map = new Map<string, { name: string; artist: string; cover?: string; tracks: Track[] }>()
  for (const t of props.tracks) {
    if (t.rating === 'dislike') continue
    const key = (t.album || 'Singles').trim()
    const existing = map.get(key)
    if (existing) {
      existing.tracks.push(t)
      if (!existing.cover && t.cover) existing.cover = t.cover
    } else {
      map.set(key, { name: key, artist: t.artist, cover: t.cover, tracks: [t] })
    }
  }
  return Array.from(map.values())
})

function onCardMove(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width - 0.5
  const y = (e.clientY - rect.top) / rect.height - 0.5
  el.style.setProperty('--rx', `${(-y * 14).toFixed(2)}deg`)
  el.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`)
  el.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`)
  el.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`)
}

function onCardLeave(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  el.style.setProperty('--rx', '0deg')
  el.style.setProperty('--ry', '0deg')
}
</script>

<template>
  <div class="desktop-showcase">
    <header class="showcase-hero">
      <div>
        <p class="hero-kicker">3D STUDIO SHELF</p>
        <h1 class="hero-title">Albums &amp; Auto Mixes</h1>
      </div>
      <div class="hero-shortcuts">
        <button class="shortcut-pill" @click="emit('navigate', 'mixer')"><SlidersHorizontal :size="14" /> DJ Mixer</button>
        <button class="shortcut-pill" @click="emit('navigate', 'playlist')"><ListMusic :size="14" /> Playlist Maker</button>
        <button class="shortcut-pill" @click="emit('navigate', 'discover')"><Compass :size="14" /> Discover</button>
        <button class="shortcut-pill" @click="emit('navigate', 'downloads')"><HardDriveDownload :size="14" /> Offline</button>
      </div>
    </header>

    <div class="filter-tabs" role="tablist">
      <button :class="{ active: activeFilter === 'all' }" @click="activeFilter = 'all'">All</button>
      <button :class="{ active: activeFilter === 'albums' }" @click="activeFilter = 'albums'">Albums ({{ albumGroups.length }})</button>
      <button :class="{ active: activeFilter === 'playlists' }" @click="activeFilter = 'playlists'">Auto Playlists ({{ allPlaylists.length }})</button>
    </div>

    <!-- Auto Playlists & Custom Mixes (3D Depth Cards) -->
    <section v-if="activeFilter !== 'albums' && allPlaylists.length" class="shelf-section">
      <div class="shelf-head">
        <h2><Sparkles :size="16" /> Auto Playlists &amp; Daily Mixes</h2>
        <button class="link-btn" @click="emit('navigate', 'playlist')">Open Maker →</button>
      </div>
      <div class="depth-grid">
        <article
          v-for="pl in allPlaylists"
          :key="pl.id"
          class="depth-card"
          @mousemove="onCardMove"
          @mouseleave="onCardLeave"
          @click="emit('load-playlist', pl)"
        >
          <div class="depth-gloss" aria-hidden="true"></div>
          <div class="depth-cover" :style="{ backgroundImage: pl.cover ? `url(${pl.cover})` : '' }">
            <Disc3 v-if="!pl.cover" :size="36" />
            <span class="kind-badge">{{ pl.kind === 'ai' ? 'AI MIX' : pl.kind === 'manual' ? 'CUSTOM' : 'AUTO' }}</span>
            <button class="depth-play" :aria-label="`Play ${pl.name}`">
              <Play :size="18" fill="currentColor" />
            </button>
          </div>
          <div class="depth-meta">
            <h3>{{ pl.name }}</h3>
            <p>{{ pl.genre }} • {{ pl.trackIds.length }} tracks</p>
          </div>
          <button class="dj-chip" title="Mix in Auto-DJ" @click.stop="emit('dj-playlist', pl)">
            <SlidersHorizontal :size="12" /> Auto-DJ
          </button>
        </article>
      </div>
    </section>

    <!-- Albums Grid (3D Depth Cards) -->
    <section v-if="activeFilter !== 'playlists'" class="shelf-section">
      <div class="shelf-head">
        <h2>Albums &amp; Collection</h2>
        <button class="link-btn" @click="emit('navigate', 'library')">Full Library →</button>
      </div>
      <div class="depth-grid">
        <article
          v-for="alb in albumGroups"
          :key="alb.name"
          class="depth-card"
          :class="{ 'is-playing': alb.tracks.some(t => t.id === currentTrack?.id) }"
          @mousemove="onCardMove"
          @mouseleave="onCardLeave"
          @click="emit('select-track', alb.tracks[0])"
        >
          <div class="depth-gloss" aria-hidden="true"></div>
          <div class="depth-cover" :style="{ backgroundImage: alb.cover ? `url(${alb.cover})` : '' }">
            <Disc3 v-if="!alb.cover" :size="36" />
            <button class="depth-play" :aria-label="`Play ${alb.name}`">
              <Pause v-if="alb.tracks.some(t => t.id === currentTrack?.id) && isPlaying" :size="18" fill="currentColor" />
              <Play v-else :size="18" fill="currentColor" />
            </button>
          </div>
          <div class="depth-meta">
            <h3>{{ alb.name }}</h3>
            <p>{{ alb.artist }} • {{ alb.tracks.length }} {{ alb.tracks.length === 1 ? 'track' : 'tracks' }}</p>
          </div>
        </article>
      </div>
    </section>

    <!-- Tracks / Because you played -->
    <section v-if="activeFilter === 'all'" class="shelf-section">
      <div class="shelf-head">
        <h2>{{ becauseYouPlayed.length && seedTrack ? `Because you played “${seedTrack.title}”` : 'Quick Play Tracks' }}</h2>
      </div>
      <div class="depth-grid tracks-grid">
        <article
          v-for="t in (becauseYouPlayed.length ? becauseYouPlayed : tracks.slice(0, 8))"
          :key="t.id"
          class="depth-card track-card"
          :class="{ 'is-playing': currentTrack?.id === t.id }"
          @mousemove="onCardMove"
          @mouseleave="onCardLeave"
          @click="emit('select-track', t)"
        >
          <div class="depth-gloss" aria-hidden="true"></div>
          <div class="depth-cover" :style="{ backgroundImage: t.cover ? `url(${t.cover})` : '' }">
            <Disc3 v-if="!t.cover" :size="30" />
            <button class="depth-play" :aria-label="`Play ${t.title}`">
              <Pause v-if="currentTrack?.id === t.id && isPlaying" :size="16" fill="currentColor" />
              <Play v-else :size="16" fill="currentColor" />
            </button>
          </div>
          <div class="depth-meta">
            <h3>{{ t.title }}</h3>
            <p>{{ t.artist }}</p>
          </div>
          <button class="add-chip" title="Add to playlist" @click.stop="emit('add-to-playlist', t)">
            <Plus :size="13" />
          </button>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.desktop-showcase {
  display: grid;
  gap: 26px;
  padding: 20px 28px 64px;
  color: #f7eff4;
}
.showcase-hero {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.hero-kicker {
  margin: 0 0 4px;
  font-size: 11px;
  letter-spacing: 0.22em;
  color: #ff7c9b;
  font-weight: 700;
}
.hero-title {
  margin: 0;
  font-size: clamp(24px, 2.6vw, 34px);
  font-weight: 800;
  letter-spacing: -0.03em;
}
.hero-shortcuts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.shortcut-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 13px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f0e4ec;
  font-size: 12px;
  font-weight: 500;
  transition: transform 0.2s, border-color 0.2s, background 0.2s;
  &:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 95, 125, 0.55);
    background: rgba(255, 95, 125, 0.14);
  }
}
.filter-tabs {
  display: flex;
  gap: 8px;
  button {
    padding: 7px 14px;
    border-radius: 999px;
    font-size: 12px;
    color: #b7a8b4;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: all 0.2s;
    &.active {
      color: #fff;
      background: rgba(255, 95, 125, 0.2);
      border-color: #ff5f7d;
    }
  }
}
.shelf-section {
  display: grid;
  gap: 14px;
}
.shelf-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #fff;
  }
}
.link-btn {
  font-size: 12px;
  color: #ff85a1;
  &:hover { text-decoration: underline; }
}

/* 3D Depth Card Grid */
.depth-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
  gap: 18px;
  perspective: 1100px;
}
.depth-card {
  --rx: 0deg;
  --ry: 0deg;
  --gx: 50%;
  --gy: 30%;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  background: linear-gradient(155deg, rgba(42, 33, 46, 0.72), rgba(16, 13, 20, 0.9));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  transform-style: preserve-3d;
  transform: rotateX(var(--rx)) rotateY(var(--ry)) translateZ(0);
  transition: transform 0.18s ease-out, box-shadow 0.25s ease, border-color 0.25s ease;
  cursor: pointer;
  overflow: hidden;

  &:hover {
    border-color: rgba(255, 95, 125, 0.48);
    box-shadow: 0 24px 44px rgba(0, 0, 0, 0.65), 0 0 26px rgba(255, 95, 125, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    .depth-play {
      opacity: 1;
      transform: translateY(0) translateZ(26px);
    }
    .depth-gloss { opacity: 1; }
  }
  &.is-playing {
    border-color: rgba(255, 95, 125, 0.65);
    box-shadow: 0 16px 36px rgba(255, 95, 125, 0.22);
  }
}
.depth-gloss {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.25s ease;
  background: radial-gradient(circle at var(--gx) var(--gy), rgba(255, 175, 198, 0.2), transparent 60%);
}
.depth-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 10px;
  background: #231c27 url('../../assets/vinyl-texture.png') center / cover;
  background-size: cover;
  background-position: center;
  display: grid;
  place-items: center;
  color: #8f7e8c;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.55);
  transform: translateZ(16px);
}
.kind-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  background: rgba(12, 10, 16, 0.8);
  color: #ff9bb3;
  border: 1px solid rgba(255, 155, 179, 0.35);
}
.depth-play {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #ff5f7d;
  color: #fff;
  display: grid;
  place-items: center;
  box-shadow: 0 8px 20px rgba(255, 95, 125, 0.5);
  opacity: 0.9;
  transform: translateY(4px) translateZ(20px);
  transition: transform 0.22s ease, opacity 0.22s ease;
}
.depth-meta {
  display: grid;
  gap: 3px;
  min-width: 0;
  transform: translateZ(10px);
  h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  p {
    margin: 0;
    font-size: 11px;
    color: #a799a6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
.dj-chip {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 10px;
  color: #ffd0dc;
  background: rgba(255, 95, 125, 0.14);
  border: 1px solid rgba(255, 95, 125, 0.35);
  transform: translateZ(12px);
  &:hover { background: rgba(255, 95, 125, 0.28); }
}
.add-chip {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(14, 11, 18, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  display: grid;
  place-items: center;
  transform: translateZ(22px);
  &:hover { background: #ff5f7d; border-color: #ff5f7d; }
}
@media (prefers-reduced-motion: reduce) {
  .depth-card { transform: none !important; transition: none; }
}
</style>
