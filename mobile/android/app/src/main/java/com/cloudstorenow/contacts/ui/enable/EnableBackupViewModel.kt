package com.cloudstorenow.contacts.ui.enable

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cloudstorenow.contacts.CloudStoreNowApp
import com.cloudstorenow.contacts.worker.ContactsSyncWorker
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class EnableBackupUiState(
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

class EnableBackupViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as CloudStoreNowApp

    private val _uiState = MutableStateFlow(EnableBackupUiState())
    val uiState: StateFlow<EnableBackupUiState> = _uiState.asStateFlow()

    fun enableAutomaticBackup(onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = app.syncRepository.setAutomaticBackupEnabled(true)
            result.fold(
                onSuccess = {
                    app.authRepository.setOnboardingComplete(true)
                    app.tokenStorage.setAutomaticBackupEnabledLocally(true)
                    ContactsSyncWorker.schedulePeriodic(app)
                    ContactsSyncWorker.enqueueImmediate(app, force = true)
                    _uiState.update { it.copy(isLoading = false) }
                    onSuccess()
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.message ?: "Failed to enable backup",
                        )
                    }
                },
            )
        }
    }

    fun skip(onSkipped: () -> Unit) {
        app.authRepository.setOnboardingComplete(true)
        onSkipped()
    }
}
