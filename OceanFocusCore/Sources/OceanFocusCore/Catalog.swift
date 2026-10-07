import Foundation

public enum UpgradeCategory: String, Codable, Sendable {
    case equipment, boat, crew
}

public struct UpgradeEffect: Codable, Equatable, Sendable {
    public var fishMultiplier: Double?
    public var moneyBonus: Double?
}

public struct Upgrade: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var category: UpgradeCategory
    public var price: Int
    public var effect: UpgradeEffect
    public var requires: [String]
}

public struct Region: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var fishPrice: Int
    public var unlockPrice: Int
    public var available: Bool
    public var requiresLicense: Bool
    public var upgrades: [Upgrade]
}

public struct Catalog: Codable, Equatable, Sendable {
    public var version: Int
    public var regions: [Region]

    public static func decode(_ data: Data) throws -> Catalog {
        try JSONDecoder().decode(Catalog.self, from: data)
    }

    public static func bundled() throws -> Catalog {
        guard let url = Bundle.module.url(forResource: "Catalog", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        return try decode(Data(contentsOf: url))
    }

    public func region(_ id: String) -> Region? {
        regions.first { $0.id == id }
    }

    public func upgrade(_ id: String) -> (region: Region, upgrade: Upgrade)? {
        for region in regions {
            if let upgrade = region.upgrades.first(where: { $0.id == id }) {
                return (region, upgrade)
            }
        }
        return nil
    }

    /// First available region that needs no license. CatalogValidator guarantees one exists.
    public var starterRegionId: String {
        regions.first { $0.available && !$0.requiresLicense }?.id ?? regions[0].id
    }

    public func modifiers(regionId: String, owned: Set<String>) -> Modifiers {
        guard let region = region(regionId) else { return .none }
        var result = Modifiers.none
        for upgrade in region.upgrades where owned.contains(upgrade.id) {
            result.fishMultiplier *= upgrade.effect.fishMultiplier ?? 1
            result.moneyBonus += upgrade.effect.moneyBonus ?? 0
        }
        return result
    }
}
