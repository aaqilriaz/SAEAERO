import { DEFAULT_DESIGN, RULES } from '../data/competition.js';

// SI internally. Conversion constants are exact; no intermediate rounding.
export const U = { inch: 0.0254, foot: 0.3048, lb: 0.45359237, g: 9.80665 };
export function densityAtAltitude(ft) {
  return 1.225 * Math.pow(1 - 0.0065 * ft * U.foot / 288.15, 4.2558797);
}
export function flightScore(empty, filled) { return 3 * empty + 11 * filled; }
export function progressionOK(a, b) {
  return b.empty + b.filled >= a.empty + a.filled && b.filled >= a.filled &&
    (b.empty + b.filled > a.empty + a.filled || b.filled > a.filled) &&
    b.filled - a.filled <= a.empty;
}
export function finalScore(flights) {
  let previous = null;
  const errors = [];
  flights.forEach((f, i) => {
    const validCounts = Number.isInteger(f.empty) && Number.isInteger(f.filled) && f.empty >= 0 && f.filled >= 0 && f.empty + f.filled > 0;
    if (!validCounts || !Number.isFinite(f.predicted) || f.predicted < 0) errors.push(`Flight ${i + 1}: valid bottle counts and prediction required.`);
    if (previous && !progressionOK(previous, f)) errors.push(`Flight ${i + 1}: payload must increase from the last scored flight.`);
    if (f.success && validCounts) previous = f;
  });
  if (errors.length) return { valid: false, errors, average: null, bonus: null, total: null, top: [] };
  const top = [...flights].filter(f => f.success).map(f => ({ ...f, score: flightScore(f.empty, f.filled) }))
    .sort((a, b) => b.score - a.score || b.filled - a.filled).slice(0, 3);
  const bonus = Math.max(0, ...top.map(f => Math.max(10 - (f.score - f.predicted) ** 2, 0)));
  return { valid: true, errors: [], average: top.reduce((s, f) => s + f.score, 0) / 3, bonus,
    total: top.reduce((s, f) => s + f.score, 0) / 3 + bonus, top };
}

