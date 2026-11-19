package com.afterglow.player

import android.content.Context
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import org.json.JSONObject
import java.io.File

internal class YouTubeSource(private val context: Context) {
    private fun initializeDownloader() {
        YoutubeDL.getInstance().init(context)
        synchronized(YouTubeSource::class.java) {
            val preferences = context.getSharedPreferences("youtube-downloader", Context.MODE_PRIVATE)
            val now = System.currentTimeMillis()
            if (now - preferences.getLong("updated-at", 0) >= 24 * 60 * 60 * 1000L) {
                YoutubeDL.getInstance().updateYoutubeDL(context, YoutubeDL.UpdateChannel.NIGHTLY)
                preferences.edit().putLong("updated-at", now).apply()
            }
        }
    }

    fun search(term: String): JSArray {
        initializeDownloader()
        val request = YoutubeDLRequest("ytsearch15:$term")
        request.addOption("--flat-playlist")
        request.addOption("--dump-json")
        request.addOption("--no-warnings")
        val results = JSArray()
        YoutubeDL.getInstance().execute(request).out.lineSequence().forEach { line ->
            if (!line.trimStart().startsWith("{")) return@forEach
            val item = JSONObject(line)
            val id = item.optString("id")
            if (!Regex("[A-Za-z0-9_-]{11}").matches(id)) return@forEach
            results.put(JSObject().apply {
                put("id", id)
                put("title", item.optString("title", "Untitled"))
                put("artist", item.optString("channel", item.optString("uploader", "YouTube")))
                put("duration", item.optDouble("duration", 0.0))
                put("cover", "https://i.ytimg.com/vi/$id/hqdefault.jpg")
                put("url", "https://www.youtube.com/watch?v=$id")
            })
        }
        return results
    }

    fun download(url: String, id: String): File {
        initializeDownloader()
        FFmpeg.getInstance().init(context)
        val infoRequest = YoutubeDLRequest(url).apply {
            addOption("--no-playlist")
            addOption("--remote-components", "ejs:github")
        }
        val info = YoutubeDL.getInstance().getInfo(infoRequest)
        check(info.duration.toDouble() >= 90.0) { "This result is too short to be a full music track" }
        val tempDir = File(context.cacheDir, "converted-audio").apply { mkdirs() }
        val output = File(tempDir, "$id.mp3")
        output.delete()
        val request = YoutubeDLRequest(url)
        request.addOption("--no-playlist")
        request.addOption("--remote-components", "ejs:github")
        request.addOption("--max-filesize", "150M")
        request.addOption("-f", "bestaudio[ext=m4a]/bestaudio")
        request.addOption("-x")
        request.addOption("--audio-format", "mp3")
        request.addOption("--audio-quality", "0")
        request.addOption("-o", File(tempDir, "$id.%(ext)s").absolutePath)
        return try {
            YoutubeDL.getInstance().execute(request)
            check(output.isFile && output.length() > 0) { "MP3 conversion did not create a file" }
            output
        } catch (error: Throwable) {
            output.delete()
            throw error
        }
    }
}
