import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_GRAVITY, motionGravity, orientationGravity, toScreenGravity, calibrationBasis, calibratedGravity, normalizeGravity, smoothGravity, createGravityInput } from '../src/gravity-input.js';
const close = (actual, expected, epsilon = 1e-7) => {
  for (const key of ['x', 'y', 'z']) assert.ok(Math.abs(actual[key] - expected[key]) < epsilon, `${key}: ${actual[key]} vs ${expected[key]}`);
};
const unit = v => assert.ok(Math.abs(Math.hypot(v.x, v.y, v.z) - 1) < 1e-8);
function fixture({ permission = false, motion = true, orientation = true, secure = true } = {}) {
  const win = new EventTarget(), screen = new EventTarget(); screen.angle = 0;
  Object.assign(win, { isSecureContext: secure, screen: { orientation: screen } });
  const calls = [], timers = new Map(), outputs = [], states = [];
  let clock = 0, timerId = 0;
  for (const name of [motion && 'DeviceMotionEvent', orientation && 'DeviceOrientationEvent'].filter(Boolean)) {
    win[name] = class {};
    if (permission) win[name].requestPermission = () => { calls.push(name); return Promise.resolve('granted'); };
  }
  const listeners = new Map();
  const add = win.addEventListener.bind(win), remove = win.removeEventListener.bind(win);
  win.addEventListener = (type, listener) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); add(type, listener); };
  win.removeEventListener = (type, listener) => { listeners.get(type)?.delete(listener); remove(type, listener); };
  const input = createGravityInput({ win, now: () => clock, onDirection: v => outputs.push(v), onState: s => states.push(s), schedule: callback => { timers.set(++timerId, callback); return timerId; }, cancel: id => timers.delete(id) });
  return { win, screen, calls, outputs, states, timers, input, listeners,
    event(type, props, advance = 16.67) { clock += advance; win.dispatchEvent(Object.assign(new Event(type), props)); },
    motion(v, advance = 16.67) { this.event('devicemotion', { accelerationIncludingGravity: v }, advance); },
    timeout() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } }
  };
}
test('specific-force sign fixtures: face-up, upright, right, left, front and back', () => {
  const fixtures = [
    [{ x: 0, y: 0, z: 9.81 }, { x: 0, y: 0, z: -1 }],
    [{ x: 0, y: 9.81, z: 0 }, DEFAULT_GRAVITY],
    [{ x: -6, y: 8, z: 0 }, { x: .6, y: -.8, z: 0 }],
    [{ x: 6, y: 8, z: 0 }, { x: -.6, y: -.8, z: 0 }],
    [{ x: 0, y: 8, z: 6 }, { x: 0, y: -.8, z: -.6 }],
    [{ x: 0, y: 8, z: -6 }, { x: 0, y: -.8, z: .6 }]
  ];
  for (const [accelerationIncludingGravity, expected] of fixtures) close(normalizeGravity(motionGravity({ accelerationIncludingGravity })), expected);
});
test('orientation fallback follows gravity projection Rz(alpha)Rx(beta)Ry(gamma)', () => {
  close(orientationGravity({ beta: 0, gamma: 0 }), { x: 0, y: 0, z: -1 });
  close(orientationGravity({ beta: 90, gamma: 0 }), DEFAULT_GRAVITY);
  close(orientationGravity({ beta: 0, gamma: 30 }), { x: .5, y: 0, z: -Math.sqrt(.75) });
  close(orientationGravity({ beta: 0, gamma: -30 }), { x: -.5, y: 0, z: -Math.sqrt(.75) });
  close(orientationGravity({ beta: 60, gamma: 0 }), { x: 0, y: -Math.sqrt(.75), z: -.5 });
  close(orientationGravity({ beta: 120, gamma: 0 }), { x: 0, y: -Math.sqrt(.75), z: .5 });
  close(orientationGravity({ alpha: 175, beta: 90, gamma: 0 }), DEFAULT_GRAVITY);
});
test('screen-angle fixtures give displayed down in all orientations', () => {
  for (const [angle, v] of [[0, { x: 0, y: -1, z: 0 }], [90, { x: -1, y: 0, z: 0 }], [-90, { x: 1, y: 0, z: 0 }], [180, { x: 0, y: 1, z: 0 }]]) close(toScreenGravity(v, angle), DEFAULT_GRAVITY);
  close(toScreenGravity({ x: 0, y: -1, z: 0 }, 90), { x: 1, y: 0, z: 0 });
});
test('comfort calibration maps arbitrary neutral down and retains orthonormal axes', () => {
  for (const neutral of [{ x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: -1 }, { x: .3, y: -.7, z: -.5 }, { x: 1, y: 0, z: 0 }]) {
    const basis = calibrationBasis(neutral); close(calibratedGravity(neutral, basis), DEFAULT_GRAVITY);
    close(calibratedGravity(basis.right, basis), { x: 1, y: 0, z: 0 });
    close(calibratedGravity(basis.depth, basis), { x: 0, y: 0, z: 1 });
  }
});
test('invalid, null and unsupported readings are ignored; normalization is overflow safe', () => {
  for (const v of [null, {}, { x: null, y: 1, z: 0 }, { x: Infinity, y: 0, z: 1 }, { x: NaN, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }]) assert.equal(normalizeGravity(v), null);
  for (const v of [null, {}, { x: null, y: 9.81, z: 0 }, { x: 50, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }]) assert.equal(motionGravity({ accelerationIncludingGravity: v }), null);
  assert.equal(orientationGravity({ beta: null, gamma: 0 }), null);
  unit(normalizeGravity({ x: Number.MAX_VALUE, y: -Number.MAX_VALUE, z: 2 }));
  unit(orientationGravity({ beta: 1e20, gamma: -1e20 }));
});
test('angular smoothing is bounded, unit length and traverses antipodal directions', () => {
  let direction = DEFAULT_GRAVITY;
  for (let i = 0; i < 200; i++) {
    const next = smoothGravity(direction, { x: 0, y: 1, z: 0 }, 1 / 60);
    unit(next); assert.ok(Math.acos(Math.min(1, direction.x * next.x + direction.y * next.y + direction.z * next.z)) <= 1.8 / 60 + 1e-8); direction = next;
  }
  assert.ok(direction.y > .999);
});
test('default preference on auto-attaches without permission requests; valid reading activates', () => {
  const f = fixture(); assert.equal(f.input.getState().enabled, true); assert.equal(f.input.getState().active, false); assert.equal(f.calls.length, 0);
  f.motion({ x: 0, y: 9.81, z: 0 }); assert.equal(f.input.getState().active, true); close(f.outputs.at(-1), DEFAULT_GRAVITY);
  for (let i = 0; i < 100; i++) f.motion({ x: -5, y: 8, z: 0 });
  assert.ok(f.outputs.at(-1).x > .5); unit(f.outputs.at(-1));
});
test('permission is only requested on explicit call, both calls occur synchronously', async () => {
  const f = fixture({ permission: true }); assert.equal(f.input.getState().state, 'permission'); assert.equal(f.calls.length, 0); assert.equal(f.listeners.get('devicemotion')?.size ?? 0, 0);
  f.input.enable(); assert.equal(f.calls.length, 0);
  const pending = f.input.requestAccess(); assert.deepEqual(f.calls, ['DeviceMotionEvent', 'DeviceOrientationEvent']);
  assert.equal(f.input.requestAccess(), pending); await pending;
  assert.equal(f.input.getState().active, false); f.motion({ x: 0, y: 9.81, z: 0 }); assert.equal(f.input.getState().active, true);
});
test('repeated enabling does not duplicate listeners', () => {
  const f = fixture(); f.input.enable(); f.input.enable(); assert.equal(f.listeners.get('devicemotion').size, 1); assert.equal(f.listeners.get('deviceorientation').size, 1);
  f.input.disable(); assert.equal(f.listeners.get('devicemotion').size, 0); f.input.enable(); assert.equal(f.listeners.get('devicemotion').size, 1);
});
test('denial and insecure/unsupported browsers honestly remain inactive', async () => {
  const denied = fixture({ permission: true }); denied.win.DeviceMotionEvent.requestPermission = () => Promise.resolve('denied'); denied.win.DeviceOrientationEvent.requestPermission = () => Promise.reject(new Error('blocked'));
  await denied.input.requestAccess(); assert.equal(denied.input.getState().state, 'denied'); assert.equal(denied.input.getState().active, false); assert.equal(denied.listeners.get('devicemotion')?.size ?? 0, 0);
  const insecure = fixture({ secure: false, permission: true }); await insecure.input.requestAccess(); assert.equal(insecure.input.getState().state, 'insecure'); assert.equal(insecure.calls.length, 0);
  const unsupported = fixture({ motion: false, orientation: false }); assert.equal(unsupported.input.getState().state, 'unsupported'); assert.equal(unsupported.input.getState().active, false);
});
test('granting only orientation works after motion denial', async () => {
  const f = fixture({ permission: true }); f.win.DeviceMotionEvent.requestPermission = () => Promise.resolve('denied'); await f.input.requestAccess();
  f.event('deviceorientation', { beta: 90, gamma: 0 }); assert.equal(f.input.getState().active, true); assert.equal(f.input.getState().source, 'orientation');
});
test('disable during unresolved permission does not attach late listeners', async () => {
  const f = fixture({ permission: true }); let resolve;
  f.win.DeviceMotionEvent.requestPermission = () => new Promise(r => { resolve = r; }); const pending = f.input.requestAccess(); f.input.disable(); resolve('granted'); await pending;
  assert.equal(f.input.getState().enabled, false); assert.equal(f.listeners.get('devicemotion')?.size ?? 0, 0); close(f.outputs.at(-1), DEFAULT_GRAVITY);
});
test('motion preferred over orientation, with fallback after stale motion', () => {
  const f = fixture(); f.motion({ x: 0, y: 9.81, z: 0 });
  f.event('deviceorientation', { beta: 0, gamma: 90 }); assert.equal(f.input.getState().source, 'motion');
  f.event('deviceorientation', { beta: 0, gamma: 90 }, 1100); assert.equal(f.input.getState().source, 'orientation');
});
test('no-data and stopped-data timeout do not claim active; later readings recover', () => {
  const f = fixture(); f.timeout(); assert.equal(f.input.getState().state, 'unavailable'); assert.equal(f.input.getState().active, false);
  f.motion({ x: 0, y: 9.81, z: 0 }); f.timeout(); assert.equal(f.input.getState().active, false); assert.equal(f.input.getState().canCalibrate, false);
  f.motion({ x: 0, y: 9.81, z: 0 }); assert.equal(f.input.getState().active, true);
});
test('paused readings allow current-pose calibration without changing physics', () => {
  const f = fixture(); f.motion({ x: 0, y: 9.81, z: 0 }); f.input.setPaused(true); const count = f.outputs.length;
  for (let i = 0; i < 100; i++) f.motion({ x: -6, y: 8, z: 0 });
  assert.equal(f.outputs.length, count); assert.equal(f.timers.size, 0); assert.equal(f.input.calibrate(), true); close(f.outputs.at(-1), DEFAULT_GRAVITY);
  f.input.setPaused(false); f.motion({ x: -6, y: 8, z: 0 }); close(f.outputs.at(-1), DEFAULT_GRAVITY, .001);
});
test('pause-resume changed pose smooths rather than snapping; reapply keeps last valid after reset', () => {
  const f = fixture(); f.motion({ x: 0, y: 9.81, z: 0 }); f.input.setPaused(true);
  for (let i = 0; i < 100; i++) f.motion({ x: -9.81, y: 0, z: 0 });
  f.input.setPaused(false); f.motion({ x: -9.81, y: 0, z: 0 }, 10000);
  assert.ok(f.outputs.at(-1).x > 0 && f.outputs.at(-1).x < .04);
  const before = f.outputs.at(-1); f.input.reapply(); close(f.outputs.at(-1), before);
  f.input.disable(); f.input.reapply(); close(f.outputs.at(-1), DEFAULT_GRAVITY);
});
test('screen rotation recaptures neutral without immediate gravity update', () => {
  const f = fixture(); f.motion({ x: 0, y: 9.81, z: 0 }); const count = f.outputs.length;
  f.screen.angle = 90; f.screen.dispatchEvent(new Event('change')); assert.equal(f.outputs.length, count);
  f.motion({ x: 9.81, y: 0, z: 0 }); close(f.outputs.at(-1), DEFAULT_GRAVITY);
});
test('null samples and disposal never emit gravity updates', () => {
  const f = fixture(); f.motion({ x: null, y: 9.81, z: 0 }); assert.equal(f.outputs.length, 0); assert.equal(f.input.calibrate(), false);
  f.input.dispose(); f.motion({ x: 0, y: 9.81, z: 0 }); assert.equal(f.outputs.length, 0); assert.equal(f.timers.size, 0);
});
