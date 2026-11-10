import test from 'node:test';
import assert from 'node:assert/strict';
import {createJetHaptics, jetHapticPulse} from '../src/haptics.js';
import {bindControls} from '../src/input.js';
import {WaterWorld} from '../src/physics.js';
const jet = (pressure = .42, extra = {}) => ({ active: true, pressure, volumeRate: pressure, exhausted: false, ...extra });
function fixture({ response = true, unsupported = false, readState, onVibrate = () => {} } = {}) {
  const win = new EventTarget(), doc = new EventTarget(); doc.hidden = false;
  const state = { paused: false, won: false, jetStates: [jet(), jet(0, { active: false })] };
  const calls = [], timers = new Map(); let clock = 0, id = 0;
  const haptics = createJetHaptics({ win, doc, readState: readState ?? (() => state), vibrate: unsupported ? null : value => { calls.push({ at: clock, value }); onVibrate(value, clock); if (response instanceof Error) throw response; return response; }, now: () => clock, schedule: (callback, delay) => { timers.set(++id, { callback, at: clock + delay }); return id; }, cancel: key => timers.delete(key) });
  return { win, doc, state, calls, timers, haptics,
    advance(ms) {
      const target = clock + ms;
      for (let i = 0; i < 1000; i++) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        clock = next[1].at; timers.delete(next[0]); next[1].callback();
        assert.ok(i < 999, 'timer loop must be bounded');
      }
      clock = target;
    }
  };
}
test('pulse timing follows actual outgoing water strength, with stronger duty rather than amplitude claims', () => {
  const weak = jetHapticPulse([jet(.42)]), medium = jetHapticPulse([jet(.7)]), strong = jetHapticPulse([jet(1)]);
  assert.ok(weak.duration < medium.duration && medium.duration < strong.duration);
  assert.ok(weak.duration / weak.interval < medium.duration / medium.interval && medium.duration / medium.interval < strong.duration / strong.interval);
  assert.equal(jetHapticPulse([jet(1, { active: false })]), null);
  assert.equal(jetHapticPulse([jet(1, { exhausted: true })]), null);
  assert.equal(jetHapticPulse([jet(1, { volumeRate: 0 })]), null);
  assert.equal(jetHapticPulse([jet(0, { volumeRate: -1, refilling: true })]), null);
  assert.equal(jetHapticPulse([jet(Infinity), jet(NaN)]), null);
  assert.deepEqual(jetHapticPulse([jet(1, { volumeRate: .2 })]), weak);
});
test('a user gesture arms feedback; repeated key activity and frame updates do not restart each pulse', () => {
  const f = fixture(); f.haptics.update(); assert.equal(f.calls.length, 0);
  f.haptics.activate(); f.haptics.update(); assert.deepEqual(f.calls, [{ at: 0, value: 12 }]);
  for (let i = 0; i < 200; i++) { f.haptics.activate(); f.haptics.update(); }
  assert.equal(f.calls.length, 1); assert.equal(f.timers.size, 1);
  f.advance(160); assert.deepEqual(f.calls.at(-1), { at: 160, value: 12 });
});
test('both buttons share one arbiter; releasing one does not stop the other and last release cancels once', () => {
  const f = fixture(); f.haptics.activate(); f.haptics.update();
  f.state.jetStates[1] = jet(1); f.haptics.activate(); f.haptics.update();
  assert.equal(f.calls.length, 1); assert.equal(f.timers.size, 1);
  f.advance(160); assert.deepEqual(f.calls.at(-1), { at: 160, value: 36 });
  f.state.jetStates[0].active = false; f.win.dispatchEvent(new Event('keyup')); assert.equal(f.calls.length, 2);
  f.advance(2); f.state.jetStates[1].active = false; f.win.dispatchEvent(new Event('pointerup'));
  assert.deepEqual(f.calls.at(-1), { at: 162, value: 0 }); assert.equal(f.timers.size, 0);
  for (let i = 0; i < 200; i++) f.haptics.update();
  f.advance(1000); assert.equal(f.calls.length, 3);
});
test('pressure changes choose the next pulse without overlap or zero/reset spam', () => {
  const f = fixture(); f.haptics.activate(); f.haptics.update();
  f.advance(20); f.state.jetStates[0] = jet(.7); f.haptics.update();
  f.advance(140); assert.deepEqual(f.calls.at(-1), { at: 160, value: 22 });
  f.advance(30); f.state.jetStates[0] = jet(1); f.haptics.update(); f.advance(90);
  assert.deepEqual(f.calls.at(-1), { at: 280, value: 36 });
  f.advance(180);
  assert.ok(f.calls.every(c => c.value > 0));
  for (let i = 1; i < f.calls.length; i++) assert.ok(f.calls[i].at >= f.calls[i - 1].at + f.calls[i - 1].value);
  assert.equal(f.timers.size, 1);
});
test('exhausted, released and refill-only states cannot buzz, even if a held flag remains', () => {
  for (const next of [jet(1, { exhausted: true, held: true }), jet(0, { active: false, held: false, refilling: true, volumeRate: -1 }), jet(1, { active: false, held: true })]) {
    const f = fixture(); f.haptics.activate(); f.haptics.update();
    f.state.jetStates = [next]; f.haptics.update();
    assert.equal(f.calls.at(-1).value, 0); assert.equal(f.timers.size, 0);
    f.advance(1000); assert.equal(f.calls.length, 2);
  }
});
test('pulse timer reads live state and cannot continue a cached held-time oscillator', () => {
  const f = fixture(); f.haptics.activate(); f.haptics.update();
  f.state.jetStates[0].active = false;
  f.advance(1000);
  assert.deepEqual(f.calls, [{ at: 0, value: 12 }]); assert.equal(f.timers.size, 0);
});
test('pause, win, blur, hidden page, reset deactivation and disposal stop and require a new gesture', () => {
  for (const action of ['pause', 'win', 'blur', 'hidden', 'pagehide', 'reset', 'dispose']) {
    const f = fixture(); f.state.jetStates[0] = jet(1); f.haptics.activate(); f.haptics.update(); f.advance(5);
    if (action === 'pause') { f.state.paused = true; f.haptics.update(); f.state.paused = false; }
    else if (action === 'win') { f.state.won = true; f.haptics.update(); f.state.won = false; }
    else if (action === 'hidden') { f.doc.hidden = true; f.doc.dispatchEvent(new Event('visibilitychange')); f.doc.hidden = false; }
    else if (action === 'reset') f.haptics.deactivate();
    else if (action === 'dispose') f.haptics.dispose();
    else f.win.dispatchEvent(new Event(action));
    assert.equal(f.calls.at(-1).value, 0, action); assert.equal(f.timers.size, 0, action);
    f.haptics.update(); f.advance(1000); assert.equal(f.calls.length, 2, action);
    assert.equal(f.haptics.getState().armed, false, action);
    f.haptics.activate(); f.haptics.update();
    assert.equal(f.calls.length, action === 'dispose' ? 2 : 3, action);
    f.haptics.dispose();
  }
});
test('unsupported, throwing and false-returning APIs degrade without retries or timers', () => {
  for (const options of [{ unsupported: true }, { response: false }, { response: new Error('blocked') }]) {
    const f = fixture(options);
    for (let i = 0; i < 200; i++) { f.haptics.activate(); f.haptics.update(); }
    assert.equal(f.calls.length, options.unsupported ? 0 : 1);
    assert.equal(f.timers.size, 0); f.advance(1000); f.haptics.dispose();
  }
});
test('real finite pump pressure produces weak and strong pulses then stops on depletion without changing physics', () => {
  const world = new WaterWorld(42);
  const timeline = [];
  const f = fixture({ readState: () => ({ jetStates: world.jetStates, paused: world.paused, won: world.won }), onVibrate: (value, at) => timeline.push({ requestAtMs: at, durationMs: value, worldSeconds: world.time, pressure: world.jetStates[0].pressure, volumeRate: world.jetStates[0].volumeRate, remaining: world.jetStates[0].remaining }) });
  f.haptics.activate(); world.setJet(0, true); f.haptics.update();
  assert.equal(f.calls.length, 0, 'setJet edge has no discharged water until physics advances');
  for (let i = 0; i < 180; i++) { world.step(1 / 120); f.haptics.update(); f.advance(1000 / 120); }
  const pulses = f.calls.filter(c => c.value > 0);
  assert.equal(pulses[0].value, 12); assert.ok(pulses.some(c => c.value === 36));
  assert.equal(world.jetStates[0].exhausted, true); assert.equal(f.timers.size, 0);
  const count = f.calls.length; world.setJet(0, false);
  for (let i = 0; i < 90; i++) { world.step(1 / 120); f.haptics.update(); f.advance(1000 / 120); }
  assert.equal(f.calls.length, count, 'refill never vibrates');
  assert.ok(world.jetStates[0].remaining > .79);
  console.log(JSON.stringify({ scope: 'Actual WaterWorld finite pump states into a vibration spy, no hardware claim', pulseDurations: pulses.map(c => c.value), timeline, calls: f.calls.length, pumps: world.pumps }));
  f.haptics.dispose();
});

