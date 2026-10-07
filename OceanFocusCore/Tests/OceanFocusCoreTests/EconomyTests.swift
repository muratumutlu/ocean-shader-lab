import XCTest
@testable import OceanFocusCore

final class EconomyTests: XCTestCase {
    func testBaseFishForEachPreset() {
        XCTAssertEqual(Economy.fish(minutes: 15, modifiers: .none), 5)
        XCTAssertEqual(Economy.fish(minutes: 25, modifiers: .none), 10)
        XCTAssertEqual(Economy.fish(minutes: 45, modifiers: .none), 22)
        XCTAssertEqual(Economy.fish(minutes: 60, modifiers: .none), 30)
    }

    func testLongSessionsEarnMoreThanLinear() {
        let per25 = Double(Economy.fish(minutes: 25, modifiers: .none))
        XCTAssertGreaterThan(Double(Economy.fish(minutes: 45, modifiers: .none)), per25 * 45 / 25)
        XCTAssertGreaterThan(Double(Economy.fish(minutes: 60, modifiers: .none)), per25 * 60 / 25)
    }

    func testNonPresetDurationIsLinear() {
        XCTAssertEqual(Economy.fish(minutes: 50, modifiers: .none), 20)
    }

    func testEquipmentMultiplierRoundsDown() {
        XCTAssertEqual(Economy.fish(minutes: 25, modifiers: Modifiers(fishMultiplier: 1.25)), 12)
    }

    func testMoneyAppliesCrewBonusAndRoundsDown() {
        XCTAssertEqual(Economy.money(fish: 10, fishPrice: 3, modifiers: .none), 30)
        XCTAssertEqual(Economy.money(fish: 10, fishPrice: 3, modifiers: Modifiers(moneyBonus: 0.15)), 34)
        XCTAssertEqual(Economy.money(fish: 22, fishPrice: 3, modifiers: Modifiers(moneyBonus: 0.3)), 85)
    }

    func testPresets() {
        XCTAssertEqual(FocusPreset.allCases.map(\.minutes), [15, 25, 45, 60])
        XCTAssertEqual(FocusPreset.minutes25.durationSec, 1500)
    }
}
