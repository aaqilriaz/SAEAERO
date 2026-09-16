import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { BASIC_DEFAULTS, calculateBasic } from '../logic/basicCalcs.js';
import { BOTTLE_ESTIMATE } from '../data/competition.js';
import { U } from '../logic/competitionCalcs.js';
import './calculator.css';

const MeetingPlanner = lazy(() => import('./MeetingPlanner.jsx'));
const fmt = (n, digits = 1) => Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };

function Icon({ name, ...props }) {
  const paths = {
    plane: <><path d="m12 3 2 7 7 5v2l-8-2v5l2 1H9l2-1v-5l-8 2v-2l7-5 2-7Z"/></>,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5"/></>,
    wing: <><path d="m3 16 18-9-2 11H3v-2Z"/><path d="m9 13 1 5m5-8 1 8"/></>,
    weight: <><path d="M8 7H5L3 21h18L19 7h-3"/><circle cx="12" cy="6" r="4"/></>,
    bottle: <><path d="M9 2h6v4l3 5v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9l3-5V2Z"/><path d="M9 5h6M6 13h12M6 18h12"/></>,
    thrust: <><path d="M3 8h7m-5 4h9M3 16h7m6-10 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>,
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] ?? paths.info}</svg>;
}

function NumberField({ id, label, value, onChange, unit, hint, error, min, max, step = 1, counter = false }) {
  const number = Number.isFinite(value) ? value : '';
  const adjust = direction => onChange(Math.min(max, Math.max(min, (Number.isFinite(value) ? value : min) + direction * step)));
  return <div className={`basic-field ${error ? 'has-error' : ''}`}>
    <label htmlFor={id}>{label}</label>
    <div className={`number-control ${counter ? 'counter' : ''}`}>
      {counter && <button type="button" aria-label={`Remove one ${label.toLowerCase()}`} disabled={number !== '' && value <= min} onClick={() => adjust(-1)}>−</button>}
      <input id={id} type="number" inputMode={step === 1 ? 'numeric' : 'decimal'} value={number} min={min} max={max} step={step} aria-invalid={!!error} aria-describedby={`${id}-help`} onChange={e => onChange(e.target.value === '' ? NaN : Number(e.target.value))}/>
      {unit && <span>{unit}</span>}
      {counter && <button type="button" aria-label={`Add one ${label.toLowerCase()}`} disabled={number !== '' && value >= max} onClick={() => adjust(1)}>+</button>}
    </div>
    <p id={`${id}-help`} className={error ? 'field-error' : 'field-help'}>{error || hint}</p>
  </div>;
}

function WingSketch({ design, result }) {
  const chord = Math.min(140, result.root / U.inch * 5);
  const width = design.spanIn * 4.7;
  return <svg className="wing-sketch" viewBox="0 0 560 215" role="img" aria-label={`Rectangular wing concept, ${fmt(design.spanIn)} inch span and ${fmt(result.root / U.inch)} inch front-to-back chord. Not a construction drawing.`}>
    <defs><pattern id="basic-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="currentColor" strokeWidth=".5"/></pattern></defs>
    <rect width="560" height="215" fill="url(#basic-grid)" className="sketch-grid"/>
    <line x1="280" y1="25" x2="280" y2="200" className="sketch-datum" strokeDasharray="4 6"/>
    <path d="M280 50c-11 0-13 13-13 24v85l8 27h10l8-27V74c0-11-2-24-13-24Z" className="sketch-body"/>
    <rect x={280-width/2} y={90-chord/4} width={width} height={chord} rx="2" className="sketch-wing"/>
    {Array.from({ length: 15 }, (_, i) => <line key={i} x1={280-width/2+(i+1)*width/16} x2={280-width/2+(i+1)*width/16} y1={90-chord/4} y2={90+chord*.75} className="sketch-rib"/>)}
    {Array.from({ length: design.motorCount }, (_, i) => {
      const x = 280 + (i - (design.motorCount-1)/2) * width/(design.motorCount+1);
      return <g key={i} className="sketch-motor"><rect x={x-5} y={75-chord/4} width="10" height="25" rx="4"/><line x1={x-design.propDiameterIn*2.35} x2={x+design.propDiameterIn*2.35} y1={75-chord/4} y2={75-chord/4}/></g>;
    })}
    <path d={`M${280-width/2} 27v10H${280+width/2}v-10`} className="sketch-datum" fill="none"/>
    <text x="280" y="25" textAnchor="middle">{fmt(design.spanIn, 0)} in wingspan</text>
    <circle cx="280" cy="90" r="4" className="sketch-center"/>
    <text x="16" y="201">TOP VIEW · WING CONCEPT</text><text x="544" y="201" textAnchor="end">{fmt(result.root/U.inch)} in chord</text>
  </svg>;
}

