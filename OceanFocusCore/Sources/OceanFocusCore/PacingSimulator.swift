import Foundation

/// Small deterministic PRNG so pacing tests are reproducible.
public struct SplitMix64: RandomNumberGenerator, Sendable {
    private var state: UInt64

    public init(seed: UInt64) {
        state = seed
    }

    public mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

/// Monte-Carlo check that a region takes 40–60 successful 25-min-equivalent sessions to finish.
/// Simulated players pick presets by weight and greedily buy the cheapest affordable upgrade.
public enum PacingSimulator {
    public static let targetRange: ClosedRange<Double> = 40...60
    public static let presetWeights: [(preset: FocusPreset, weight: Double)] = [
        (.minutes15, 0.15), (.minutes25, 0.5), (.minutes45, 0.2), (.minutes60, 0.15),
    ]
    static let maxSessions = 10_000

    /// Returns 25-min-equivalent sessions needed to own every upgrade, or `.infinity` if impossible.
    public static func sessionsToComplete<R: RandomNumberGenerator>(regionId: String, catalog: Catalog,
                                                                  rng: inout R) -> Double {
        guard let region = catalog.region(regionId) else { return .infinity }
        let engine = GameEngine(catalog: catalog)
        var state = GameState.fresh(catalog: catalog)
        state.currentRegionId = regionId
        if !state.unlockedRegionIds.contains(regionId) { state.unlockedRegionIds.append(regionId) }

        var equivalents = 0.0
        for _ in 0..<maxSessions {
            if state.progress(for: regionId).ownedUpgrades.count >= region.upgrades.count {
                return equivalents
            }
            let preset = pickPreset(&rng)
            let modifiers = engine.modifiers(in: state, regionId: regionId)
            let fish = Economy.fish(minutes: preset.minutes, modifiers: modifiers)
            state.regions[regionId, default: RegionProgress()].money +=
                Economy.money(fish: fish, fishPrice: region.fishPrice, modifiers: modifiers)
            equivalents += Double(preset.minutes) / 25
            buyGreedily(engine: engine, state: &state)
        }
        return .infinity
    }

    public static func run(regionId: String, catalog: Catalog, players: Int, seed: UInt64) -> [Double] {
        var rng = SplitMix64(seed: seed)
        var results: [Double] = []
        for _ in 0..<players {
            results.append(sessionsToComplete(regionId: regionId, catalog: catalog, rng: &rng))
        }
        return results
    }

    public static func median(_ values: [Double]) -> Double {
        let sorted = values.sorted()
        guard !sorted.isEmpty else { return .nan }
        let mid = sorted.count / 2
        return sorted.count.isMultiple(of: 2) ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }

    static func buyGreedily(engine: GameEngine, state: inout GameState) {
        while true {
            let money = state.progress(for: state.currentRegionId).money
            let next = engine.purchasable(in: state)
                .filter { $0.price <= money }
                .min { ($0.price, $0.id) < ($1.price, $1.id) }
            guard let next, (try? engine.purchase(next.id, in: &state)) != nil else { return }
        }
    }

    static func pickPreset<R: RandomNumberGenerator>(_ rng: inout R) -> FocusPreset {
        let roll = Double.random(in: 0..<1, using: &rng)
        var cumulative = 0.0
        for (preset, weight) in presetWeights {
            cumulative += weight
            if roll < cumulative { return preset }
        }
        return presetWeights[presetWeights.count - 1].preset
    }
}
