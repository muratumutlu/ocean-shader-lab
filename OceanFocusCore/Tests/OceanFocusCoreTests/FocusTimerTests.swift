import XCTest
@testable import OceanFocusCore

final class FocusTimerTests: XCTestCase {
    // XCTest creates a new instance per test method, so these start fresh for every test.
    let engine = GameEngine(catalog: Fixtures.catalog)
    let clock = TestClock()
    var state = GameState.fresh(catalog: Fixtures.catalog)
    var timer: FocusTimer { FocusTimer(engine: engine, clock: clock) }

    func testStartFocusRecordsAbsoluteTimes() throws {
        try timer.startFocus(.minutes25, in: &state)
        let session = try XCTUnwrap(state.activeSession)
        XCTAssertEqual(session.kind, .focus)
        XCTAssertEqual(session.durationSec, 1500)
        XCTAssertEqual(session.startedAt, clock.now)
        XCTAssertEqual(session.endsAt, clock.now.addingTimeInterval(1500))
        XCTAssertEqual(session.monotonicStart, clock.uptime)
        XCTAssertEqual(session.regionId, "med")
    }

    func testCannotStartTwoSessions() throws {
        try timer.startFocus(.minutes25, in: &state)
        XCTAssertThrowsError(try timer.startBreak(in: &state)) {
            XCTAssertEqual($0 as? GameError, .sessionAlreadyActive)
        }
    }

    func testRemainingProgressAndExpectedFish() throws {
        state.regions["med"]?.ownedUpgrades = [OwnedUpgrade(id: "med.rod", pricePaid: 20)]
        try timer.startFocus(.minutes25, in: &state)
        clock.advance(750)
        XCTAssertEqual(timer.remaining(in: state), 750)
        XCTAssertEqual(timer.progress(in: state), 0.5, accuracy: 1e-9)
        XCTAssertEqual(timer.expectedFish(in: state), 15)
        XCTAssertNil(timer.tick(&state))
    }

    func testCompletionCreditsMoneyOnce() throws {
        try timer.startFocus(.minutes25, in: &state)
        let endsAt = try XCTUnwrap(state.activeSession).endsAt
        clock.advance(1500)
        let record = SessionRecord(endedAt: endsAt, durationSec: 1500, outcome: .completed,
                                   fish: 10, money: 30, regionId: "med")
        XCTAssertEqual(timer.tick(&state), .focusCompleted(record))
        XCTAssertEqual(state.progress(for: "med").money, 30)
        XCTAssertEqual(state.history, [record])
        XCTAssertNil(state.activeSession)
        XCTAssertNil(timer.tick(&state))
        XCTAssertEqual(state.progress(for: "med").money, 30)
    }

    func testSessionCompletesAfterAppRestartAndSleep() throws {
        try timer.startFocus(.minutes45, in: &state)
        clock.advance(2 * 3600)
        let relaunched = FocusTimer(engine: engine, clock: clock)
        guard case .focusCompleted(let record)? = relaunched.tick(&state) else {
            return XCTFail("expected completion")
        }
        XCTAssertEqual(record.fish, 22)
        XCTAssertEqual(record.money, 66)
    }

    func testAbandonSpillsTheCatch() throws {
        state.regions["med"]?.money = 12
        try timer.startFocus(.minutes25, in: &state)
        clock.advance(600)
        guard case .focusAbandoned(let record)? = try timer.abandon(&state) else {
            return XCTFail("expected abandonment")
        }
        XCTAssertEqual(record.outcome, .abandoned)
        XCTAssertEqual(record.fish, 0)
        XCTAssertEqual(record.money, 0)
        XCTAssertEqual(state.progress(for: "med").money, 12)
        XCTAssertNil(state.activeSession)
        XCTAssertThrowsError(try timer.abandon(&state)) {
            XCTAssertEqual($0 as? GameError, .noActiveSession)
        }
    }

    func testAbandonAfterEndsAtCompletesTheSession() throws {
        try timer.startFocus(.minutes25, in: &state)
        clock.advance(1510)
        guard case .focusCompleted(let record)? = try timer.abandon(&state) else {
            return XCTFail("expected completion")
        }
        XCTAssertEqual(record.fish, 10)
        XCTAssertEqual(record.money, 30)
        XCTAssertEqual(state.progress(for: "med").money, 30)
        XCTAssertNil(state.activeSession)
    }

