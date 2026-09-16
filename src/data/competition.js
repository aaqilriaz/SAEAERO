// Source of truth: supplied 2027 SAE Aero Design Rules, version 2027.0.
// Page numbers below are printed rule pages (PDF page = printed page + 8).
export const RULES = {
  version: '2027.0', class: 'Regular', reviewed: '2026-09-16',
  minSpanIn: 72, maxSpanIn: 96, minChordIn: 4, maxLengthIn: 120,
  maxGrossLb: 55, takeoffFt: 100, landingFt: 400,
  batteryCells: 4, batteryMah: 2200, receiverMah: 1000,
  emptyMinLb: 1, filledMinLb: 4, emptyPoints: 3, filledPoints: 11,
};

// Planning envelope, not manufacturer dimensions. Confirm against the actual bottle.
// Keep the default gap small: 1 mm between bottles (not padding or wall thickness).
export const BOTTLE_ESTIMATE = {
  litres: 2, diameterIn: 4.4, lengthIn: 13, clearanceIn: 1 / 25.4,
};

export const FOILS = [
  { id: 'S1223', name: 'Selig S1223', cl: 2.1, tag: 'High lift',
    note: 'A high-lift candidate. A published 2D test reached Cl,max 2.2 at Re = 200,000; the 2.1 preset is a planning assumption. Check pitching moment, trim drag, surface accuracy and performance at your Reynolds number.',
    source: 'https://m-selig.ae.illinois.edu/pubs/GuglielmoSelig-1997-JofAC-S1223.pdf' },
  { id: 'NACA_4412', name: 'NACA 4412', cl: 1.6, tag: 'Baseline',
    note: 'Cambered comparison baseline. The 1.6 section Cl,max preset is an unvalidated planning assumption, not a Reynolds-matched polar.', source: 'https://m-selig.ae.illinois.edu/ads/coord_database.html' },
  { id: 'CLARK_Y', name: 'Clark Y', cl: 1.5, tag: 'Build simplicity',
    note: 'Flat aft lower surface can simplify construction. The 1.5 section Cl,max preset is an unvalidated planning assumption; measure or source a matching polar.', source: 'https://m-selig.ae.illinois.edu/ads/coord_database.html' },
  { id: 'NACA_2412', name: 'NACA 2412', cl: 1.4, tag: 'Lower camber',
    note: 'Lower-camber comparison option. The 1.4 section Cl,max preset is an unvalidated planning assumption; it does not establish stall behavior or drag.', source: 'https://m-selig.ae.illinois.edu/ads/coord_database.html' },
  { id: 'CUSTOM', name: 'Custom / tested airfoil', cl: 1.6, tag: 'Your data',
    note: 'Enter a section Cl,max supported by a polar or test at the relevant Reynolds number. Use the installation factor for finite-wing, trim, surface and interference effects.', source: 'https://m-selig.ae.illinois.edu/uiuc_lsat.html' },
];

export const DEFAULT_DESIGN = {
  name: 'Meeting baseline', mode: 'wing', airfoil: 'S1223',
  spanIn: 94, rootChordIn: 18, taper: 1, planes: 1, lengthIn: 76,
  stallTarget: 10, sectionCl: 2.1, clFactor: 0.8, cd0: 0.045, oswald: 0.7,
  emptyBottles: 2, filledBottles: 2, emptyBottleLb: 1.05, filledBottleLb: 4.05,
  bottleDiameterIn: BOTTLE_ESTIMATE.diameterIn, bottleLengthIn: BOTTLE_ESTIMATE.lengthIn, bottleClearanceIn: BOTTLE_ESTIMATE.clearanceIn,
  bayLengthIn: 28, bayWidthIn: 10, bayHeightIn: 6,
  densityAltitudeFt: 1500, temperatureC: 25, cruiseMps: 18, bankDeg: 25,
  motorCount: 2, propDiameterIn: 12, propsPerMotor: 1, driveRatio: 1,
  batteryCells: 4, batteryMah: 2200, batteryC: 60, loadedVoltage: 14,
  receiverMah: 1000, receiverChemistry: 'LiFe', separateReceiver: true,
  staticThrustN: 40, thrustTestDensity: 1.225, maxPowerW: 900,
  zeroThrustMps: 32, efficiency: 0.5, propulsionMeasured: false,
  usableBattery: 0.8, missionMinutes: 2, headwindMps: 0,
  rollingMu: 0.04, liftoffFactor: 1.2, groundLiftFraction: 0.7, rotationSeconds: 1,
  runwayMargin: 0.85, minClimbMps: 1, minCruiseFactor: 1.3,
  tailType: 'conventional', tailArmIn: 36, horizontalVolume: 0.5, verticalVolume: 0.04,
  tailAR: 4, tailEfficiency: 0.9, downwash: 0.35, minStaticMargin: 0.08,
  cgEmptyMac: 0.25, payloadCgMac: 0.25, targetCgMac: 0.25, balanceMode: 'entered', structure: 'wood',
  massStationsIn: { wing: 4.5, tail: 40.5, fuselage: 10, gear: 3, motors: -6, esc: -3, battery: -2, receiver: 2, controls: 8, cargo: 4.5, other: 4.5 },
  emptyMassMode: 'budget', measuredEmptyKg: 2.5, massGrowth: 0.15,
  mass: { wing: 0.65, tail: 0.2, fuselage: 0.5, gear: 0.2, motors: 0.26, esc: 0.1, battery: 0.25, receiver: 0.1, controls: 0.16, cargo: 0.15, other: 0.1 },
};

