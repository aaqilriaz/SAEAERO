# Numerical and modeling audit

The 2027 dashboard exclusively uses `src/logic/competitionCalcs.js`. Legacy calculators are not part of the displayed results. All intermediate calculations retain full floating-point precision; formatting happens only in the UI.

## Rules and dimensions

Source: supplied SAE Aero Design Rules 2027.0, all 57 PDF pages, copied unchanged to `public/rules-2027.pdf`. Regular Class uses strict 72 < span < 96 inch, minimum chord >4 inch, body length <120 inch, gross weight <=55 lb, two or four motors, 12/9 inch maximum props respectively, 4S LiPo <=2200 mAh, and independent receiver LiPo/LiFe >=1000 mAh. Empty bottles require >1 and <4 lb under section 7.4; filled bottles require >=4 lb. The unloading section's wording at exactly 1 lb is less strict; the design checker follows the stricter payload requirement.

## Physical model

- Exact conversions: 1 inch = 0.0254 m; 1 foot = 0.3048 m; 1 lb = 0.45359237 kg; g = 9.80665 m/s².
- The wing is trapezoidal with zero quarter-chord sweep. Area, aspect ratio and MAC follow their analytic definitions. Payload sizing inverts the lift equation at fixed entered empty mass.
- Lift and drag use dynamic pressure, total wing planform reference area and a parabolic drag polar. Bank increases required lift by sec(bank), banked stall by sqrt(sec(bank)), and induced drag by sec²(bank).
- Ground roll solves Newton's law with aerodynamic force evaluated at airspeed, and runway distance evaluated at groundspeed. Velocity-domain midpoint quadrature is independently checked against time-stepping the acceleration equation, with relative error below 0.1% in regression cases.
- Available thrust is capped by useful propulsive power divided by airspeed. Its quadratic dependence on airspeed and linear density scaling are assumptions, not manufacturer data. Static inverse sizing holds power and curve shape fixed.
- Energy is integrated across the explicitly stated ground/climb/cruise phases; impossible takeoff returns infinite energy, never NaN. Battery current is total electrical power divided by loaded pack voltage.
- Component CG uses mass moments about MAC leading edge. The chosen loaded-CG target is an input; required payload location is obtained by algebraically inverting that same moment balance.
- The neutral point cancels the combined wing and tail pitching-moment slope. The denominator includes the tail's contribution to total lift slope, consistent with defining the tail moment arm from wing AC to tail AC. A regression test independently verifies zero derivative at the calculated neutral point. Fuselage/propulsion moments and trim remain outside this preliminary model.

Foundations: [NASA drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/), [NASA induced drag](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/modern-drag-equation/), [Cornell stability formulation correction](https://courses.cit.cornell.edu/mae5070/mae5070texterrata.html), [MIT static stability](https://live.ocw.mit.edu/courses/16-333-aircraft-stability-and-control-fall-2004/99dac83da0ad7eb8906ebac40e9e6ae1_lecture_2.pdf), [UIUC S1223 experiment](https://m-selig.ae.illinois.edu/pubs/GuglielmoSelig-1997-JofAC-S1223.pdf).

## Tests and limits

297 tests passed, including 24 competition cases. Tests cover strict boundaries, malformed/nonfinite inputs, exact conversions, lift closure, mass moments, neutral-point derivative, takeoff numerical agreement, power capping, impossible-flight handling, inverse thrust sizing, flight progression, decimal prediction bonus, and TDS schema/monotonicity. Live Chromium exercised the actual deployed UI and rulebook download.

Passing tests establish implementation consistency with these equations and rules, not accuracy of unmeasured inputs or flight readiness. Real airfoil/propeller data, build mass, CG measurements, structural and control analysis, runway trials, mission duration, and flight demonstrations are required to validate the model.
