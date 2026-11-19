# UI/UX Design Specification

### Turntable Player
- `src/components/player/VinylPlayer.vue`: Overhung turntable deck, circular seek arc (135° to 45° sweep), floating elapsed time indicator, duration anchor, bold geometric typography, and frosted glass transport buttons (shuffle & repeat).
- `src/styles/turntable.scss`: High-fidelity vinyl grooving, multi-stop anisotropic light reflection, concentric spindle hub, and tactile center play button with warm rose inner rim.
- `src/components/player/WaveformSpectrum.vue`: Symmetrical waveform with low-opacity end-dots expanding into pulsing coral/rose vertical capsules.
- `src/components/layout/SceneryLayers.vue`: Organic curved dusk scenic cutout with silhouetted tree foliage and distant mountain gradient on the upper-left, paired with atmospheric glowing dune contours along the bottom.
- `src/components/layout/TopBar.vue`: Minimal typography with "Retro Mix." branding, spaced subtitle, and top-right glassmorphic disc badge with pink indicator dot.
- `src/components/navigation/SidebarDock.vue`: Curved glassmorphic dock pinned on the right viewport edge with subtle dotted dividers between Discover, Queue, Library, and Player tabs.

### Minimalist Discovery, Library & Downloads
- `src/styles/sections.scss`: Unified minimalist design system eliminating heavy card borders, drop-shadow clutter, and uppercase tags. Features whisper-thin dividers, capsule search inputs, and responsive typography.
- `src/components/discover/DiscoverView.vue`: Single-tap region filter chips (`[Global] [United States] [India] [UK] [Japan]...`), unified row click-to-play interaction, and single-action download icon.
- `src/components/library/LibraryView.vue`: Clean "Recently Played" horizontal reel with rounded covers, minimal "+" icon for importing local MP3s, and favoriting heart action.
- `src/components/downloads/DownloadsView.vue`: Minimal offline vault with track counter and storage footprint, clean row list without noisy developer tags, and quiet trash action.
- `src/components/player/MiniPlayer.vue`: Dark frosted glass pill with rotating disc avatar, responsive typography, and bottom neon progress indicator.
