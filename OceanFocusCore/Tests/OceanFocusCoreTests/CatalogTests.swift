import XCTest
@testable import OceanFocusCore

final class CatalogTests: XCTestCase {
    func testBundledCatalogIsValid() throws {
        let catalog = try Catalog.bundled()
        XCTAssertEqual(CatalogValidator.validate(catalog), [])
        XCTAssertEqual(catalog.regions.map(\.id), ["med", "arctic", "indian", "atlantic"])
        XCTAssertEqual(catalog.starterRegionId, "med")
        XCTAssertEqual(catalog.region("med")?.upgrades.count, 18)
        XCTAssertEqual(catalog.region("arctic")?.upgrades.count, 18)
        XCTAssertEqual(catalog.regions.filter(\.available).map(\.id), ["med", "arctic"])
    }

    func testFixtureCatalogIsValid() {
        XCTAssertEqual(CatalogValidator.validate(Fixtures.catalog), [])
    }

    func testUpgradeLookupReturnsOwningRegion() throws {
        let match = try XCTUnwrap(Fixtures.catalog.upgrade("arctic.rod"))
        XCTAssertEqual(match.region.id, "arctic")
        XCTAssertEqual(match.upgrade.price, 30)
        XCTAssertNil(Fixtures.catalog.upgrade("nope"))
    }

    func testModifiersMultiplyFishAndAddMoney() {
        let m = Fixtures.catalog.modifiers(regionId: "med", owned: ["med.rod", "med.boat", "med.crew"])
        XCTAssertEqual(m.fishMultiplier, 1.65, accuracy: 1e-9)
        XCTAssertEqual(m.moneyBonus, 0.2, accuracy: 1e-9)
        XCTAssertEqual(Fixtures.catalog.modifiers(regionId: "med", owned: []), .none)
    }

    func testValidatorReportsProblems() {
        var catalog = Fixtures.catalog
        catalog.regions[0].upgrades.append(
            Upgrade(id: "med.rod", name: "Dup", category: .equipment, price: 10,
                    effect: UpgradeEffect(), requires: ["med.ghost"]))
        catalog.regions[0].upgrades.append(
            Upgrade(id: "arctic.misplaced", name: "Wrong prefix", category: .boat, price: 60,
                    effect: UpgradeEffect(), requires: []))
        let errors = CatalogValidator.validate(catalog)
        XCTAssertTrue(errors.contains("duplicate id med.rod"), "\(errors)")
        XCTAssertTrue(errors.contains("med.rod: unknown requirement med.ghost"), "\(errors)")
        XCTAssertTrue(errors.contains("med.rod: price decreases within equipment"), "\(errors)")
        XCTAssertTrue(errors.contains("arctic.misplaced: id must start with med."), "\(errors)")
    }

    func testValidatorReportsCyclicRequirements() {
        let catalog = Catalog(version: 1, regions: [
            Region(id: "x", name: "X", fishPrice: 1, unlockPrice: 0, available: true, requiresLicense: false, upgrades: [
                Upgrade(id: "x.a", name: "A", category: .equipment, price: 1, effect: UpgradeEffect(), requires: ["x.b"]),
                Upgrade(id: "x.b", name: "B", category: .boat, price: 1, effect: UpgradeEffect(), requires: ["x.a"]),
            ]),
        ])
        XCTAssertEqual(CatalogValidator.validate(catalog), ["x: upgrades cannot all be bought (cyclic requirements)"])
    }

    func testValidatorRequiresAFreeAvailableRegion() {
        var catalog = Fixtures.catalog
        catalog.regions[0].requiresLicense = true
        XCTAssertTrue(CatalogValidator.validate(catalog).contains("catalog has no free available region"))
    }
}
