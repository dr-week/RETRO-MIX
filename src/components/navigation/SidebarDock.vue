<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NavSection, Section } from '../../types/music'
const props = defineProps<{ sections: NavSection[]; activeTab: Section; isPlaying: boolean; currentTime: number; duration: number }>()
const emit = defineEmits<{ (e: 'select', section: Section): void }>()
const activeIndex = computed(() => Math.max(0, props.sections.findIndex(s => s.id === props.activeTab)))
const dragIndex = ref<number | null>(null)
const dragging = ref(false)
const dragY = ref(0)
let pointerStartY = 0
let pressedPointer: number | null = null
function startDrag(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  pointerStartY = event.clientY
  dragging.value = false
  pressedPointer = event.pointerId
}
function moveDrag(event: PointerEvent) {
  const nav = event.currentTarget as HTMLElement
  if (pressedPointer !== event.pointerId) return
  if (!dragging.value && Math.abs(event.clientY - pointerStartY) < 5) return
  dragging.value = true
  nav.setPointerCapture(event.pointerId)
  dragY.value = Math.max(0, Math.min((props.sections.length - 1) * 58, event.clientY - nav.getBoundingClientRect().top - 22))
  dragIndex.value = Math.round(dragY.value / 58)
}
function endDrag(event: PointerEvent) {
  const nav = event.currentTarget as HTMLElement
  pressedPointer = null
  if (!nav.hasPointerCapture(event.pointerId)) return
  nav.releasePointerCapture(event.pointerId)
  if (event.type !== 'pointercancel' && dragIndex.value !== null) {
    const section = props.sections[dragIndex.value]
    if (section) emit('select', section.id)
  }
  dragIndex.value = null
  setTimeout(() => { dragging.value = false }, 0)
}
function selectSection(section: Section) {
  if (!dragging.value) emit('select', section)
  dragging.value = false
}
</script>

<template>
  <aside class="retro-sidebar-dock" :class="{ 'is-dragging': dragIndex !== null }" aria-label="Music console">
    <div class="retro-dock-capsule">
      <nav class="dock-track" aria-label="App sections" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag">
        <div class="dock-selection" :style="{ transform: 'translateY(' + (dragIndex !== null ? dragY : activeIndex * 58) + 'px)' }" aria-hidden="true"></div>
        <template v-for="section in sections" :key="section.id">
          <button class="dock-item" :class="{ active: activeTab === section.id }" :aria-current="activeTab === section.id ? 'page' : undefined" :aria-label="section.label" :title="section.label" @click="selectSection(section.id)">
            <component :is="section.icon" :size="22" :stroke-width="1.6" />
          </button>
        </template>
      </nav>
    </div>
  </aside>
</template>

<style scoped>
.retro-sidebar-dock { position:fixed; top:48%; right:0; transform:translateY(-50%); z-index:30; user-select:none; }
.retro-dock-capsule { position:relative; display:flex; flex-direction:column; align-items:center; gap:12px; width:72px; padding:18px 8px 22px 12px; border:1px solid #d5b7c13d; border-right:0; border-radius:48px 0 0 48px; background:linear-gradient(105deg,#c3a9b51c,#201c2399 42%,#16131cc7); box-shadow:-8px 12px 32px #0005,inset 1px 0 1px #ffffff30; backdrop-filter:blur(24px) saturate(125%); }
.retro-dock-capsule { isolation:isolate; background:transparent; border-color:transparent; box-shadow:none; backdrop-filter:none; }
.retro-dock-capsule::before { content:''; position:absolute; inset:0; z-index:-1; border:1px solid #d5b7c13d; border-right:0; border-radius:inherit; background:linear-gradient(105deg,#c3a9b51c,#201c2399 42%,#16131cc7); box-shadow:-8px 12px 32px #0005,inset 1px 0 1px #ffffff30; backdrop-filter:blur(24px) saturate(125%); opacity:.12; transition:opacity .6s ease; pointer-events:none; }
.retro-sidebar-dock:hover .retro-dock-capsule::before,.retro-sidebar-dock:focus-within .retro-dock-capsule::before { opacity:1; }
.dock-track { position:relative; display:flex; flex-direction:column; gap:14px; width:44px; cursor:grab; touch-action:none; }
.dock-track:active { cursor:grabbing; }
.dock-selection { position:absolute; inset:0 auto auto 0; width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,#e6c5d330,#ffffff08); border:1px solid #e1b8c466; box-shadow:inset 0 1px #ffffff32,0 4px 12px #0004; transition:transform .45s cubic-bezier(.2,.8,.2,1); pointer-events:none; }
.dock-item { position:relative; z-index:1; display:grid; place-items:center; width:44px; height:44px; padding:0; border:0; border-radius:50%; color:#bfb2bd; background:transparent; transition:color .2s,transform .25s; }
.dock-item.active { color:#fff0f5; }
.dock-item:hover { color:white; transform:scale(1.08); }
.is-dragging .dock-selection { transition:transform .08s linear; box-shadow:inset 0 1px #ffffff45,0 5px 20px #e7a9bf35; }
.is-dragging .dock-item { transform:scale(.94); }
.retro-dock-capsule::before { animation:dock-breathe 7s ease-in-out infinite; }
@keyframes dock-breathe { 50% { filter:brightness(1.2); } }
@media(max-width:700px) { .retro-dock-capsule { width:64px; padding-left:10px; padding-right:6px; } }
@media(prefers-reduced-motion:reduce) { .dock-selection,.dock-item,.retro-dock-capsule::before { transition:none; animation:none; } }
</style>
