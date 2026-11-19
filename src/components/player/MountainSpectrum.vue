<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ active: boolean; progress: number; spectrum: number[] }>()
const count = 128
const levels = ref(Array.from({ length: 5 }, () => Array(count).fill(0) as number[]))
const velocities = Array.from({ length: 5 }, () => Array(count).fill(0) as number[])
const phase = ref(0)
const intensity = ref(0)
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
let frame = 0
let lastUpdate = 0

// Stable random terrain changes continuously, rather than flickering every frame.
const seed = Math.random() * 1000
function noise(x: number, layer: number) {
  const cell = Math.floor(x)
  const fraction = x - cell
  const ease = fraction * fraction * (3 - 2 * fraction)
  const random = (n: number) => {
    const value = Math.sin(n * 127.1 + layer * 311.7 + seed) * 43758.5453
    return value - Math.floor(value)
  }
  return random(cell) * (1 - ease) + random(cell + 1) * ease
}

function terrain(x: number, layer: number) {
  return noise(x, layer) * 58 + noise(x * 2.7, layer + 7) * 24 + noise(x * 7.3, layer + 13) * 10
}

const ridges = computed(() => levels.value.map((heights, layer) => {
  const coordinates = heights.map((height, index) => {
    const x = index / (count - 1) * 1000
    const ridge = terrain(index * .065 + layer * 3, layer)
    const slope = (x / 1000 - .5) * (layer % 2 ? -28 : 35)
    return { x, y: 170 + layer * 13 - ridge - height + slope }
  })
  let edge = `M 0 ${coordinates[0]!.y}`
  for (let i = 1; i < coordinates.length; i++) {
    const next = coordinates[i]!
    edge += ` L ${next.x} ${next.y}`
  }
  edge += ` L 1000 ${coordinates[count - 1]!.y}`
  return { edge, fill: `${edge} L 1000 240 L 0 240 Z` }
}))

function animate(now: number) {
  const dt = Math.min((now - (lastUpdate || now)) / 1000, .032)
  lastUpdate = now
  const gentle = motionPreference.matches
  intensity.value += ((props.active ? 1 : 0) - intensity.value) * (1 - Math.exp(-dt * (props.active ? 8 : 2.5)))
  phase.value += dt * intensity.value * 9
  const audioAvailable = props.spectrum.some(value => value > 6)
  levels.value = levels.value.map((heights, layer) => heights.map((height, index) => {
    const time = phase.value * (.65 + layer * .29)
    const drift = terrain(index * .065 + layer * 3 + time * .18, layer) - terrain(index * .065 + layer * 3, layer)
    const audio = audioAvailable ? (props.spectrum[Math.floor(index / count * props.spectrum.length)] ?? 4) * .65 : 0
    const target = intensity.value * (drift + audio) * (1 - layer * .1) * (gentle ? .3 : 1)
    const velocity = velocities[layer]!
    velocity[index] = (velocity[index]! + (target - height) * 400 * dt) * Math.exp(-dt * 20)
    return height + velocity[index]! * dt
  }))
  if (props.active || intensity.value > .002) frame = requestAnimationFrame(animate)
}

function syncAnimation() {
  cancelAnimationFrame(frame)
  lastUpdate = 0
  frame = requestAnimationFrame(animate)
}

watch(() => props.active, syncAnimation, { immediate: true })
motionPreference.addEventListener('change', syncAnimation)
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  motionPreference.removeEventListener('change', syncAnimation)
})
</script>

<template>
  <svg class="mountain-spectrum" :class="{ 'is-playing': active }" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="mountain-spectrum-fill" x1="0%" y1="0%" x2="100%" y2="90%">
        <stop offset="0" stop-color="#ad2818" stop-opacity=".95" />
        <stop offset=".4" stop-color="#74170e" stop-opacity=".85" />
        <stop offset="1" stop-color="#250704" stop-opacity=".7" />
      </linearGradient>
      <linearGradient id="mountain-spectrum-rim" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0" stop-color="#dc4927" stop-opacity=".65" /><stop offset=".45" stop-color="#942416" stop-opacity=".3" /><stop offset="1" stop-color="#410b06" stop-opacity=".08" />
      </linearGradient>
    </defs>
    <g v-for="(ridge, index) in ridges" :key="index" :opacity=".45 + index * .1">
      <path class="mountain-spectrum-fill" :d="ridge.fill" />
      <path class="mountain-spectrum-edge" :d="ridge.edge" />
    </g>
  </svg>
</template>
