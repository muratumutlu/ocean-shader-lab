import Foundation

public enum FocusPreset: Int, CaseIterable, Codable, Sendable {
    case minutes15 = 15
    case minutes25 = 25
    case minutes45 = 45
    case minutes60 = 60

    public var minutes: Int { rawValue }
    public var durationSec: Int { rawValue * 60 }
}

/// Combined effect of every owned upgrade in one region.
public struct Modifiers: Equatable, Sendable {
    public var fishMultiplier: Double
    public var moneyBonus: Double

    public init(fishMultiplier: Double = 1, moneyBonus: Double = 0) {
        self.fishMultiplier = fishMultiplier
        self.moneyBonus = moneyBonus
    }

    public static let none = Modifiers()
}

public enum Economy {
    public static let baseFishPer25Min = 10
    /// Guards floor() against values like 21.999999999 caused by binary floating point.
    static let epsilon = 1e-9

    public static func durationMultiplier(minutes: Int) -> Double {
        switch minutes {
        case 15: 0.55
        case 25: 1.0
        case 45: 2.2
        case 60: 3.0
        default: Double(minutes) / 25
        }
    }

    public static func fish(minutes: Int, modifiers: Modifiers) -> Int {
        let raw = Double(baseFishPer25Min) * durationMultiplier(minutes: minutes) * modifiers.fishMultiplier
        return Int((raw + epsilon).rounded(.down))
    }

    public static func money(fish: Int, fishPrice: Int, modifiers: Modifiers) -> Int {
        let raw = Double(fish * fishPrice) * (1 + modifiers.moneyBonus)
        return Int((raw + epsilon).rounded(.down))
    }
}
