// Auto-sizes the aircraft geometry from a handful of high-level choices.
// Returns all the derived geometry inputs needed by calcOptimizedDesign.

import { AIRFOILS } from './data/airfoils.js';
import { WING_CONFIGS } from './data/wingConfigs.js';
import { MATERIALS } from './data/materials.js';
import { MOTORS } from './data/motors.js';
import { calcBatteryWeight } from './logic/powerCalcs.js';

const G = 9.81;
const RHO = 1.225;
const V_LAUNCH_MAX = 8.0; // m/s — SAE hand-launch ceiling; stall must stay at or below this
const V_HT_TARGET = 0.45;    // target horizontal tail volume coefficient
const V_VT_TARGET = 0.04;    // target vertical tail volume coefficient

export function autoSize({
  wingspan,          // m — user constraint (often SAE rule limit)
  payloadKg,         // kg — mission target
  airfoilId,
  wingConfigId,
  materialId,        // single material for both wing and tail
  motorId,
  manualThrustG,     // only used when motorId === 'CUSTOM'
  manualMotorWeightG,
  batteryS,
  batteryCapacityMAh,
  h_cg = 0.28,       // CG position as fraction of MAC
}) {
  const airfoil = AIRFOILS.find((a) => a.id === airfoilId);
  const wingConfig = WING_CONFIGS.find((w) => w.id === wingConfigId);
  const material = MATERIALS.find((m) => m.id === materialId);
  const motor = MOTORS.find((m) => m.id === motorId);

  const b = wingspan;

  // Fixed / derived masses that don't depend on wing area
  const motorWeightG = motorId === 'CUSTOM' ? (manualMotorWeightG ?? 0) : (motor?.weightG ?? 0);
  const W_motor = motorWeightG / 1000;
  const W_battery = calcBatteryWeight(batteryS, batteryCapacityMAh);
  const W_electronics = 0.150; // ESC + receiver + servos — fixed
  // Fuselage scales modestly with span
  const W_fuselage = 0.120 + 0.060 * b;

  // Effective CL_max adjusted for biplane interference
  const gapChordRatio = 1.0;
  const isBiplane = wingConfigId === 'BIPLANE' || wingConfigId === 'SESQUIPLANE';
  const CL_max_eff = isBiplane
    ? airfoil.CL_max * wingConfig.liftInterferenceFactor * (1 + gapChordRatio * 0.1)
    : airfoil.CL_max;

  // Iterative solve: S depends on W_total, W_total depends on S (through wing/tail weight)
  const W_fixed = W_motor + W_battery + W_electronics + W_fuselage + payloadKg;
  let S = (2 * W_fixed * G) / (RHO * CL_max_eff * V_LAUNCH_MAX ** 2);

  for (let i = 0; i < 10; i++) {
    const c = S / b;
    const L_ht = 0.60 * b; // typical SAE tail arm ~60% of wingspan

    const S_ht = (V_HT_TARGET * S * c) / L_ht;
    const S_vt = (V_VT_TARGET * S * b) / L_ht;

    const W_wing = S * material.densityKgM2 * 2.2 * wingConfig.structuralWeightFactor;
    const W_tail = (S_ht + S_vt) * material.densityKgM2 * 1.5;

    const W_total = W_wing + W_tail + W_fixed;
    S = (2 * W_total * G) / (RHO * CL_max_eff * V_LAUNCH_MAX ** 2);
  }

  const c = Math.max(0.05, S / b);
  const L_ht = 0.60 * b;
  const S_ht = (V_HT_TARGET * S * c) / L_ht;
  const S_vt = (V_VT_TARGET * S * b) / L_ht;
  const fuseWidth = Math.max(0.09, 0.07 * b);

  return {
    // Wing
    S, b, c,
    gapChordRatio,
    // Tail
    S_ht, S_vt,
    L_ht, L_vt: L_ht,
    // Fuselage
    fuselageWidth: fuseWidth,
    fuselageHeight: fuseWidth,
    fuselageWeightG: Math.round((0.120 + 0.060 * b) * 1000),
    electronicsWeightG: 150,
    // Flight
    h_cg,
    aoa: 5,
    rho: RHO,
    dihedralAngle: 35,
    flaperonsEnabled: false,
    throttleFraction: 1.0,
  };
}
