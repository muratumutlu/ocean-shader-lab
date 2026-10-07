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

    func testSystemClockIsMonotonic() {
        let clock = SystemClock()
        let first = clock.uptime
        XCTAssertGreaterThan(first, 0)
        XCTAssertGreaterThanOrEqual(clock.uptime, first)
    }
}
