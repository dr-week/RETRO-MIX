# Android music storage

Downloaded and imported MP3 files are saved under `Music/Retro Mix/Music Downloaded/` through Android MediaStore on Android 10 and later. Older Android versions use the app's external Music directory. Metadata is stored in the local database.

The Android bridge handles audio-only online playback, MP3 conversion, imports, and deletion. Source extraction depends on the bundled yt-dlp library and can require updates when remote sites change.
