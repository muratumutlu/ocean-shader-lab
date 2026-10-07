import Foundation
@testable import OceanFocusCore

enum Fixtures {
    /// Small hand-written catalog so rule tests do not change when the real catalog is re-tuned.
    static let catalog = Catalog(version: 1, regions: [
        Region(id: "med", name: "Mediterranean", fishPrice: 3, unlockPrice: 0,
               available: true, requiresLicense: false, upgrades: [
                   Upgrade(id: "med.rod", name: "Rod", category: .equipment, price: 20,
                           effect: UpgradeEffect(fishMultiplier: 1.5), requires: []),
                   Upgrade(id: "med.boat", name: "Boat", category: .boat, price: 50,
                           effect: UpgradeEffect(fishMultiplier: 1.1), requires: []),
                   Upgrade(id: "med.crew", name: "Deckhand", category: .crew, price: 40,
                           effect: UpgradeEffect(moneyBonus: 0.2), requires: ["med.boat"]),
               ]),
        Region(id: "arctic", name: "Arctic", fishPrice: 5, unlockPrice: 100,
               available: true, requiresLicense: true, upgrades: [
                   Upgrade(id: "arctic.rod", name: "Ice rod", category: .equipment, price: 30,
                           effect: UpgradeEffect(fishMultiplier: 1.2), requires: []),
               ]),
        Region(id: "indian", name: "Indian Ocean", fishPrice: 4, unlockPrice: 200,
               available: false, requiresLicense: true, upgrades: []),
    ])
}

/// Manually advanced clock. `advance` moves wall and monotonic time together (normal time or sleep).
final class TestClock: FocusClock, @unchecked Sendable {
    var now: Date
    var uptime: TimeInterval
    var bootSessionId = "boot-1"

    init(now: Date = Date(timeIntervalSince1970: 1_800_000_000), uptime: TimeInterval = 1_000) {
        self.now = now
        self.uptime = uptime
    }

    func advance(_ seconds: TimeInterval) {
        now = now.addingTimeInterval(seconds)
        uptime += seconds
    }
}
