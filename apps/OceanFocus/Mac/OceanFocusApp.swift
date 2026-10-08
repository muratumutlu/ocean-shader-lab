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
            MenuBarLabel(title: store.menuTitle, symbol: store.menuSymbol)
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
                Label("Fishing · \(Int(Double(store.expectedFish) * store.progress)) / \(store.expectedFish) fish", systemImage: "fish")
                Button("Give up (catch spills)…") { confirmGiveUp() }
            } else {
                Label("Break", systemImage: "cup.and.saucer")
                Button("End break") { store.abandon() }
            }
        } else {
            Text("Focus for…")
            ForEach(FocusPreset.allCases, id: \.self) { preset in
                Button("\(preset.minutes) min") { store.startFocus(minutes: preset.minutes) }
            }
        }
        Divider()
        Label("\(store.region?.name ?? "") · \(store.money) coins", systemImage: "dollarsign.circle")
        Button("Open game") {
            openWindow(id: "game")
            NSApp.activate(ignoringOtherApps: true)
        }
        Button(store.clock.speed == 1 ? "Demo speed ×60" : "Real time") {
            store.setSpeed(store.clock.speed == 1 ? 60 : 1)
        }
        if let problem = store.loadProblem { Text(problem) }
        Divider()
        Button("Quit Ocean Focus") { NSApp.terminate(nil) }.keyboardShortcut("q")
    }

    private func confirmGiveUp() {
        NSApp.activate(ignoringOtherApps: true)
        let alert = NSAlert()
        alert.messageText = "Give up this session?"
        alert.informativeText = "Your catch spills back into the sea and this session earns no coins."
        alert.addButton(withTitle: "Keep going")
        alert.addButton(withTitle: "Give up")
        if alert.runModal() == .alertSecondButtonReturn { store.abandon() }
    }
}

/// The menu bar label exists from launch, so it also opens the game window once at startup.
struct MenuBarLabel: View {
    let title: String
    let symbol: String
    @Environment(\.openWindow) private var openWindow
    @State private var opened = false

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: symbol)
            if !title.isEmpty { Text(title).monospacedDigit() }
        }
            .task {
                guard !opened else { return }
                opened = true
                openWindow(id: "game")
                NSApp.activate(ignoringOtherApps: true)
            }
    }
}
