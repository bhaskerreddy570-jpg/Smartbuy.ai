package com.cloudstorenow.contacts

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.Modifier
import com.cloudstorenow.contacts.ui.CloudStoreNowNavHost
import com.cloudstorenow.contacts.ui.Routes

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as CloudStoreNowApp
        val startDestination = when {
            !app.authRepository.isLoggedIn() -> Routes.LOGIN
            !app.authRepository.isOnboardingComplete() -> Routes.ENABLE_BACKUP
            else -> Routes.SETTINGS
        }

        setContent {
            MaterialTheme(colorScheme = lightColorScheme()) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    CloudStoreNowNavHost(startDestination = startDestination)
                }
            }
        }
    }
}