const bounds = {
  spanIn: [1, 300], rootChordIn: [0.1, 150], taper: [0.05, 1], lengthIn: [1, 300],
  stallTarget: [2, 50], sectionCl: [0.1, 4], clFactor: [0.1, 1], cd0: [0.005, 0.5], oswald: [0.1, 1],
  emptyBottles: [0, 120], filledBottles: [0, 120], emptyBottleLb: [0.01, 55], filledBottleLb: [0.01, 55],
  bottleDiameterIn: [0.1, 30], bottleLengthIn: [0.1, 60], bottleClearanceIn: [0, 5],
  bayLengthIn: [0.1, 150], bayWidthIn: [0.1, 100], bayHeightIn: [0.1, 100],
  densityAltitudeFt: [-2000, 15000], temperatureC: [-40, 60], cruiseMps: [2, 70], bankDeg: [0, 60],
  motorCount: [1, 8], propDiameterIn: [1, 30], driveRatio: [0.1, 10], batteryCells: [1, 12],
  batteryMah: [1, 20000], batteryC: [1, 200], loadedVoltage: [1, 50], receiverMah: [1, 20000],
  staticThrustN: [0, 500], thrustTestDensity: [0.5, 1.5], maxPowerW: [0, 10000],
  zeroThrustMps: [1, 100], efficiency: [0.05, 0.9], usableBattery: [0.1, 1], missionMinutes: [0.1, 30],
  headwindMps: [-10, 10], rollingMu: [0.005, 0.5], liftoffFactor: [1.05, 1.6], groundLiftFraction: [0, 1],
  rotationSeconds: [0, 10], runwayMargin: [0.2, 1], minClimbMps: [0, 10], minCruiseFactor: [1.1, 2],
  tailArmIn: [1, 150], horizontalVolume: [0.1, 1.5], verticalVolume: [0.01, 0.2],
  tailAR: [1, 10], tailEfficiency: [0.1, 1], downwash: [0, 0.9], minStaticMargin: [0.01, 0.3],
  cgEmptyMac: [-1, 2], payloadCgMac: [-1, 2], measuredEmptyKg: [0.1, 40], massGrowth: [0, 1],
};
export function validate(d) {
  const errors = [];
  if (!d || typeof d !== 'object' || Array.isArray(d)) return ['Configuration must be an object.'];
  for (const [key, [lo, hi]] of Object.entries(bounds)) {
    if (typeof d[key] !== 'number' || !Number.isFinite(d[key]) || d[key] < lo || d[key] > hi)
      errors.push(`${key}: enter a number from ${lo} to ${hi}.`);
  }
  for (const key of ['emptyBottles', 'filledBottles', 'motorCount', 'batteryCells'])
    if (!Number.isInteger(d[key])) errors.push(`${key} must be a whole number.`);
  for (const key of Object.keys(DEFAULT_DESIGN.mass))
    if (typeof d.mass?.[key] !== 'number' || !Number.isFinite(d.mass[key]) || d.mass[key] < 0 || d.mass[key] > 40)
      errors.push(`Mass for ${key} must be from 0 to 40 kg.`);
  if (d.emptyMassMode === 'budget' && Object.keys(DEFAULT_DESIGN.mass).reduce((sum, key) => sum + (d.mass?.[key] || 0), 0) <= 0)
    errors.push('Empty aircraft mass must be greater than zero.');
  if (d.mass && Object.keys(d.mass).some(key => !(key in DEFAULT_DESIGN.mass))) errors.push('Mass budget contains unknown components.');
  if (typeof d.name !== 'string' || d.name.length > 150) errors.push('Configuration name must be text, at most 150 characters.');
  if (!['wood', 'frp'].includes(d.structure)) errors.push('Choose a supported construction option.');
  if (d.planes !== 1 || d.tailType !== 'conventional') errors.push('This model supports a monoplane with a conventional tail only.');
  if (typeof d.separateReceiver !== 'boolean' || typeof d.propulsionMeasured !== 'boolean') errors.push('Receiver and propulsion switches must be true or false.');
  if (d.loadedVoltage > d.batteryCells * 4.2) errors.push('Loaded voltage cannot exceed 4.2 V per LiPo cell.');
  if (!['entered', 'components'].includes(d.balanceMode ?? 'entered')) errors.push('Choose an entered or component-derived empty CG.');
  if (!Number.isFinite(d.targetCgMac ?? 0.25) || (d.targetCgMac ?? 0.25) < -1 || (d.targetCgMac ?? 0.25) > 2) errors.push('Chosen CG target must be between -1 and 2 MAC.');
  if (d.balanceMode === 'components') {
    if (d.emptyMassMode !== 'budget') errors.push('Component-derived CG requires the component mass budget.');
    for (const key of Object.keys(DEFAULT_DESIGN.mass)) if (!Number.isFinite(d.massStationsIn?.[key]) || Math.abs(d.massStationsIn[key]) > 300)
      errors.push(`Position for ${key} must be within ±300 inches of MAC leading edge.`);
  }
  if (!['wing', 'payload'].includes(d.mode)) errors.push('Choose wing or payload sizing.');
  if (!['budget', 'measured'].includes(d.emptyMassMode)) errors.push('Choose budget or measured empty mass.');
  return errors;
}

export function packing(d) {
  const c = d.bottleClearanceIn;
  const dims = [d.bayLengthIn, d.bayWidthIn, d.bayHeightIn];
  // Rectangular grid of bounding cylinders. Uniform orientation; no staggered packing claims.
  return [0, 1, 2].map(axis => {
    const counts = dims.map((v, i) => Math.max(0, Math.floor((v + c + 1e-9) / ((i === axis ? d.bottleLengthIn : d.bottleDiameterIn) + c))));
    return { axis: ['lengthwise', 'crosswise', 'upright'][axis], counts, capacity: counts.reduce((a, b) => a * b, 1) };
  }).sort((a, b) => b.capacity - a.capacity)[0];
}

