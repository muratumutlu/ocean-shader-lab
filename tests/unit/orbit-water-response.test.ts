import {describe, expect, it} from 'vitest';
import {
  createOrbitWaterResponse,
  stepOrbitWaterResponse,
  ORBIT_WATER_HALF_LIFE,
  ORBIT_WATER_MAX_SLOPE,
  type OrbitWaterResponse,
  type OrbitWaterSample,
} from '../../src/water/orbit-response';

const sample = (timeSeconds: number, azimuth = 0, active = true, polar = Math.PI / 2): OrbitWaterSample =>
  ({timeSeconds, azimuth, polar, active});
const start = () => stepOrbitWaterResponse(createOrbitWaterResponse(), sample(0));
function orbit(fps: number, seconds = 1, speed = .7): OrbitWaterResponse {
  let state = start();
  for (let i = 1; i <= fps * seconds; i++) {
    state = stepOrbitWaterResponse(state, sample(i / fps, speed * i / fps));
  }
  return state;
}

describe('visual orbit-water response', () => {
  it('starts without excitation and does not respond to stationary angles during zoom', () => {
    let state = stepOrbitWaterResponse(createOrbitWaterResponse(), sample(42, 2.8));
    for (let i = 1; i <= 120; i++) state = stepOrbitWaterResponse(state, sample(42 + i / 60, 2.8));
    expect(state.amplitude).toBe(0);
  });

  it('responds to ordinary orbiting but stays below a small fixed slope during sustained fast orbit', () => {
    expect(orbit(60).amplitude).toBeGreaterThan(.01);
    let state = start();
    for (let i = 1; i <= 3600; i++) {
      state = stepOrbitWaterResponse(state, sample(i / 60, i * .1));
      expect(state.amplitude).toBeGreaterThanOrEqual(0);
      expect(state.amplitude).toBeLessThanOrEqual(ORBIT_WATER_MAX_SLOPE);
    }
    expect(state.amplitude).toBeCloseTo(ORBIT_WATER_MAX_SLOPE, 8);
  });

  it('gives the same response at 30, 60, and 144 fps and irregular frame intervals', () => {
    const expected = orbit(60).amplitude;
    expect(orbit(30).amplitude).toBeCloseTo(expected, 12);
    expect(orbit(144).amplitude).toBeCloseTo(expected, 12);
    let state = start(), time = 0;
    for (const dt of [.013, .071, .016, .1, .2, .03, .17, .1, .05, .25]) {
      time += dt;
      state = stepOrbitWaterResponse(state, sample(time, time * .7));
    }
    expect(time).toBeCloseTo(1);
    expect(state.amplitude).toBeCloseTo(expected, 12);
  });

  it('decays by half in the documented half-life regardless of whether a gesture remains held', () => {
    const moving = orbit(60);
    for (const active of [false, true]) {
      let state = moving;
      for (let i = 1; i <= 4; i++) {
        state = stepOrbitWaterResponse(state, sample(1 + ORBIT_WATER_HALF_LIFE * i / 4, moving.azimuth, active));
      }
      expect(state.amplitude).toBeCloseTo(moving.amplitude / 2, 12);
    }
  });

  it('crosses the azimuth branch cut without inventing a large impulse', () => {
    const edge = stepOrbitWaterResponse(createOrbitWaterResponse(), sample(0, Math.PI - .005));
    const wrapped = stepOrbitWaterResponse(edge, sample(.02, -Math.PI + .005));
    const ordinary = stepOrbitWaterResponse(start(), sample(.02, .01));
    expect(wrapped.amplitude).toBeGreaterThan(0);
    expect(wrapped.amplitude).toBeCloseTo(ordinary.amplitude, 12);
  });

  it('handles polar motion and suppresses azimuth jitter at the orbit poles', () => {
    const polarMotion = stepOrbitWaterResponse(start(), sample(.02, 0, true, Math.PI / 2 + .01));
    expect(polarMotion.amplitude).toBeGreaterThan(0);
    const pole = stepOrbitWaterResponse(createOrbitWaterResponse(), sample(0, 0, true, .0001));
    expect(stepOrbitWaterResponse(pole, sample(.02, .1, true, .0001)).amplitude)
      .toBeLessThan(polarMotion.amplitude / 100);
  });

  it('does not accumulate inactive movement or introduce a kick when a gesture resumes', () => {
    let state = start();
    state = stepOrbitWaterResponse(state, sample(.1, 1, false));
    state = stepOrbitWaterResponse(state, sample(.2, -2, false));
    state = stepOrbitWaterResponse(state, sample(.3, 2, true));
    expect(state.amplitude).toBe(0);
    expect(stepOrbitWaterResponse(state, sample(.32, 2.01)).amplitude).toBeGreaterThan(0);
  });

  it('clears stale responses across reset, large gaps, teleports, and clock rewind', () => {
    const moving = orbit(60);
    for (const discontinuity of [sample(8, .72), sample(1.02, 2), sample(.5, .72)]) {
      const state = stepOrbitWaterResponse(moving, discontinuity);
      expect(state.amplitude).toBe(0);
      expect(stepOrbitWaterResponse(state, {...discontinuity, timeSeconds: discontinuity.timeSeconds + .02}).amplitude).toBe(0);
    }
    const reset = stepOrbitWaterResponse(createOrbitWaterResponse(), sample(1.02, 2));
    expect(reset.amplitude).toBe(0);
    expect(stepOrbitWaterResponse(moving, sample(1.001, .75)).amplitude).toBe(0);
  });

  it('keeps finite large angle representations from overflowing a delta', () => {
    const state = stepOrbitWaterResponse(createOrbitWaterResponse(), sample(0, 1e308));
    const next = stepOrbitWaterResponse(state, sample(.02, -1e308));
    expect(Number.isFinite(next.amplitude)).toBe(true);
    expect(next.amplitude).toBeLessThanOrEqual(ORBIT_WATER_MAX_SLOPE);
  });

  it('is pure and rejects invalid samples without poisoning future state', () => {
    const previous = Object.freeze(orbit(60));
    for (const invalid of [sample(NaN), sample(2, Infinity), sample(2, 0, true, -1)]) {
      const state = stepOrbitWaterResponse(previous, invalid);
      expect(state).toEqual(createOrbitWaterResponse());
      expect(stepOrbitWaterResponse(state, sample(2, 1)).amplitude).toBe(0);
    }
    const duplicate = Object.freeze(sample(1, previous.azimuth));
    expect(stepOrbitWaterResponse(previous, duplicate).amplitude).toBe(previous.amplitude);
    expect(stepOrbitWaterResponse(previous, duplicate)).not.toBe(previous);
  });
});
