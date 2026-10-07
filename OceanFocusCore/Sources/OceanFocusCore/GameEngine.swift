import Foundation

public enum GameError: Error, Equatable, Sendable {
    case unknownUpgrade(String)
    case unknownRegion(String)
    case wrongRegion(String)
    case alreadyOwned(String)
    case missingRequirement(String)
    case insufficientFunds(needed: Int, available: Int)
    case regionUnavailable(String)
    case regionLocked(String)
    case requiresLicense(String)
    case alreadyUnlocked(String)
    case sessionAlreadyActive
    case noActiveSession
}

/// Shop and region rules. Every mutation goes through `inout GameState`.
public struct GameEngine: Sendable {
    public let catalog: Catalog

    public init(catalog: Catalog) {
        self.catalog = catalog
    }

    public func modifiers(in state: GameState, regionId: String) -> Modifiers {
        catalog.modifiers(regionId: regionId, owned: state.progress(for: regionId).ownedIds)
    }

    /// Unowned upgrades of the current region whose requirements are met (affordable or not).
    public func purchasable(in state: GameState) -> [Upgrade] {
        guard let region = catalog.region(state.currentRegionId) else { return [] }
        let owned = state.progress(for: region.id).ownedIds
        return region.upgrades.filter { !owned.contains($0.id) && $0.requires.allSatisfy(owned.contains) }
    }

    public func purchase(_ upgradeId: String, in state: inout GameState) throws {
        guard let match = catalog.upgrade(upgradeId) else { throw GameError.unknownUpgrade(upgradeId) }
        guard match.region.id == state.currentRegionId else { throw GameError.wrongRegion(upgradeId) }
        var progress = state.progress(for: match.region.id)
        let owned = progress.ownedIds
        guard !owned.contains(upgradeId) else { throw GameError.alreadyOwned(upgradeId) }
        if let missing = match.upgrade.requires.first(where: { !owned.contains($0) }) {
            throw GameError.missingRequirement(missing)
        }
        guard progress.money >= match.upgrade.price else {
            throw GameError.insufficientFunds(needed: match.upgrade.price, available: progress.money)
        }
        progress.money -= match.upgrade.price
        progress.ownedUpgrades.append(OwnedUpgrade(id: upgradeId, pricePaid: match.upgrade.price))
        state.regions[match.region.id] = progress
    }

    /// Pays `unlockPrice` from the current region's money, then switches to the new region.
    public func unlockRegion(_ regionId: String, licensed: Bool, in state: inout GameState) throws {
        guard let region = catalog.region(regionId) else { throw GameError.unknownRegion(regionId) }
        guard state.activeSession == nil else { throw GameError.sessionAlreadyActive }
        guard !state.unlockedRegionIds.contains(regionId) else { throw GameError.alreadyUnlocked(regionId) }
        guard region.available else { throw GameError.regionUnavailable(regionId) }
        guard licensed || !region.requiresLicense else { throw GameError.requiresLicense(regionId) }
        let available = state.progress(for: state.currentRegionId).money
        guard available >= region.unlockPrice else {
            throw GameError.insufficientFunds(needed: region.unlockPrice, available: available)
        }
        state.regions[state.currentRegionId, default: RegionProgress()].money -= region.unlockPrice
        state.unlockedRegionIds.append(regionId)
        state.regions[regionId] = state.regions[regionId] ?? RegionProgress()
        state.currentRegionId = regionId
    }

    public func switchRegion(_ regionId: String, licensed: Bool, in state: inout GameState) throws {
        guard let region = catalog.region(regionId) else { throw GameError.unknownRegion(regionId) }
        guard state.activeSession == nil else { throw GameError.sessionAlreadyActive }
        guard state.unlockedRegionIds.contains(regionId) else { throw GameError.regionLocked(regionId) }
        guard licensed || !region.requiresLicense else { throw GameError.requiresLicense(regionId) }
        state.currentRegionId = regionId
    }

    /// Without a license, licensed regions cannot be entered. Their progress is kept untouched.
    public func enforceLicense(licensed: Bool, in state: inout GameState) {
        guard !licensed, catalog.region(state.currentRegionId)?.requiresLicense == true else { return }
        state.currentRegionId = catalog.starterRegionId
    }

    /// Removes owned upgrades the catalog no longer has, refunding what was paid.
    /// Returns the total refunded across all regions.
    @discardableResult
    public func reconcile(_ state: inout GameState) -> Int {
        var refunded = 0
        for (regionId, var progress) in state.regions {
            let known = Set(catalog.region(regionId)?.upgrades.map(\.id) ?? [])
            let (keep, drop) = (progress.ownedUpgrades.filter { known.contains($0.id) },
                                progress.ownedUpgrades.filter { !known.contains($0.id) })
            guard !drop.isEmpty else { continue }
            let refund = drop.reduce(0) { $0 + $1.pricePaid }
            progress.ownedUpgrades = keep
            progress.money += refund
            refunded += refund
            state.regions[regionId] = progress
        }
        if catalog.region(state.currentRegionId) == nil {
            state.currentRegionId = catalog.starterRegionId
        }
        return refunded
    }
}
