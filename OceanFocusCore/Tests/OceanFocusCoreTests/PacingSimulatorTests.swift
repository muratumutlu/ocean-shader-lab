import XCTest
@testable import OceanFocusCore

final class PacingSimulatorTests: XCTestCase {
    func testEveryAvailableRegionMeetsThePacingTarget() throws {
        let catalog = try Catalog.bundled()
        for region in catalog.regions where region.available {
            let results = PacingSimulator.run(regionId: region.id, catalog: catalog, players: 1_000, seed: 42)
            let median = PacingSimulator.median(results)
            XCTAssertTrue(PacingSimulator.targetRange.contains(median),
                          "\(region.id) median \(median) sessions is outside \(PacingSimulator.targetRange)")
        }
    }

    func testSameSeedGivesSameResults() throws {
        let catalog = try Catalog.bundled()
        XCTAssertEqual(PacingSimulator.run(regionId: "med", catalog: catalog, players: 20, seed: 7),
                       PacingSimulator.run(regionId: "med", catalog: catalog, players: 20, seed: 7))
    }

    func testRegionThatCannotBeFinishedReturnsInfinity() {
        let catalog = Catalog(version: 1, regions: [
            Region(id: "x", name: "X", fishPrice: 1, unlockPrice: 0, available: true, requiresLicense: false, upgrades: [
                Upgrade(id: "x.a", name: "A", category: .equipment, price: 1, effect: UpgradeEffect(), requires: ["x.b"]),
                Upgrade(id: "x.b", name: "B", category: .boat, price: 1, effect: UpgradeEffect(), requires: ["x.a"]),
            ]),
        ])
        var rng = SplitMix64(seed: 1)
        XCTAssertEqual(PacingSimulator.sessionsToComplete(regionId: "x", catalog: catalog, rng: &rng), .infinity)
    }

    func testMedian() {
        XCTAssertEqual(PacingSimulator.median([3, 1, 2]), 2)
        XCTAssertEqual(PacingSimulator.median([4, 1, 2, 3]), 2.5)
    }

    func testPresetWeightsSumToOne() {
        XCTAssertEqual(PacingSimulator.presetWeights.map(\.weight).reduce(0, +), 1, accuracy: 1e-9)
    }
}
