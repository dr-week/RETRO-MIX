<script setup lang="ts">
import { Play, Pause, SkipBack, Shuffle, Radio, Gauge, HardDriveDownload, Repeat, Sparkles, Drum } from 'lucide-vue-next'
import type { AutoDjMode, Track } from '../../types/music'
import type { DeckId, useMixer } from '../../composables/useMixer'
import type { useAutoDj } from '../../composables/useAutoDj'
import type { BeatPattern, DjSfxKind } from '../../services/djFxService'

const props = defineProps<{
  tracks: Track[]
  mixer: ReturnType<typeof useMixer>
  autoDj: ReturnType<typeof useAutoDj>
}>()

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const ids: DeckId[] = ['A', 'B']
const modes: Array<{ id: AutoDjMode; label: string }> = [
  { id: 'off', label: 'Manual' },
  { id: 'similar', label: 'Similar Mix' },
  { id: 'playlist', label: 'Playlist' },
  { id: 'endless', label: 'Endless' }
]
const sfxPads: Array<{ id: DjSfxKind; label: string }> = [
  { id: 'airhorn', label: 'Airhorn' },
  { id: 'riser', label: 'Riser' },
  { id: 'drop', label: 'Drop Boom' },
  { id: 'scratch', label: 'Scratch' },
  { id: 'laser', label: 'Laser' },
  { id: 'clap', label: 'Clap' }
]
const beatPatterns: Array<{ id: BeatPattern; label: string }> = [
  { id: 'off', label: 'Off' },
  { id: 'house', label: 'House' },
  { id: 'lofi', label: 'Lo-Fi' },
  { id: 'trap', label: 'Trap' },
  { id: 'breakbeat', label: 'Breakbeat' }
]

function pick(id: DeckId, e: Event) {
  const t = props.tracks.find(x => x.id === (e.target as HTMLSelectElement).value)
  if (t) void props.mixer.load(id, t)
}
</script>

