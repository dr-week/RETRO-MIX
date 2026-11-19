package com.afterglow.player

import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

@CapacitorPlugin(name = "AudioBridge")
class AudioBridgePlugin : Plugin() {
    private val io = Executors.newSingleThreadExecutor()
    private var player: MediaPlayer? = null
    @Volatile private var playRequest = 0
    private val files by lazy { MusicFileStore(context) }
    private val youtube by lazy { YouTubeSource(context) }

    private fun initExtractor() {
        YoutubeDL.getInstance().init(context)
    }

    private fun validYouTubeUrl(url: String): Boolean = runCatching {
        val parsed = URL(url)
        parsed.protocol == "https" && (parsed.host == "youtu.be" || parsed.host == "youtube.com" || parsed.host.endsWith(".youtube.com"))
    }.getOrDefault(false)

    @PluginMethod
    fun search(call: PluginCall) {
        val term = call.getString("query")?.trim()?.takeIf { it.isNotEmpty() && it.length <= 120 }
            ?: return call.reject("Enter a search of up to 120 characters")
        io.execute {
            runCatching {
                call.resolve(JSObject().put("tracks", youtube.search(term)))
            }.onFailure { call.reject("YouTube search failed: ${it.message}", it.asException()) }
        }
    }

    @PluginMethod
    fun play(call: PluginCall) {
        val url = call.getString("url")?.takeIf(::validYouTubeUrl)
            ?: return call.reject("A valid YouTube URL is required")
        val ticket = ++playRequest
        io.execute {
            runCatching {
                initExtractor()
                val request = YoutubeDLRequest(url)
                request.addOption("-f", "bestaudio[ext=m4a]/bestaudio")
                request.addOption("--no-playlist")
                request.addOption("--remote-components", "ejs:github")
                val info = YoutubeDL.getInstance().getInfo(request)
                val audioUrl = info.url?.takeIf { it.startsWith("https://") }
                    ?: error("No playable audio stream was returned")
                val result = JSObject().apply {
                    put("title", info.title ?: "Untitled")
                    put("artist", info.uploader ?: "YouTube")
                    put("duration", info.duration)
                    put("cover", info.thumbnail)
                }
                activity.runOnUiThread {
                    if (ticket != playRequest) { call.reject("Playback changed"); return@runOnUiThread }
                    startPlayer(call, result) { media -> media.setDataSource(context, Uri.parse(audioUrl), info.httpHeaders ?: emptyMap()) }
                }
            }.onFailure { call.reject("Could not play this track: ${it.message}", it.asException()) }
        }
    }

    @PluginMethod
    fun playLocal(call: PluginCall) {
        val uri = call.getString("uri")?.takeIf { it.startsWith("content://") || it.startsWith("file://") }
            ?: return call.reject("A saved audio file is required")
        ++playRequest
        activity.runOnUiThread { startPlayer(call, JSObject()) { media -> media.setDataSource(context, Uri.parse(uri)) } }
    }

    private fun startPlayer(call: PluginCall, result: JSObject, source: (MediaPlayer) -> Unit) {
        runCatching {
            player?.release()
            val media = MediaPlayer()
            player = media
            media.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            media.setOnPreparedListener {
                it.start()
                result.put("duration", it.duration / 1000.0)
                call.resolve(result)
            }
            media.setOnCompletionListener { notifyListeners("ended", JSObject()) }
            media.setOnErrorListener { _, _, _ -> call.reject("Audio playback failed"); true }
            source(media)
            media.prepareAsync()
        }.onFailure { call.reject("Could not open audio: ${it.message}", it.asException()) }
    }

    @PluginMethod
    fun pause(call: PluginCall) { activity.runOnUiThread { runCatching { if (player?.isPlaying == true) player?.pause(); call.resolve() }.onFailure { call.reject("Pause failed", it.asException()) } } }

    @PluginMethod
    fun resume(call: PluginCall) { activity.runOnUiThread { runCatching { player?.start(); call.resolve() }.onFailure { call.reject("Resume failed", it.asException()) } } }

    @PluginMethod
    fun seek(call: PluginCall) { activity.runOnUiThread { runCatching { player?.seekTo((call.getDouble("seconds") ?: 0.0).toInt().coerceAtLeast(0) * 1000); call.resolve() }.onFailure { call.reject("Seek failed", it.asException()) } } }

    @PluginMethod
    fun position(call: PluginCall) { activity.runOnUiThread { call.resolve(JSObject().put("seconds", (player?.currentPosition ?: 0) / 1000.0).put("duration", (player?.duration ?: 0) / 1000.0)) } }

    @PluginMethod
    fun stop(call: PluginCall) { ++playRequest; activity.runOnUiThread { player?.release(); player = null; call.resolve() } }

