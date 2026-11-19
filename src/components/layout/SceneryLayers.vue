<script setup lang="ts">
import mountainOverlay from '../../assets/mountain-overlay.png'
import textureBackground from '../../assets/vinyl-texture.png'
defineProps<{ playing?: boolean }>()
</script>

<template>
  <div class="scenery" :class="{ 'spectrum-playing': playing }" aria-hidden="true">
    <img class="scenery-texture" :src="textureBackground" alt="" />
    <img class="scenery-bottom" :src="mountainOverlay" alt="" />
  </div>
</template>
