# Resona™ Audio Engine & Workstation

<p align="center">
  <img src="src/assets/vinyl-texture.png" alt="Resona Audio Architecture" width="180" style="border-radius: 50%;" />
</p>

<p align="center">
  <strong>Next-Generation Cross-Platform Audio Experience & Atmospheric Sound System</strong>
  <br />
  <em>Designed and engineered by <strong>Danger Labs</strong></em>
</p>

<p align="center">
  <a href="https://dr-week.github.io/RETRO-MIX/"><strong>🌐 Live Web App</strong></a> •
  <a href="https://github.com/dr-week/RETRO-MIX/releases/latest"><strong>📱 Download Android APK</strong></a>
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#core-capabilities">Key Features</a> •
  <a href="#system-architecture">Architecture</a> •
  <a href="#deployment--installation">Deployment</a> •
  <a href="#platform-specifications">Specifications</a> •
  <a href="#enterprise-governance--licensing">Governance</a>
</p>

---

## Executive Overview

**Resona™** is an enterprise-grade, client-side digital audio workstation and playback platform engineered by **Danger Labs**. Built upon high-fidelity web audio protocols and native Android hardware integrations, Resona bridges analog turntable tactile aesthetics with contemporary algorithmic curation, real-time frequency spectrum analysis, multi-source stream aggregation, and persistent on-device storage.

Engineered with performance, privacy, and aesthetic minimalism at its core, Resona operates independently of intrusive corporate tracking, providing instantaneous music playback, background streaming, offline caching, and automated mood-based playlist intelligence.

---

## Core Capabilities

### 🎛️ Precision Turntable & Audio Core
- **Hardware-Accelerated Vinyl Simulation**: High-precision interactive vinyl playback interface with real-time rotational state physics and interactive seeking.
- **Dynamic Spectral Fast-Fourier Transform (FFT)**: 48-band zero-latency audio spectrum analyzer powered by the Web Audio API and hardware decoders.
- **Smart Queue & Non-Repeating Shuffler**: Mathematical Fisher-Yates unplayed-pool queue architecture guaranteeing zero track repetition until complete exhaustion of the active listening pool.
- **Persistent Mini-Console**: Zero-interruption background mini-player dock maintaining state across navigational routing and view transitions.

### 🧠 Algorithmic Curation & Smart Mixes
- **Automated Genre Clustering**: Heuristic metadata parsing and classification engine categorizing tracks into distinct sonic profiles (*Chill*, *Pop*, *Acoustic*, *Energy*, *Indie*).
- **Daily Mix Synthesizer**: Spotify-style automated dynamic playlist generation yielding tailored mood mixes updated per session and persisted to disk.
- **Contextual Recommendation Engine**: Collaborative local filtering evaluating user listening patterns, skip rates, and rating metrics without telemetry transmission.

### ⚡ Resilient Downloader & Native Storage
- **Stream Ingestion & Conversion**: Integrated stream-to-MP3 processing pipeline complete with real-time download speed calculation, byte-level tracking, and ETA progression monitors.
- **Dual-Tier Storage Architecture**:
  - **Android Native Runtime**: Filesystem isolation targeting dedicated Android media storage (`Music/Retro Mix/Music Downloaded/` & `Music/Retro Mix/Playlists/`) coupled with high-throughput Room SQLite metadata indexing.
  - **Web Client Environment**: Transactional IndexedDB binary blob persistence.
- **Open Knowledge & Archive Discovery**: Full metadata querying across the Internet Archive open-audio catalog and direct stream resolvers.

---

## System Architecture

Resona adheres to strict separation of concerns, designed with modularity, micro-composable reactive state management, and strict file complexity ceilings (<200 lines per component):

```
├── src/
│   ├── components/
│   │   ├── discover/       # Global audio discovery & multi-source resolvers
│   │   ├── downloads/      # Download queue, byte telemetry & ETA tracking
│   │   ├── library/        # Tag-based collection filters, ratings & grouping
│   │   ├── navigation/     # Ergonomic sidebar dock & routing interface
│   │   ├── player/         # Vinyl turntable emulator & persistent mini-player
│   │   └── playlist/       # Dynamic mix decks & non-repeating queue
│   ├── composables/        # Reactive state orchestration (Playback, Library, Downloader)
│   ├── services/           # Room DB bridge, IndexedDB, and playlist engines
│   └── types/              # Type definitions & contract interfaces
└── android/                # Native Android Kotlin Capacitor wrapper & Room DB
```

---

## Deployment & Installation

### Prerequisites
- [Bun](https://bun.sh) (v1.0.0 or higher recommended)
- Node.js LTS (optional fallback runtime)
- Android Studio with Android SDK Platform 36 & Build Tools 35 (for native APK builds)
- Java SE Development Kit (JDK 21)

### Development Environment Setup

Clone repository and provision dependencies:

```bash
# Clone the repository
git clone https://github.com/danger-labs/resona.git
cd resona

# Install runtime dependencies via Bun
bun install

# Launch local development server with Hot Module Replacement (HMR)
bun run dev
```

### Production Build

Compile optimized production client bundle:

```bash
bun run build
```

### Android Native Assembly

To generate compiled APK binaries for deployment on mobile hardware:

```bash
# Synchronize web assets with native Capacitor shell
bun run android:sync

# Assemble Debug APK across device architectures
bun run android:apk
```

Compiled APK distribution paths:
- **ARM64 Devices (Modern Android)**: `android/app/build/outputs/apk/debug/app-arm64-v8a-debug.apk`
- **ARM 32-bit Devices**: `android/app/build/outputs/apk/debug/app-armeabi-v7a-debug.apk`
- **x86_64 Virtualized / Emulators**: `android/app/build/outputs/apk/debug/app-x86_64-debug.apk`

---

## Platform Specifications

| Parameter | Specification |
| :--- | :--- |
| **Frontend Framework** | Vue 3 (Composition API, `<script setup>`) |
| **Language** | TypeScript 5.8+ (Strict Type-Checking Enabled) |
| **Styling & Theming** | Modular SCSS, Retro-Futuristic Cyber / Japanese Cyberpunk |
| **Native Integration** | Capacitor 8.x + Custom Native Kotlin Plugins |
| **Persistence Layer** | Room SQLite (Android Native) / IndexedDB Version 4 (Web) |
| **Audio Protocol** | HTML5 Audio, Web Audio AnalyserNode (FFT), Native Android MediaCodec |
| **Minimum Android API** | Android 7.0 (API Level 24+) |
| **Target Android API** | Android 15 (API Level 36) |

---

## Enterprise Governance & Licensing

Resona is designed, architected, and maintained by **Danger Labs**. All proprietary interfaces, visual assets, and system algorithms are governed under commercial research protocols.

- **Starter Audio Manifest**: Includes curated open-license public works licensed under Creative Commons BY 4.0:
  - *Vexento* — "Spark"
  - *Kai Engel* — "Maree"
  - *Leonard Richter* — "Crime Time"
- **Open Standards**: Built with adherence to Web Audio open standards, IndexedDB specification, and W3C accessibility patterns.

For enterprise inquiries, custom deployments, or partnership communications, contact the **Danger Labs Engineering Division**.

---

<p align="center">
  <sub>Copyright © 2026 Danger Labs. All rights reserved. Precision Audio Engineering.</sub>
</p>
