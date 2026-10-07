import Foundation

public enum SaveStoreError: Error, Equatable, Sendable {
    case unsupportedSchema(Int)
    /// save.json exists but its bytes cannot be read (I/O or permission error). Nothing was changed.
    case primaryUnreadable
}

/// Persists GameState as JSON. Writes are atomic and keep rotating backups.
/// Unreadable files are moved aside, never deleted.
public struct SaveStore: Sendable {
    public enum Source: Equatable, Sendable {
        case primary
        case backup(Int)
        case fresh
        case freshAfterCorruption
        /// save.json exists but could not be read (e.g. iOS file protection while locked).
        /// Nothing was moved or deleted. The app must not save while in this state and should retry later.
        case unreadable
    }

    public struct LoadResult: Equatable, Sendable {
        public let state: GameState
        public let source: Source
    }

    public static let backupCount = 3

    public let directory: URL
    private let catalog: Catalog

    public init(directory: URL, catalog: Catalog) {
        self.directory = directory
        self.catalog = catalog
    }

    public static func defaultDirectory() throws -> URL {
        let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                               appropriateFor: nil, create: true)
        return base.appendingPathComponent("OceanFocus", isDirectory: true)
    }

    var saveURL: URL { directory.appendingPathComponent("save.json") }
    var tmpURL: URL { directory.appendingPathComponent("save.json.tmp") }
    func backupURL(_ n: Int) -> URL { directory.appendingPathComponent("save.bak\(n).json") }

    public func load(now: Date = Date()) -> LoadResult {
        let fm = FileManager.default
        guard fm.fileExists(atPath: saveURL.path) else {
            return loadFromBackups() ?? LoadResult(state: .fresh(catalog: catalog), source: .fresh)
        }
        let data: Data
        do { data = try Data(contentsOf: saveURL) } catch {
            return LoadResult(state: .fresh(catalog: catalog), source: .unreadable)
        }
        if let state = try? Self.decode(data) {
            return LoadResult(state: state, source: .primary)
        }
        _ = try? moveAside(saveURL, now: now, fm)
        return loadFromBackups() ?? LoadResult(state: .fresh(catalog: catalog), source: .freshAfterCorruption)
    }

    private func loadFromBackups() -> LoadResult? {
        for n in 1...Self.backupCount {
            if let data = try? Data(contentsOf: backupURL(n)), let state = try? Self.decode(data) {
                return LoadResult(state: state, source: .backup(n))
            }
        }
        return nil
    }

    public func save(_ state: GameState, now: Date = Date()) throws {
        let fm = FileManager.default
        try fm.createDirectory(at: directory, withIntermediateDirectories: true)
        var existing: Data?
        if fm.fileExists(atPath: saveURL.path) {
            do { existing = try Data(contentsOf: saveURL) } catch { throw SaveStoreError.primaryUnreadable }
        }
        try Self.encode(state).write(to: tmpURL, options: .atomic)
        if fm.fileExists(atPath: saveURL.path) {
            if let data = existing, (try? Self.decode(data)) != nil {
                try rotateBackups(fm)
            } else {
                try moveAside(saveURL, now: now, fm)
                try fm.moveItem(at: tmpURL, to: saveURL)
                return
            }
            _ = try fm.replaceItemAt(saveURL, withItemAt: tmpURL)
        } else {
            try fm.moveItem(at: tmpURL, to: saveURL)
        }
    }

    /// Moves an unreadable file to save.corrupt-<stamp>[-n].json without ever overwriting.
    @discardableResult
    private func moveAside(_ url: URL, now: Date, _ fm: FileManager) throws -> URL {
        let stamp = now.formatted(Date.ISO8601FormatStyle()).replacingOccurrences(of: ":", with: "-")
        var target = directory.appendingPathComponent("save.corrupt-\(stamp).json")
        var n = 2
        while fm.fileExists(atPath: target.path) {
            target = directory.appendingPathComponent("save.corrupt-\(stamp)-\(n).json")
            n += 1
        }
        try fm.moveItem(at: url, to: target)
        return target
    }

    private func rotateBackups(_ fm: FileManager) throws {
        let oldest = backupURL(Self.backupCount)
        if fm.fileExists(atPath: oldest.path) { try fm.removeItem(at: oldest) }
        for n in stride(from: Self.backupCount - 1, through: 1, by: -1) where fm.fileExists(atPath: backupURL(n).path) {
            try fm.moveItem(at: backupURL(n), to: backupURL(n + 1))
        }
        try fm.copyItem(at: saveURL, to: backupURL(1))
    }

    static let dateStyle = Date.ISO8601FormatStyle(includingFractionalSeconds: true)

    static func encode(_ state: GameState) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(dateStyle.format(date))
        }
        return try encoder.encode(state)
    }

    static func decode(_ data: Data) throws -> GameState {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            try dateStyle.parse(decoder.singleValueContainer().decode(String.self))
        }
        let state = try decoder.decode(GameState.self, from: data)
        guard state.schemaVersion == GameState.currentSchemaVersion else {
            throw SaveStoreError.unsupportedSchema(state.schemaVersion)
        }
        return state
    }
}
