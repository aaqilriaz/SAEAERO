import { BOTTLE_ESTIMATE, DEFAULT_DESIGN } from '../data/competition.js';
import { evaluate, requiredStaticThrust, U } from './competitionCalcs.js';

export const BASIC_DEFAULTS = { emptyBottles: 2, filledBottles: 2, spanIn: 94, emptyKg: 3, propDiameterIn: 12 };
export const THRUST_ALLOWANCE = 1.15;

export function validateBasic(input) {
  const errors = {};
  for (const key of ['emptyBottles', 'filledBottles']) {
    if (!Number.isInteger(input[key]) || input[key] < 0 || input[key] > 120)
      errors[key] = 'Use a whole number from 0 to 120.';
  }
  if (!errors.emptyBottles && !errors.filledBottles && input.emptyBottles + input.filledBottles < 1)
    errors.emptyBottles = 'Add at least one bottle.';
  if (!Number.isFinite(input.spanIn) || input.spanIn <= 72 || input.spanIn >= 96)
    errors.spanIn = 'Use more than 72 and less than 96 inches.';
  if (!Number.isFinite(input.emptyKg) || input.emptyKg < 0.1 || input.emptyKg > 24)
    errors.emptyKg = 'Enter an empty weight from 0.1 to 24 kg.';
  if (!Number.isFinite(input.propDiameterIn) || input.propDiameterIn < 1 || input.propDiameterIn > 12)
    errors.propDiameterIn = 'Use a propeller diameter from 1 to 12 inches.';
  return errors;
}

export function sizeBottleBay(count) {
  // One layer, bottles lying along the fuselage, at most two side by side.
  // Dimensions describe the clear envelope; doors/restraints/walls are extra.
  const columns = Math.min(2, Math.max(1, count));
  const rows = Math.max(1, Math.ceil(count / columns));
  const { lengthIn, diameterIn, clearanceIn } = BOTTLE_ESTIMATE;
  return {
    rows, columns,
    bayLengthIn: rows * lengthIn + (rows - 1) * clearanceIn,
    bayWidthIn: columns * diameterIn + (columns - 1) * clearanceIn,
    bayHeightIn: diameterIn,
  };
}

export function calculateBasic(input) {
  const errors = validateBasic(input);
  if (Object.keys(errors).length) return { valid: false, errors };
  const bay = sizeBottleBay(input.emptyBottles + input.filledBottles);
  if (bay.bayLengthIn > 150) return { valid: false, errors: { emptyBottles: 'Too many bottles for this single-bay estimate. Reduce the count or change the layout in Advanced.' } };
  const design = {
    ...structuredClone(DEFAULT_DESIGN), name: 'Basic estimate', mode: 'payload',
    emptyBottles: input.emptyBottles, filledBottles: input.filledBottles,
    spanIn: input.spanIn, motorCount: 2, propDiameterIn: input.propDiameterIn,
    emptyMassMode: 'measured', measuredEmptyKg: input.emptyKg, massGrowth: 0,
    bayLengthIn: bay.bayLengthIn, bayWidthIn: bay.bayWidthIn, bayHeightIn: bay.bayHeightIn,
  };
  const preliminary = evaluate(design);
  if (!preliminary.valid) return { valid: false, errors: { calculation: preliminary.errors.join(' ') } };
  // Battery capacity is checked separately: extra thrust cannot cure insufficient energy.
  const minimumN = requiredStaticThrust(design, { checkBattery: false });
  const targetPerMotorKgf = minimumN === null ? null : Math.ceil(minimumN * THRUST_ALLOWANCE / U.g / design.motorCount * 10) / 10;
  const targetN = targetPerMotorKgf === null ? null : targetPerMotorKgf * U.g * design.motorCount;
  const targetDesign = { ...design, staticThrustN: targetN ?? design.staticThrustN };
  const result = targetN === null ? preliminary : evaluate(targetDesign);
  const issues = result.checks.filter(c => !c.ok).filter(c => targetN !== null || !['Takeoff margin', 'Climb target', 'Cruise and turn thrust', 'Battery energy'].includes(c.name));
  return { valid: true, errors: {}, design: targetDesign, result, bay, minimumN, targetN, targetPerMotorKgf, issues };
}