export const MASS_LABELS = {
  wing: 'Wing + spars', tail: 'Tail + boom', fuselage: 'Fuselage', gear: 'Landing gear',
  motors: 'All motors', esc: 'All ESCs + power wiring', battery: 'Propulsion battery',
  receiver: 'Receiver battery', controls: 'Receiver + servos + controls',
  cargo: 'Cargo doors + restraints', other: 'Hardware + other',
};

export const MANUAL_CHECKS = [
  ['Payload construction', 'Unmodified commercial 2 L cylindrical plastic bottles; inert contents; no lead. Enclosed and restrained throughout flight. Payload must not support the airframe.', '§2.12–2.14, §7.4', 35],
  ['Material review', 'No FRP or fiber-reinforced tape in the airframe. Only the listed commercial motor mount, propeller, gear and linkage exceptions apply. No elastic wing or payload retention.', '§7.2', 34],
  ['Propulsion installation', 'Commercial 4S LiPo pack; motor and propeller RPM must match. Non-metal propellers with spinners or approved safety nuts. Verify propeller clearance and measured current.', '§2.10–2.11, §7.3', 34],
  ['Independent receiver supply', 'Separate LiPo or LiFe receiver battery, at least 1000 mAh; sufficient for all servos. Receiver must work with the propulsion plug removed.', '§2.23', 15],
  ['Arming and switch placement', 'Discrete red plug in the positive lead; top, visible, near centerline. Plug and receiver switch at least 9 in from every propeller sweep. Observe opposite-side-of-wing placement.', '§2.22–2.24', 14],
  ['Controls and structure', '2.4 GHz radio with zero-throttle failsafe, positive ground steering, secure batteries, clevis keepers, no backlash, sufficient servo torque and demonstrated structural strength.', '§2.6–2.19', 12],
  ['Weight and balance', 'Verify both empty and loaded CG physically. Mark empty CG on both fuselage sides with a ≥0.5 in symbol centered within ±0.25 in of the drawing.', '§2.4, §4.4', 11],
  ['Flight operation', 'One takeoff try in the 60 s allotment; airborne by 100 ft. First turn after 400 ft, complete a 360° circuit, land and stop inside the 400 ft zone. No push at release.', '§3.3–3.9', 19],
  ['Unloading and progression', 'Unload within 60 s with at most two people; only removed bottles count. After a scored flight, add an empty bottle and/or replace an empty with a filled bottle; total count cannot decrease.', '§7.4–7.5', 35],
  ['Identification', 'Team numbers on both wing faces and both vertical sides; Regular numbers ≥4 in where practical. External university name plus school mailing and email information.', '§2.2', 11],
  ['Design deliverables', 'Original report and signed compliance statement; ANSI B 3-view drawing, dimensions in inches, mass/moment table, empty/loaded CG, MAC, static margins and equipment data. TDS needs graph/explanation and JSON.', '§4, Appendix A', 22],
  ['Readiness and inspection', 'Complete the SAE STARS checklist before inspection. Prepare the 12-minute FDRR and 7-minute Q&A. Report changes via ECR; compare length/span/height to drawings (sum of absolute deviations ≤2 in).', '§2.26, §5–6', 30],
];