test('real input aggregation releases the last keyboard jet before the single arbiter handles keyup', () => {
  const original = { window: globalThis.window, document: globalThis.document, HTMLInputElement: globalThis.HTMLInputElement };
  const win = new EventTarget(), doc = new EventTarget(); doc.hidden = false;
  const buttons = [0, 1].map(() => Object.assign(new EventTarget(), { disabled: false, classList: { toggle() {} }, setAttribute() {}, setPointerCapture() {} }));
  const world = new WaterWorld(42), calls = [], timers = new Map(); let id = 0, haptics;
  try {
    globalThis.window = win; globalThis.document = doc; globalThis.HTMLInputElement = class {};
    // This is main.js ordering: input listeners before haptic lifecycle listeners.
    bindControls(world, buttons, () => { haptics.activate(); haptics.update(); }, () => haptics.deactivate());
    haptics = createJetHaptics({ win, doc, readState: () => ({ jetStates: world.jetStates, paused: world.paused, won: world.won }), vibrate: value => { calls.push(value); return true; }, now: () => 0, schedule: callback => { timers.set(++id, callback); return id; }, cancel: key => timers.delete(key) });
    win.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyA' }));
    win.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyD' }));
    world.step(1 / 120); haptics.update(); assert.deepEqual(calls, [12]);
    for (let i = 0; i < 50; i++) win.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyA', repeat: true }));
    assert.deepEqual(calls, [12]);
    win.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyA' })); assert.deepEqual(calls, [12]);
    assert.equal(world.jetStates[1].active, true);
    win.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyD' })); assert.deepEqual(calls, [12, 0]);
    assert.equal(timers.size, 0);
  } finally {
    haptics?.dispose();
    for (const [key, value] of Object.entries(original)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
});
test('a real short tap emits only a weak pulse and no refill vibration', () => {
  const world = new WaterWorld(42), timeline = [];
  const f = fixture({ readState: () => ({ jetStates: world.jetStates, paused: world.paused, won: world.won }), onVibrate: (value, at) => timeline.push({ requestAtMs: at, durationMs: value, pressure: world.jetStates[0].pressure, volumeRate: world.jetStates[0].volumeRate }) });
  f.haptics.activate(); world.setJet(0, true);
  for (let i = 0; i < 6; i++) { world.step(1 / 120); f.haptics.update(); f.advance(1000 / 120); }
  world.setJet(0, false); f.haptics.update(); f.advance(1000);
  assert.deepEqual(f.calls.filter(c => c.value > 0).map(c => c.value), [12]);
  assert.equal(f.timers.size, 0);
  console.log(JSON.stringify({ scope: 'Actual 50ms pump press into a vibration spy', timeline }));
  f.haptics.dispose();
});
