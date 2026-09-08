package com.cloudstorenow.contacts

import android.app.Application
import androidx.room.Room
import com.cloudstorenow.contacts.data.auth.TokenStorage
import com.cloudstorenow.contacts.data.db.AppDatabase
import com.cloudstorenow.contacts.data.repository.AuthRepository
import com.cloudstorenow.contacts.data.repository.SyncRepository
import com.cloudstorenow.contacts.worker.ContactsSyncWorker

class CloudStoreNowApp : Application() {
    lateinit var tokenStorage: TokenStorage
        private set

    lateinit var database: AppDatabase
        private set

    lateinit var authRepository: AuthRepository
        private set

    lateinit var syncRepository: SyncRepository
        private set

    override fun onCreate() {
        super.onCreate()
        tokenStorage = TokenStorage(this)
        database = Room.databaseBuilder(this, AppDatabase::class.java, "cloudstorenow.db")
            .fallbackToDestructiveMigration()
            .build()
        authRepository = AuthRepository(tokenStorage)
        syncRepository = SyncRepository(this, tokenStorage, database.pendingSyncDao())

        if (authRepository.isLoggedIn() && tokenStorage.isAutomaticBackupEnabledLocally()) {
            ContactsSyncWorker.schedulePeriodic(this)
        }
    }
}
