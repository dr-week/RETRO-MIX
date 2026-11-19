package com.afterglow.player

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase

@Entity(tableName = "music_tracks")
data class MusicTrackRecord(
    @PrimaryKey val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val duration: Double,
    val cover: String?,
    val size: Long,
    val source: String,
    val favorite: Boolean,
)

@Dao
interface MusicTrackDao {
    @Query("SELECT * FROM music_tracks ORDER BY title COLLATE NOCASE ASC")
    fun getAll(): List<MusicTrackRecord>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun upsert(track: MusicTrackRecord)

    @Query("DELETE FROM music_tracks WHERE id = :id")
    fun delete(id: String)
}

@Database(entities = [MusicTrackRecord::class], version = 1, exportSchema = false)
abstract class MusicLibraryDatabase : RoomDatabase() {
    abstract fun tracks(): MusicTrackDao
}
