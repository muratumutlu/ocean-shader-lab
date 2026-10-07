import Foundation

public enum CatalogValidator {
    /// Returns human-readable problems. An empty array means the catalog is valid.
    public static func validate(_ catalog: Catalog) -> [String] {
        var errors: [String] = []
        var seen = Set<String>()

        if !catalog.regions.contains(where: { $0.available && !$0.requiresLicense }) {
            errors.append("catalog has no free available region")
        }

        for region in catalog.regions {
            if !seen.insert(region.id).inserted { errors.append("duplicate id \(region.id)") }
            if region.available && region.fishPrice <= 0 { errors.append("\(region.id): fishPrice must be > 0") }
            if region.available && region.upgrades.isEmpty { errors.append("\(region.id): available region has no upgrades") }

            let ids = Set(region.upgrades.map(\.id))
            var lastPrice: [UpgradeCategory: Int] = [:]
            for upgrade in region.upgrades {
                if !seen.insert(upgrade.id).inserted { errors.append("duplicate id \(upgrade.id)") }
                if !upgrade.id.hasPrefix(region.id + ".") { errors.append("\(upgrade.id): id must start with \(region.id).") }
                if upgrade.price <= 0 { errors.append("\(upgrade.id): price must be > 0") }
                for requirement in upgrade.requires where !ids.contains(requirement) {
                    errors.append("\(upgrade.id): unknown requirement \(requirement)")
                }
                if let last = lastPrice[upgrade.category], upgrade.price < last {
                    errors.append("\(upgrade.id): price decreases within \(upgrade.category.rawValue)")
                }
                lastPrice[upgrade.category] = upgrade.price
            }

            var owned = Set<String>()
            var progressed = true
            while progressed {
                progressed = false
                for upgrade in region.upgrades where !owned.contains(upgrade.id) && upgrade.requires.allSatisfy(owned.contains) {
                    owned.insert(upgrade.id)
                    progressed = true
                }
            }
            if owned.count != ids.count {
                errors.append("\(region.id): upgrades cannot all be bought (cyclic requirements)")
            }
        }
        return errors
    }
}
