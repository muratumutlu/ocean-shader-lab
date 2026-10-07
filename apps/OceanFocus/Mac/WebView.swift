import AppKit
import SwiftUI
import WebKit

struct GameWebView: NSViewRepresentable {
    @ObservedObject var store: GameStore

    func makeNSView(context: Context) -> WKWebView {
        let webView = GameWebViewFactory.make(store: store)
        webView.setValue(false, forKey: "drawsBackground")
        #if DEBUG
        // Visual QA: OCEAN_FOCUS_SNAPSHOT=/path/prefix writes window snapshots after launch.
        if let prefix = ProcessInfo.processInfo.environment["OCEAN_FOCUS_SNAPSHOT"] {
            for delay in [8.0, 14.0] {
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak webView] in
                    webView?.takeSnapshot(with: nil) { image, _ in
                        guard let tiff = image?.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
                              let png = rep.representation(using: .png, properties: [:]) else { return }
                        try? png.write(to: URL(fileURLWithPath: "\(prefix)-\(Int(delay)).png"))
                    }
                }
            }
        }
        #endif
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {}

    static func dismantleNSView(_ webView: WKWebView, coordinator: ()) {
        GameWebViewFactory.teardown(webView)
    }
}
