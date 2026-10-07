import SwiftUI
import WebKit

@main
struct OceanFocusiOSApp: App {
    @StateObject private var store = GameStore()
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            GameWebView(store: store)
                .ignoresSafeArea()
                .statusBarHidden()
                .onChange(of: phase) { _, next in if next == .active { store.tick() } }
        }
    }
}

struct GameWebView: UIViewRepresentable {
    @ObservedObject var store: GameStore

    func makeUIView(context: Context) -> WKWebView {
        let webView = GameWebViewFactory.make(store: store)
        webView.isOpaque = false
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: ()) {
        GameWebViewFactory.teardown(webView)
    }
}