function CargoSketch({ count, filled, bay }) {
  const visible = Math.min(count, 12);
  return <div className="cargo-sketch" role="img" aria-label={`${count} bottles lying lengthwise, ${bay.columns} across and ${bay.rows} rows. One layer.`}>
    <div className="cargo-grid" style={{ gridTemplateColumns: `repeat(${bay.columns}, 1fr)` }}>
      {Array.from({ length: visible }, (_, i) => <div key={i} className={`cargo-bottle ${i < filled ? 'filled' : ''}`}><Icon name="bottle"/><span>{i < filled ? 'Filled' : 'Light'}</span></div>)}
    </div>
    {count > visible && <span className="cargo-extra">+ {count-visible} more bottles</span>}
  </div>;
}

const issueText = {
  'Gross mass': 'The loaded aircraft exceeds the 55 lb limit. Reduce payload or empty weight.',
  'Minimum chord': 'The calculated wing is too narrow for the 4 in minimum. Set a larger chord in Advanced.',
  'Cargo fit': 'This two-across bottle layout is longer than the assumed fuselage. Reduce the bottle count or change the layout in Advanced.',
  'Battery energy': 'This mission needs more energy than the standard battery provides with reserve. Reduce weight or review flight duration in Advanced.',
  'Battery current': 'The power estimate exceeds the assumed battery current rating. Check your power setup in Advanced.',
  'Empty and loaded CG': 'The balance estimate needs review. Check aircraft and payload positions in Advanced.',
  'Takeoff margin': 'The estimate misses the runway target. Reduce weight or review propulsion in Advanced.',
  'Turn stall margin': 'The assumed cruise speed leaves too little margin in a turn. Review flight speed in Advanced.',
  'Climb target': 'The power setup does not meet the estimated climb target. Reduce weight or review propulsion.',
};

