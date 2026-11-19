package com.afterglow.player

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.File

internal class MusicFileStore(private val context: Context) {
    private val musicPath = "Music/Retro Mix/Music Downloaded/"

    fun publishMp3(source: File, title: String): String {
        val name = title.replace(Regex("[\\/:*?\"<>|\\p{Cntrl}]"), "_").trim().take(80).ifBlank { "Retro Mix track" }
        if (Build.VERSION.SDK_INT < 29) {
            val folder = File(context.getExternalFilesDir(Environment.DIRECTORY_MUSIC), "Retro Mix/Music Downloaded").apply { mkdirs() }
            var target = File(folder, "$name.mp3")
            var suffix = 2
            while (target.exists()) target = File(folder, "$name ($suffix).mp3").also { suffix++ }
            source.copyTo(target)
            return Uri.fromFile(target).toString()
        }
        val values = ContentValues().apply {
            put(MediaStore.Audio.Media.DISPLAY_NAME, "$name.mp3")
            put(MediaStore.Audio.Media.MIME_TYPE, "audio/mpeg")
            put(MediaStore.Audio.Media.RELATIVE_PATH, musicPath)
            put(MediaStore.Audio.Media.IS_PENDING, 1)
        }
        val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val uri = context.contentResolver.insert(collection, values) ?: error("Could not create music file")
        try {
            context.contentResolver.openOutputStream(uri)?.use { output -> source.inputStream().use { it.copyTo(output) } }
                ?: error("Could not write music file")
            context.contentResolver.update(uri, ContentValues().apply { put(MediaStore.Audio.Media.IS_PENDING, 0) }, null, null)
            return uri.toString()
        } catch (error: Throwable) {
            context.contentResolver.delete(uri, null, null)
            throw error
        }
    }

    fun importTemp(id: String): File {
        check(Regex("file-[a-f0-9-]{36}").matches(id)) { "Invalid import id" }
        return File(File(context.cacheDir, "imports").apply { mkdirs() }, "$id.mp3")
    }

    fun delete(uriString: String) {
        val uri = Uri.parse(uriString)
        if (uri.scheme == "content") {
            check(uri.authority == MediaStore.AUTHORITY) { "File is outside Retro Mix storage" }
            val relativePath = context.contentResolver.query(uri, arrayOf(MediaStore.Audio.Media.RELATIVE_PATH), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            }
            check(relativePath == musicPath) { "File is outside Retro Mix storage" }
            context.contentResolver.delete(uri, null, null)
        } else {
            check(uri.scheme == "file") { "A saved audio file is required" }
            val file = File(uri.path ?: "").canonicalFile
            val root = File(context.getExternalFilesDir(Environment.DIRECTORY_MUSIC), "Retro Mix/Music Downloaded").canonicalFile
            check(file.parentFile == root) { "File is outside Retro Mix storage" }
            file.delete()
        }
    }
}
