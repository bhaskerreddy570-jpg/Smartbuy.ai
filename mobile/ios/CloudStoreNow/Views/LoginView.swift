import SwiftUI

struct LoginView: View {
    @ObservedObject var authViewModel: AuthViewModel
    @State private var showPassword = false

    var body: some View {
        NavigationStack {
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

                    Button(showPassword ? "Hide password" : "Show password") {
                        showPassword.toggle()
                    }
                    .font(.footnote)
                } header: {
                    Text("CloudStoreNow Account")
                } footer: {
                    Text("Your password is sent only for sign-in and is never stored on this device. The bearer token is saved in the Keychain.")
                }

                if let error = authViewModel.errorMessage {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button {
                        Task { await authViewModel.login() }
                    } label: {
                        if authViewModel.isLoading {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text("Sign In")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(authViewModel.isLoading)
                }
            }
            .navigationTitle("Sign In")
        }
    }
}

#Preview {
    LoginView(authViewModel: AuthViewModel())
}