export function evaluate(d) {
  const errors = validate(d);
  if (errors.length) return { valid: false, errors, checks: [], feasible: false };
  const rho = densityAtAltitude(d.densityAltitudeFt);
  const emptyBase = d.emptyMassMode === 'measured' ? d.measuredEmptyKg : Object.keys(DEFAULT_DESIGN.mass).reduce((sum, key) => sum + d.mass[key], 0);
  const emptyKg = emptyBase * (1 + d.massGrowth);
  const payloadKg = (d.emptyBottles * d.emptyBottleLb + d.filledBottles * d.filledBottleLb) * U.lb;
  const grossKg = emptyKg + payloadKg;
  const W = grossKg * U.g;
  const span = d.spanIn * U.inch;
  const clmax = d.sectionCl * d.clFactor;
  const requiredArea = 2 * W / (rho * d.stallTarget ** 2 * clmax);
  const root = d.mode === 'payload' ? 2 * requiredArea / (span * (1 + d.taper)) : d.rootChordIn * U.inch;
  const tip = root * d.taper;
  const area = span * (root + tip) / 2;
  const mac = 2 / 3 * root * (1 + d.taper + d.taper ** 2) / (1 + d.taper);
  const ar = span ** 2 / area;
  const k = 1 / (Math.PI * d.oswald * ar);
  const stall = Math.sqrt(2 * W / (rho * area * clmax));
  const loadFactor = 1 / Math.cos(d.bankDeg * Math.PI / 180);
  const turnStall = stall * Math.sqrt(loadFactor);
  const emptyStall = Math.sqrt(2 * emptyKg * U.g / (rho * area * clmax));
  const drag = (v, n = 1) => { const q = 0.5 * rho * v ** 2; return q * area * d.cd0 + k * (n * W) ** 2 / (q * area); };
  const thrust = v => Math.min(d.staticThrustN * rho / d.thrustTestDensity * Math.max(0, 1 - (v / d.zeroThrustMps) ** 2), v > 0 ? d.efficiency * d.maxPowerW / v : Infinity);
  const cruiseDrag = drag(d.cruiseMps);
  const turnDrag = drag(d.cruiseMps, loadFactor);
  const cruisePower = cruiseDrag * d.cruiseMps / d.efficiency;
  const turnPower = turnDrag * d.cruiseMps / d.efficiency;
  const climbSpeed = d.minCruiseFactor * stall;
  const climb = (thrust(climbSpeed) - drag(climbSpeed)) * climbSpeed / W;
  const liftoff = d.liftoffFactor * stall;
  const targetGround = Math.max(0, liftoff - d.headwindMps);
  let distance = 0, seconds = 0;
  const dv = targetGround / 240;
  // Integrate dx/dv=m*v/F, dt/dv=m/F. Airspeed sets aero; groundspeed sets distance.
  for (let i = 0; i < 240; i++) {
    const vg = (i + 0.5) * dv;
    const va = Math.max(0, vg + d.headwindMps);
    const qS = 0.5 * rho * va ** 2 * area;
    const cl = d.groundLiftFraction * clmax;
    const lift = Math.min(W, qS * cl);
    const force = thrust(va) - qS * (d.cd0 + k * cl ** 2) - d.rollingMu * Math.max(0, W - lift);
    if (force <= 0) { distance = Infinity; seconds = Infinity; break; }
    distance += grossKg * vg / force * dv;
    seconds += grossKg / force * dv;
  }
  distance += targetGround * d.rotationSeconds;
  seconds += d.rotationSeconds;
  const usableWh = d.loadedVoltage * d.batteryMah / 1000 * d.usableBattery;
  const climbSeconds = Math.min(20, d.missionMinutes * 60);
  const energyWh = Number.isFinite(seconds) ? (d.maxPowerW * (seconds + climbSeconds) + turnPower * (d.missionMinutes * 60 - climbSeconds)) / 3600 : Infinity;
  const tailArea = d.horizontalVolume * area * mac / (d.tailArmIn * U.inch);
  const finArea = d.verticalVolume * area * span / (d.tailArmIn * U.inch);
  const wingSlope = 2 * Math.PI / (1 + 2 / (d.oswald * ar));
  const tailSlope = 2 * Math.PI / (1 + 2 / d.tailAR);
  // Tail arm is wing AC to tail AC. Include tail contribution to TOTAL lift slope.
  // dCm/dalpha = aw(h-.25) + eta*at*(1-downwash)*(Sh/S)*(h-h_tail).
  const tailContribution = d.tailEfficiency * tailSlope * (1 - d.downwash) * tailArea / area;
  const tailAcMac = 0.25 + d.tailArmIn * U.inch / mac;
  const neutral = (wingSlope * 0.25 + tailContribution * tailAcMac) / (wingSlope + tailContribution);
  const massMomentKgIn = d.balanceMode === 'components' ? Object.keys(DEFAULT_DESIGN.mass).reduce((sum, key) => sum + d.mass[key] * d.massStationsIn[key], 0) : null;
  const emptyCg = massMomentKgIn === null ? d.cgEmptyMac : massMomentKgIn / emptyBase * U.inch / mac;
  const loadedCg = (emptyKg * emptyCg + payloadKg * d.payloadCgMac) / grossKg;
  const emptySM = neutral - emptyCg, loadedSM = neutral - loadedCg;
  const targetCg = d.targetCgMac ?? 0.25;
  const payloadTargetMac = payloadKg > 0 ? (grossKg * targetCg - emptyKg * emptyCg) / payloadKg : null;
  const pack = packing(d);
  const checks = [];
  const check = (kind, name, ok, detail, ref) => checks.push({ kind, name, ok, detail, ref });
  check('rule', 'Planform span', d.spanIn > 72 && d.spanIn < 96, 'Strictly greater than 72 and less than 96 in', '7.1');
  check('rule', 'Minimum chord', tip / U.inch > 4, 'Every wing chord must be > 4 in', '7.1');
  check('rule', 'Body length', d.lengthIn < 120, 'Body-axis length < 120 in', '7.1');
  check('rule', 'Gross mass', grossKg <= 55 * U.lb, 'Gross takeoff weight ≤ 55 lb', '2.5');
  check('rule', 'Motors and propellers', [2, 4].includes(d.motorCount) && d.propDiameterIn <= (d.motorCount === 2 ? 12 : 9), '2 motors: props ≤ 12 in; 4 motors: props ≤ 9 in', '7.3');
  check('rule', 'Drive ratio', d.driveRatio === 1, 'Propeller RPM must equal motor RPM', '7.3');
  check('rule', 'Propulsion pack', d.batteryCells === 4 && d.batteryMah <= 2200, 'Commercial 4S LiPo; capacity ≤ 2200 mAh', '7.3');
  check('rule', 'Receiver supply', d.separateReceiver && d.receiverMah >= 1000 && ['LiPo', 'LiFe'].includes(d.receiverChemistry), 'Independent LiPo/LiFe receiver battery ≥ 1000 mAh', '2.23');
  check('rule', 'Bottle payload', d.emptyBottles + d.filledBottles >= 1 && (d.emptyBottles === 0 || d.emptyBottleLb > 1 && d.emptyBottleLb < 4) && (d.filledBottles === 0 || d.filledBottleLb >= 4), 'At least 1 bottle. Empty: > 1 and < 4 lb. Filled: ≥ 4 lb.', '7.4');
  check('rule', 'Airframe material', d.structure !== 'frp', 'No airframe FRP or fiber-reinforced tape; limited commercial hardware exceptions', '7.2');
  check('model', 'Cargo fit', pack.capacity >= d.emptyBottles + d.filledBottles && d.bayLengthIn < d.lengthIn, `${pack.capacity} positions in a ${pack.axis} grid; verify doors, restraints and clearance`, 'Packaging estimate');
  check('model', 'Stall target', stall <= d.stallTarget * (1 + 1e-10), 'Loaded level-flight stall at or below your target', 'Lift equation');
  check('model', 'Takeoff margin', distance <= RULES.takeoffFt * U.foot * d.runwayMargin, `Model target ≤ ${RULES.takeoffFt * d.runwayMargin} ft; rule limit 100 ft`, '3.8 + team margin');
  check('model', 'Ground-roll model applicability', d.headwindMps < liftoff, 'Headwind must be below liftoff airspeed for this rolling-takeoff model', 'Model domain');
  check('model', 'Turn stall margin', d.cruiseMps >= d.minCruiseFactor * turnStall, 'Cruise speed exceeds your margin above banked stall', 'Coordinated level turn');
  check('model', 'Cruise and turn thrust', thrust(d.cruiseMps) >= turnDrag, 'Available thrust must cover drag in your design turn', 'Assumed thrust curve');
  check('model', 'Climb target', climb >= d.minClimbMps, `Excess-power climb ≥ ${d.minClimbMps} m/s`, 'Point-mass estimate');
  check('model', 'Battery energy', energyWh <= usableWh, 'Ground run + 20 s full-power climb + banked cruise; reserve excluded from usable energy', 'Energy balance');
  check('model', 'Battery current', d.maxPowerW / d.loadedVoltage <= d.batteryMah / 1000 * d.batteryC, 'Total power / loaded voltage ≤ battery Ah × C rating; verify sag and ESC limits', 'Electrical estimate');
  check('model', 'Empty and loaded CG', Math.min(emptySM, loadedSM) >= d.minStaticMargin, 'Both static margins meet target; trim/control authority still require validation', 'Simplified neutral point');
  const warnings = ['Section lift presets are assumptions; drag, trim, stall and propulsion require Reynolds-matched data and tests.', 'Takeoff uses a level runway and constant ground CL; no gust, slope, ground-effect, rotation dynamics or landing-distance prediction.', 'Structural strength, flutter, servo authority and actual empty/loaded balance are not verified by this model.'];
  if (!d.propulsionMeasured) warnings.unshift('Propulsion is unmeasured. Candidate rankings are provisional.');
  if (ar < 4) warnings.unshift('Aspect ratio below 4: this lifting-line drag/stability approximation is weak.');
  if (Math.max(emptySM, loadedSM) > 0.2) warnings.unshift('Static margin exceeds 20% MAC in at least one loading case. Check elevator trim authority; more static stability is not always better.');
  if (d.balanceMode === 'components') warnings.unshift('Component positions are measured from MAC leading edge. Mass contingency is assumed to have the same CG as the entered empty budget.');
  if (d.mode === 'payload') warnings.unshift('Payload sizing solves wing area at fixed empty mass. Update the mass budget after resizing the structure.');
  return { valid: true, errors: [], rho, emptyBase, emptyKg, payloadKg, grossKg, area, span, root, tip, mac, ar, clmax,
    stall, emptyStall, turnStall, requiredArea, loadFactor, cruiseDrag, cruisePower, turnPower,
    availableThrust: thrust(d.cruiseMps), climb, liftoff, distance, seconds, usableWh, energyWh,
    enduranceMin: usableWh / cruisePower * 60, tailArea, finArea, neutral, loadedCg, emptyCg, emptySM, loadedSM, pack, massMomentKgIn, targetCg, payloadTargetMac,
    reynolds: rho * d.cruiseMps * mac / (1.716e-5 * ((d.temperatureC + 273.15) / 273.15) ** 1.5 * (273.15 + 110.4) / (d.temperatureC + 273.15 + 110.4)),
    ld: W / cruiseDrag, rootBendingNm: W * span / 8,
    turnDrag, climbSpeed, climbThrustRequired: drag(climbSpeed) + W * d.minClimbMps / climbSpeed,
    aftCgLimit: neutral - d.minStaticMargin,
    score: flightScore(d.emptyBottles, d.filledBottles), checks, warnings,
    feasible: checks.every(c => c.ok), rulesPass: checks.filter(c => c.kind === 'rule').every(c => c.ok) };
}

