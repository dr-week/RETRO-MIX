package com.afterglow.player

import android.media.MediaMetadataRetriever
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Test

class YouTubeDownloadTest {
    @Test
    fun travisRemakes() = verifySearchDownload("Travis Scott remakes")

    @Test
    fun djRemakes() = verifySearchDownload("DJ remakes")

    @Test
    fun artistMisspelling() = verifySearchDownload("Arji Singh")

    @Test
    fun regionalTrending() = verifySearchDownload("trending music India")

    @Test
    fun billboard() = verifySearchDownload("Billboard hot 100 song official audio")
    @Test
    fun relaxedMusicSearch() = verifySearchDownload("river flows in you piano cover")

    @Test
    fun hindiMusicSearch() = verifySearchDownload("old hindi song acoustic cover short")

    @Test
    fun upbeatMusicSearch() = verifySearchDownload("autumn leaves jazz guitar cover")

    private fun verifySearchDownload(query: String) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val source = YouTubeSource(context)
        val results = source.search(query)
        assertTrue("Search returned no videos", results.length() > 0)
        val result = (0 until results.length()).map { results.getJSONObject(it) }
            .firstOrNull { it.optDouble("duration") in 90.0..600.0 }
            ?: error("Search returned no short test video")
        val file = source.download(result.getString("url"), result.getString("id"))
        try {
            assertTrue("MP3 is empty", file.length() > 0)
            val metadata = MediaMetadataRetriever()
            try {
                metadata.setDataSource(file.absolutePath)
                val duration = metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0
                assertTrue("MP3 has no playable duration", duration > 0)
                println("DOWNLOAD_TEST query=$query title=${result.getString("title")} url=${result.getString("url")} bytes=${file.length()} durationMs=$duration")
            } finally { metadata.release() }
        } finally { file.delete() }
    }
}
