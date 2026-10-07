import Foundation
import OceanFocusCore
import UserNotifications

/// Wall and monotonic time that can run faster for demos. Speed 1 is the real clock.
final class ScaledClock: FocusClock, @unchecked Sendable {
    private let base = SystemClock()
    private var anchorReal: Date
    private var anchorScaled: Date
    private var anchorRealUptime: TimeInterval
    private var anchorScaledUptime: TimeInterval
    private(set) var speed: Double = 1

    init() {
        anchorReal = base.now
        anchorScaled = anchorReal
        anchorRealUptime = base.uptime
        anchorScaledUptime = anchorRealUptime
    }

    var now: Date { anchorScaled.addingTimeInterval(base.now.timeIntervalSince(anchorReal) * speed) }
    var uptime: TimeInterval { anchorScaledUptime + (base.uptime - anchorRealUptime) * speed }
    var bootSessionId: String { base.bootSessionId }

    func setSpeed(_ next: Double) {
        anchorScaled = now
        anchorScaledUptime = uptime
        anchorReal = base.now
        anchorRealUptime = base.uptime
        speed = next
    }
}

/// Owns the game for the macOS app: timer, rules and save live in OceanFocusCore.
/// The menu bar and the web scene only observe it and send commands.
@MainActor
final class GameStore: ObservableObject {
    @Published private(set) var state: GameState
    @Published private(set) var tickDate = Date()
    @Published private(set) var loadProblem: String?

    let catalog: Catalog
    let engine: GameEngine
    let clock = ScaledClock()
    private let store: SaveStore?
    private var ticker: Timer?
    /// Delivers bridge messages to the web scene (set by the web view while it exists).
    var sendToWeb: (([String: Any]) -> Void)?

    var timer: FocusTimer { FocusTimer(engine: engine, clock: clock) }

    init() {
        // The catalog ships inside OceanFocusCore and is validated by its tests.
        let catalog = try! Catalog.bundled()
        self.catalog = catalog
        engine = GameEngine(catalog: catalog)
        let directory = try? SaveStore.defaultDirectory()
        store = directory.map { SaveStore(directory: $0, catalog: catalog) }
        var loaded = GameState.fresh(catalog: catalog)
        if let result = store?.load() {
            if let state = result.state { loaded = state } else { loadProblem = "Kayıt dosyası şu an okunamıyor. Tekrar denenecek." }
        }
        state = loaded
        _ = FocusTimer(engine: engine, clock: clock).prepareLoadedState(&state, licensed: licensed)
        persist()
        ticker = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        }
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    // MARK: Derived values

    var region: Region? { catalog.region(state.currentRegionId) }
    var money: Int { state.progress(for: state.currentRegionId).money }
    var active: ActiveSession? { state.activeSession }
    var remaining: TimeInterval { timer.remaining(in: state) }
    var progress: Double { timer.progress(in: state) }
    var expectedFish: Int { timer.expectedFish(in: state) }

    var menuTitle: String {
        guard let active else { return "🎣" }
        let icon = active.kind == .focus ? "🎣" : "☕️"
        let seconds = Int(remaining.rounded(.up))
        return String(format: "%@ %02d:%02d", icon, seconds / 60, seconds % 60)
    }

    // MARK: Commands

    func startFocus(minutes: Int) {
        guard let preset = FocusPreset(rawValue: minutes) else { return }
        do { try timer.startFocus(preset, in: &state) } catch { return }
        persist()
        schedule(title: "Seans tamam! 🎣", body: "Balıklar kıyıda seni bekliyor. Gel, sat!")
        send(["type": "started", "session": sessionJSON(state.activeSession!), "expectedFish": expectedFish])
    }

    func startBreak() {
        do { try timer.startBreak(in: &state) } catch { return }
        persist()
        schedule(title: "Mola bitti ☕️", body: "Yeni bir seansa hazır mısın?")
        send(["type": "started", "session": sessionJSON(state.activeSession!), "expectedFish": 0])
    }