export function requiredStaticThrust(d, { checkBattery = true } = {}) {
  // Inverse search keeps installed power, prop speed, density and mission fixed.
  const relevant = ['Takeoff margin', 'Ground-roll model applicability', 'Cruise and turn thrust', 'Climb target'];
  if (checkBattery) relevant.push('Battery energy', 'Battery current');
  const passes = n => { const r = evaluate({ ...d, staticThrustN: n }); return r.valid && r.checks.filter(c => relevant.includes(c.name)).every(c => c.ok); };
  if (!passes(500)) return null;
  let lo = 0, hi = 500;
  for (let i = 0; i < 36; i++) { const mid = (lo + hi) / 2; if (passes(mid)) hi = mid; else lo = mid; }
  return hi;
}

export function candidates(d) {
  const base = evaluate({ ...d, mode: 'wing' });
  if (!base.valid) return [];
  const limit = Math.min(base.pack.capacity, 120, Math.floor((55 * U.lb - base.emptyKg) / (Math.min(d.emptyBottleLb, d.filledBottleLb) * U.lb)));
  const rows = [];
  for (let n = 1; n <= limit; n++) for (let f = 0; f <= n; f++) {
    const design = { ...d, mode: 'wing', emptyBottles: n - f, filledBottles: f };
    const r = evaluate(design);
    rows.push({ empty: n - f, filled: f, result: r });
  }
  return rows.sort((a, b) => Number(b.result.feasible) - Number(a.result.feasible) || b.result.score - a.result.score || a.result.payloadKg - b.result.payloadKg);
}

export function exportTds(d, team) {
  if (!Number.isInteger(team) || team < 1) throw new Error('Enter your positive integer team number.');
  const input = evaluate(d);
  if (!input.valid) throw new Error('Correct the aircraft inputs before generating a prediction.');
  const fixedDesign = { ...d, mode: 'wing', rootChordIn: input.root / U.inch };
  let previousScore = Infinity;
  return Array.from({ length: 31 }, (_, i) => {
    const rows = candidates({ ...fixedDesign, densityAltitudeFt: i * 200 });
    // Select an actually achievable mix at or below the preceding score. This
    // gives a conservative non-increasing curve without inventing a score.
    const selected = rows.find(r => r.result.feasible && r.result.score <= previousScore);
    previousScore = selected?.result.score ?? 0;
    return { Team: team, 'Den-Alt': i * 200, Score: previousScore };
  });
}
