<script setup lang="ts">
import { Disc3 } from 'lucide-vue-next'

defineProps<{
  isPlaying: boolean
  isDownloadsOpen?: boolean
}>()

const emit = defineEmits<{
  (e: 'go-player'): void
  (e: 'toggle-downloads'): void
}>()
</script>

<template>
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="#" aria-label="Retro Mix home" @click.prevent="emit('go-player')">
        <span>Retro <em>Mix</em><span class="brand-period">.</span></span>
      </a>
      <div class="topbar-status">
        <button
          class="topbar-disc-btn"
          :class="{
            spinning: isPlaying && !isDownloadsOpen,
            'is-open': isDownloadsOpen
          }"
          :title="isDownloadsOpen ? 'Close downloads' : 'Open downloads vault'"
          :aria-label="isDownloadsOpen ? 'Close downloads' : 'Open downloads vault'"
          @click="emit('toggle-downloads')"
        >
          <span class="disc-icon-wrap">
            <Disc3 :size="24" :stroke-width="1.8" />
          </span>
          <span class="badge-dot" aria-hidden="true"></span>
        </button>
      </div>
    </div>
  </header>
</template>