    @PluginMethod
    fun downloadYouTube(call: PluginCall) {
        val url = call.getString("url")?.takeIf(::validYouTubeUrl)
            ?: return call.reject("A valid YouTube URL is required")
        val id = call.getString("id")?.takeIf { Regex("[A-Za-z0-9_-]{11}").matches(it) }
            ?: return call.reject("Invalid video id")
        val title = call.getString("title")?.takeIf(String::isNotBlank) ?: "Retro Mix track"
        io.execute {
            runCatching {
                val output = youtube.download(url, id)
                try {
                    val uri = files.publishMp3(output, title)
                    call.resolve(JSObject().put("uri", uri).put("size", output.length()))
                } finally { output.delete() }
            }.onFailure { call.reject("MP3 download failed: ${it.message}", it.asException()) }
        }
    }

    @PluginMethod
    fun downloadFile(call: PluginCall) {
        val url = call.getString("url")?.takeIf {
            runCatching { val parsed = URL(it); parsed.protocol == "https" && (parsed.host == "archive.org" || parsed.host.endsWith(".archive.org")) }.getOrDefault(false)
        } ?: return call.reject("An Internet Archive audio URL is required")
        val title = call.getString("title")?.takeIf(String::isNotBlank) ?: "Retro Mix track"
        io.execute {
            runCatching {
                var currentUrl = url
                var connection: HttpURLConnection
                var redirects = 0
                while (true) {
                    val target = URL(currentUrl)
                    check(target.protocol == "https" && (target.host == "archive.org" || target.host.endsWith(".archive.org"))) { "Source redirected outside Internet Archive" }
                    connection = target.openConnection() as HttpURLConnection
                    connection.setRequestProperty("User-Agent", "RetroMix/1.0 (Android; Mobile)")
                    connection.connectTimeout = 15000
                    connection.readTimeout = 30000
                    connection.instanceFollowRedirects = true
                    val code = connection.responseCode
                    if (code in 300..399) {
                        check(++redirects <= 5) { "Too many redirects" }
                        val loc = connection.getHeaderField("Location") ?: error("Redirect missing Location")
                        currentUrl = if (loc.startsWith("http")) loc else URL(URL(currentUrl), loc).toString()
                        connection.disconnect()
                        continue
                    }
                    check(code == 200) { "Source returned $code" }
                    val contentType = connection.contentType?.lowercase().orEmpty()
                    check(!contentType.startsWith("text/") && !contentType.contains("json")) { "Source did not return audio" }
                    break
                }
                val temp = File.createTempFile("retro-mix-", ".mp3", context.cacheDir)
                try {
                    connection.inputStream.use { input -> temp.outputStream().use { output ->
                        val buffer = ByteArray(64 * 1024)
                        var total = 0L
                        while (true) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            total += count
                            check(total <= 150_000_000) { "Audio file is too large" }
                            output.write(buffer, 0, count)
                        }
                    } }
                    check(temp.length() > 0) { "Source returned an empty file" }
                    val uri = files.publishMp3(temp, title)
                    call.resolve(JSObject().put("uri", uri).put("size", temp.length()))
                } finally { temp.delete(); connection.disconnect() }
            }.onFailure { call.reject("Download failed: ${it.message}", it.asException()) }
        }
    }


    @PluginMethod
    fun beginImport(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("Missing import id")
        io.execute { runCatching { files.importTemp(id).writeBytes(ByteArray(0)); call.resolve() }.onFailure { call.reject("Could not start import", it.asException()) } }
    }

    @PluginMethod
    fun appendImportChunk(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("Missing import id")
        val chunk = call.getString("base64") ?: return call.reject("Missing audio chunk")
        io.execute {
            runCatching {
                val file = files.importTemp(id)
                check(file.isFile) { "Import was not started" }
                val bytes = Base64.decode(chunk, Base64.DEFAULT)
                check(file.length() + bytes.size <= 150_000_000) { "MP3 is too large" }
                FileOutputStream(file, true).use { it.write(bytes) }
                call.resolve()
            }.onFailure { call.reject("Could not save audio chunk", it.asException()) }
        }
    }

    @PluginMethod
    fun finishImport(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("Missing import id")
        val title = call.getString("title")?.takeIf(String::isNotBlank) ?: "Imported track"
        io.execute {
            runCatching {
                val file = files.importTemp(id)
                check(file.isFile && file.length() > 0) { "Import is empty" }
                val uri = files.publishMp3(file, title)
                val size = file.length()
                file.delete()
                call.resolve(JSObject().put("uri", uri).put("size", size))
            }.onFailure { call.reject("Could not finish import", it.asException()) }
        }
    }

    @PluginMethod
    fun abortImport(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("Missing import id")
        io.execute { runCatching { files.importTemp(id).delete(); call.resolve() }.onFailure { call.reject("Could not cancel import", it.asException()) } }
    }

    @PluginMethod
    fun deleteFile(call: PluginCall) {
        val uri = call.getString("uri")?.takeIf { it.startsWith("content://") || it.startsWith("file://") }
            ?: return call.reject("A saved audio file is required")
        io.execute {
            runCatching {
                files.delete(uri)
                call.resolve()
            }.onFailure { call.reject("Could not delete saved audio", it.asException()) }
        }
    }

    override fun handleOnDestroy() { player?.release(); player = null; io.shutdownNow() }
    private fun Throwable.asException() = this as? Exception ?: RuntimeException(this)
}
