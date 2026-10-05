/** Maximum additional normal slope: about 1.4 degrees on a flat surface.
 * This envelope is visual only. Never add it to waves, terrain, or support heights.
 */
export const ORBIT_WATER_MAX_SLOPE = .025;
export const ORBIT_WATER_HALF_LIFE = .38;
const DECAY_RATE = Math.LN2 / ORBIT_WATER_HALF_LIFE;
const MAX_SAMPLE_GAP = .25;
const MAX_ANGULAR_STEP = .45;
const MAX_ANGULAR_SPEED = 8;
const SLOPE_PER_RADIAN_PER_SECOND = .025;

export type OrbitWaterSample = Readonly<{
  /** OrbitControls azimuth and polar angle, in radians; radius is deliberately absent. */
  azimuth: number;
  polar: number;
  /** Monotonic wall-clock seconds, not capped simulation delta or paused scene time. */
  timeSeconds: number;
  /** True only for an eligible user orbit gesture. False still advances decay/baseline. */
  active: boolean;
}>;

export type OrbitWaterResponse = Readonly<{
  azimuth: number;
  polar: number;
  timeSeconds: number | null;
  active: boolean;
  /** Nonnegative dimensionless slope; multiply by a shader field of length <= 1. */
  amplitude: number;
}>;

/** Also the reset operation. No resources, listeners, or dispose step are needed. */
export function createOrbitWaterResponse(): OrbitWaterResponse {
  return {azimuth: 0, polar: 0, timeSeconds: null, active: false, amplitude: 0};
}

/** Pure sample-to-state update. Discontinuities establish a baseline without excitation. */
export function stepOrbitWaterResponse(
  previous: OrbitWaterResponse,
  sample: OrbitWaterSample,
): OrbitWaterResponse {
  const {azimuth, polar, timeSeconds, active} = sample;
  if (![azimuth, polar, timeSeconds].every(Number.isFinite) || polar < 0 || polar > Math.PI) {
    return createOrbitWaterResponse();
  }
  // Normalize before subtraction so even two finite, very large angles cannot overflow.
  const next = {azimuth: Math.atan2(Math.sin(azimuth), Math.cos(azimuth)), polar, timeSeconds, active, amplitude: 0};
  if (previous.timeSeconds === null) return next;
  const dt = timeSeconds - previous.timeSeconds;
  // A resumed tab, clock rewind, or camera teleport must not retain a stale impulse.
  if (dt < 0 || dt > MAX_SAMPLE_GAP) return next;
  if (dt === 0) return {...next, amplitude: previous.amplitude};

  const decay = Math.exp(-DECAY_RATE * dt);
  next.amplitude = previous.amplitude * decay;
  // Keep sampling while inactive, and rebaseline on activation, so motion while
  // paused, zooming, switching modes, or blocked cannot accumulate into a kick.
  if (!active || !previous.active) return next;

  const difference = next.azimuth - previous.azimuth;
  const azimuthDelta = Math.atan2(Math.sin(difference), Math.cos(difference));
  // Azimuth has little visible travel near a pole; polar travel is unwrapped.
  const distance = Math.hypot(
    azimuthDelta * Math.sin((polar + previous.polar) * .5),
    polar - previous.polar,
  );
  const speed = distance / dt;
  if (distance > MAX_ANGULAR_STEP || speed > MAX_ANGULAR_SPEED) {
    return {...next, amplitude: 0};
  }
  const target = Math.min(ORBIT_WATER_MAX_SLOPE, speed * SLOPE_PER_RADIAN_PER_SECOND);
  // Exact constant-speed integration avoids frame-rate-dependent impulse accumulation.
  next.amplitude = Math.min(ORBIT_WATER_MAX_SLOPE, next.amplitude + target * (1 - decay));
  return next;
}
