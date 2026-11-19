<script setup lang="ts">
defineProps<{ active: boolean }>()

// Symmetrical waveform heights matching reference design:
// Dotted bars on the outer wings scaling up into glowing coral/rose vertical bars in the center
const bars = [
  { h: 3, dot: true },
  { h: 3, dot: true },
  { h: 3, dot: true },
  { h: 4, dot: true },
  { h: 6, dot: false },
  { h: 10, dot: false },
  { h: 16, dot: false },
  { h: 22, dot: false },
  { h: 28, dot: false },
  { h: 20, dot: false },
  { h: 32, dot: false },
  { h: 24, dot: false },
  { h: 18, dot: false },
  { h: 12, dot: false },
  { h: 8, dot: false },
  { h: 4, dot: true },
  { h: 3, dot: true },
  { h: 3, dot: true },
  { h: 3, dot: true },
  { h: 3, dot: true }
]
</script>

<template>
  <div class="waveform-visualizer" :class="{ active }" aria-hidden="true">
    <span
      v-for="(bar, index) in bars"
      :key="index"
      class="wave-bar"
      :class="{ 'is-dot': bar.dot }"
      :style="{ '--wave-height': `${bar.h}px`, '--bar-index': index }"
    />
  </div>
</template>
