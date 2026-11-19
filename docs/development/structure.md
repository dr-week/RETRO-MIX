# Project structure

- `src/App.vue`: screen composition and music collection state.
- `src/composables/usePlayback.ts`: browser and Android playback state.
- `src/components/`: one folder per visual section.
- `src/services/`: discovery and stored track access.
- `src/types/music.ts`: shared contracts.
- `android/app/src/main/java/com/afterglow/player/`: Capacitor bridge and Android music storage.

Install and build with Bun: `bun install`, `bun run build`, `bun run android:apk`.
