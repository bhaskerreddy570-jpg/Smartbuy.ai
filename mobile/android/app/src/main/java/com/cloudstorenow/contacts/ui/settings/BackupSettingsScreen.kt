package com.cloudstorenow.contacts.ui.settings

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.cloudstorenow.contacts.R

@Composable
fun BackupSettingsScreen(
    viewModel: BackupSettingsViewModel,
    onSignedOut: () -> Unit,
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        viewModel.onPermissionResult(granted)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = stringResource(R.string.backup_status_title),
            style = MaterialTheme.typography.headlineMedium,
        )

        val email = state.email
        if (email != null) {
            Text(
                text = stringResource(R.string.signed_in_as, email),
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        when (state.permissionState) {
            PermissionState.NOT_REQUESTED -> {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(stringResource(R.string.contacts_permission_required))
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = {
                                permissionLauncher.launch(Manifest.permission.READ_CONTACTS)
                            },
                        ) {
                            Text(stringResource(R.string.grant_permission))
                        }
                    }
                }
            }
            PermissionState.DENIED -> {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = stringResource(R.string.permission_denied),
                            color = MaterialTheme.colorScheme.error,
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = {
                                val intent = Intent(
                                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                    Uri.fromParts("package", context.packageName, null),
                                )
                                context.startActivity(intent)
                            },
                        ) {
                            Text(stringResource(R.string.open_settings))
                        }
                    }
                }
            }
            PermissionState.GRANTED -> Unit
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(stringResource(R.string.automatic_backup))
                    Switch(
                        checked = state.automaticBackupEnabled,
                        onCheckedChange = viewModel::setAutomaticBackupEnabled,
                        enabled = state.permissionState == PermissionState.GRANTED && !state.isSyncing,
                    )
                }
                Text("${stringResource(R.string.cloud_contacts)}: ${state.contactCount}")
                Text(
                    "${stringResource(R.string.last_backup)}: " +
                        (state.lastBackupAt ?: stringResource(R.string.never)),
                )
                Text("${stringResource(R.string.pending_changes)}: ${state.pendingChanges}")
                if (state.lastSyncStatus != null) {
                    Text("${stringResource(R.string.sync_status)}: ${state.lastSyncStatus}")
                }
                if (state.lastSyncError != null) {
                    Text(
                        text = "${stringResource(R.string.sync_failed)}: ${state.lastSyncError}",
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }
        }

        if (state.errorMessage != null) {
            Text(
                text = state.errorMessage!!,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
            )
        }

        Button(
            onClick = viewModel::backupNow,
            enabled = state.permissionState == PermissionState.GRANTED && !state.isSyncing,
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (state.isSyncing) {
                CircularProgressIndicator(modifier = Modifier.height(20.dp))
            } else {
                Text(stringResource(R.string.backup_now))
            }
        }

        OutlinedButton(
            onClick = { viewModel.signOut(onSignedOut) },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(stringResource(R.string.sign_out))
        }
    }
}
