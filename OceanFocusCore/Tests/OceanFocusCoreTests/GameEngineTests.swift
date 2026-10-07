import XCTest
@testable import OceanFocusCore

final class GameEngineTests: XCTestCase {
    let engine = GameEngine(catalog: Fixtures.catalog)

    func makeState(medMoney: Int = 0) -> GameState {
        var state = GameState.fresh(catalog: Fixtures.catalog)
        state.regions["med"]?.money = medMoney
        return state
    }

    func testFreshStateStartsInStarterRegion() {
        let state = GameState.fresh(catalog: Fixtures.catalog)
        XCTAssertEqual(state.schemaVersion, 1)
        XCTAssertEqual(state.currentRegionId, "med")
        XCTAssertEqual(state.unlockedRegionIds, ["med"])
        XCTAssertEqual(state.progress(for: "med"), RegionProgress())
        XCTAssertNil(state.activeSession)
        XCTAssertEqual(state.history, [])
    }

    func testPurchaseDeductsMoneyAndRecordsPricePaid() throws {
        var state = makeState(medMoney: 100)
        try engine.purchase("med.rod", in: &state)
        XCTAssertEqual(state.progress(for: "med").money, 80)
        XCTAssertEqual(state.progress(for: "med").ownedUpgrades, [OwnedUpgrade(id: "med.rod", pricePaid: 20)])
        XCTAssertEqual(engine.modifiers(in: state, regionId: "med").fishMultiplier, 1.5, accuracy: 1e-9)
    }

    func testPurchaseErrors() throws {
        var state = makeState(medMoney: 30)
        XCTAssertThrowsError(try engine.purchase("med.boat", in: &state)) {
            XCTAssertEqual($0 as? GameError, .insufficientFunds(needed: 50, available: 30))
        }
        XCTAssertThrowsError(try engine.purchase("med.crew", in: &state)) {
            XCTAssertEqual($0 as? GameError, .missingRequirement("med.boat"))
        }
        XCTAssertThrowsError(try engine.purchase("arctic.rod", in: &state)) {
            XCTAssertEqual($0 as? GameError, .wrongRegion("arctic.rod"))
        }
        XCTAssertThrowsError(try engine.purchase("ghost", in: &state)) {
            XCTAssertEqual($0 as? GameError, .unknownUpgrade("ghost"))
        }
        try engine.purchase("med.rod", in: &state)
        XCTAssertThrowsError(try engine.purchase("med.rod", in: &state)) {
            XCTAssertEqual($0 as? GameError, .alreadyOwned("med.rod"))
        }
        XCTAssertEqual(state.progress(for: "med").money, 10)
    }

    func testPurchasableListsUnownedUpgradesWithRequirementsMet() throws {
        var state = makeState(medMoney: 100)
        XCTAssertEqual(engine.purchasable(in: state).map(\.id), ["med.rod", "med.boat"])
        try engine.purchase("med.boat", in: &state)
        XCTAssertEqual(engine.purchasable(in: state).map(\.id), ["med.rod", "med.crew"])
    }

    func testUnlockRegionPaysFromCurrentRegionAndSwitches() throws {
        var state = makeState(medMoney: 150)
        try engine.unlockRegion("arctic", licensed: true, in: &state)
        XCTAssertEqual(state.progress(for: "med").money, 50)
        XCTAssertEqual(state.unlockedRegionIds, ["med", "arctic"])
        XCTAssertEqual(state.currentRegionId, "arctic")
        XCTAssertEqual(state.progress(for: "arctic"), RegionProgress())
    }

    func testUnlockRegionErrors() throws {
        var state = makeState(medMoney: 50)
        XCTAssertThrowsError(try engine.unlockRegion("arctic", licensed: false, in: &state)) {
            XCTAssertEqual($0 as? GameError, .requiresLicense("arctic"))
        }
        XCTAssertThrowsError(try engine.unlockRegion("arctic", licensed: true, in: &state)) {
            XCTAssertEqual($0 as? GameError, .insufficientFunds(needed: 100, available: 50))
        }
        XCTAssertThrowsError(try engine.unlockRegion("indian", licensed: true, in: &state)) {
            XCTAssertEqual($0 as? GameError, .regionUnavailable("indian"))
        }
        XCTAssertThrowsError(try engine.unlockRegion("med", licensed: true, in: &state)) {
            XCTAssertEqual($0 as? GameError, .alreadyUnlocked("med"))
        }
        XCTAssertThrowsError(try engine.unlockRegion("mars", licensed: true, in: &state)) {
            XCTAssertEqual($0 as? GameError, .unknownRegion("mars"))
        }
    }

    func testSwitchRegionRules() throws {
        var state = makeState(medMoney: 100)
        XCTAssertThrowsError(try engine.switchRegion("arctic", licensed: true, in: &state)) {
            XCTAssertEqual($0 as? GameError, .regionLocked("arctic"))
        }
        try engine.unlockRegion("arctic", licensed: true, in: &state)
        try engine.switchRegion("med", licensed: true, in: &state)
        XCTAssertEqual(state.currentRegionId, "med")
        XCTAssertThrowsError(try engine.switchRegion("arctic", licensed: false, in: &state)) {
            XCTAssertEqual($0 as? GameError, .requiresLicense("arctic"))
        }
    }

    func testRegionChangesAreBlockedDuringASession() {
        var state = makeState(medMoney: 500)
        state.unlockedRegionIds.append("arctic")
        state.activeSession = ActiveSession(kind: .focus, durationSec: 1500, startedAt: Date(),
                                            endsAt: Date().addingTimeInterval(1500), monotonicStart: 0, bootSessionId: "boot-1", regionId: "med")
        XCTAssertThrowsError(try engine.switchRegion("arctic", licensed: true, in: &state)) {
            XCTAssertEqual($0 as? GameError, .sessionAlreadyActive)
        }
    }

    func testEnforceLicenseMovesToStarterWithoutDeletingProgress() throws {
        var state = makeState(medMoney: 150)
        try engine.unlockRegion("arctic", licensed: true, in: &state)
        state.regions["arctic"]?.money = 77
        engine.enforceLicense(licensed: false, in: &state)
        XCTAssertEqual(state.currentRegionId, "med")
        XCTAssertEqual(state.progress(for: "arctic").money, 77)
        XCTAssertEqual(state.unlockedRegionIds, ["med", "arctic"])
    }

    func testReconcileRefundsUnknownUpgradesAndFixesUnknownRegion() {
        var state = makeState(medMoney: 5)
        state.regions["med"]?.ownedUpgrades = [OwnedUpgrade(id: "med.rod", pricePaid: 20),
                                               OwnedUpgrade(id: "med.retired", pricePaid: 45)]
        state.currentRegionId = "atlantis"
        let refunded = engine.reconcile(&state)
        XCTAssertEqual(refunded, 45)
        XCTAssertEqual(state.progress(for: "med").money, 50)
        XCTAssertEqual(state.progress(for: "med").ownedUpgrades.map(\.id), ["med.rod"])
        XCTAssertEqual(state.currentRegionId, "med")
    }

    func testStaticLicensing() async throws {
        let licensing = StaticLicensing(unlocked: true)
        let unlocked = await licensing.isUnlocked()
        XCTAssertTrue(unlocked)
        let purchased = try await StaticLicensing(unlocked: false).purchase()
        XCTAssertFalse(purchased)
    }
}
