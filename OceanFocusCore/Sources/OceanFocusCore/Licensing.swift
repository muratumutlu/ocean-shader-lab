import Foundation

/// Lifetime-unlock entitlement. Implemented by StoreKit (Plan 6) and Lemon Squeezy (v1.1).
public protocol Licensing: Sendable {
    func isUnlocked() async -> Bool
    /// Returns true when the purchase completed and the app is now unlocked.
    func purchase() async throws -> Bool
    /// Returns true when a previous purchase was found.
    func restore() async throws -> Bool
}

/// Fixed answer. Used in tests and previews.
public struct StaticLicensing: Licensing {
    public let unlocked: Bool

    public init(unlocked: Bool) {
        self.unlocked = unlocked
    }

    public func isUnlocked() async -> Bool { unlocked }
    public func purchase() async throws -> Bool { unlocked }
    public func restore() async throws -> Bool { unlocked }
}
