import SwiftUI

struct PairDeviceView: View {
    @ObservedObject var authViewModel: AuthViewModel
    @State private var pairingCode = ""
    @State private var showPassword = false

    var body: some View {
        Form {
            Section {
                TextField("Email", text: $authViewModel.email)
                    .textContentType(.username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                if showPassword {
                    TextField("Password", text: $authViewModel.password)
                        .textContentType(.password)
                } else {
                    SecureField("Password", text: $authViewModel.password)
                        .textContentType(.password)
                }

                TextField("Pairing code", text: $pairingCode)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
            } header: {
                Text("Connect This Device")
            } footer: {
                Text("Open CloudStoreNow on the web, go to My Files → Contacts, tap Connect a device, then enter the pairing code shown there.")
            }

            if let error = authViewModel.errorMessage {
                Section {
                    Text(error)
                        .foregroundStyle(.red)
                }
            }

            Section {
                Button {
                    Task {
                        await authViewModel.completePairing(pairingCode: pairingCode)
                    }
                } label: {
                    if authViewModel.isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Connect Device")
                            .frame(maxWidth: .infinity)
                    }
                }
                .disabled(authViewModel.isLoading)
            }
        }
        .navigationTitle("Pair Device")
    }
}

#Preview {
    NavigationStack {
        PairDeviceView(authViewModel: AuthViewModel())
    }
}
