import Foundation
import SwiftData

@MainActor
final class PendingSyncQueue {
    private let modelContext: ModelContext

    init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    func enqueue(_ changes: [DeviceContactChange]) throws {
        for change in changes {
            if let existing = try fetchExisting(localContactId: change.localContactId) {
                existing.operationRaw = change.operation.rawValue
                existing.localModifiedAt = change.localModifiedAt
                existing.lastKnownCloudVersion = change.lastKnownCloudVersion
                existing.payloadJSON = change.payload.flatMap { try? ContactPayloadCodec.encode($0) }
            } else {
                modelContext.insert(
                    PendingSyncItem(
                        localContactId: change.localContactId,
                        operation: change.operation,
                        payload: change.payload,
                        localModifiedAt: change.localModifiedAt,
                        lastKnownCloudVersion: change.lastKnownCloudVersion
                    )
                )
            }
        }
        try modelContext.save()
    }

    func dequeueAll() throws -> [DeviceContactChange] {
        let descriptor = FetchDescriptor<PendingSyncItem>(
            sortBy: [SortDescriptor(\.createdAt, order: .forward)]
        )
        let items = try modelContext.fetch(descriptor)
        let changes = items.compactMap { $0.toDeviceChange() }
        for item in items {
            modelContext.delete(item)
        }
        try modelContext.save()
        return changes
    }

    func pendingCount() throws -> Int {
        try modelContext.fetchCount(FetchDescriptor<PendingSyncItem>())
    }

    func markFailure(for changes: [DeviceContactChange], error: String) throws {
        for change in changes {
            if let existing = try fetchExisting(localContactId: change.localContactId) {
                existing.attemptCount += 1
                existing.lastError = error
            } else {
                let item = PendingSyncItem(
                    localContactId: change.localContactId,
                    operation: change.operation,
                    payload: change.payload,
                    localModifiedAt: change.localModifiedAt,
                    lastKnownCloudVersion: change.lastKnownCloudVersion,
                    attemptCount: 1,
                    lastError: error
                )
                modelContext.insert(item)
            }
        }
        try modelContext.save()
    }

    private func fetchExisting(localContactId: String) throws -> PendingSyncItem? {
        var descriptor = FetchDescriptor<PendingSyncItem>(
            predicate: #Predicate { $0.localContactId == localContactId }
        )
        descriptor.fetchLimit = 1
        return try modelContext.fetch(descriptor).first
    }
}