    func abandon() {
        let fishLost = Int(Double(expectedFish) * progress)
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [Self.sessionNotification])
        guard let event = try? timer.abandon(&state) else { persist(); return }
        handle(event, fishLost: fishLost)
    }

    func buy(_ id: String) {
        do { try engine.purchase(id, in: &state) } catch { return }
        persist()
    }

    /// Until StoreKit lands every build counts as licensed (spec §5b).
    let licensed = true

    func unlockRegion(_ id: String) {
        do { try engine.unlockRegion(id, licensed: licensed, in: &state) } catch { return }
        persist()
    }

    func switchRegion(_ id: String) {
        do { try engine.switchRegion(id, licensed: licensed, in: &state) } catch { return }
        persist()
    }

    func setSpeed(_ speed: Double) {
        clock.setSpeed(speed)
        sendClock()
    }

    // MARK: Ticking

    func tick() {
        tickDate = Date()
        if let event = timer.tick(&state) { handle(event, fishLost: 0) }
        sendClock()
    }

    private func handle(_ event: TimerEvent, fishLost: Int) {
        persist()
        switch event {
        case .focusCompleted(let record):
            send(["type": "completed", "fish": record.fish, "money": record.money])
            // A short break follows every successful focus session.
            startBreak()
        case .focusAbandoned:
            send(["type": "abandoned", "fishLost": fishLost])
        case .focusUnverified:
            send(["type": "abandoned", "fishLost": 0])
            notify(title: "Seans doğrulanamadı", body: "Saat değiştiği için bu seansın ödülü verilmedi.")
        case .breakCompleted:
            send(["type": "breakDone"])
        }
    }

    private func persist() {
        do { try store?.save(state) } catch { loadProblem = "Kayıt yazılamadı: \(error.localizedDescription)" }
        tickDate = Date()
        send(["type": "state", "save": saveJSON()])
    }

    static let sessionNotification = "session-end"

    /// Schedules the end-of-session alert up front so it fires even if the app is suspended (iOS) or closed.
    private func schedule(title: String, body: String) {
        guard remaining > 0 else { return }
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        // Demo speed compresses time, so convert the remaining game time back to real seconds.
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, remaining / clock.speed), repeats: false)
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: Self.sessionNotification, content: content, trigger: trigger))
    }

    private func notify(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil))
    }

    // MARK: Bridge

    func webReady() {
        sendClock()
        send(["type": "state", "save": saveJSON()])
    }

    private func send(_ message: [String: Any]) { sendToWeb?(message) }

    private func sendClock() {
        send(["type": "clock", "now": clock.now.timeIntervalSince1970 * 1000, "speed": clock.speed])
    }

    private func ms(_ date: Date) -> Double { date.timeIntervalSince1970 * 1000 }

    private func sessionJSON(_ s: ActiveSession) -> [String: Any] {
        ["kind": s.kind == .focus ? "focus" : "break", "durationMin": s.durationSec / 60,
         "startedAt": ms(s.startedAt), "endsAt": ms(s.endsAt), "regionId": s.regionId]
    }

    /// Mirrors the web `GameSave` shape so the scene and HUD work unchanged.
    private func saveJSON() -> [String: Any] {
        var regions: [String: Any] = [:]
        for (id, progress) in state.regions {
            regions[id] = ["money": progress.money, "owned": progress.ownedUpgrades.map(\.id)]
        }
        let history: [[String: Any]] = state.history.suffix(50).map {
            ["endedAt": ms($0.endedAt), "durationMin": $0.durationSec / 60,
             "outcome": $0.outcome == .completed ? "completed" : "abandoned",
             "fish": $0.fish, "money": $0.money, "regionId": $0.regionId]
        }
        return ["version": 1, "currentRegionId": state.currentRegionId, "regions": regions, "unlocked": state.unlockedRegionIds,
                "active": state.activeSession.map(sessionJSON) ?? NSNull(), "history": history]
    }

    /// Commands from the web scene (see src/game/native-host.ts).
    func receive(_ message: [String: Any]) {
        switch message["type"] as? String {
        case "ready": webReady()
        case "startFocus": if let m = message["minutes"] as? Int { startFocus(minutes: m) }
        case "startBreak": startBreak()
        case "abandon": abandon()
        case "buy": if let id = message["id"] as? String { buy(id) }
        case "setSpeed": if let s = message["speed"] as? Double { setSpeed(s) }
        case "unlockRegion": if let id = message["id"] as? String { unlockRegion(id) }
        case "switchRegion": if let id = message["id"] as? String { switchRegion(id) }
        default: break
        }
    }
}
