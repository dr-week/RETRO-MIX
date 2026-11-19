package com.afterglow.player

import androidx.room.Room
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.concurrent.Executors

@CapacitorPlugin(name = "MusicLibrary")
class MusicLibraryPlugin : Plugin() {
    private val io = Executors.newSingleThreadExecutor()
    private val database by lazy {
        Room.databaseBuilder(context, MusicLibraryDatabase::class.java, "afterglow-library.db").build()
    }

    @PluginMethod
    fun listTracks(call: PluginCall) {
        io.execute {
            runCatching {
                val tracks = JSArray()
                database.tracks().getAll().forEach { tracks.put(it.toJson()) }
                call.resolve(JSObject().put("tracks", tracks))
            }.onFailure { call.reject("Could not read the music library", it.asException()) }
        }
    }

    @PluginMethod
    fun upsertTrack(call: PluginCall) {
        val data = call.getObject("track") ?: return call.reject("Missing track metadata")
        val id = data.optString("id").takeIf(String::isNotBlank) ?: return call.reject("Missing track id")
        val record = MusicTrackRecord(
            id = id,
            title = data.optString("title", "Untitled"),
            artist = data.optString("artist", "Unknown artist"),
            album = data.optString("album", "Local music"),
            duration = data.optDouble("duration", 0.0),
            cover = data.optString("cover").takeIf(String::isNotBlank),
            size = data.optLong("size", 0L),
            source = data.optString("source", "import"),
            favorite = data.optBoolean("favorite", false),
        )
        io.execute {
            runCatching { database.tracks().upsert(record); call.resolve() }
                .onFailure { call.reject("Could not save track metadata", it.asException()) }
        }
    }

    @PluginMethod
    fun deleteTrack(call: PluginCall) {
        val id = call.getString("id")?.takeIf(String::isNotBlank) ?: return call.reject("Missing track id")
        io.execute {
            runCatching { database.tracks().delete(id); call.resolve() }
                .onFailure { call.reject("Could not delete track metadata", it.asException()) }
        }
    }

    private fun MusicTrackRecord.toJson() = JSObject().apply {
        put("id", id)
        put("title", title)
        put("artist", artist)
        put("album", album)
        put("duration", duration)
        put("cover", cover)
        put("size", size)
        put("source", source)
        put("favorite", favorite)
        put("local", true)
    }

    private fun Throwable.asException() = this as? Exception ?: RuntimeException(this)
}
