<script setup lang="ts">
import { Play, Pause, SkipBack, Shuffle } from 'lucide-vue-next'
import type { Track } from '../../types/music'
import { useMixer, type DeckId } from '../../composables/useMixer'

const props = defineProps<{ tracks: Track[] }>()
const { decks, crossfade, master, autoMixSeconds, autoMixing, load, toggle, seek, cue, autoMix } = useMixer({ get value() { return props.tracks } } as any)
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const ids: DeckId[] = ['A', 'B']
function pick(id: DeckId, e: Event) {
  const t = props.tracks.find(x => x.id === (e.target as HTMLSelectElement).value)
  if (t) void load(id, t)
}
</script>

<template>
  <div class="mixer">
    <h2>Music Mixer</h2>
    <div class="decks">
      <section v-for="id in ids" :key="id" class="deck" :class="{ live: decks[id].playing }">
        <header><b>DECK {{ id }}</b>
          <select :value="decks[id].track?.id ?? ''" @change="pick(id, $event)" :aria-label="`Load track on deck ${id}`">
            <option value="" disabled>Load a track…</option>
            <option v-for="t in tracks" :key="t.id" :value="t.id">{{ t.title }} — {{ t.artist }}</option>
          </select>
        </header>
        <p class="title">{{ decks[id].track?.title ?? 'Empty' }}</p>
        <p v-if="decks[id].error" class="err">{{ decks[id].error }}</p>
        <input type="range" min="0" :max="decks[id].duration || 1" step="0.1" :value="decks[id].time" @input="seek(id, +($event.target as HTMLInputElement).value)" aria-label="Position" />
        <div class="time">{{ fmt(decks[id].time) }} / {{ fmt(decks[id].duration) }}</div>
        <div class="btns">
          <button @click="cue(id)" aria-label="Cue"><SkipBack :size="18" /></button>
          <button class="play" @click="toggle(id)" :aria-label="decks[id].playing ? 'Pause' : 'Play'"><component :is="decks[id].playing ? Pause : Play" :size="20" /></button>
        </div>
        <label>Volume <input type="range" min="0" max="1" step="0.01" v-model.number="decks[id].volume" /></label>
        <label>Low <input type="range" min="-12" max="12" step="0.5" v-model.number="decks[id].low" /></label>
        <label>Mid <input type="range" min="-12" max="12" step="0.5" v-model.number="decks[id].mid" /></label>
        <label>High <input type="range" min="-12" max="12" step="0.5" v-model.number="decks[id].high" /></label>
        <label>Tempo {{ decks[id].rate.toFixed(2) }}× <input type="range" min="0.8" max="1.2" step="0.01" v-model.number="decks[id].rate" /></label>
      </section>
    </div>
    <div class="xfader">
      <span>A</span>
      <input type="range" min="-1" max="1" step="0.01" v-model.number="crossfade" aria-label="Crossfader" @dblclick="crossfade = 0" />
      <span>B</span>
    </div>
    <div class="row">
      <button class="auto" :disabled="autoMixing || !decks.A.track || !decks.B.track" @click="autoMix"><Shuffle :size="16" /> Auto-mix to other deck</button>
      <label>Fade {{ autoMixSeconds }}s <input type="range" min="2" max="20" v-model.number="autoMixSeconds" /></label>
      <label>Master <input type="range" min="0" max="1" step="0.01" v-model.number="master" /></label>
    </div>
  </div>
</template>

<style scoped>
.mixer { max-width: 900px; margin: 0 auto; padding: 24px 16px 120px; color: #f3e6ee; }
h2 { margin: 0 0 16px; }
.decks { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.deck { padding: 16px; border-radius: 20px; border: 1px solid #d5b7c13d; background: #16131ccc; backdrop-filter: blur(16px); display: grid; gap: 8px; }
.deck.live { box-shadow: 0 0 24px #e7a9bf40; }
header { display: grid; gap: 6px; } select { background: #201c23; color: inherit; border: 1px solid #d5b7c13d; border-radius: 10px; padding: 6px; }
.title { margin: 0; font-weight: 600; min-height: 1.4em; } .err { color: #ff8a9a; margin: 0; font-size: .85rem; }
.time { font-size: .8rem; opacity: .7; } label { display: grid; grid-template-columns: 90px 1fr; align-items: center; font-size: .85rem; gap: 8px; }
input[type=range] { accent-color: #e6a9bf; width: 100%; }
.btns { display: flex; gap: 8px; } button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; border: 1px solid #d5b7c166; background: #ffffff10; color: inherit; cursor: pointer; }
button.play { background: #e6a9bf33; } button:disabled { opacity: .4; cursor: default; }
.xfader { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; margin: 20px 0 12px; font-weight: 700; }
.row { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; } .row label { grid-template-columns: auto 140px; }
</style>