    func testWallClockJumpIsUnverified() throws {
        try timer.startFocus(.minutes25, in: &state)
        clock.now = clock.now.addingTimeInterval(1800)
        clock.uptime += 60
        guard case .focusUnverified(let record)? = timer.tick(&state) else {
            return XCTFail("expected unverified")
        }
        XCTAssertEqual(record.money, 0)
        XCTAssertEqual(state.progress(for: "med").money, 0)
    }

    func testRebootFallsBackToWallClock() throws {
        try timer.startFocus(.minutes25, in: &state)
        clock.now = clock.now.addingTimeInterval(1600)
        clock.uptime = 5
        guard case .focusCompleted? = timer.tick(&state) else {
            return XCTFail("expected completion after reboot")
        }
    }

    func testRebootWithLongDowntimeStillCompletes() throws {
        clock.uptime = 300
        try timer.startFocus(.minutes25, in: &state)
        clock.bootSessionId = "boot-2"
        clock.now = clock.now.addingTimeInterval(3 * 3600)
        clock.uptime = 3600
        guard case .focusCompleted? = timer.tick(&state) else {
            return XCTFail("expected completion after reboot with long downtime")
        }
    }

    func testMissingBootIdOnSessionDoesNotSkipTamperDetection() throws {
        try timer.startFocus(.minutes25, in: &state)
        state.activeSession?.bootSessionId = ""
        clock.now = clock.now.addingTimeInterval(1800)
        clock.uptime += 60
        guard case .focusUnverified? = timer.tick(&state) else {
            return XCTFail("expected unverified")
        }
    }

    func testBreakHasNoRewardAndNoHistory() throws {
        try timer.startBreak(in: &state)
        XCTAssertEqual(state.activeSession?.durationSec, 300)
        XCTAssertEqual(timer.expectedFish(in: state), 0)
        clock.advance(300)
        XCTAssertEqual(timer.tick(&state), .breakCompleted)
        XCTAssertEqual(state.history, [])
        XCTAssertEqual(state.progress(for: "med").money, 0)
    }

    func testAbandoningABreakJustEndsIt() throws {
        try timer.startBreak(in: &state)
        XCTAssertNil(try timer.abandon(&state))
        XCTAssertNil(state.activeSession)
        XCTAssertEqual(state.history, [])
    }

    func testPrepareLoadedStateReconcilesEnforcesLicenseThenSettlesSession() throws {
        state.regions["med"]?.ownedUpgrades = [OwnedUpgrade(id: "med.retired", pricePaid: 45)]
        state.unlockedRegionIds.append("arctic")
        state.currentRegionId = "arctic"
        state.regions["arctic"] = RegionProgress()
        try timer.startFocus(.minutes25, in: &state)
        clock.advance(1600)
        let endsAt = try XCTUnwrap(state.activeSession).endsAt
        let result = timer.prepareLoadedState(&state, licensed: false)
        let record = SessionRecord(endedAt: endsAt, durationSec: 1500, outcome: .completed,
                                   fish: 10, money: 50, regionId: "arctic")
        XCTAssertEqual(result, FocusTimer.LaunchResult(refunded: 45, event: .focusCompleted(record)))
        XCTAssertEqual(state.currentRegionId, "med")
        XCTAssertEqual(state.progress(for: "med").money, 45)
        XCTAssertEqual(state.progress(for: "arctic").money, 50)
    }

    func testPrepareLoadedStateOnFreshStateDoesNothing() {
        XCTAssertEqual(timer.prepareLoadedState(&state, licensed: true), FocusTimer.LaunchResult(refunded: 0, event: nil))
    }

    func testSystemClockIsMonotonic() {
        let clock = SystemClock()
        let first = clock.uptime
        XCTAssertGreaterThan(first, 0)
        XCTAssertGreaterThanOrEqual(clock.uptime, first)
    }

    func testSystemClockHasBootSessionId() {
        XCTAssertFalse(SystemClock().bootSessionId.isEmpty)
    }
}
