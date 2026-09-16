import { describe, it, expect } from 'vitest';
import { DEFAULT_DESIGN } from '../data/competition.js';
import { evaluate, U, densityAtAltitude, flightScore, finalScore, progressionOK, requiredStaticThrust, packing, exportTds } from '../logic/competitionCalcs.js';
const d = (patch={}) => ({ ...structuredClone(DEFAULT_DESIGN), ...patch });
describe('2027 Regular competition model', () => {
  it('uses exact units and independent rectangular geometry', () => { const r=evaluate(d()); expect(U.lb).toBe(0.45359237); expect(r.area).toBeCloseTo(94*18*0.0254**2,12); expect(r.mac).toBeCloseTo(18*0.0254,12); expect(r.payloadKg).toBeCloseTo(10.2*0.45359237,12); });
  it.each([72,96])('rejects strict span endpoint %s', spanIn => expect(evaluate(d({spanIn})).rulesPass).toBe(false));
  it('checks exact chord, body, bottle and prop bounds', () => { for(const patch of [{rootChordIn:4},{lengthIn:120},{emptyBottleLb:1},{emptyBottleLb:4},{filledBottleLb:3.999},{motorCount:4,propDiameterIn:9.01},{batteryMah:2201}]) expect(evaluate(d(patch)).rulesPass).toBe(false); expect(evaluate(d({filledBottleLb:4})).rulesPass).toBe(true); });
  it('withholds missing, nonfinite and fractional inputs', () => { for(const patch of [{spanIn:NaN},{spanIn:Infinity},{spanIn:null},{spanIn:0},{emptyBottles:1.2}]) expect(evaluate(d(patch)).valid).toBe(false); });
  it('closes the lift equation and payload sizing inverse', () => { const r=evaluate(d({mode:'payload'})); expect(r.stall).toBeCloseTo(DEFAULT_DESIGN.stallTarget,10); expect(.5*r.rho*r.stall**2*r.area*r.clmax).toBeCloseTo(r.grossKg*U.g,10); });
  it('uses mass moments for loaded balance', () => { const r=evaluate(d({cgEmptyMac:.2,payloadCgMac:.5})); expect(r.loadedCg).toBeCloseTo((r.emptyKg*.2+r.payloadKg*.5)/r.grossKg,12); });
  it('fails takeoff with no thrust and respects power cap', () => { expect(evaluate(d({staticThrustN:0})).distance).toBe(Infinity); const r=evaluate(d({maxPowerW:100})); expect(r.availableThrust*18).toBeLessThanOrEqual(50); });
  it('handles density and banked stall consistently', () => { expect(densityAtAltitude(0)).toBe(1.225); expect(densityAtAltitude(5000)).toBeLessThan(1.225); const r=evaluate(d({bankDeg:60})); expect(r.turnStall/r.stall).toBeCloseTo(Math.sqrt(2),12); });
  it('sizes thrust against runway, turn, climb and energy', () => { const n=requiredStaticThrust(d()); expect(n).toBeGreaterThan(0); const r=evaluate(d({staticThrustN:n+0.001})); expect(r.feasible).toBe(true); expect(requiredStaticThrust(d({maxPowerW:1}))).toBe(null); });
  it('scores a valid progressive three-flight strategy', () => { expect(flightScore(2,2)).toBe(28); expect(progressionOK({empty:3,filled:0},{empty:2,filled:1})).toBe(true); expect(progressionOK({empty:0,filled:1},{empty:0,filled:2})).toBe(false); const r=finalScore([9,17,25].map((s,i)=>({empty:3-i,filled:i,predicted:s,success:true}))); expect(r.total).toBe(27); });
  it('fits only whole bottle envelopes with clearance', () => { expect(packing(d()).capacity).toBe(4); expect(packing(d({bayHeightIn:4})).capacity).toBe(0); });
  it('withholds invalid flight progression rather than awarding points', () => {
    const r = finalScore([{empty:1,filled:0,predicted:3,success:true},{empty:1,filled:0,predicted:3,success:true}]);
    expect(r.valid).toBe(false); expect(r.total).toBeNull();
    expect(finalScore([{empty:0,filled:0,predicted:0,success:true}]).valid).toBe(false);
  });
  it('does not advance the payload baseline after a failed attempt', () => {
    expect(finalScore([{empty:2,filled:0,predicted:6,success:true},{empty:1,filled:1,predicted:14,success:false},{empty:1,filled:1,predicted:14,success:true}]).valid).toBe(true);
  });
  it('preserves decimal prediction scores and uses the best top-three bonus only', () => {
    const r = finalScore([{empty:3,filled:0,predicted:9,success:true},{empty:2,filled:1,predicted:100,success:true},{empty:1,filled:2,predicted:100,success:true},{empty:0,filled:3,predicted:32.5,success:true}]);
    expect(r.average).toBe(25); expect(r.bonus).toBe(9.75); expect(r.total).toBe(34.75);
  });
  it('neutral point cancels the complete wing-plus-tail pitching derivative', () => {
    const cfg=d(), r=evaluate(cfg), aw=2*Math.PI/(1+2/(cfg.oswald*r.ar));
    const at=2*Math.PI/(1+2/cfg.tailAR);
    const B=cfg.tailEfficiency*at*(1-cfg.downwash)*r.tailArea/r.area;
    const ht=.25+cfg.tailArmIn*U.inch/r.mac;
    expect(aw*(r.neutral-.25)+B*(r.neutral-ht)).toBeCloseTo(0,12);
    expect(aw*(r.loadedCg-.25)+B*(r.loadedCg-ht)).toBeLessThan(0);
  });
  it('derives empty CG from component moments and solves payload placement', () => {
    const cfg=d({balanceMode:'components'}), r=evaluate(cfg);
    const moment=Object.keys(cfg.mass).reduce((sum,key)=>sum+cfg.mass[key]*cfg.massStationsIn[key],0);
    expect(r.emptyCg*r.mac/U.inch).toBeCloseTo(moment/r.emptyBase,12);
    expect((r.emptyKg*r.emptyCg+r.payloadKg*r.payloadTargetMac)/r.grossKg).toBeCloseTo(cfg.targetCgMac,12);
  });
  it('rejects incompatible CG sources, unknown mass items, zero empty mass and unsupported layouts', () => {
    for(const patch of [{balanceMode:'components',emptyMassMode:'measured'},{mass:{...DEFAULT_DESIGN.mass,unknown:100}},{mass:Object.fromEntries(Object.keys(DEFAULT_DESIGN.mass).map(k=>[k,0]))},{planes:2},{loadedVoltage:17},{name:{}}]) expect(evaluate(d(patch)).valid).toBe(false);
  });
  it('never returns NaN energy after an impossible zero-power takeoff', () => {
    const r=evaluate(d({maxPowerW:0})); expect(r.energyWh).toBe(Infinity); expect(r.feasible).toBe(false);
  });
  it('rejects wind-supported zero-ground-speed departure in the rolling model', () => {
    const r=evaluate(d({emptyBottles:1,filledBottles:0,headwindMps:10}));
    expect(r.checks.find(c=>c.name==='Ground-roll model applicability').ok).toBe(false);
  });
  it.each([-3,0,3])('matches an independent time-step ground-run integration at wind %s', wind => {
    const cfg=d({headwindMps:wind}), r=evaluate(cfg); let v=0,x=0,t=0;
    const dt=.0001, target=r.liftoff-wind, W=r.grossKg*U.g;
    while(v<target && t<60) {
      const va=Math.max(0,v+wind), qS=.5*r.rho*va*va*r.area, cl=cfg.groundLiftFraction*r.clmax;
      const T=Math.min(cfg.staticThrustN*r.rho/cfg.thrustTestDensity*Math.max(0,1-(va/cfg.zeroThrustMps)**2),va>0?cfg.efficiency*cfg.maxPowerW/va:Infinity);
      const D=qS*(cfg.cd0+cl*cl/(Math.PI*cfg.oswald*r.ar));
      const acceleration=(T-D-cfg.rollingMu*Math.max(0,W-qS*cl))/r.grossKg;
      x+=v*dt+.5*acceleration*dt*dt; v+=acceleration*dt; t+=dt;
    }
    expect(t).toBeLessThan(60);
    expect(Math.abs((x+target*cfg.rotationSeconds)/r.distance-1)).toBeLessThan(.001);
    expect(Math.abs((t+cfg.rotationSeconds)/r.seconds-1)).toBeLessThan(.001);
  });
  it('exports finite correctly keyed TDS data and rejects missing team number', () => {
    expect(()=>exportTds(d(),0)).toThrow();
    const rows=exportTds(d(),123); expect(rows).toHaveLength(31);
    rows.forEach((row,i)=>{ expect(Object.keys(row)).toEqual(['Team','Den-Alt','Score']); expect(row.Team).toBe(123); expect(row['Den-Alt']).toBe(i*200); expect(Number.isFinite(row.Score)).toBe(true); if(i>0) expect(row.Score).toBeLessThanOrEqual(rows[i-1].Score); });
  });
});
