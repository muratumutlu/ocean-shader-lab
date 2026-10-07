import Foundation

public protocol FocusClock: Sendable {
    /// Wall-clock time. The user can change it.
    var now: Date { get }
    /// Seconds since boot, including sleep. Survives app restarts and resets on reboot.
    var uptime: TimeInterval { get }
}

public struct SystemClock: FocusClock {
    public init() {}

    public var now: Date { Date() }

    /// On Darwin, CLOCK_MONOTONIC keeps counting while the device sleeps.
    public var uptime: TimeInterval {
        TimeInterval(clock_gettime_nsec_np(CLOCK_MONOTONIC)) / 1_000_000_000
    }
}
