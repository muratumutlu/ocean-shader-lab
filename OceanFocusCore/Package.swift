// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "OceanFocusCore",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [
        .library(name: "OceanFocusCore", targets: ["OceanFocusCore"]),
    ],
    targets: [
        .target(name: "OceanFocusCore", resources: [.process("Resources")]),
        .testTarget(name: "OceanFocusCoreTests", dependencies: ["OceanFocusCore"]),
    ]
)
