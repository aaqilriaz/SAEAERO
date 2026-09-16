import { useMemo, useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { DEFAULT_DESIGN, FOILS, MASS_LABELS, MANUAL_CHECKS } from '../data/competition.js';
import { evaluate, candidates, requiredStaticThrust, U, finalScore, progressionOK, exportTds } from '../logic/competitionCalcs.js';
import './planner.css';

const fmt = (n, digits = 1) => Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
const fresh = () => structuredClone(DEFAULT_DESIGN);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
function download(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Field({ label, value, onChange, unit, step = 0.1, min, max }) {
  return <label className="field"><span>{label}</span><div><input type="number" value={value == null || Number.isNaN(value) ? '' : value} step={step} min={min} max={max} onChange={e => onChange(e.target.value === '' ? NaN : Number(e.target.value))} /><em>{unit}</em></div></label>;
}
function Select({ label, value, onChange, options }) {
  return <label className="field select"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}
function Metric({ label, value, unit, detail }) { return <div className="metric"><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{detail}</p></div>; }
function CheckList({ items }) { return <div className="checks">{items.map(c => <div key={c.name} className={c.ok ? 'check good' : 'check bad'}><b>{c.ok ? '✓' : '×'}</b><div><strong>{c.name}</strong><p>{c.detail}</p></div><small>{c.ref}</small></div>)}</div>; }
function Drawing({ d, r }) {
  const scale = Math.min(500 / d.spanIn, 240 / d.lengthIn);
  const b = d.spanIn * scale, root = r.root / U.inch * scale, tip = r.tip / U.inch * scale;
  const tailB = Math.sqrt(r.tailArea * d.tailAR) / U.inch * scale;
  const tailC = r.tailArea / Math.sqrt(r.tailArea * d.tailAR) / U.inch * scale;
  const tailY = 90 + d.tailArmIn * scale;
  const cg = 90 + (r.loadedCg - 0.25) * r.mac / U.inch * scale;
  return <svg className="aircraft" viewBox="0 0 600 340" role="img" aria-label="Scaled preliminary wing and conventional tail planform; packaging is schematic">
    <defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#dfe8e4" strokeWidth=".6" /></pattern></defs>
    <rect width="600" height="340" fill="url(#grid)" />
    <line x1="300" y1="10" x2="300" y2="325" stroke="#8ca49a" strokeDasharray="5 5" />
    <rect x={300 - d.bayWidthIn * scale / 2} y="55" width={d.bayWidthIn * scale} height={d.lengthIn * scale} rx="15" fill="#e5eee9" stroke="#557365" />
    <path d={`M ${300-b/2} ${90-tip/4} L 300 ${90-root/4} L ${300+b/2} ${90-tip/4} L ${300+b/2} ${90+tip*0.75} L 300 ${90+root*0.75} L ${300-b/2} ${90+tip*0.75} Z`} fill="#bddecf" fillOpacity=".9" stroke="#127a5a" strokeWidth="1.5" />
    <rect x={300-tailB/2} y={tailY-tailC/4} width={tailB} height={tailC} fill="#bddecf" stroke="#127a5a" />
    {[...Array(d.motorCount)].map((_, i) => { const x = 300 + (i - (d.motorCount-1)/2) * b / (d.motorCount+1); return <g key={i}><rect x={x-4} y={65-root/4} width="8" height="24" rx="3" fill="#234e3c"/><line x1={x-d.propDiameterIn*scale/2} x2={x+d.propDiameterIn*scale/2} y1={65-root/4} y2={65-root/4} stroke="#234e3c" strokeWidth="2" /></g>; })}
    <circle cx="300" cy={cg} r="5" fill="#ec9a43" stroke="#744711"/><text x="312" y={cg+4} className="svglabel">Loaded CG</text>
    <path d={`M ${300-b/2} 20 V 30 H ${300+b/2} V 20`} fill="none" stroke="#567264"/><text x="300" y="22" textAnchor="middle" className="svglabel">{fmt(d.spanIn)} in span</text>
    <text x="20" y="315" className="svglabel">PLAN VIEW / CONCEPT ONLY</text><text x="580" y="315" textAnchor="end" className="svglabel">S = {fmt(r.area, 3)} m²</text>
  </svg>;
}

export default function MeetingPlanner() {
  const [d, setD] = useState(() => { const saved = read('sae-design-2027-v1', {}); return { ...fresh(), ...saved, mass: { ...DEFAULT_DESIGN.mass, ...saved.mass }, massStationsIn: { ...DEFAULT_DESIGN.massStationsIn, ...saved.massStationsIn } }; });
  const [tab, setTab] = useState('design');
  const [mobileInputs, setMobileInputs] = useState(false);
  const [saved, setSaved] = useState(() => read('sae-scenarios-2027-v1', []));
  const [notice, setNotice] = useState('');
  const [team, setTeam] = useState(1);
  const [tds, setTds] = useState(null);
  const [flights, setFlights] = useState(() => read('sae-flights-2027-v1', [
    { empty: 3, filled: 0, predicted: 9, success: true }, { empty: 2, filled: 1, predicted: 17, success: true }, { empty: 1, filled: 2, predicted: 25, success: true },
  ]));
  const [manual, setManual] = useState(() => read('sae-checks-2027-v1', {}));
  useEffect(() => { try { localStorage.setItem('sae-design-2027-v1', JSON.stringify(d)); } catch { setNotice('Browser storage unavailable. Export your design to keep it.'); } }, [d]);
  useEffect(() => { try { localStorage.setItem('sae-scenarios-2027-v1', JSON.stringify(saved)); } catch {} }, [saved]);
  useEffect(() => { try { localStorage.setItem('sae-flights-2027-v1', JSON.stringify(flights)); localStorage.setItem('sae-checks-2027-v1', JSON.stringify(manual)); } catch {} }, [flights, manual]);
  useEffect(() => setTds(null), [d, team]);
  const r = useMemo(() => evaluate(d), [d]);
  const wingDesign = useMemo(() => ({ ...d, mode: 'wing', rootChordIn: r.valid ? r.root / U.inch : d.rootChordIn }), [d, r]);
  const mixes = useMemo(() => r.valid ? candidates(wingDesign) : [], [wingDesign, r.valid]);
  const thrustNeed = useMemo(() => r.valid ? requiredStaticThrust(d) : null, [d, r.valid]);
  const best = mixes.find(x => x.result.feasible);
  const foil = FOILS.find(f => f.id === d.airfoil) ?? FOILS[0];
  const set = (key, value) => setD(old => ({ ...old, [key]: value }));
  const field = (key, label, unit, step = 0.1) => <Field key={key} label={label} value={d[key]} unit={unit} step={step} onChange={v => set(key, v)} />;
  const select = (key, label, options, numeric = false) => <Select label={label} value={d[key]} options={options} onChange={v => set(key, numeric ? Number(v) : v)} />;
  const changeMode = mode => setD({ ...d, mode, rootChordIn: r.valid ? r.root / U.inch : d.rootChordIn });
  const save = () => { if (!r.valid) return; setSaved([...saved, { id: Date.now(), design: structuredClone(d) }]); setNotice('Scenario saved on this browser. Export JSON to share it.'); };
  const applyMix = row => { setD({ ...wingDesign, emptyBottles: row.empty, filledBottles: row.filled }); setTab('design'); };
  const trades = useMemo(() => {
    if (!r.valid || tab !== 'trades') return [];
    return [74, 80, 86, 90, 94, 95.5].map(spanIn => {
      const row = { spanIn };
      FOILS.filter(f => f.id !== 'CUSTOM').forEach(f => {
        const draft = { ...wingDesign, spanIn, airfoil: f.id, sectionCl: f.cl };
        const c = candidates(draft).find(x => x.result.feasible);
        row[f.id] = c?.result.score ?? null; row[f.id + '_candidate'] = c; row[f.id + '_design'] = draft;
      });
      return row;
    });
  }, [wingDesign, r.valid, tab]);
  const scoring = finalScore(flights);
  const failed = r.valid ? r.checks.filter(c => !c.ok) : [];
  return <div className="planner">
    <header className="topbar"><a className="brand" href="#"><span className="brandmark">↗</span><div>FLIGHT LAB<small>SAE AERO DESIGN / 2027</small></div></a><div className="top-actions"><span className="class-pill">REGULAR CLASS · v2027.0</span><button onClick={() => window.print()}>Print brief</button><button className="primary" onClick={save} disabled={!r.valid}>+ Save scenario</button></div></header>
    <div className="workspace">
      <button className="mobile-config" onClick={() => setMobileInputs(!mobileInputs)}>{mobileInputs ? 'Close configuration controls' : 'Edit aircraft & mission inputs'}</button>
      <aside className={`inputs ${mobileInputs ? 'mobile-open' : ''}`}>
        <div className="input-heading"><span className="eyebrow">DESIGN WORKSPACE</span><input aria-label="Configuration name" className="design-name" value={d.name} onChange={e => set('name', e.target.value)} /><p>Change an input. Every result updates.</p></div>
        <div className="mode-toggle"><button className={d.mode === 'wing' ? 'active' : ''} onClick={() => changeMode('wing')}>Start with wing size</button><button className={d.mode === 'payload' ? 'active' : ''} onClick={() => changeMode('payload')}>Start with bottles</button></div>
        <details open><summary><b>01</b> Mission & bottles</summary><div className="fields">
          {field('emptyBottles', 'Empty bottles', 'count', 1)}{field('filledBottles', 'Filled bottles', 'count', 1)}
          {field('emptyBottleLb', 'Each empty bottle', 'lb', 0.01)}{field('filledBottleLb', 'Each filled bottle', 'lb', 0.01)}
          <p className="hint">“Empty” is a scoring category: gross bottle mass must be &gt;1 and &lt;4 lb. Filled is ≥4 lb. Use actual bottle + contents mass.</p>
          {field('stallTarget', 'Target stall speed', 'm/s')}{field('missionMinutes', 'Airborne duration', 'min')}
        </div></details>
        <details open><summary><b>02</b> Wing & airfoil</summary><div className="fields">
          {field('spanIn', 'Planform span', 'in')}
          {d.mode === 'wing' ? field('rootChordIn', 'Root chord', 'in') : <div className="solved"><span>Solved root chord</span><strong>{r.valid ? fmt(r.root / U.inch, 2) : '—'} in</strong></div>}
          {field('taper', 'Tip / root chord', 'ratio', 0.05)}{field('lengthIn', 'Body length', 'in')}
          <Select label="Airfoil candidate" value={d.airfoil} options={FOILS.map(f => [f.id, f.name])} onChange={id => setD({ ...d, airfoil: id, sectionCl: FOILS.find(f => f.id === id).cl })}/>
          {field('sectionCl', 'Section Cl,max', '', 0.05)}{field('clFactor', 'Installation factor', '', 0.05)}
          <p className="hint">{foil.note} <a href={foil.source} target="_blank" rel="noreferrer">Source ↗</a></p>
          {field('cd0', 'Aircraft parasite CD₀', '', 0.005)}{field('oswald', 'Oswald efficiency', '', 0.05)}
          {select('structure', 'Airframe construction', [['wood', 'Wood / unreinforced materials'], ['frp', 'FRP / carbon / fiberglass (prohibited)']])}
          <p className="hint">Conventional-tail monoplane model. Total aircraft drag coefficient uses wing planform area. Material choice does not predict structural strength.</p>
        </div></details>
        <details><summary><b>03</b> Mass budget</summary><div className="fields">
          {select('emptyMassMode', 'Empty mass source', [['budget', 'Component budget'], ['measured', 'Measured / independently estimated']])}
          {d.emptyMassMode === 'budget' ? Object.entries(MASS_LABELS).map(([key, label]) => <Field key={key} label={label} unit="kg" step={0.01} value={d.mass[key]} onChange={value => setD({ ...d, mass: { ...d.mass, [key]: value } })} />) : field('measuredEmptyKg', 'Empty aircraft', 'kg', 0.01)}
          {field('massGrowth', 'Mass contingency fraction', '', 0.05)}
          <p className="hint">Includes both batteries, all motors, wiring, doors and restraints. Set contingency to 0 for a complete weighed aircraft. Geometry changes do not silently change your mass estimate.</p>
        </div></details>
        <details><summary><b>04</b> Cargo packaging</summary><div className="fields">
          {field('bayLengthIn', 'Usable bay length', 'in')}{field('bayWidthIn', 'Usable bay width', 'in')}{field('bayHeightIn', 'Usable bay height', 'in')}
          {field('bottleLengthIn', 'Bottle overall length', 'in')}{field('bottleDiameterIn', 'Bottle maximum diameter', 'in')}{field('bottleClearanceIn', 'Between-bottle clearance', 'in')}
          <p className="hint">Rectangular, single-bay grid estimate with three orientations. Enter usable dimensions after structure and restraints. Door access and one-minute unloading need a physical demonstration.</p>
        </div></details>
        <details><summary><b>05</b> Propulsion & batteries</summary><div className="fields">
          {select('motorCount', 'Number of motors', [[2, '2 motors'], [4, '4 motors']], true)}{field('propDiameterIn', 'Propeller diameter', 'in')}
          {field('staticThrustN', 'TOTAL static thrust', 'N')}{field('maxPowerW', 'TOTAL electrical input', 'W', 10)}
          {field('thrustTestDensity', 'Thrust-test air density', 'kg/m³', 0.01)}{field('zeroThrustMps', 'Zero-thrust airspeed', 'm/s')}{field('efficiency', 'Electrical → useful propulsive', '', 0.05)}
          <label className="toggle"><input type="checkbox" checked={d.propulsionMeasured} onChange={e => set('propulsionMeasured', e.target.checked)}/>Static thrust and power measured on this setup</label>
          <p className="hint">Enter combined values for every motor. Quadratic thrust falloff is an assumption even with static tests; validate against speed-dependent propeller data.</p>
          {field('batteryCells', 'LiPo series cells', 'S', 1)}{field('batteryMah', 'Propulsion capacity', 'mAh', 50)}{field('batteryC', 'Battery current rating', 'C', 1)}{field('loadedVoltage', 'Loaded pack voltage', 'V')}{field('usableBattery', 'Usable energy fraction', '', 0.05)}{field('driveRatio', 'Prop / motor RPM ratio', '', 0.1)}
          {field('receiverMah', 'Receiver battery', 'mAh', 50)}{select('receiverChemistry', 'Receiver chemistry', [['LiFe', 'LiFe'], ['LiPo', 'LiPo'], ['other', 'Other (fails rules)']])}
          <label className="toggle"><input type="checkbox" checked={d.separateReceiver} onChange={e => set('separateReceiver', e.target.checked)}/>Separate receiver battery</label>
        </div></details>
        <details><summary><b>06</b> Conditions & margins</summary><div className="fields">
          {field('densityAltitudeFt', 'Density altitude', 'ft', 100)}{field('temperatureC', 'Air temperature (viscosity)', '°C', 1)}{field('cruiseMps', 'Cruise airspeed', 'm/s')}{field('bankDeg', 'Design turn bank', 'deg', 1)}{field('headwindMps', 'Headwind (+) / tailwind (−)', 'm/s')}
          {field('rollingMu', 'Rolling friction coefficient', '', 0.01)}{field('liftoffFactor', 'Liftoff / stall speed', '', 0.05)}{field('groundLiftFraction', 'Ground CL / CL,max', '', 0.05)}{field('rotationSeconds', 'Rotation allowance', 's')}
          {field('runwayMargin', 'Usable 100 ft runway fraction', '', 0.05)}{field('minClimbMps', 'Minimum climb target', 'm/s')}{field('minCruiseFactor', 'Cruise / banked stall margin', '', 0.05)}
          <p className="hint">Density comes from ISA density altitude; temperature only affects viscosity. Positive wind reduces ground speed, not required liftoff airspeed. No guaranteed takeoff distance.</p>
        </div></details>
        <details><summary><b>07</b> Tail & balance</summary><div className="fields">
          {field('tailArmIn', 'Wing AC → tail AC', 'in')}{field('horizontalVolume', 'Horizontal tail volume', '', 0.05)}{field('verticalVolume', 'Vertical tail volume', '', 0.005)}{field('tailAR', 'Horizontal-tail aspect ratio', '', 0.1)}{field('tailEfficiency', 'Tail dynamic-pressure ratio', '', 0.05)}{field('downwash', 'Downwash gradient', '', 0.05)}
          {select('balanceMode', 'Empty CG source', [['entered', 'Enter measured / estimated empty CG'], ['components', 'Calculate from component positions']])}
          {d.balanceMode !== 'components' && field('cgEmptyMac', 'Empty CG / MAC from LE', '', 0.01)}{field('payloadCgMac', 'Payload CG / MAC from LE', '', 0.01)}{field('targetCgMac', 'Chosen loaded CG target / MAC', '', 0.01)}{field('minStaticMargin', 'Minimum static margin', '', 0.01)}
          {d.balanceMode === 'components' && <><p className="hint">Use component-budget mass mode. Enter each component CG in inches aft of the wing MAC leading edge; negative is forward. Default positions are examples, not a verified arrangement.</p>{Object.entries(MASS_LABELS).map(([key, label]) => <Field key={key} label={`${label} CG position`} unit="in" value={d.massStationsIn?.[key] ?? DEFAULT_DESIGN.massStationsIn[key]} onChange={value => setD({ ...d, massStationsIn: { ...DEFAULT_DESIGN.massStationsIn, ...d.massStationsIn, [key]: value } })}/>)}</>}
          <p className="hint">Both CG locations use the same MAC leading-edge datum. Tail-volume sizing and neutral point are first-order estimates; aerodynamic moments and trim are not solved.</p>
        </div></details>
        <div className="input-footer"><button onClick={() => { setD(fresh()); setNotice('Baseline restored. Saved scenarios retained.'); }}>Restore baseline</button><button onClick={() => download('sae-design-2027.json', { version: '2027.0', design: d })}>Export inputs</button><label className="import-label">Import inputs<input type="file" accept=".json" onChange={async e => { try { const obj = JSON.parse(await e.target.files[0].text()); const next = { ...fresh(), ...obj.design, mass: { ...DEFAULT_DESIGN.mass, ...obj.design?.mass }, massStationsIn: { ...DEFAULT_DESIGN.massStationsIn, ...obj.design?.massStationsIn } }; const result = evaluate(next); if (!result.valid) throw new Error(result.errors.join(' ')); setD(next); setNotice('Configuration imported.'); } catch (err) { setNotice(`Import failed: ${err.message}`); } e.target.value = ''; }}/></label></div>
      </aside>
      <main>
        <div className="page-heading"><div><span className="eyebrow">PRELIMINARY DESIGN / MEETING EDITION</span><h1>Build the mission.<br/><span>Then size the aircraft.</span></h1><p>Compare the bottles you can carry, the wing they need, and the margins that matter.</p></div><div className="rule-stamp"><strong>72 &lt; span &lt; 96</strong><span>inches · 2027 Regular Class</span><small>2 or 4 motors / 4S / ≤2200 mAh</small></div></div>
        <nav className="tabs">{[['design', 'Design overview'], ['trades', 'Trade study'], ['flights', 'Flight strategy'], ['rules', 'Rules & checklist'], ['math', 'Math & assumptions']].map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
        {notice && <div className="notice" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
        {!r.valid ? <div className="panel invalid"><h2>Fix inputs to calculate</h2><p>Results are withheld while inputs are missing or invalid.</p>{r.errors.map(e => <p key={e}>{e}</p>)}</div> : <>
          <div className={`status-banner ${r.feasible ? 'passing' : ''}`}><span className="status-dot"/><div><strong>{r.feasible ? 'Passes the selected preliminary checks' : `${failed.length} ${failed.length === 1 ? 'constraint needs' : 'constraints need'} attention`}</strong><p>{r.feasible ? 'A candidate for validation; flight readiness and complete rules compliance remain unverified.' : failed.map(c => c.name).join(' · ')}</p></div><span className="estimate">MODEL ESTIMATE</span></div>
          {tab === 'design' && <>
            <div className="metrics"><Metric label="Bottle mission" value={`${d.emptyBottles} + ${d.filledBottles}`} unit="E / F" detail={`${fmt(r.payloadKg, 2)} kg payload · ${fmt(r.payloadKg / U.lb, 2)} lb`}/><Metric label="Potential single-flight score" value={r.score} unit="pts" detail="3 × empty + 11 × filled; successful flight required"/><Metric label="Wing planform area" value={fmt(r.area, 3)} unit="m²" detail={`${fmt(r.area / U.inch ** 2, 0)} in² · AR ${fmt(r.ar, 2)}`}/><Metric label="Loaded takeoff mass" value={fmt(r.grossKg, 2)} unit="kg" detail={`${fmt(r.emptyKg, 2)} kg empty including contingency`}/></div>
            <section className="panel"><span className="eyebrow">PROPULSION &amp; BALANCE TARGETS</span><h2>What this configuration needs</h2><div className="detail-grid"><div><span>Total static thrust at test density</span><b>{thrustNeed === null ? 'No solution below 500 N' : `${fmt(thrustNeed)} N / ${fmt(thrustNeed/U.g, 2)} kgf`}</b></div><div><span>Static thrust per motor</span><b>{thrustNeed === null ? 'Review power and energy' : `${fmt(thrustNeed/d.motorCount)} N`}</b></div><div><span>Minimum useful electrical power in flight</span><b>{fmt(Math.max(r.turnPower, r.climbThrustRequired*r.climbSpeed/d.efficiency), 0)} W total</b></div><div><span>Empty / loaded CG</span><b>{fmt(r.emptyCg*100)} / {fmt(r.loadedCg*100)} % MAC</b></div><div><span>Your chosen loaded CG target</span><b>{fmt(r.targetCg*100)} % MAC</b></div><div><span>Payload CG needed for that target</span><b>{r.payloadTargetMac === null ? 'No payload' : `${fmt(r.payloadTargetMac*r.mac/U.inch, 2)} in aft of MAC LE`}</b></div></div><p className="hint">Static-thrust search holds your installed {fmt(d.maxPowerW,0)} W power limit and thrust-curve shape fixed, and checks takeoff, turn, climb, current and mission energy. Search range is 0-500 N total at {fmt(d.thrustTestDensity,3)} kg/m³ test density. The in-flight power lower bound does not size the ground run. Your chosen CG target is an input, not an automatically approved balance point. Verify cargo placement, trim and both loading cases.</p>{r.targetCg > r.aftCgLimit && <p className="warning-note">Your chosen CG target is aft of the model's static-margin limit.</p>}</section><div className="overview-grid"><section className="panel drawing-panel"><div className="panel-heading"><div><span className="eyebrow">CONFIGURATION</span><h2>{foil.name} / monoplane</h2></div><span className="tag">{d.mode === 'payload' ? 'Payload → wing' : 'Wing → payload'}</span></div><Drawing d={d} r={r}/><div className="drawing-stats"><span>Root <b>{fmt(r.root / U.inch, 2)} in</b></span><span>Tip <b>{fmt(r.tip / U.inch, 2)} in</b></span><span>MAC <b>{fmt(r.mac / U.inch, 2)} in</b></span></div></section>
              <section className="panel"><span className="eyebrow">MISSION MARGINS</span><h2>What limits this design?</h2><div className="margin-list">{[
                ['Takeoff estimate', `${fmt(r.distance / U.foot)} ft`, `${100*d.runwayMargin} ft model target / 100 ft rule`, r.distance <= 100*U.foot*d.runwayMargin],
                ['Stall / turn stall', `${fmt(r.stall)} / ${fmt(r.turnStall)} m/s`, `${fmt(d.cruiseMps)} m/s cruise airspeed`, d.cruiseMps >= r.turnStall*d.minCruiseFactor],
                ['Mission energy', `${fmt(r.energyWh)} / ${fmt(r.usableWh)} Wh`, 'Required / usable with reserve', r.energyWh <= r.usableWh],
                ['Initial climb', `${fmt(r.climb)} m/s`, `${fmt(d.minClimbMps)} m/s target`, r.climb >= d.minClimbMps],
                ['Bottle positions', `${d.emptyBottles+d.filledBottles} / ${r.pack.capacity}`, `${r.pack.counts.join(' × ')} grid, ${r.pack.axis}`, d.emptyBottles+d.filledBottles <= r.pack.capacity],
              ].map(([label, value, detail, ok]) => <div key={label}><span>{label}<small>{detail}</small></span><strong className={ok ? 'positive' : 'negative'}>{value}</strong></div>)}</div></section></div>
            <section className="panel"><div className="panel-heading"><div><span className="eyebrow">SAME AIRCRAFT / DIFFERENT CARGO</span><h2>Choose a bottle mix</h2><p>Ranked by score after every modeled check. Uses this wing, empty mass, bay and power system.</p></div>{best && <button onClick={() => applyMix(best)}>Use best modeled mix ↗</button>}</div>{!best && <p className="warning-note">No bottle mix passes all current checks. Review power, wing, mass and mission assumptions.</p>}<div className="table-scroll"><table><thead><tr><th>Empty / filled</th><th>Payload</th><th>Score</th><th>Takeoff</th><th>Energy</th><th>Model result</th><th/></tr></thead><tbody>{mixes.slice(0, 8).map(row => <tr key={`${row.empty}-${row.filled}`}><td><b>{row.empty} E + {row.filled} F</b></td><td>{fmt(row.result.payloadKg, 2)} kg</td><td>{row.result.score}</td><td>{fmt(row.result.distance/U.foot)} ft</td><td>{fmt(row.result.energyWh)} Wh</td><td><span className={row.result.feasible ? 'positive' : 'negative'}>{row.result.feasible ? 'Candidate' : row.result.checks.filter(c => !c.ok).map(c => c.name).join(', ')}</span></td><td><button onClick={() => applyMix(row)}>Apply</button></td></tr>)}</tbody></table></div><p className="hint">The search includes every integer mix that fits this grid and the gross-weight limit, up to 120 bottles. “Candidate” means model checks pass, not that the aircraft is cleared to fly.</p></section>
            <section className="panel"><h2>Performance & balance</h2><div className="detail-grid">{[['Minimum total static thrust (model)', thrustNeed === null ? 'No solution in 0-500 N range' : fmt(thrustNeed) + ' N / ' + fmt(thrustNeed / U.g, 2) + ' kgf'], ['Per-motor static thrust target', thrustNeed === null ? 'Unresolved' : fmt(thrustNeed / d.motorCount) + ' N'], ['Straight / turn thrust required', fmt(r.cruiseDrag) + ' / ' + fmt(r.turnDrag) + ' N'], ['Climb thrust required', fmt(r.climbThrustRequired) + ' N at ' + fmt(r.climbSpeed) + ' m/s'], ['Aft CG limit (model, validate trim)', fmt(r.aftCgLimit * 100) + ' % MAC'], ['Loaded CG distance from MAC LE', fmt(r.loadedCg * r.mac / U.inch, 2) + ' in'], ['Empty stall', `${fmt(r.emptyStall)} m/s`], ['Lift / drag at cruise', fmt(r.ld, 2)], ['Cruise electrical power', `${fmt(r.cruisePower, 0)} W`], ['Wing loading', `${fmt(r.grossKg/r.area, 2)} kg/m²`], ['Reynolds at cruise', fmt(r.reynolds, 0)], ['Horizontal tail area', `${fmt(r.tailArea, 3)} m²`], ['Vertical tail area', `${fmt(r.finArea, 3)} m²`], ['Empty / loaded static margin', `${fmt(r.emptySM*100)} / ${fmt(r.loadedSM*100)} %`], ['Loaded CG from MAC LE', `${fmt(r.loadedCg*100)} % MAC`], ['1g wing-root bending estimate', `${fmt(r.rootBendingNm)} N·m`]].map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div><p className="hint">Bending assumes uniform span loading without wing inertial relief; multiply by design load factor and validate the spar. Static margin does not establish trim or control authority.</p></section>
          </>}
          {tab === 'trades' && <>
            <section className="panel"><span className="eyebrow">SPAN × AIRFOIL × BOTTLES</span><h2>Find the useful design space</h2><p>Maximum modeled bottle score at each span, holding root chord, taper, empty mass, cargo bay and propulsion fixed. Airfoil changes only its assumed section Cl,max; this does not rank their actual drag or trim performance. Re-estimate structural mass and drag before selecting a design.</p><div className="chart"><ResponsiveContainer width="100%" height={300}><LineChart data={trades}><CartesianGrid strokeDasharray="3 3" stroke="#e1e7e2"/><XAxis dataKey="spanIn" label={{ value: 'Planform span (in)', position: 'insideBottom', offset: -2 }} height={45}/><YAxis label={{ value: 'Single-flight score', angle: -90, position: 'insideLeft' }}/><Tooltip/><Legend/>{FOILS.filter(f => f.id !== 'CUSTOM').map((f, i) => <Line key={f.id} name={f.name} dataKey={f.id} stroke={['#137a58', '#b07627', '#4764b5', '#9a547e'][i]} strokeWidth={2} connectNulls={false} />)}</LineChart></ResponsiveContainer></div><p className="hint">A gap means no passing mix under these assumptions. These are sampled spans, not a global optimum.</p><div className="table-scroll"><table><thead><tr><th>Span</th>{FOILS.filter(f => f.id !== 'CUSTOM').map(f => <th key={f.id}>{f.name}</th>)}</tr></thead><tbody>{trades.map(row => <tr key={row.spanIn}><td>{row.spanIn} in</td>{FOILS.filter(f => f.id !== 'CUSTOM').map(f => <td key={f.id}>{row[f.id] === null ? 'No candidate' : <button onClick={() => { const c = row[f.id+'_candidate']; setD({ ...row[f.id+'_design'], emptyBottles: c.empty, filledBottles: c.filled }); setTab('design'); }}>{row[f.id]} pts · {row[f.id+'_candidate'].empty}E/{row[f.id+'_candidate'].filled}F ↗</button>}</td>)}</tr>)}</tbody></table></div></section>
            <section className="panel"><h2>Saved scenarios</h2><p>Save any configuration for your meeting comparison. Stored on this browser.</p><div className="table-scroll"><table><thead><tr><th>Configuration</th><th>Wing</th><th>Bottles</th><th>Score</th><th>Takeoff</th><th>Model</th><th/></tr></thead><tbody>{saved.map(s => { const x = evaluate(s.design); return <tr key={s.id}><td>{s.design.name}</td><td>{s.design.spanIn} in / {fmt(x.area, 2)} m²</td><td>{s.design.emptyBottles}E + {s.design.filledBottles}F</td><td>{x.score ?? '—'}</td><td>{fmt(x.distance/U.foot)} ft</td><td>{x.feasible ? 'Candidate' : 'Review'}</td><td><button onClick={() => { setD(s.design); setTab('design'); }}>Load</button> <button aria-label={`Delete ${s.design.name}`} onClick={() => setSaved(saved.filter(a => a.id !== s.id))}>×</button></td></tr>; })}</tbody></table></div>{saved.length === 0 && <p className="empty-state">Your comparison starts with “Save scenario”.</p>}</section>
          </>}
          {tab === 'flights' && <>
            <section className="panel"><span className="eyebrow">PROGRESSIVE PAYLOAD</span><h2>Plan your scored flights</h2>{!scoring.valid && <div className="warning-note" role="alert">Score withheld: {scoring.errors.join(" ")}</div>}<p>After a successful score, add empty bottles and/or replace existing empty bottles with filled bottles. Total count cannot decrease. Failed attempts do not advance the baseline.</p><div className="table-scroll"><table><thead><tr><th>Attempt</th><th>Empty</th><th>Filled</th><th>TDS prediction at flight DA</th><th>Scored?</th><th>Flight score</th><th>Progression</th></tr></thead><tbody>{flights.map((f, i) => { const prev = flights.slice(0, i).filter(a => a.success).at(-1); const ok = !prev || progressionOK(prev, f); return <tr key={i}><td>{i+1}</td>{['empty', 'filled', 'predicted'].map(key => <td key={key}><input aria-label={`Flight ${i+1} ${key}`} type="number" min="0" step={key === 'predicted' ? '0.1' : '1'} value={f[key]} onChange={e => { const value = Math.max(0, key === 'predicted' ? (Number(e.target.value) || 0) : Math.trunc(Number(e.target.value) || 0)); setFlights(flights.map((a, j) => j === i ? { ...a, [key]: value } : a)); }}/></td>)}<td><input aria-label={`Flight ${i+1} successful`} type="checkbox" checked={f.success} onChange={e => setFlights(flights.map((a, j) => j === i ? { ...a, success: e.target.checked } : a))}/></td><td>{f.success ? 3*f.empty+11*f.filled : 0}</td><td className={ok ? 'positive' : 'negative'}>{ok ? 'Allowed' : 'Invalid increase'}</td></tr>; })}</tbody></table></div><button onClick={() => setFlights([...flights, { empty: 1, filled: 0, predicted: 0, success: false }])}>+ Add attempt</button><div className="metrics scoring"><Metric label="Top-three average" value={fmt(scoring.average, 2)} unit="pts" detail="Missing scored flights use zero slots"/><Metric label="Best prediction bonus" value={fmt(scoring.bonus, 2)} unit="pts" detail="max(10 − (FS − PS)², 0) across top three"/><Metric label="Planned flight total" value={fmt(scoring.total, 2)} unit="pts" detail="Does not validate flight success or hardware"/></div><p className="warning-note">Illustrative flight plan. Invalid payload progression or bottle counts withhold the total. Flight success and actual hardware capability still require verification. Confirm treatment of fewer than three successful flights with officials.</p></section>
            <section className="panel tds-panel"><span className="eyebrow">TECHNICAL DATA SHEET / §4.5</span><h2>Draft density-altitude prediction</h2><p>Freeze this aircraft and compare the best passing bottle mix from 0 to 6000 ft density altitude. The exported JSON uses the exact required keys: Team, Den-Alt, Score.</p><Field label="Team number" value={team} onChange={setTeam} step={1}/><div className="tds-actions"><button onClick={() => { try { setTds(exportTds(wingDesign, team)); } catch (e) { setNotice(e.message); } }}>Generate prediction graph</button><button onClick={() => { try { const data = exportTds(wingDesign, team); setTds(data); download('draft-tds-2027.json', data); setNotice('Draft TDS exported. Validate predictions and prepare the required stand-alone page before submission.'); } catch (e) { setNotice(e.message); } }}>Export draft TDS JSON</button></div>{tds && <><h3>Team {team}: Maximum predicted flight score</h3><div className="chart"><ResponsiveContainer width="100%" height={300}><LineChart data={tds}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="Den-Alt" tickFormatter={v => Number(v).toFixed(0)} label={{ value: 'Density altitude (ft)', position: 'insideBottom', offset: -2 }} height={45}/><YAxis label={{ value: 'Flight score (points)', angle: -90, position: 'insideLeft' }}/><Tooltip/><Line type="stepAfter" dataKey="Score" stroke="#127453" dot={false} strokeWidth={2}/></LineChart></ResponsiveContainer></div><p>Method: {fmt(d.spanIn)} in span, {fmt(r.root/U.inch,2)} in root chord, {fmt(r.emptyKg,2)} kg planning empty mass, {fmt(d.staticThrustN)} N measured/assumed static thrust and {fmt(d.maxPowerW,0)} W electrical limit. At each 200 ft step, enumerate integer bottle mixes, enforce entered rule limits, then check stall, runway, turn, climb, CG, current, energy and cargo space. Headwind is held at {fmt(d.headwindMps)} m/s. To produce a conservative non-increasing prediction, each score must be achievable at that altitude and no greater than the preceding value.</p></>}<p className="hint">Draft for engineering review. Zero means no modeled candidate. Confirm with flight tests and official interpretations. Add team/school names and a defensible test-supported explanation to the required one-page stand-alone document; this workspace printout is not a submission-ready TDS.</p></section>
          </>}
          {tab === 'rules' && <>
            <section className="panel"><span className="eyebrow">SUPPLIED RULEBOOK / VERSION 2027.0</span><h2>Rules that can be checked numerically</h2><p>Based on the supplied complete 57-page PDF. These checks cover entered values; physical inspection and official interpretations remain necessary.</p><CheckList items={r.checks.filter(c => c.kind === 'rule')}/><a className="source-link" href="/rules-2027.pdf" target="_blank" rel="noreferrer">Open the complete supplied rulebook ↗</a></section>
            <section className="panel"><h2>Team verification checklist</h2><p>{Object.values(manual).filter(Boolean).length} / {MANUAL_CHECKS.length} marked by the team. These boxes record your review and do not certify compliance.</p>{MANUAL_CHECKS.map(([title, text, ref, page]) => <label key={title} className="manual-item"><input type="checkbox" checked={!!manual[title]} onChange={e => setManual({ ...manual, [title]: e.target.checked })}/><div><strong>{title}</strong><p>{text}</p><a href={`/rules-2027.pdf#page=${page+8}`} target="_blank" rel="noreferrer">{ref} · printed p. {page} ↗</a></div></label>)}<p className="hint">Regular design report/TDS/drawing deadlines in this edition: East February 1, 2027; West March 8, 2027. Registration lottery interest: September 16–30, 2026. Verify organizer announcements for updates.</p></section>
          </>}
          {tab === 'math' && <>
            <section className="panel"><span className="eyebrow">TRANSPARENT CALCULATION</span><h2>Equations, units and limits</h2><p>All calculations use unrounded SI values internally. Inches and pounds are converted with exact factors; display rounding never determines a rule check.</p><div className="equations">{[
              ['Geometry', 'S = b(cr + ct)/2; AR = b²/S; MAC = (2cr/3)(1 + λ + λ²)/(1 + λ)', `${fmt(r.area,4)} m² area / ${fmt(r.mac,4)} m MAC`],
              ['Mass and score', 'm = mempty(1 + contingency) + 0.45359237(EB·lbE + FB·lbF); FS = 3EB + 11FB', `${fmt(r.grossKg,4)} kg / ${r.score} potential points`],
              ['Lift and stall', 'CLmax = section Clmax × installation factor; Vs = √(2mg / ρSCLmax)', `ρ = ${fmt(r.rho,4)} kg/m³; CLmax = ${fmt(r.clmax,3)}`],
              ['Payload-first sizing', 'Srequired = 2mg / (ρ Vtarget² CLmax)', `${fmt(r.requiredArea,4)} m² at fixed entered empty mass`],
              ['Drag and bank', 'D = qS·CD₀ + (nW)²/(qS·πeAR); q = ρV²/2; n = 1/cos(bank)', `${fmt(r.cruiseDrag,3)} N straight-flight drag; n = ${fmt(r.loadFactor,3)}`],
              ['Available thrust', 'T(V) = min[Tstatic·(ρ/ρtest)·max(0, 1 − (V/Vzero)²), ηPelectric/V]', `${fmt(r.availableThrust,3)} N at cruise; assumed speed dependence`],
              ['Takeoff integration', 'F = T − D − μmax(W − L, 0); dx/dvground = m·vground/F; dt/dvground = m/F', '240 midpoint intervals + rotation time × liftoff ground speed; nonpositive force fails'],
              ['Power and climb', 'Pelectric = D·V/η; climb = (T − D)V/W at selected climb speed', `${fmt(r.cruisePower,2)} W straight cruise / ${fmt(r.climb,2)} m/s climb`],
              ['Energy', 'Eusable = Vloaded·Ah·usableFraction; Ereq = [Pmax(tground + tclimb) + Pturn·tremaining]/3600', 'Up to 20 s climb at full input power; remaining mission at design-bank power'],
              ['Tail sizing', 'Sh = Vh·S·MAC/lh; Sv = Vv·S·b/lv', 'Horizontal and vertical moment arms assumed equal'],
              ['CG and stability', 'xCG = sum(m*x)/sum(m); hNP = (aw*0.25 + B*htail)/(aw + B); B = etaTail*at*(1 - downwash)*Sh/S; SM = hNP - hCG', 'htail = 0.25 + tailArm/MAC. Total wing + tail lift slope included. Fuselage/propulsion moments and trim omitted'],
              ['Prediction bonus', 'FFS = (top FS1 + FS2 + FS3)/3 + max_top3[max(10 − (FS − PS)², 0)]', 'Use each flight’s prediction at the density altitude measured for that flight'],
            ].map(([label, equation, note]) => <div key={label}><strong>{label}</strong><code>{equation}</code><p>{note}</p></div>)}</div><p className="hint">Aerodynamic foundations: <a href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/" target="_blank" rel="noreferrer">NASA drag equation</a> · <a href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/modern-drag-equation/" target="_blank" rel="noreferrer">NASA induced drag</a> · <a href="https://courses.cit.cornell.edu/mae5070/mae5070texterrata.html" target="_blank" rel="noreferrer">Cornell stability formulation</a> ? <a href="https://m-selig.ae.illinois.edu/uiuc_lsat.html" target="_blank" rel="noreferrer">UIUC low-speed airfoil tests</a>.</p></section>
            <section className="panel"><h2>Model checks</h2><CheckList items={r.checks.filter(c => c.kind === 'model')}/></section>
          </>}
          <section className="assumptions"><strong>Before choosing a configuration</strong><ul>{r.warnings.map(w => <li key={w}>{w}</li>)}</ul></section>
        </>}
        <footer>FLIGHT LAB · SAE AERO DESIGN 2027 · Preliminary design support · Team retains all design decisions</footer>
      </main>
    </div>
  </div>;
}
