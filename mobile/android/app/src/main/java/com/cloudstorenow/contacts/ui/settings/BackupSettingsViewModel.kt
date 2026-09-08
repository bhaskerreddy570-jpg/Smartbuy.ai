package com.cloudstorenow.contacts.ui.settings

import android.app.Application
import android.database.ContentObserver
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cloudstorenow.contacts.CloudStoreNowApp
import com.cloudstorenow.contacts.data.repository.SyncResult
import com.cloudstorenow.contacts.worker.ContactsSyncWorker
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class PermissionState {
    GRANTED,
    DENIED,
    NOT_REQUESTED,
}

data class BackupSettingsUiState(
    val email: String? = null,
    val automaticBackupEnabled: Boolean = false,
    val contactCount: Int = 0,
    val lastBackupAt: String? = null,
    val lastSyncStatus: String? = null,
    val lastSyncError: String? = null,
    val pendingChanges: Int = 0,
    val isSyncing: Boolean = false,
    val permissionState: PermissionState = PermissionState.NOT_REQUESTED,
    val errorMessage: String? = null,
)

class BackupSettingsViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as CloudStoreNowApp
    private var contactsObserver: ContentObserver? = null

    private val _uiState = MutableStateFlow(BackupSettingsUiState())
    val uiState: StateFlow<BackupSettingsUiState> = _uiState.asStateFlow()

    init {
        refresh()
        registerContactsObserver()
    }

    private fun registerContactsObserver() {
        val reader = com.cloudstorenow.contacts.data.contacts.ContactsReader(app)
        contactsObserver = reader.registerObserver {
            if (_uiState.value.automaticBackupEnabled && _uiState.value.permissionState == PermissionState.GRANTED) {
                viewModelScope.launch {
                    app.syncRepository.queueDetectedChanges()
                    refreshPendingCount()
                    ContactsSyncWorker.enqueueImmediate(app)
                }
            }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            val permissionState = when {
                app.syncRepository.hasContactsPermission() -> PermissionState.GRANTED
                _uiState.value.permissionState == PermissionState.DENIED -> PermissionState.DENIED
                else -> PermissionState.NOT_REQUESTED
            }

            _uiState.update {
                it.copy(
                    email = app.authRepository.getSession()?.email,
                    automaticBackupEnabled = app.syncRepository.isAutomaticBackupEnabled(),
                    permissionState = permissionState,
                )
            }

            refreshPendingCount()
            loadSummary()
        }
    }

    private suspend fun refreshPendingCount() {
        val count = app.syncRepository.pendingCount()
        _uiState.update { it.copy(pendingChanges = count) }
    }

    private suspend fun loadSummary() {
        app.syncRepository.fetchBackupSummary().fold(
            onSuccess = { summary ->
                _uiState.update {
                    it.copy(
                        automaticBackupEnabled = summary.automaticBackupEnabled,
                        contactCount = summary.contactCount,
                        lastBackupAt = summary.lastSuccessfulBackupAt,
                        lastSyncStatus = summary.lastSyncStatus,
                        lastSyncError = summary.lastSyncError,
                    )
                }
                app.tokenStorage.setAutomaticBackupEnabledLocally(summary.automaticBackupEnabled)
            },
            onFailure = { error ->
                _uiState.update {
                    it.copy(errorMessage = error.message)
                }
            },
        )
    }

    fun onPermissionResult(granted: Boolean) {
        _uiState.update {
            it.copy(
                permissionState = if (granted) PermissionState.GRANTED else PermissionState.DENIED,
            )
        }
        if (granted) {
            viewModelScope.launch {
                app.syncRepository.queueDetectedChanges(force = true)
                refreshPendingCount()
            }
        }
    }

    fun setAutomaticBackupEnabled(enabled: Boolean) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSyncing = true, errorMessage = null) }
            app.syncRepository.setAutomaticBackupEnabled(enabled).fold(
                onSuccess = { summary ->
                    if (enabled) {
                        ContactsSyncWorker.schedulePeriodic(app)
                        ContactsSyncWorker.enqueueImmediate(app)
                    } else {
                        ContactsSyncWorker.cancelPeriodic(app)
                    }
                    _uiState.update {
                        it.copy(
                            isSyncing = false,
                            automaticBackupEnabled = summary.automaticBackupEnabled,
                            contactCount = summary.contactCount,
                            lastBackupAt = summary.lastSuccessfulBackupAt,
                            lastSyncStatus = summary.lastSyncStatus,
                            lastSyncError = summary.lastSyncError,
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(isSyncing = false, errorMessage = error.message)
                    }
                },
            )
        }
    }

    fun backupNow() {
        viewModelScope.launch {
            if (_uiState.value.permissionState != PermissionState.GRANTED) {
                _uiState.update { it.copy(errorMessage = "Contacts permission required") }
                return@launch
            }

            _uiState.update { it.copy(isSyncing = true, errorMessage = null) }
            ContactsSyncWorker.enqueueImmediate(app, force = true)

            when (val result = app.syncRepository.processSyncQueue(force = true)) {
                is SyncResult.Success -> {
                    refreshPendingCount()
                    loadSummary()
                    _uiState.update { it.copy(isSyncing = false) }
                }
                is SyncResult.Error -> {
                    _uiState.update {
                        it.copy(isSyncing = false, errorMessage = result.message)
                    }
                }
            }
        }
    }

    fun signOut(onSignedOut: () -> Unit) {
        ContactsSyncWorker.cancelPeriodic(app)
        app.authRepository.signOut()
        onSignedOut()
    }

    override fun onCleared() {
        contactsObserver?.let {
            com.cloudstorenow.contacts.data.contacts.ContactsReader(app).unregisterObserver(it)
        }
        super.onCleared()
    }
}