export default function Calculator() {
  const [mode, setMode] = useState('basic');
  const [basic, setBasic] = useState(() => ({ ...BASIC_DEFAULTS, ...read('sae-basic-2027-v2', {}) }));
  const [advanced, setAdvanced] = useState(() => read('sae-design-2027-v1', null));
  const [advancedRevision, setAdvancedRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const plan = useMemo(() => calculateBasic(basic), [basic]);
  const set = (key, value) => setBasic(old => ({ ...old, [key]: value }));
  useEffect(() => { if (!write('sae-basic-2027-v2', basic)) setNotice('Browser saving is unavailable. Use Download estimate to keep a copy.'); }, [basic]);

  function openAdvanced(copyBasic = false) {
    if ((copyBasic || !advanced) && plan.valid) {
      // Transfer the exact solved wing and targets; keep geometry fixed for subsequent studies.
      const next = { ...plan.design, mode: 'wing', rootChordIn: plan.result.root/U.inch };
      setAdvanced(next);
      write('sae-design-2027-v1', next);
      setAdvancedRevision(n => n + 1);
    }
    setMode('advanced');
    setNotice(copyBasic ? 'Basic estimate copied to Advanced. You can now adjust every assumption.' : '');
  }
  function downloadEstimate() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: '2027.0', basicInputs: basic, design: plan.design, estimate: { wingAreaM2: plan.result.area, chordIn: plan.result.root/U.inch, requiredStaticThrustN: plan.minimumN, targetStaticThrustN: plan.targetN, targetPerMotorKgf: plan.targetPerMotorKgf }, notes: 'Preliminary estimate. Bottle envelope is estimated; required thrust assumes the stated 900 W power limit and thrust curve.' }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'flight-lab-estimate.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const { result: r, design: d } = plan;
  const unresolved = plan.valid && plan.targetN === null;
  return <div className="calculator">
    <header className="calc-header">
      <a className="calc-brand" href="#" onClick={e => { e.preventDefault(); setMode('basic'); }} aria-label="Flight Lab home"><span className="calc-brand-icon"><Icon name="plane"/></span><span>flight<span className="brand-light">lab</span><small>SAE AERO DESIGN</small></span></a>
      <div className="view-switch" role="group" aria-label="Calculator mode"><button aria-pressed={mode === 'basic'} onClick={() => { setMode('basic'); setNotice(''); }}>Basic<span>Start here</span></button><button aria-pressed={mode === 'advanced'} onClick={() => openAdvanced()}>Advanced<span>All controls</span></button></div>
      <a className="rulebook-link" href="/rules-2027.pdf" target="_blank" rel="noreferrer">2027 rulebook <span>↗</span></a>
    </header>
    {notice && <div className="calc-notice" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
    {mode === 'advanced' ? <Suspense fallback={<div className="loading-workspace">Opening advanced controls…</div>}><MeetingPlanner key={advancedRevision} initialDesign={advanced} onDesignChange={setAdvanced}/></Suspense> : <main className="basic-main">
      <div className="basic-heading"><div><span className="calc-eyebrow"><span/> REGULAR CLASS / 2027</span><h1>Start with the payload.</h1><p>Choose your bottles. Get a wing size and a thrust target.</p></div><span className="simple-tag">5 inputs. We’ll handle the rest.</span></div>
      <div className="basic-layout">
        <section className="setup-card" aria-labelledby="setup-title">
          <div className="setup-heading"><span className="section-number">01</span><div><h2 id="setup-title">Your aircraft</h2><p>Estimates are fine to start.</p></div></div>
          <div className="payload-fields">
            <div className="bottle-input light-bottle"><div className="bottle-type"><Icon name="bottle"/><span>3 points each</span></div><NumberField id="light-bottles" label="Light bottles" counter value={basic.emptyBottles} onChange={v => set('emptyBottles', v)} min={0} max={120} error={plan.errors.emptyBottles} hint="1.05 lb each · SAE ‘empty’"/></div>
            <div className="bottle-input filled-bottle"><div className="bottle-type"><Icon name="bottle"/><span>11 points each</span></div><NumberField id="filled-bottles" label="Filled bottles" counter value={basic.filledBottles} onChange={v => set('filledBottles', v)} min={0} max={120} error={plan.errors.filledBottles} hint="4.05 lb each · SAE ‘filled’"/></div>
          </div>
          <p className="bottle-explainer">Both are 2 L bottles. “Light” still needs ballast—the rules require it to weigh over 1 lb.</p>
          <div className="setup-divider"/>
          <NumberField id="basic-span" label="Wingspan" value={basic.spanIn} onChange={v => set('spanIn', v)} unit="in" min={72.1} max={95.9} step={0.1} error={plan.errors.spanIn} hint="Tip to tip. Rules: over 72 in and under 96 in."/>
          <NumberField id="basic-weight" label="Aircraft weight without bottles" value={basic.emptyKg} onChange={v => set('emptyKg', v)} unit="kg" min={0.1} max={24} step={0.1} error={plan.errors.emptyKg} hint="Include motors, batteries and everything ready to fly. 3 kg is a starting estimate."/>
          <NumberField id="basic-prop" label="Propeller diameter" value={basic.propDiameterIn} onChange={v => set('propDiameterIn', v)} unit="in" min={1} max={12} step={0.5} error={plan.errors.propDiameterIn} hint="Tip to tip, per motor. Maximum 12 inches for two motors."/>
          <div className="hardware-defaults"><span>2 motors</span><span>4S · 2,200 mAh</span></div>
          <div className="auto-note"><Icon name="check"/><p><strong>Already taken care of</strong>Your twin-motor setup, 2 L bottles, 1 mm packing gap and flight assumptions. Props up to 12″ are allowed.</p></div>
          <div className="setup-bottom"><span><i/> Updates as you type</span><button className="text-button" onClick={() => setBasic({ ...BASIC_DEFAULTS })}>Reset</button></div>
        </section>
        <div className="basic-results" id="estimate">
          {!plan.valid ? <section className="result-empty" role="status"><Icon name="info" width="32" height="32"/><h2>A quick adjustment first</h2><p>{plan.errors.calculation || 'Check the highlighted inputs. Your estimate will appear here as soon as they’re ready.'}</p></section> : <>
            <section className={`thrust-card ${unresolved ? 'thrust-unresolved' : ''}`} aria-labelledby="thrust-title">
              <div className="result-topline"><span><Icon name="thrust"/> PROPULSION TARGET</span><span className="estimate-pill">Estimated</span></div>
              <h2 id="thrust-title">{unresolved ? 'This load needs a different power setup.' : 'Aim for this much thrust.'}</h2>
              {unresolved ? <p className="unresolved-copy">The standard 900 W setup cannot meet the runway, turn and climb targets. Try fewer filled bottles or less aircraft weight, or adjust the power setup in Advanced.</p> : <>
                <div className="thrust-numbers"><div><strong data-testid="total-thrust">{fmt(plan.targetN/U.g)}<small>kgf</small></strong><span>total static thrust</span></div><span className="thrust-separator">/</span><div className="per-motor"><strong data-testid="motor-thrust">{fmt(plan.targetPerMotorKgf)}<small>kgf</small></strong><span>per motor × {d.motorCount}</span></div></div>
                <p className="thrust-explanation">Static thrust is the push measured with the plane held still. <strong>kgf is force, not motor weight.</strong></p>
                <div className="thrust-footnote"><span>Calculated minimum: {fmt(plan.minimumN/U.g, 2)} kgf / {fmt(plan.minimumN)} N</span><span>Target adds 15% + rounding</span></div>
              </>}
              <p className="power-assumption">Assumes 900 W total electrical power and the default thrust curve. Prop diameter sets the size limit; it does not predict available thrust. Confirm with motor and propeller tests.</p>
            </section>
            <div className="core-results">
              <section className="result-card wing-result"><div className="result-label"><Icon name="wing"/> WING SIZE</div><div className="result-value" data-testid="wing-area">{fmt(r.area, 2)} <small>m²</small></div><p>{fmt(d.spanIn, 0)}″ wide × <strong>{fmt(r.root/U.inch)}″ front to back</strong></p><span className="result-help">The wing area needed for this weight.</span></section>
              <section className="result-card"><div className="result-label"><Icon name="weight"/> LOADED WEIGHT</div><div className="result-value" data-testid="loaded-weight">{fmt(r.grossKg, 2)} <small>kg</small></div><p>{fmt(r.emptyKg, 1)} kg aircraft + <strong>{fmt(r.payloadKg, 2)} kg cargo</strong></p><span className="result-help">{fmt(r.grossKg/U.lb, 1)} lb of the 55 lb rule limit.</span></section>
            </div>
            {(unresolved || plan.issues.length > 0) && <section className="basic-issues" aria-label="Estimate needs attention"><h3><Icon name="info"/> {unresolved ? 'Review the power setup' : 'A few things to resolve'}</h3>{plan.issues.map(c => <p key={c.name}>{issueText[c.name] || c.detail}</p>)}{unresolved && <p>Wing size and weight are still shown. Takeoff and battery results are withheld until a suitable power setup is found.</p>}<button className="text-button" onClick={() => openAdvanced(true)}>Review this estimate in Advanced <Icon name="arrow"/></button></section>}
            <section className="concept-card"><div className="concept-heading"><h2>Your wing, at a glance</h2><span>Selig S1223 · rectangular wing</span></div><WingSketch design={d} result={r}/><div className="flight-strip"><div><span>Stall speed estimate</span><strong>{fmt(r.stall)} <small>m/s</small></strong></div><div><span>Takeoff at thrust target</span><strong>{unresolved ? 'Unresolved' : fmt(r.distance/U.foot, 0)} {!unresolved && <small>ft / 100 ft</small>}</strong></div><div><span>Potential flight score</span><strong>{r.score} <small>points</small></strong></div></div></section>
          </>}
        </div>
      </div>
      {plan.valid && <>
        <section className="packing-card"><div className="packing-copy"><span className="calc-eyebrow">02 / BOTTLE PACKING</span><h2>A snug fit, figured out.</h2><p>Estimated 2 L Sprite-style bottles, lying lengthwise in one layer. Just a 1 mm gap between bottles.</p><div className="bay-dimensions"><strong>{fmt(plan.bay.bayLengthIn, 2)} × {fmt(plan.bay.bayWidthIn, 2)} × {fmt(plan.bay.bayHeightIn, 2)} <small>in</small></strong><span>clear length × width × height</span></div><p className="packing-note">{plan.bay.columns} across × {plan.bay.rows} rows. This is the bottle envelope; allow extra room for walls and restraints. Check fit with real bottles and keep them removable within 60 seconds.</p></div><CargoSketch count={d.emptyBottles+d.filledBottles} filled={d.filledBottles} bay={plan.bay}/></section>
        <details className="basic-assumptions"><summary><span><Icon name="info"/> What’s being assumed?</span><span>View defaults <span className="disclosure-arrow">⌄</span></span></summary><div className="assumption-content"><p>These are starting estimates for a conventional-tail monoplane. Changing the payload resizes the wing while keeping your entered empty weight fixed.</p><dl><div><dt>Bottle envelope</dt><dd>{BOTTLE_ESTIMATE.lengthIn}″ long × {BOTTLE_ESTIMATE.diameterIn}″ diameter; estimated, not manufacturer specifications.</dd></div><div><dt>Bottle mass</dt><dd>Light: 1.05 lb. Filled: 4.05 lb, including the bottle and contents. These are scoring-weight targets, not automatically a full bottle of water.</dd></div><div><dt>Wing & flight</dt><dd>Selig S1223, effective maximum lift coefficient 1.68. 10 m/s stall target, 18 m/s cruise, 25° turns.</dd></div><div><dt>Field & runway</dt><dd>1,500 ft density altitude, no wind, level runway. Design target: airborne within 85 ft of the 100 ft limit.</dd></div><div><dt>Power & batteries</dt><dd>900 W total, 50% propulsive efficiency, 32 m/s zero-thrust speed. 4S 2,200 mAh LiPo; 20% energy reserve; separate 1,000 mAh receiver battery.</dd></div><div><dt>Mission & balance</dt><dd>2 minutes airborne. CG assumed at 25% of wing chord; verify actual empty and loaded balance. Structural strength and landing distance are not calculated.</dd></div></dl><p>Thrust is specified at 1.225 kg/m³ test density. A calculated target does not establish that a particular motor and propeller can deliver it.</p><button className="secondary-button" onClick={() => openAdvanced(true)}>Customize this estimate <Icon name="arrow"/></button></div></details>
        <div className="estimate-actions"><p>Planning estimates. Confirm weight, balance, propulsion and bottle fit on the actual aircraft.</p><button className="secondary-button" onClick={downloadEstimate}>Download estimate <span>↓</span></button></div>
      </>}
      <footer className="calc-footer"><span>FLIGHT LAB <span>/</span> BUILT FOR THE TEAM</span><span>Basic uses standard estimates. Advanced keeps your custom setup.</span></footer>
    </main>}
  </div>;
}
