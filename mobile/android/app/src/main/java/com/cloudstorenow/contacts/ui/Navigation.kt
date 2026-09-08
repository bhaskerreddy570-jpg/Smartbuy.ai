package com.cloudstorenow.contacts.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.cloudstorenow.contacts.ui.enable.EnableBackupScreen
import com.cloudstorenow.contacts.ui.enable.EnableBackupViewModel
import com.cloudstorenow.contacts.ui.login.LoginScreen
import com.cloudstorenow.contacts.ui.login.LoginViewModel
import com.cloudstorenow.contacts.ui.pair.PairDeviceScreen
import com.cloudstorenow.contacts.ui.pair.PairDeviceViewModel
import com.cloudstorenow.contacts.ui.settings.BackupSettingsScreen
import com.cloudstorenow.contacts.ui.settings.BackupSettingsViewModel

object Routes {
    const val LOGIN = "login"
    const val PAIR_DEVICE = "pair_device"
    const val ENABLE_BACKUP = "enable_backup"
    const val SETTINGS = "settings"
}

@Composable
fun CloudStoreNowNavHost(
    startDestination: String,
    modifier: Modifier = Modifier,
    navController: NavHostController = rememberNavController(),
) {
    NavHost(
        navController = navController,
        startDestination = startDestination,
        modifier = modifier,
    ) {
        composable(Routes.LOGIN) {
            val viewModel: LoginViewModel = viewModel()
            LoginScreen(
                viewModel = viewModel,
                onLoggedIn = {
                    val destination = if (viewModel.needsOnboarding()) {
                        Routes.ENABLE_BACKUP
                    } else {
                        Routes.SETTINGS
                    }
                    navController.navigate(destination) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onConnectWithPairingCode = {
                    navController.navigate(Routes.PAIR_DEVICE)
                },
            )
        }

        composable(Routes.PAIR_DEVICE) {
            val viewModel: PairDeviceViewModel = viewModel()
            PairDeviceScreen(
                viewModel = viewModel,
                onPaired = {
                    val destination = if (viewModel.needsOnboarding()) {
                        Routes.ENABLE_BACKUP
                    } else {
                        Routes.SETTINGS
                    }
                    navController.navigate(destination) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onBackToLogin = {
                    navController.popBackStack()
                },
            )
        }

        composable(Routes.ENABLE_BACKUP) {
            val viewModel: EnableBackupViewModel = viewModel()
            EnableBackupScreen(
                viewModel = viewModel,
                onEnabled = {
                    navController.navigate(Routes.SETTINGS) {
                        popUpTo(Routes.ENABLE_BACKUP) { inclusive = true }
                    }
                },
                onSkipped = {
                    navController.navigate(Routes.SETTINGS) {
                        popUpTo(Routes.ENABLE_BACKUP) { inclusive = true }
                    }
                },
            )
        }

        composable(Routes.SETTINGS) {
            val viewModel: BackupSettingsViewModel = viewModel()
            BackupSettingsScreen(
                viewModel = viewModel,
                onSignedOut = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(Routes.SETTINGS) { inclusive = true }
                    }
                },
            )
        }
    }
}
