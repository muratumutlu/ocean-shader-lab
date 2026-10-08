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
        #if DEBUG
        // QA probe: OCEAN_FOCUS_PROBE=1 writes render quality and resolution to tmp/probe.txt after launch.
        if ProcessInfo.processInfo.environment["OCEAN_FOCUS_PROBE"] != nil {
            for delay in [3.0, 12.0] {
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak webView] in
                    webView?.evaluateJavaScript("(()=>{const c=document.querySelector('#ocean');return JSON.stringify({t:\(delay),quality:c.dataset.quality,dpr:devicePixelRatio,css:[c.clientWidth,c.clientHeight],buffer:[c.width,c.height]})})()") { result, _ in
                        let line = (result as? String ?? "nil") + "\n"
                        let url = FileManager.default.temporaryDirectory.appendingPathComponent("probe.txt")
                        if let handle = try? FileHandle(forWritingTo: url) { handle.seekToEndOfFile(); handle.write(Data(line.utf8)); try? handle.close() }
                        else { try? line.write(to: url, atomically: true, encoding: .utf8) }
                    }
                }
            }
        }
        #endif
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: ()) {
        GameWebViewFactory.teardown(webView)
    }
}
