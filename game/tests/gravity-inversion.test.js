import test from 'node:test';
import assert from 'node:assert/strict';
import {createGravityInput} from '../src/gravity-input.js';
import {WaterWorld} from '../src/physics.js';

test('sensor full flip reaches live upward gravity, lower cavity and upward-moving physical rings', () => {
  const win = new EventTarget(), screen = new EventTarget(); screen.angle = 0;
  Object.assign(win, { isSecureContext: true, screen: { orientation: screen }, DeviceMotionEvent: class {} });
  const world = new WaterWorld(42); let time = 0;
  const sensor = createGravityInput({ win, now: () => time, onDirection: v => world.setGravityDirection(v), onAcceleration: v => world.setDeviceAcceleration(v), schedule: () => 0, cancel: () => {} });
  function motion(degrees) {
    const theta = degrees * Math.PI / 180; time += 1000 / 60;
    win.dispatchEvent(Object.assign(new Event('devicemotion'), { acceleration: { x: 0, y: 0, z: 0 }, accelerationIncludingGravity: { x: 9.81 * Math.sin(theta), y: 9.81 * Math.cos(theta), z: 0 } }));
    world.step(1 / 120); world.step(1 / 120);
    assert.ok(Math.abs(world.world.gravity.length() - 210) < 1e-8);
  }
  motion(0);
  for (let i = 0; i <= 120; i++) {
    const degrees = 180 * i / 120, angle = degrees >= 150 ? 180 : degrees >= 60 ? 90 : 0;
    if (angle !== screen.angle) { screen.angle = angle; screen.dispatchEvent(new Event('change')); }
    motion(degrees);
  }
  for (let i = 0; i < 180; i++) motion(180);
  assert.ok(world.gravityDirection.y > .999999);
  assert.ok(world.world.gravity.y > 209.999);
  const surface = world.getWaterSurface();
  assert.ok(surface.normal.y < -.999999);
  assert.ok(surface.signedDepth({ x: 210, y: 35, z: 0 }) < 0, 'air cavity must be at game bottom when upside down');
  assert.ok(surface.signedDepth({ x: 210, y: 530, z: 0 }) > 0, 'water must occupy game top when upside down');
  const airPolygon = surface.facePolygon('z', 'max', { water: false });
  assert.ok(airPolygon.length >= 3 && airPolygon.every(p => p.y < 53));
  const before = world.rings.map(r => r.y);
  for (let i = 0; i < 60; i++) motion(180);
  const meanRise = world.rings.reduce((sum, r, i) => sum + r.y - before[i], 0) / world.rings.length;
  assert.ok(meanRise > 5, `rings must respond to upward gravity: mean rise ${meanRise}`);
  const inverted = { ...world.gravityDirection };
  world.reset(43); sensor.reapply();
  assert.deepEqual(world.gravityDirection, inverted);
  assert.deepEqual(world.deviceAcceleration, { x: 0, y: 0, z: 0 });
  console.log(JSON.stringify({ scope: 'Synthetic native motion connected to actual Cannon world and shared rendered cavity polygon; not a real phone', gravity: inverted, cavityY: airPolygon.map(p => p.y), meanRingRiseInOneSecond: meanRise, magnitude: world.world.gravity.length() }));
  sensor.dispose();
});
