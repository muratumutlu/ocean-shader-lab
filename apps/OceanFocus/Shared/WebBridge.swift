import Foundation
import UniformTypeIdentifiers
import WebKit

/// Serves the bundled web build (Resources/web) from `oceanfocus://app/...` so ES modules,
/// WebAssembly and textures load offline with correct MIME types.
final class BundledWebSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "oceanfocus"
    private let root = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true)

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        let path = task.request.url?.path ?? "/"
        let file = root.appendingPathComponent(path == "/" ? "index.html" : String(path.dropFirst()))
        guard file.standardizedFileURL.path.hasPrefix(root.standardizedFileURL.path),
              let data = try? Data(contentsOf: file) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        let mime = file.pathExtension == "wasm" ? "application/wasm"
            : file.pathExtension == "js" ? "text/javascript"
            : UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        task.didReceive(URLResponse(url: task.request.url!, mimeType: mime, expectedContentLength: data.count, textEncodingName: nil))
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}
}

/// Receives `window.webkit.messageHandlers.oceanFocus.postMessage(...)` from the scene.
final class BridgeHandler: NSObject, WKScriptMessageHandler {
    weak var store: GameStore?
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        MainActor.assumeIsolated { store?.receive(body) }
    }
}

/// Shared WKWebView setup for both platforms: bundled assets, bridge handler and state push.
@MainActor
enum GameWebViewFactory {
    static func make(store: GameStore) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(BundledWebSchemeHandler(), forURLScheme: BundledWebSchemeHandler.scheme)
        let bridge = BridgeHandler()
        bridge.store = store
        configuration.userContentController.add(bridge, name: "oceanFocus")
        let webView = WKWebView(frame: .zero, configuration: configuration)
        store.sendToWeb = { [weak webView] message in
            guard let webView, let data = try? JSONSerialization.data(withJSONObject: message),
                  let json = String(data: data, encoding: .utf8) else { return }
            webView.evaluateJavaScript("window.oceanFocusNative&&window.oceanFocusNative.receive(\(json))")
        }
        webView.load(URLRequest(url: URL(string: "\(BundledWebSchemeHandler.scheme)://app/index.html?mode=game")!))
        return webView
    }

    static func teardown(_ webView: WKWebView) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "oceanFocus")
    }
}
