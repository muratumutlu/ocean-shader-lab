import Foundation

public struct OwnedUpgrade: Codable, Equatable, Sendable {
    public var id: String
    /// Stored so a catalog change can refund exactly what was paid.
    public var pricePaid: Int
}

public struct RegionProgress: Codable, Equatable, Sendable {
    public var money: Int = 0
    public var ownedUpgrades: [OwnedUpgrade] = []

    public var ownedIds: Set<String> { Set(ownedUpgrades.map(\.id)) }
}

public enum SessionKind: String, Codable, Sendable {
    case focus
    case rest = "break"
}

public struct ActiveSession: Codable, Equatable, Sendable {
    public var kind: SessionKind
    public var durationSec: Int
    public var startedAt: Date
    public var endsAt: Date
    /// FocusClock.uptime when the session started. Used to detect wall-clock tampering.
    public var monotonicStart: TimeInterval
    /// Region the catch is credited to, fixed at start.
    public var regionId: String
}

public enum SessionOutcome: String, Codable, Sendable {
    case completed, abandoned, unverified
}

public struct SessionRecord: Codable, Equatable, Sendable {
    public var endedAt: Date
    public var durationSec: Int
    public var outcome: SessionOutcome
    public var fish: Int
    public var money: Int
    public var regionId: String
}

public struct GameState: Codable, Equatable, Sendable {
    public static let currentSchemaVersion = 1

    public var schemaVersion: Int
    public var currentRegionId: String
    public var regions: [String: RegionProgress]
    public var unlockedRegionIds: [String]
    public var activeSession: ActiveSession?
    public var history: [SessionRecord]

    public static func fresh(catalog: Catalog) -> GameState {
        let starter = catalog.starterRegionId
        return GameState(schemaVersion: currentSchemaVersion, currentRegionId: starter,
                         regions: [starter: RegionProgress()], unlockedRegionIds: [starter],
                         activeSession: nil, history: [])
    }

    public func progress(for regionId: String) -> RegionProgress {
        regions[regionId] ?? RegionProgress()
    }
}
