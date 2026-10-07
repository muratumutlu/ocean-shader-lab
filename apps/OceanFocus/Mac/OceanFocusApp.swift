import AppKit
import OceanFocusCore
import SwiftUI

@main
struct OceanFocusApp: App {
    @StateObject private var store = GameStore()

    var body: some Scene {
        MenuBarExtra {
            MenuContent(store: store)
        } label: {
            Text(store.menuTitle).monospacedDigit()
        }
        .menuBarExtraStyle(.menu)

        Window("Ocean Focus", id: "game") {
            GameWebView(store: store)
                .frame(minWidth: 960, minHeight: 640)
                .onDisappear { store.sendToWeb = nil }
        }
        .defaultSize(width: 1280, height: 800)
    }
}

struct MenuContent: View {
    @ObservedObject var store: GameStore
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        if let active = store.active {
            if active.kind == .focus {
                Text("Odaklanma · \(Int(Double(store.expectedFish) * store.progress)) / \(store.expectedFish) balık")
                Button("Vazgeç (balıklar denize dökülür)…") { confirmGiveUp() }
            } else {
                Text("Mola ☕️")
                Button("Molayı bitir") { store.abandon() }
            }
        } else {
            Text("Ne kadar odaklanacaksın?")
            ForEach(FocusPreset.allCases, id: \.self) { preset in
                Button("\(preset.minutes) dakika") { store.startFocus(minutes: preset.minutes) }
            }
        }
        Divider()
        Text("\(store.region?.name ?? "") · \(store.money) 💰")
        Button("Oyunu aç") {
            openWindow(id: "game")
            NSApp.activate(ignoringOtherApps: true)
        }
        Button(store.clock.speed == 1 ? "Demo hızı ×60" : "Gerçek zaman") {
            store.setSpeed(store.clock.speed == 1 ? 60 : 1)
        }
        if let problem = store.loadProblem { Text(problem) }
        Divider()
        Button("Ocean Focus'tan çık") { NSApp.terminate(nil) }.keyboardShortcut("q")
    }

    private func confirmGiveUp() {
        NSApp.activate(ignoringOtherApps: true)
        let alert = NSAlert()
        alert.messageText = "Vazgeçmek istediğine emin misin?"
        alert.informativeText = "Kovadaki balıklar denize dökülecek ve bu seanstan para kazanmayacaksın."
        alert.addButton(withTitle: "Devam et")
        alert.addButton(withTitle: "Vazgeç")
        if alert.runModal() == .alertSecondButtonReturn { store.abandon() }
    }
}
