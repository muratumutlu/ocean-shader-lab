import Foundation

public enum TimerEvent: Equatable, Sendable {
    case focusCompleted(SessionRecord)
    case focusAbandoned(SessionRecord)
    case focusUnverified(SessionRecord)
    case breakCompleted
}

/// Session lifecycle. All state lives in GameState.activeSession, so a new FocusTimer
/// created after an app restart continues the same session.
public struct FocusTimer: Sendable {
    public static let tamperTolerance: TimeInterval = 120
    public static let breakDurationSec = 300

    public let engine: GameEngine
    let clock: any FocusClock

    public init(engine: GameEngine, clock: any FocusClock) {
        self.engine = engine
        self.clock = clock
    }

    public func startFocus(_ preset: FocusPreset, in state: inout GameState) throws {
        try start(kind: .focus, durationSec: preset.durationSec, in: &state)
    }

    public func startBreak(in state: inout GameState) throws {
        try start(kind: .rest, durationSec: Self.breakDurationSec, in: &state)
    }

    public func remaining(in state: GameState) -> TimeInterval {
        guard let session = state.activeSession else { return 0 }
        return max(0, session.endsAt.timeIntervalSince(clock.now))
    }

    public func progress(in state: GameState) -> Double {
        guard let session = state.activeSession, session.durationSec > 0 else { return 0 }
        let elapsed = clock.now.timeIntervalSince(session.startedAt)
        return min(1, max(0, elapsed / Double(session.durationSec)))
    }

    /// Fish a completed focus session would pay right now. Drives the cosmetic bucket fill.
    public func expectedFish(in state: GameState) -> Int {
        guard let session = state.activeSession, session.kind == .focus else { return 0 }
        return Economy.fish(minutes: session.durationSec / 60,
                            modifiers: engine.modifiers(in: state, regionId: session.regionId))
    }

    /// Call every second and on launch/wake. Returns an event when the session ends.
    public func tick(_ state: inout GameState) -> TimerEvent? {
        guard let session = state.activeSession else { return nil }
        let now = clock.now
        let wallElapsed = now.timeIntervalSince(session.startedAt)
        let monotonicElapsed = clock.uptime - session.monotonicStart
        // Negative monotonic elapsed means a reboot happened: only the wall clock is left.
        if monotonicElapsed >= 0 && wallElapsed - monotonicElapsed > Self.tamperTolerance {
            return finish(session, outcome: .unverified, fish: 0, money: 0, at: now, in: &state)
        }
        guard now >= session.endsAt else { return nil }
        guard session.kind == .focus else {
            return finish(session, outcome: .completed, fish: 0, money: 0, at: session.endsAt, in: &state)
        }
        let modifiers = engine.modifiers(in: state, regionId: session.regionId)
        let fish = Economy.fish(minutes: session.durationSec / 60, modifiers: modifiers)
        let fishPrice = engine.catalog.region(session.regionId)?.fishPrice ?? 0
        let money = Economy.money(fish: fish, fishPrice: fishPrice, modifiers: modifiers)
        state.regions[session.regionId, default: RegionProgress()].money += money
        return finish(session, outcome: .completed, fish: fish, money: money, at: session.endsAt, in: &state)
    }

    /// Explicit give-up. Focus sessions spill their catch. Breaks simply end (returns nil).
    public func abandon(_ state: inout GameState) throws -> TimerEvent? {
        guard let session = state.activeSession else { throw GameError.noActiveSession }
        guard session.kind == .focus else {
            state.activeSession = nil
            return nil
        }
        return finish(session, outcome: .abandoned, fish: 0, money: 0, at: clock.now, in: &state)
    }

    private func start(kind: SessionKind, durationSec: Int, in state: inout GameState) throws {
        guard state.activeSession == nil else { throw GameError.sessionAlreadyActive }
        let now = clock.now
        state.activeSession = ActiveSession(kind: kind, durationSec: durationSec, startedAt: now,
                                            endsAt: now.addingTimeInterval(TimeInterval(durationSec)),
                                            monotonicStart: clock.uptime, regionId: state.currentRegionId)
    }

    private func finish(_ session: ActiveSession, outcome: SessionOutcome, fish: Int, money: Int,
                        at endedAt: Date, in state: inout GameState) -> TimerEvent {
        state.activeSession = nil
        guard session.kind == .focus else { return .breakCompleted }
        let record = SessionRecord(endedAt: endedAt, durationSec: session.durationSec, outcome: outcome,
                                   fish: fish, money: money, regionId: session.regionId)
        state.history.append(record)
        switch outcome {
        case .completed: return .focusCompleted(record)
        case .abandoned: return .focusAbandoned(record)
        case .unverified: return .focusUnverified(record)
        }
    }
}
