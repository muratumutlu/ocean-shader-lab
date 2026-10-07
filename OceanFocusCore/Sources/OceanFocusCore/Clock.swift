import Foundation

public protocol FocusClock: Sendable {
    /// Wall-clock time. The user can change it.
    var now: Date { get }
    /// Seconds since boot, including sleep. Survives app restarts and resets on reboot.
    var uptime: TimeInterval { get }
    /// Identifies the current boot. Changes on reboot, unaffected by wall-clock changes.
    var bootSessionId: String { get }
}

public struct SystemClock: FocusClock {
    public init() {}

    public var now: Date { Date() }

    /// On Darwin, CLOCK_MONOTONIC keeps counting while the device sleeps.
    public var uptime: TimeInterval {
        TimeInterval(clock_gettime_nsec_np(CLOCK_MONOTONIC)) / 1_000_000_000
    }

    /// kern.bootsessionuuid. Not kern.boottime, which shifts when the wall clock is changed.
    /// Returns "" if the sysctl fails.
    public var bootSessionId: String {
        var size = 0
        guard sysctlbyname("kern.bootsessionuuid", nil, &size, nil, 0) == 0, size > 0 else { return "" }
        var buffer = [CChar](repeating: 0, count: size)
        guard sysctlbyname("kern.bootsessionuuid", &buffer, &size, nil, 0) == 0 else { return "" }
        return String(decoding: buffer.prefix { $0 != 0 }.map { UInt8(bitPattern: $0) }, as: UTF8.self)
    }
}
