package com.cloudstorenow.contacts.data.db

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase

@Entity(tableName = "pending_sync")
data class PendingSyncEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val localContactId: String,
    val operation: String,
    val payloadJson: String?,
    val localModifiedAt: String?,
    val lastKnownCloudVersion: String?,
    val createdAt: Long = System.currentTimeMillis(),
    val retryCount: Int = 0,
)

@Dao
interface PendingSyncDao {
    @Query("SELECT * FROM pending_sync ORDER BY createdAt ASC")
    suspend fun getAll(): List<PendingSyncEntity>

    @Query("SELECT COUNT(*) FROM pending_sync")
    suspend fun count(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: PendingSyncEntity): Long

    @Query("DELETE FROM pending_sync WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<Long>)

    @Query("DELETE FROM pending_sync WHERE localContactId = :localContactId")
    suspend fun deleteByLocalContactId(localContactId: String)

    @Query(
        """
        DELETE FROM pending_sync
        WHERE localContactId = :localContactId
          AND operation = :operation
          AND id != :keepId
        """,
    )
    suspend fun dedupe(localContactId: String, operation: String, keepId: Long)

    @Query("UPDATE pending_sync SET retryCount = retryCount + 1 WHERE id IN (:ids)")
    suspend fun incrementRetry(ids: List<Long>)
}

@Database(entities = [PendingSyncEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun pendingSyncDao(): PendingSyncDao
}
