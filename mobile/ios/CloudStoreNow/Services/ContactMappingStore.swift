import Foundation

/// Maps cloud contact IDs to on-device CNContact identifiers for incremental sync.
final class ContactMappingStore: @unchecked Sendable {
    private let defaults: UserDefaults
    private let key = "cloudContactLocalMappings"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func localContactId(for cloudContactId: String) -> String? {
        mappings()[cloudContactId]
    }

    func set(cloudContactId: String, localContactId: String) {
        var current = mappings()
        current[cloudContactId] = localContactId
        defaults.set(current, forKey: key)
    }

    func remove(cloudContactId: String) {
        var current = mappings()
        current.removeValue(forKey: cloudContactId)
        defaults.set(current, forKey: key)
    }

    func clear() {
        defaults.removeObject(forKey: key)
    }

    private func mappings() -> [String: String] {
        defaults.dictionary(forKey: key) as? [String: String] ?? [:]
    }
}

final class LocalSnapshotStore: @unchecked Sendable {
    private let defaults: UserDefaults
    private let key = "contactSnapshotFingerprints"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load() -> [String: ContactPayload] {
        guard let data = defaults.data(forKey: key) else { return [:] }
        return (try? JSONDecoder().decode([String: ContactPayload].self, from: data)) ?? [:]
    }

    func save(_ snapshot: [String: ContactPayload]) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        defaults.set(data, forKey: key)
    }

    func clear() {
        defaults.removeObject(forKey: key)
    }
}
