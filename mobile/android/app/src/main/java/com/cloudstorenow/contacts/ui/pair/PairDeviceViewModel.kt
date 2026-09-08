package com.cloudstorenow.contacts.ui.pair

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cloudstorenow.contacts.CloudStoreNowApp
import com.cloudstorenow.contacts.data.repository.AuthResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PairDeviceUiState(
    val email: String = "",
    val password: String = "",
    val pairingCode: String = "",
    val sessionId: String? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

class PairDeviceViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as CloudStoreNowApp
    private val authRepository = app.authRepository

    private val _uiState = MutableStateFlow(PairDeviceUiState())
    val uiState: StateFlow<PairDeviceUiState> = _uiState.asStateFlow()

    fun updateEmail(value: String) {
        _uiState.update { it.copy(email = value, errorMessage = null) }
    }

    fun updatePassword(value: String) {
        _uiState.update { it.copy(password = value, errorMessage = null) }
    }

    fun updatePairingCode(value: String) {
        _uiState.update { it.copy(pairingCode = value.uppercase(), errorMessage = null) }
    }

    fun applyQrPayload(sessionId: String, pairingCode: String) {
        _uiState.update {
            it.copy(
                sessionId = sessionId,
                pairingCode = pairingCode.uppercase(),
                errorMessage = null,
            )
        }
    }

    fun completePairing(onSuccess: () -> Unit) {
        val email = _uiState.value.email.trim()
        val password = _uiState.value.password
        val pairingCode = _uiState.value.pairingCode.trim()

        if (email.isEmpty() || password.length < 8 || pairingCode.length < 4) {
            _uiState.update {
                it.copy(errorMessage = "Enter your account, password, and the website pairing code")
            }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            when (
                val result = authRepository.completePairing(
                    email = email,
                    password = password,
                    pairingCode = pairingCode,
                    sessionId = _uiState.value.sessionId,
                )
            ) {
                is AuthResult.Success -> {
                    _uiState.update { it.copy(isLoading = false) }
                    onSuccess()
                }
                is AuthResult.Error -> {
                    _uiState.update {
                        it.copy(isLoading = false, errorMessage = result.message)
                    }
                }
            }
        }
    }

    fun needsOnboarding(): Boolean = !authRepository.isOnboardingComplete()
}
