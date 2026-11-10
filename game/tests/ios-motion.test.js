import test from 'node:test';
import assert from 'node:assert/strict';
import { createGravityInput, motionAccelerationSign, motionGravity, orientationGravity, normalizeGravity } from '../src/gravity-input.js';

const profiles = {
  android: { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36', platform: 'Linux armv8l', maxTouchPoints: 5 },
  iphone: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', platform: 'iPhone', maxTouchPoints: 5 },
  ipad: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 },
  mac: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 0 },
};
const multiply = (v, k) => Object.fromEntries(Object.entries(v).map(([axis, n]) => [axis, n * k]));
function close(actual, expected, message = '') {
  for (const k of ['x','y','z']) assert.ok(Math.abs(actual[k] - expected[k]) < 1e-5, `${message} ${k}: ${actual[k]} vs ${expected[k]}`);
}
function fixture(profile, rawSign) {
  const win = new EventTarget(), screen = new EventTarget(); screen.angle = 0;
  Object.assign(win, { navigator: profile, isSecureContext: true, screen: { orientation: screen }, DeviceMotionEvent: class {}, DeviceOrientationEvent: class {} });
  let clock = 0; const directions = [], accelerations = [];
  const input = createGravityInput({ win, now: () => clock, onDirection: v => directions.push(v), onAcceleration: v => accelerations.push(v), schedule: () => 1, cancel() {} });
  const event = (type, props) => { clock += 16.67; win.dispatchEvent(Object.assign(new Event(type), props)); };
  return { input, screen, directions, accelerations, event,
    motion(gravity, linear = null) {
      // Input fixtures describe the same physical pose/movement; iOS motion
      // vectors have the opposite raw convention, orientation Euler angles do not.
      const g = multiply(gravity, -9.81);
      const including = linear ? { x:g.x+linear.x, y:g.y+linear.y, z:g.z+linear.z } : g;
      event('devicemotion', { accelerationIncludingGravity: multiply(including, rawSign), ...(linear ? {acceleration: multiply(linear, rawSign)} : {}) });
    },
  };
}

test('iPhone and desktop-mode iPadOS motion normalization does not select Android or ordinary Mac Safari', () => {
  for (const [name, profile] of Object.entries(profiles)) assert.equal(motionAccelerationSign({ navigator: profile }), ['iphone','ipad'].includes(name) ? -1 : 1, name);
  assert.equal(motionAccelerationSign({}), 1);
});

test('iOS raw motion and W3C orientation agree before calibration at canonical 3D poses', () => {
  for (const beta of [-150,-90,-35,0,35,90,150]) for (const gamma of [-70,0,70]) {
    const down = orientationGravity({beta,gamma}), a = { x:1, y:-2, z:3 };
    const including = {x:-down.x*9.81+a.x,y:-down.y*9.81+a.y,z:-down.z*9.81+a.z};
    for (const sign of [1,-1]) close(normalizeGravity(motionGravity({ accelerationIncludingGravity:multiply(including,sign), acceleration:multiply(a,sign) },sign)),down);
  }
});

for (const name of ['iphone','ipad','android']) for (const native of [false,true]) {
  test(`${name} ${native?'native':'fallback'} physical left/right, pitch and inversion are not mirrored`, () => {
    const f = fixture(profiles[name], name==='android'?1:-1), zero={x:0,y:0,z:0};
    const neutral={x:0,y:-1,z:0}; f.motion(neutral,native?zero:null);
    for (const target of [{x:.6,y:-.8,z:0},{x:-.6,y:-.8,z:0},{x:0,y:-.8,z:.6},{x:0,y:-.8,z:-.6},{x:0,y:1,z:0},neutral]) {
      for(let i=0;i<300;i++) f.motion(target,native?zero:null);
      close(f.directions.at(-1),target,`${name} native=${native}`);
    }
    f.input.dispose();
  });
}

test('iOS and Android share shake signs/magnitudes, screen changes, pause and recalibration', () => {
  for (const name of ['iphone','ipad','android']) {
    const f=fixture(profiles[name],name==='android'?1:-1), zero={x:0,y:0,z:0}, down={x:0,y:-1,z:0};
    f.motion(down,zero);
    for (const vector of [{x:6,y:0,z:0},{x:-6,y:0,z:0},{x:0,y:4,z:0},{x:0,y:0,z:-5}]) {
      for(let i=0;i<60;i++) f.motion(down,vector);
      close(f.accelerations.at(-1),vector,name);
    }
    for (const angle of [90,180,270,0]) {
      f.screen.angle=angle;f.screen.dispatchEvent(new Event('change'));
      for(let i=0;i<240;i++) f.motion({x:.6,y:-.8,z:0},zero);
      close(f.directions.at(-1),{x:.6,y:-.8,z:0},name);
    }
    f.input.setPaused(true);close(f.accelerations.at(-1),zero);
    assert.equal(f.input.calibrate(),true);
    f.input.setPaused(false);
    for(let i=0;i<120;i++) f.motion({x:.6,y:-.8,z:0},zero);
    close(f.directions.at(-1),down,name);
    f.input.dispose();
  }
});

test('iOS orientation-only fallback is not sign-flipped', () => {
  const f=fixture(profiles.iphone,-1);
  f.event('deviceorientation',{beta:90,gamma:0});
  for(let i=0;i<300;i++) f.event('deviceorientation',{beta:53.13010235415598,gamma:90});
  close(f.directions.at(-1),{x:.6,y:-.8,z:0});
  f.input.dispose();
});
