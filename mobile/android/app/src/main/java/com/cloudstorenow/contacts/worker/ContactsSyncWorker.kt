package com.cloudstorenow.contacts.worker

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.cloudstorenow.contacts.CloudStoreNowApp
import com.cloudstorenow.contacts.data.repository.SyncResult
import java.util.concurrent.TimeUnit

class ContactsSyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as CloudStoreNowApp
        if (!app.authRepository.isLoggedIn()) {
            return Result.failure()
        }

        val force = inputData.getBoolean(KEY_FORCE, false)
        val syncResult = app.syncRepository.processSyncQueue(force = force)

        return when (syncResult) {
            is SyncResult.Success -> Result.success()
            is SyncResult.Error -> {
                if (syncResult.requiresLogin) {
                    app.authRepository.signOut()
                    Result.failure()
                } else {
                    Result.retry()
                }
            }
        }
    }

    companion object {
        const val UNIQUE_PERIODIC_WORK = "contacts_periodic_sync"
        const val UNIQUE_IMMEDIATE_WORK = "contacts_immediate_sync"
        private const val KEY_FORCE = "force"

        fun schedulePeriodic(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<ContactsSyncWorker>(6, TimeUnit.HOURS)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_PERIODIC_WORK,
                ExistingPeriodicWorkPolicy.UPDATE,
                request,
            )
        }

        fun cancelPeriodic(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_PERIODIC_WORK)
        }

        fun enqueueImmediate(context: Context, force: Boolean = false) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<ContactsSyncWorker>()
                .setConstraints(constraints)
                .setInputData(workDataOf(KEY_FORCE to force))
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_IMMEDIATE_WORK,
                ExistingWorkPolicy.REPLACE,
                request,
            )
        }
    }
}
