# Handoff — SAE Aero Design 2027 calculator

Updated 2026-09-16 21:25 UTC. The requested redesign is DEPLOYED and verified.

## Production
- Public URL: https://sae-aero-calculator.vercel.app
- Deployment ID: dpl_8fjsznBkDTBvSC86Afnc2JrGTGzX
- Deployment URL: https://sae-aero-calculator-67thou64f-aaqilgaming2-2525s-projects.vercel.app
- Existing password and one-hour session behavior retained.
- Earlier Not authorized error resolved by refreshing the link to the existing project and specifying the accessible team explicitly. No project migration or new account needed.

## Verification
- npm.cmd test: 297 tests passed, 9 files (24 competition tests).
- npm.cmd run build: passed. Vercel production build: READY and aliased.
- Public-site Chromium checks passed: wrong/right password, complete PDF download (HTTP 200 and PDF signature), all tabs, invalid/strict-boundary inputs, wing/payload modes, save/load/persistence, component CG editing, invalid flight-plan rejection, TDS graph and JSON download, mobile input controls. No page errors or horizontal mobile overflow.
- Independent time-step takeoff calculation agrees within 0.1% with velocity-domain quadrature for wind -3, 0 and +3 m/s. This verifies numerical consistency, not physical-model accuracy.
- git diff --check: passed.

## What changed
Read all supplied 57-page rules text including all classes/appendices and checked rendered Regular dimension/scoring pages. App targets Regular Class because its bottle mission matches the user's request. Full source PDF served at /rules-2027.pdf.

New engine src/logic/competitionCalcs.js: exact units; strict rules; integer bottle scoring/progression; trapezoid wing area/MAC; fixed-mass inverse wing sizing; density-altitude/viscosity; banked stall/drag; power-capped assumed thrust curve; numerical runway model; climb/current/mission energy; bottle envelope packing; conventional tail sizing; component mass moments; corrected total-wing-plus-tail neutral point; payload location to reach chosen CG; inverse static thrust; bottle mix enumeration; monotonic draft TDS.

New UI src/components/MeetingPlanner.jsx and planner.css: complete dashboard, mobile controls, editable inputs/mass/CG, airfoil-span trade table/chart, scenarios, JSON import/export, print, flight strategy, rule checks/manual checklist, TDS graph/export, math transparency. App.jsx preserves LockScreen and mounts new UI. Legacy engines remain on disk but are not used by the new app.

## Model limits to preserve in any follow-up
- No guarantee of flight readiness or complete physical rules compliance.
- Section Clmax, installation factor, aircraft CD0, thrust speed dependence and efficiencies are planning assumptions unless independently validated. Airfoil comparisons vary section Clmax only and explicitly do not rank real drag/trim performance.
- Monoplane/conventional-tail only; reject unsupported imports. Unswept quarter-chord geometry.
- Wing/payload sizing and geometry sweeps hold the entered empty mass fixed; revise structural estimates after geometry changes.
- Neutral point includes both wing and tail lift slopes, but no fuselage/propulsion moments or trim. An aft-CG bound is NOT a flight-tested CG recommendation. Default chosen CG is a user-editable assumption.
- Component positions use MAC leading edge as datum. Contingency mass has the same CG as the base empty budget.
- Takeoff uses flat runway, assumed constant ground CL and rotation-time allowance; no gust, slope, ground effect, rotation dynamics, trim, actual landing-distance or structural/servo/flutter solution.
- Mission energy: ground run, up to 20 seconds full-power climb, remaining airborne duration at design-bank power. User sets duration and usable reserve fraction.
- Inverse static thrust searches 0–500 N at the entered test density and fixed installed power. No solution does not mean thrust alone can cure deficient power/energy.
- Bottle packing is one rectangular usable bay, uniform orientation, conservative rectangular grid; door/restraint/unload access is manual.
- Invalid flight plans withhold aggregate totals. Fewer than three successes use zero score slots, explicitly flagged for organizer confirmation.
- TDS output is a draft; conservative non-increasing scores correspond to actual passing model mixes. Required stand-alone one-page graph/explanation still needs team/school details and test evidence.

## Environment and commands
PowerShell; rg unavailable. Build/browser tools need sandbox escalation on this Windows installation.
Vercel CLI: $env:LOCALAPPDATA/npm-cache/_npx/69f9afb961c37556/node_modules/vercel/dist/index.js
Deployment: node <CLI> deploy --prod --yes --scope aaqilgaming2-2525s-projects --project sae-aero-calculator
Browser check: node artifacts/browser-check.cjs. Set TEST_URL to production for live verification. Script uses locally cached Playwright; artifacts are ignored.
Vercel link created .env.local (ignored); never print or publish it. .vercelignore excludes tool caches, artifacts, docs, environment files and duplicate root PDF, while retaining public/rules-2027.pdf.
Local dev server from this session: port 5173, exec session 24516.

No git commit made. Preexisting changes (.gitignore, src/autoSize.js, docs/rules-2027.txt, src/data/competition.js, original PDF) were preserved and extended where appropriate.
