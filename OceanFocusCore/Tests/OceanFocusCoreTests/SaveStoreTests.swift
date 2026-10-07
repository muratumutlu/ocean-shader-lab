import XCTest
@testable import OceanFocusCore

final class SaveStoreTests: XCTestCase {
    var directory: URL!
    var store: SaveStore!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("SaveStoreTests-\(UUID().uuidString)", isDirectory: true)
        store = SaveStore(directory: directory, catalog: Fixtures.catalog)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    func state(money: Int) -> GameState {
        var state = GameState.fresh(catalog: Fixtures.catalog)
        state.regions["med"]?.money = money
        state.activeSession = ActiveSession(kind: .focus, durationSec: 1500,
                                            startedAt: Date(timeIntervalSince1970: 1_800_000_000),
                                            endsAt: Date(timeIntervalSince1970: 1_800_001_500),
                                            monotonicStart: 42.5, regionId: "med")
        return state
    }

    func files() throws -> [String] {
        try FileManager.default.contentsOfDirectory(atPath: directory.path).sorted()
    }

    func testMissingFileLoadsFreshState() {
        XCTAssertEqual(store.load(), .init(state: .fresh(catalog: Fixtures.catalog), source: .fresh))
    }

    func testRoundTrip() throws {
        try store.save(state(money: 7))
        XCTAssertEqual(store.load(), .init(state: state(money: 7), source: .primary))
        XCTAssertEqual(try files(), ["save.json"])
    }

    func testFileUsesIso8601Dates() throws {
        try store.save(state(money: 7))
        let text = try String(contentsOf: directory.appendingPathComponent("save.json"), encoding: .utf8)
        XCTAssertTrue(text.contains("\"startedAt\" : \"2027-01-15T08:00:00.000Z\""), text)
    }

    func testKeepsThreeRotatingBackups() throws {
        for money in 1...5 { try store.save(state(money: money)) }
        XCTAssertEqual(try files(), ["save.bak1.json", "save.bak2.json", "save.bak3.json", "save.json"])
        let bak3 = try Data(contentsOf: directory.appendingPathComponent("save.bak3.json"))
        XCTAssertEqual(try SaveStore.decode(bak3), state(money: 2))
    }

    func testCorruptFileIsMovedAsideAndNewestBackupLoaded() throws {
        try store.save(state(money: 1))
        try store.save(state(money: 2))
        try Data("{ nope".utf8).write(to: directory.appendingPathComponent("save.json"))
        let result = store.load(now: Date(timeIntervalSince1970: 1_800_000_000))
        XCTAssertEqual(result, .init(state: state(money: 1), source: .backup(1)))
        let names = try files()
        XCTAssertTrue(names.contains("save.corrupt-2027-01-15T08-00-00Z.json"), "\(names)")
        XCTAssertFalse(names.contains("save.json"))
    }

    func testCorruptFileWithoutBackupsStartsFresh() throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try Data("garbage".utf8).write(to: directory.appendingPathComponent("save.json"))
        XCTAssertEqual(store.load().source, .freshAfterCorruption)
    }

    func testFutureSchemaIsPreservedNotOverwritten() throws {
        var future = state(money: 9)
        future.schemaVersion = 2
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try SaveStore.encode(future).write(to: directory.appendingPathComponent("save.json"))
        XCTAssertEqual(store.load().source, .freshAfterCorruption)
        let names = try files()
        XCTAssertTrue(names.contains { $0.hasPrefix("save.corrupt-") }, "\(names)")
        XCTAssertThrowsError(try SaveStore.decode(SaveStore.encode(future))) {
            XCTAssertEqual($0 as? SaveStoreError, .unsupportedSchema(2))
        }
    }

    func corruptFiles() throws -> [String] { try files().filter { $0.hasPrefix("save.corrupt-") } }

    func money(_ name: String) throws -> Int? {
        let data = try Data(contentsOf: directory.appendingPathComponent(name))
        return try SaveStore.decode(data).regions["med"]?.money
    }

    func testCorruptPrimaryNeverDisplacesGoodBackups() throws {
        for m in 1...3 { try store.save(state(money: m)) }
        let garbage = Data("garbage".utf8)
        try garbage.write(to: directory.appendingPathComponent("save.json"))
        try store.save(state(money: 4), now: Date(timeIntervalSince1970: 1_800_000_000))
        XCTAssertEqual(try money("save.bak1.json"), 2)
        XCTAssertEqual(try money("save.bak2.json"), 1)
        XCTAssertEqual(try money("save.json"), 4)
        let corrupt = try corruptFiles()
        XCTAssertEqual(corrupt.count, 1, "\(corrupt)")
        XCTAssertEqual(try Data(contentsOf: directory.appendingPathComponent(corrupt[0])), garbage)
    }

    func testMovedAsideFileKeepsItsBytes() throws {
        var future = state(money: 9)
        future.schemaVersion = 2
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let bytes = try SaveStore.encode(future)
        try bytes.write(to: directory.appendingPathComponent("save.json"))
        _ = store.load()
        let corrupt = try corruptFiles()
        XCTAssertEqual(corrupt.count, 1)
        XCTAssertEqual(try Data(contentsOf: directory.appendingPathComponent(corrupt[0])), bytes)
    }

    func testCorruptNamesNeverCollide() throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let a = Data("first".utf8), b = Data("second".utf8)
        try a.write(to: directory.appendingPathComponent("save.json"))
        _ = store.load(now: now)
        try b.write(to: directory.appendingPathComponent("save.json"))
        _ = store.load(now: now)
        XCTAssertEqual(try corruptFiles(), ["save.corrupt-2027-01-15T08-00-00Z-2.json", "save.corrupt-2027-01-15T08-00-00Z.json"])
        XCTAssertEqual(try Data(contentsOf: directory.appendingPathComponent("save.corrupt-2027-01-15T08-00-00Z.json")), a)
        XCTAssertEqual(try Data(contentsOf: directory.appendingPathComponent("save.corrupt-2027-01-15T08-00-00Z-2.json")), b)
    }

    func testFallsBackToSecondBackupWhenFirstIsCorrupt() throws {
        for m in 1...3 { try store.save(state(money: m)) }
        try Data("x".utf8).write(to: directory.appendingPathComponent("save.json"))
        try Data("y".utf8).write(to: directory.appendingPathComponent("save.bak1.json"))
        XCTAssertEqual(store.load(), .init(state: state(money: 1), source: .backup(2)))
    }

    func testMissingPrimaryRecoversFromBackups() throws {
        try store.save(state(money: 1))
        try store.save(state(money: 2))
        try FileManager.default.removeItem(at: directory.appendingPathComponent("save.json"))
        XCTAssertEqual(store.load(), .init(state: state(money: 1), source: .backup(1)))
    }

    func testDefaultDirectoryIsInApplicationSupport() throws {
        let url = try SaveStore.defaultDirectory()
        XCTAssertEqual(url.lastPathComponent, "OceanFocus")
        XCTAssertEqual(url.deletingLastPathComponent().lastPathComponent, "Application Support")
    }
}
