import { describe, expect, it } from 'vitest';
import { BASIC_DEFAULTS, calculateBasic } from '../logic/basicCalcs.js';
import { evaluate, requiredStaticThrust, U } from '../logic/competitionCalcs.js';

describe('basic calculator', () => {
  it('uses the team hardware and rule-compliant payload weights without extra inputs', () => {
    const p = calculateBasic(BASIC_DEFAULTS);
    expect(p.valid).toBe(true);
    expect(p.design.motorCount).toBe(2);
    expect(p.design.batteryCells).toBe(4);
    expect(p.design.batteryMah).toBe(2200);
    expect(p.result.rulesPass).toBe(true);
    expect(p.result.grossKg).toBeCloseTo(3 + (2 * 1.05 + 2 * 4.05) * U.lb, 12);
  });
  it('solves enough wing area for the entered weight and closes the lift equation', () => {
    const a = calculateBasic(BASIC_DEFAULTS);
    const b = calculateBasic({ ...BASIC_DEFAULTS, emptyKg: 4 });
    expect(b.result.area).toBeGreaterThan(a.result.area);
    expect(b.minimumN).toBeGreaterThan(a.minimumN);
    expect(.5 * b.result.rho * b.result.stall ** 2 * b.result.area * b.result.clmax).toBeCloseTo(b.result.grossKg * U.g, 10);
    expect(b.result.emptyKg).toBe(4); // no invisible contingency or component sum
  });
  it('returns a per-motor target above the solved minimum and verifies its runway and climb performance', () => {
    const p = calculateBasic(BASIC_DEFAULTS);
    expect(p.targetN).toBeCloseTo(2 * p.targetPerMotorKgf * U.g, 12);
    expect(p.targetN).toBeGreaterThanOrEqual(p.minimumN * 1.15);
    const atTarget = evaluate(p.design);
    expect(atTarget.distance).toBeLessThan(85 * U.foot);
    expect(atTarget.climb).toBeGreaterThanOrEqual(1);
    expect(atTarget.availableThrust).toBeGreaterThanOrEqual(atTarget.turnDrag);
  });
  it('fits odd and even bottle counts with exactly a 1 mm gap, including full bottle length', () => {
    for (const count of [1, 2, 3, 4, 7]) {
      const p = calculateBasic({ ...BASIC_DEFAULTS, emptyBottles: count, filledBottles: 0 });
      expect(p.result.pack.capacity).toBeGreaterThanOrEqual(count);
      expect(p.design.bottleClearanceIn * 25.4).toBeCloseTo(1, 12);
      expect(p.bay.bayLengthIn).toBeCloseTo(p.bay.rows * 13 + (p.bay.rows - 1) / 25.4, 12);
    }
  });
  it.each([72, 96, NaN, null])('rejects invalid or boundary span %s rather than quietly clamping', spanIn => {
    expect(calculateBasic({ ...BASIC_DEFAULTS, spanIn }).valid).toBe(false);
  });
  it('retains an editable prop diameter and enforces the two-motor rule', () => {
    expect(calculateBasic({ ...BASIC_DEFAULTS, propDiameterIn: 10 }).design.propDiameterIn).toBe(10);
    expect(calculateBasic({ ...BASIC_DEFAULTS, propDiameterIn: 12 }).valid).toBe(true);
    for (const propDiameterIn of [0, 12.01, NaN, null])
      expect(calculateBasic({ ...BASIC_DEFAULTS, propDiameterIn }).valid).toBe(false);
  });
  it('does not fabricate thrust or a passing result when fixed power cannot support the load', () => {
    const p = calculateBasic({ ...BASIC_DEFAULTS, emptyBottles: 4, filledBottles: 4 });
    expect(p.minimumN).toBeNull();
    expect(p.targetN).toBeNull();
    expect(p.targetPerMotorKgf).toBeNull();
    expect(p.result.feasible).toBe(false);
  });
  it('separates thrust requirements from an energy shortfall', () => {
    const d = { ...calculateBasic(BASIC_DEFAULTS).design, missionMinutes: 10 };
    expect(requiredStaticThrust(d)).toBeNull();
    const thrust = requiredStaticThrust(d, { checkBattery: false });
    expect(thrust).toBeGreaterThan(0);
    const r = evaluate({ ...d, staticThrustN: thrust + .01 });
    expect(r.checks.find(c => c.name === 'Battery energy').ok).toBe(false);
    expect(r.checks.find(c => c.name === 'Takeoff margin').ok).toBe(true);
  });
  it('rejects missing or fractional bottles, zero payload and impossible layout inputs', () => {
    for (const patch of [{ emptyBottles: 1.5 }, { emptyBottles: NaN }, { emptyBottles: 0, filledBottles: 0 }, { emptyKg: 0 }, { emptyBottles: 120 }])
      expect(calculateBasic({ ...BASIC_DEFAULTS, ...patch }).valid).toBe(false);
  });
});