<template>
  <div class="mixer">
    <div class="mixer-head">
      <h2>Music Mixer &amp; Auto-DJ</h2>
      <div class="dj-modes" role="group" aria-label="Auto-DJ mode">
        <button
          v-for="m in modes"
          :key="m.id"
          class="mode-pill"
          :class="{ active: autoDj.mode.value === m.id }"
          @click="autoDj.startMode(m.id)"
        >
          <Radio v-if="m.id !== 'off'" :size="13" /> {{ m.label }}
        </button>
      </div>
    </div>

    <p v-if="autoDj.status.value" class="dj-status">{{ autoDj.status.value }}</p>

    <div class="decks">
      <section v-for="id in ids" :key="id" class="deck" :class="{ live: mixer.decks[id].playing }">
        <header>
          <div class="deck-top">
            <b>DECK {{ id }}</b>
            <span v-if="mixer.decks[id].bpm" class="bpm-badge">
              <Gauge :size="12" /> {{ Math.round(mixer.decks[id].bpm! * mixer.decks[id].rate) }} BPM
            </span>
            <button
              v-if="mixer.decks.A.bpm && mixer.decks.B.bpm"
              class="sync-btn"
              title="Beat-match tempo to other deck (±8%)"
              @click="mixer.syncBpm(id)"
            >Sync</button>
          </div>
          <select :value="mixer.decks[id].track?.id ?? ''" @change="pick(id, $event)" :aria-label="`Load track on deck ${id}`">
            <option value="" disabled>Load a track…</option>
            <option v-for="t in tracks" :key="t.id" :value="t.id">{{ t.title }} — {{ t.artist }}</option>
          </select>
        </header>
        <p class="title">{{ mixer.decks[id].track?.title ?? 'Empty' }}</p>
        <p v-if="mixer.decks[id].error" class="err">{{ mixer.decks[id].error }}</p>
        <input
          type="range"
          min="0"
          :max="mixer.decks[id].duration || 1"
          step="0.1"
          :value="mixer.decks[id].time"
          @input="mixer.seek(id, +($event.target as HTMLInputElement).value)"
          aria-label="Position"
        />
        <div class="time">{{ fmt(mixer.decks[id].time) }} / {{ fmt(mixer.decks[id].duration) }}</div>
        <div class="btns">
          <button @click="mixer.cue(id)" aria-label="Cue"><SkipBack :size="18" /></button>
          <button class="play" @click="mixer.toggle(id)" :aria-label="mixer.decks[id].playing ? 'Pause' : 'Play'">
            <component :is="mixer.decks[id].playing ? Pause : Play" :size="20" />
          </button>
          <button
            :class="{ active: mixer.decks[id].looping }"
            title="Toggle 4-beat remix loop"
            @click="mixer.toggleLoop(id, 4)"
          ><Repeat :size="15" /> 4-Beat Loop</button>
        </div>
        <label>Volume <input type="range" min="0" max="1" step="0.01" v-model.number="mixer.decks[id].volume" /></label>
        <label>Low <input type="range" min="-12" max="12" step="0.5" v-model.number="mixer.decks[id].low" /></label>
        <label>Mid <input type="range" min="-12" max="12" step="0.5" v-model.number="mixer.decks[id].mid" /></label>
        <label>High <input type="range" min="-12" max="12" step="0.5" v-model.number="mixer.decks[id].high" /></label>
        <label>Filter <input type="range" min="-1" max="1" step="0.02" v-model.number="mixer.decks[id].filter" @dblclick="mixer.decks[id].filter = 0" /></label>
        <label>Echo <input type="range" min="0" max="0.6" step="0.02" v-model.number="mixer.decks[id].echo" /></label>
        <label>Tempo {{ mixer.decks[id].rate.toFixed(2) }}× <input type="range" min="0.8" max="1.2" step="0.01" v-model.number="mixer.decks[id].rate" /></label>
      </section>
    </div>

    <div class="xfader">
      <span>A</span>
      <input
        type="range"
        min="-1"
        max="1"
        step="0.01"
        v-model.number="mixer.crossfade.value"
        aria-label="Crossfader"
        @dblclick="mixer.crossfade.value = 0"
      />
      <span>B</span>
    </div>

    <div class="row">
      <button
        class="auto"
        :disabled="mixer.autoMixing.value || (!mixer.decks.A.track && !mixer.decks.B.track)"
        @click="autoDj.mode.value !== 'off' ? autoDj.mixNextNow() : mixer.autoMix()"
      >
        <Shuffle :size="16" /> {{ autoDj.mode.value !== 'off' ? 'Mix Next Now' : 'Auto-mix to other deck' }}
      </button>
      <label>Fade {{ mixer.autoMixSeconds.value }}s <input type="range" min="2" max="20" v-model.number="mixer.autoMixSeconds.value" /></label>
      <label>Master <input type="range" min="0" max="1" step="0.01" v-model.number="mixer.master.value" /></label>
    </div>

    <!-- Live Remix FX Pads & BPM-Synced Beat Machine -->
    <div class="fx-grid">
      <section class="fx-panel">
        <h3><Sparkles :size="14" /> DJ Sound Effects (SFX Pads)</h3>
        <div class="sfx-pads">
          <button v-for="pad in sfxPads" :key="pad.id" class="sfx-pad" @click="mixer.playSfx(pad.id)">
            {{ pad.label }}
          </button>
        </div>
      </section>

      <section class="fx-panel">
        <h3><Drum :size="14" /> Beat Layer ({{ mixer.activeBpm.value }} BPM Sync)</h3>
        <div class="beat-pills">
          <button
            v-for="bp in beatPatterns"
            :key="bp.id"
            class="mode-pill"
            :class="{ active: mixer.beatPattern.value === bp.id }"
            @click="mixer.setBeatPattern(bp.id)"
          >{{ bp.label }}</button>
        </div>
        <label class="beat-vol">Beat Vol <input type="range" min="0" max="1" step="0.02" v-model.number="mixer.beatVolume.value" /></label>
      </section>
    </div>

    <section v-if="autoDj.queue.value.length" class="up-next">
      <h3>Up Next (Auto-DJ Queue)</h3>
      <div class="queue-list">
        <div v-for="(t, i) in autoDj.queue.value.slice(0, 5)" :key="`${t.id}-${i}`" class="q-item">
          <span class="q-idx">{{ i + 1 }}</span>
          <span class="q-title">{{ t.title }} — <small>{{ t.artist }}</small></span>
          <span v-if="t.local" class="q-badge" title="Cached offline"><HardDriveDownload :size="12" /> Offline</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.mixer { max-width: 900px; margin: 0 auto; padding: 24px 16px 120px; color: #f3e6ee; }
.mixer-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
h2 { margin: 0; font-size: 1.25rem; }
.dj-modes, .beat-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.mode-pill { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 999px; border: 1px solid #d5b7c144; background: #ffffff0a; color: #d8c8d2; font-size: .78rem; cursor: pointer; }
.mode-pill.active, button.active { background: #ff5f7d33; border-color: #ff5f7d; color: #fff; }
.dj-status { margin: 0 0 12px; font-size: .8rem; color: #ff85a1; }
.decks { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.deck { padding: 16px; border-radius: 20px; border: 1px solid #d5b7c13d; background: #16131ccc; backdrop-filter: blur(16px); display: grid; gap: 8px; }
.deck.live { box-shadow: 0 0 24px #e7a9bf40; border-color: #e6a9bf88; }
.deck-top { display: flex; align-items: center; gap: 8px; }
.bpm-badge { display: inline-flex; align-items: center; gap: 4px; font-size: .72rem; padding: 2px 8px; border-radius: 999px; background: #ff5f7d22; color: #ffb3c4; }
.sync-btn { margin-left: auto; padding: 3px 9px; font-size: .72rem; border-radius: 999px; border: 1px solid #ff5f7d66; background: #ff5f7d22; color: #fff; cursor: pointer; }
header { display: grid; gap: 6px; }
select { background: #201c23; color: inherit; border: 1px solid #d5b7c13d; border-radius: 10px; padding: 6px; }
.title { margin: 0; font-weight: 600; min-height: 1.4em; }
.err { color: #ff8a9a; margin: 0; font-size: .85rem; }
.time { font-size: .8rem; opacity: .7; }
label { display: grid; grid-template-columns: 90px 1fr; align-items: center; font-size: .85rem; gap: 8px; }
input[type=range] { accent-color: #e6a9bf; width: 100%; }
.btns { display: flex; flex-wrap: wrap; gap: 8px; }
button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; border: 1px solid #d5b7c166; background: #ffffff10; color: inherit; cursor: pointer; }
button.play { background: #e6a9bf33; }
button:disabled { opacity: .4; cursor: default; }
.xfader { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; margin: 20px 0 12px; font-weight: 700; }
.row { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
.row label { grid-template-columns: auto 140px; }
.fx-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-top: 20px; }
.fx-panel { padding: 14px; border-radius: 16px; border: 1px solid #d5b7c12e; background: #16131cbb; display: grid; gap: 10px; }
.fx-panel h3 { margin: 0; font-size: .84rem; color: #ff85a1; display: inline-flex; align-items: center; gap: 6px; }
.sfx-pads { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.sfx-pad { justify-content: center; border-radius: 10px; padding: 10px 6px; font-size: .78rem; font-weight: 600; background: linear-gradient(145deg, #ff5f7d24, #ffffff08); border-color: #ff5f7d44; }
.sfx-pad:active { transform: scale(0.95); background: #ff5f7d55; }
.beat-vol { grid-template-columns: 72px 1fr; margin-top: 4px; }
.up-next { margin-top: 22px; padding: 14px; border-radius: 14px; border: 1px solid #d5b7c12a; background: #16131c99; }
.up-next h3 { margin: 0 0 8px; font-size: .85rem; color: #ff85a1; }
.queue-list { display: grid; gap: 6px; }
.q-item { display: flex; align-items: center; gap: 8px; font-size: .82rem; padding: 5px 8px; border-radius: 8px; background: #ffffff08; }
.q-idx { opacity: .6; width: 16px; }
.q-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.q-title small { opacity: .7; }
.q-badge { display: inline-flex; align-items: center; gap: 4px; font-size: .7rem; color: #8ff0b8; }
</style>
