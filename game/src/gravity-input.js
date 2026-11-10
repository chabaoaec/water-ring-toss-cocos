// Coordinates: device +x right, +y toward its top, +z out of its screen.
// Game +x right, +y up, +z toward the viewer before pose calibration.
export const DEFAULT_GRAVITY = Object.freeze({ x: 0, y: -1, z: 0 });
export const MAX_DEVICE_ACCELERATION = 3 * 9.81;
const ZERO_ACCELERATION = Object.freeze({ x: 0, y: 0, z: 0 });
const finiteVector = v => !!v && ['x', 'y', 'z'].every(k => Number.isFinite(v[k]));
const copy = v => ({ x: v.x, y: v.y, z: v.z });
// WebKit/iOS exposes Core Motion's user+gravity convention, opposite to
// Android's accelerometer convention. Normalize BOTH motion channels before
// gravity subtraction, screen rotation or calibration (never mirror game x).
// iPadOS can identify itself as a desktop Mac; a Mac without touch is not iOS.
export function motionAccelerationSign(win) {
  const nav = win?.navigator;
  return /iPad|iPhone|iPod/.test(nav?.userAgent ?? '')
    || (nav?.platform === 'MacIntel' && nav?.maxTouchPoints > 1) ? -1 : 1;
}
const motionVector = (v, sign) => finiteVector(v) ? { x: v.x * sign, y: v.y * sign, z: v.z * sign } : null;
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export function normalizeGravity(v) {
  if (!v || !['x', 'y', 'z'].every(k => Number.isFinite(v[k]))) return null;
  const scale = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
  if (scale < 1e-6) return null;
  const x = v.x / scale, y = v.y / scale, z = v.z / scale, length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
}
export function motionGravity(event, sign = 1) {
  const v = motionVector(event?.accelerationIncludingGravity, sign);
  if (!v) return null;
  // Specific force = physical linear acceleration - physical gravity. Native
  // gravity-removed acceleration lets shaking be removed from the tilt channel.
  const a = motionVector(event.acceleration, sign) ?? ZERO_ACCELERATION;
  const gravity = { x: a.x - v.x, y: a.y - v.y, z: a.z - v.z };
  const length = Math.hypot(gravity.x, gravity.y, gravity.z);
  if (length < .5 || length > 30 || !Number.isFinite(length)) return null;
  return gravity;
}
export function orientationGravity(event) {
  if (!Number.isFinite(event?.beta) || !Number.isFinite(event?.gamma)) return null;
  const beta = Math.max(-180, Math.min(180, event.beta)) * Math.PI / 180;
  const gamma = Math.max(-90, Math.min(90, event.gamma)) * Math.PI / 180;
  // W3C intrinsic Z(alpha) X(beta) Y(gamma): R^T * world-down.
  // Alpha is rotation around vertical and cancels out of gravity.
  return { x: Math.cos(beta) * Math.sin(gamma), y: -Math.sin(beta), z: -Math.cos(beta) * Math.cos(gamma) };
}
export function toScreenVector(v, angle = 0) {
  if (!finiteVector(v)) return null;
  const a = (Number.isFinite(angle) ? angle : 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  // screen.orientation.angle 90: device-left becomes displayed screen-down.
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
}
export function toScreenGravity(v, angle = 0) {
  return normalizeGravity(v) ? toScreenVector(v, angle) : null;
}
export function clampDeviceAcceleration(v) {
  if (!finiteVector(v)) return null;
  const length = Math.hypot(v.x, v.y, v.z);
  if (length <= MAX_DEVICE_ACCELERATION) return copy(v);
  const direction = normalizeGravity(v);
  return { x: direction.x * MAX_DEVICE_ACCELERATION, y: direction.y * MAX_DEVICE_ACCELERATION, z: direction.z * MAX_DEVICE_ACCELERATION };
}
export function calibratedAcceleration(v, basis) {
  if (!basis || !finiteVector(v)) return null;
  // Basis is orthonormal: project without normalizing away physical magnitude.
  return { x: dot(v, basis.right), y: dot(v, basis.up), z: dot(v, basis.depth) };
}
export function calibrationBasis(gravity) {
  const down = normalizeGravity(gravity);
  if (!down) return null;
  let right = normalizeGravity({ x: 1 - down.x * down.x, y: -down.x * down.y, z: -down.x * down.z });
  // A nearly side-on pose cannot preserve screen-right; choose a stable fallback.
  if (!right || Math.abs(down.x) > .98) right = normalizeGravity(cross(down, { x: 0, y: 0, z: 1 }));
  const up = { x: -down.x, y: -down.y, z: -down.z };
  return { right, up, depth: normalizeGravity(cross(right, up)) };
}
export function calibratedGravity(v, basis) {
  if (!basis || !normalizeGravity(v)) return null;
  return normalizeGravity({ x: dot(v, basis.right), y: dot(v, basis.up), z: dot(v, basis.depth) });
}
export function smoothGravity(from, to, dt) {
  const cosine = Math.max(-1, Math.min(1, dot(from, to))), angle = Math.acos(cosine);
  if (angle < 1e-6) return copy(to);
  const step = Math.min(angle * (1 - Math.exp(-dt / .12)), 1.8 * dt);
  let axis = normalizeGravity(cross(from, to));
  if (!axis) axis = normalizeGravity(cross(from, Math.abs(from.x) < .9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 }));
  const tangent = cross(axis, from);
  return normalizeGravity({ x: from.x * Math.cos(step) + tangent.x * Math.sin(step), y: from.y * Math.cos(step) + tangent.y * Math.sin(step), z: from.z * Math.cos(step) + tangent.z * Math.sin(step) });
}
const blend = (a, b, weight) => ({ x: a.x + (b.x - a.x) * weight, y: a.y + (b.y - a.y) * weight, z: a.z + (b.z - a.z) * weight });

// Preferred ON, a paused valid reading, and actual live application are distinct.
export function gravityStateLabel(state) {
  if (!state.enabled) return '关';
  if (state.paused && state.hasReading) return '开 · 暂停中';
  if (state.active) return '开';
  if (state.state === 'permission' || state.state === 'requesting') return '开 · 待授权';
  if (state.state === 'denied') return '开 · 未获授权';
  if (state.state === 'waiting') return '开 · 等待读数';
  if (state.state === 'unavailable') return '开 · 无数据';
  return '开 · 不可用';
}

// No permission request occurs at construction, automatic start, or enable().
// requestAccess() must be called directly inside the user's click handler.
export function createGravityInput({ onDirection, onAcceleration = () => {}, onState = () => {}, win = globalThis.window, now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
  const motionSign = motionAccelerationSign(win);
  let preferred = true, active = false, paused = false, listening = false, disposed = false;
  let basis = null, raw = null, sample = null, direction = copy(DEFAULT_GRAVITY), source = null;
  let lastTime = null, lastMotionTime = -Infinity, timer = null, generation = 0, pending = null;
  let acceleration = copy(ZERO_ACCELERATION), accelerationActive = false, accelerationSource = null;
  let accelerationTime = null, accelerationTimer = null, gravityEstimate = null;
  const readScreenAngle = () => {
    const value = win?.screen?.orientation?.angle ?? win?.orientation ?? 0;
    return Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0;
  };
  let screenAngle = readScreenAngle();
  function synchronizeScreenFrame() {
    const next = readScreenAngle(), delta = next - screenAngle;
    if (!delta) return;
    // Gravity samples and the calibration axes use screen coordinates. Rotate
    // BOTH by the same orthonormal transform, preserving their dot products.
    // raw and gravityEstimate remain DEVICE-coordinate vectors, not screen data.
    if (basis) basis = { right: toScreenVector(basis.right, delta), up: toScreenVector(basis.up, delta), depth: toScreenVector(basis.depth, delta) };
    if (sample) sample = normalizeGravity(toScreenVector(sample, delta));
    screenAngle = next;
  }
  let state = 'waiting', message = '倾斜重力默认开启，正在等待传感器。';
  const permission = new Map();
  const sensors = [['motion', 'DeviceMotionEvent', 'devicemotion'], ['orientation', 'DeviceOrientationEvent', 'deviceorientation']].filter(([, name]) => typeof win?.[name] !== 'undefined');
  for (const [name, ctor] of sensors) permission.set(name, typeof win[ctor].requestPermission === 'function' ? 'prompt' : 'granted');
  const needsPermission = () => sensors.some(([name]) => ['prompt', 'denied'].includes(permission.get(name)));
  const snapshot = () => ({ acceleration: copy(acceleration), accelerationActive, accelerationSource, enabled: preferred, active, hasReading: !!sample, state, message, source, paused, canRequest: preferred && needsPermission() && !pending && win?.isSecureContext !== false, canCalibrate: preferred && !!sample });
  function emit(next, text) { state = next; message = text; onState(snapshot()); }
  function activeMessage() {
    if (!accelerationActive) return '倾斜已启用；未收到晃动加速度，晃动暂不可用。';
    return accelerationSource === 'estimated' ? '倾斜与晃动已启用 · 晃动使用估算加速度。' : '倾斜与晃动已启用。';
  }
  function emitActivity() {
    if (active && !paused && (state !== 'active' || message !== activeMessage())) emit('active', activeMessage());
  }
  function clearAcceleration() {
    if (accelerationTimer !== null) cancel(accelerationTimer);
    accelerationTimer = null; accelerationTime = null; gravityEstimate = null;
    acceleration = copy(ZERO_ACCELERATION); accelerationActive = false; accelerationSource = null;
    onAcceleration(copy(acceleration));
    emitActivity();
  }
  function handleAcceleration(event) {
    if (!preferred || paused || disposed || permission.get('motion') !== 'granted') return;
    synchronizeScreenFrame();
    const time = now(), dt = accelerationTime === null ? 1 / 60 : Math.max(.001, Math.min(.05, (time - accelerationTime) / 1000));
    const native = motionVector(event.acceleration, motionSign);
    const including = motionVector(event.accelerationIncludingGravity, motionSign);
    let linear = native, nextSource = 'native';
    if (including) {
      // Fallback is a high-pass residual, retaining rapid motion rather than
      // normalizing it into tilt. It cannot distinguish slow translation from tilt.
      if (native) gravityEstimate = { x: including.x - native.x, y: including.y - native.y, z: including.z - native.z };
      else {
        const measured = clampDeviceAcceleration(including);
        gravityEstimate = gravityEstimate ? blend(gravityEstimate, measured, 1 - Math.exp(-dt / .35)) : measured;
        linear = { x: measured.x - gravityEstimate.x, y: measured.y - gravityEstimate.y, z: measured.z - gravityEstimate.z };
        nextSource = 'estimated';
      }
    }
    const bounded = clampDeviceAcceleration(linear);
    if (!bounded || !basis) return;
    const screen = toScreenVector(bounded, screenAngle);
    const game = calibratedAcceleration(screen, basis);
    acceleration = blend(acceleration, game, 1 - Math.exp(-dt / .03));
    accelerationTime = time; accelerationActive = true; accelerationSource = nextSource;
    onAcceleration(copy(acceleration));
    if (accelerationTimer !== null) cancel(accelerationTimer);
    // A missing stream must not leave a persistent force; fluid inertia is separate.
    accelerationTimer = schedule(clearAcceleration, 150);
    emitActivity();
  }
  function clearWatchdog() { if (timer !== null) cancel(timer); timer = null; }
  function watchdog() {
    clearWatchdog();
    if (paused || !preferred || !listening) return;
    timer = schedule(() => {
      timer = null; active = false; sample = raw = null;
      if (accelerationTime === null || now() - accelerationTime >= 150) clearAcceleration();
      emit(needsPermission() ? 'permission' : 'unavailable', needsPermission() ? '倾斜重力待授权：点“授权传感器”；也可继续用按钮。' : '未收到有效倾斜读数；保持当前重力，按钮仍可使用。请检查手机浏览器传感器设置。');
    }, 3500);
  }
  function handle(event, kind) {
    if (!preferred || disposed || permission.get(kind) !== 'granted') return;
    // Some browsers update angle before the change event, others afterward.
    synchronizeScreenFrame();
    const time = now();
    if (kind === 'orientation' && time - lastMotionTime < 1000) return;
    const value = kind === 'motion' ? motionGravity(event, motionSign) : orientationGravity(event);
    if (!value) return;
    if (kind === 'motion') lastMotionTime = time;
    const dt = lastTime === null ? 1 / 60 : Math.max(.001, Math.min(.05, (time - lastTime) / 1000));
    // Native linear acceleration was removed above; with no native channel,
    // this low-pass gravity estimate still has the usual translation/tilt ambiguity.
    raw = !raw || source !== kind ? value : blend(raw, value, 1 - Math.exp(-dt / .18));
    const screen = toScreenGravity(raw, screenAngle);
    const hadSample = !!sample;
    sample = normalizeGravity(screen);
    if (!sample) return;
    source = kind; lastTime = time;
    if (paused) {
      if (!hadSample) emit('paused', '已收到传感器读数，当前游戏暂停；可校准姿势，再点“继续游玩”后倾斜。');
      return;
    }
    basis ??= calibrationBasis(sample);
    const target = calibratedGravity(sample, basis);
    const filtered = smoothGravity(direction, target, dt);
    if (!filtered) return;
    direction = filtered; active = true;
    onDirection(copy(direction)); watchdog();
    // Avoid rewriting an aria-live region on every sensor tick.
    emitActivity();
  }
  const motion = e => { handle(e, 'motion'); handleAcceleration(e); }, orientation = e => handle(e, 'orientation');
  function detach() {
    win?.removeEventListener('devicemotion', motion); win?.removeEventListener('deviceorientation', orientation);
    listening = false; clearWatchdog(); clearAcceleration();
  }
  function attach() {
    if (disposed || !preferred) return;
    if (win?.isSecureContext === false) { emit('insecure', '倾斜重力不可用：请通过 HTTPS（或本机 localhost）打开；按钮仍可使用。'); return; }
    if (!sensors.length) { emit('unsupported', '此浏览器未提供手机传感器；保持普通重力，按钮和键盘照常使用。'); return; }
    if (!listening) {
      for (const [name, , event] of sensors) if (permission.get(name) === 'granted') win.addEventListener(event, name === 'motion' ? motion : orientation);
      listening = sensors.some(([name]) => permission.get(name) === 'granted');
    }
    if (paused && sample) emit('paused', '已收到传感器读数，当前游戏暂停；点“继续游玩”后倾斜。');
    else if (!active) emit(needsPermission() ? 'permission' : 'waiting', needsPermission() ? '倾斜重力默认开启，待授权：点“授权传感器”。' : '正在等待有效传感器数据，保持当前姿势自动校准。');
    watchdog();
  }
  function enable() {
    if (disposed) return;
    if (!preferred) { preferred = true; generation++; basis = raw = sample = null; lastTime = null; lastMotionTime = -Infinity; }
    attach();
  }
  function disable() {
    if (disposed) return;
    preferred = false; generation++; active = false; pending = null;
    detach(); basis = raw = sample = null; source = null; lastTime = null; lastMotionTime = -Infinity;
    direction = copy(DEFAULT_GRAVITY); onDirection(copy(direction)); emit('disabled', '倾斜重力已关闭，恢复普通向下重力。');
  }
  function requestAccess() {
    if (disposed || !preferred || pending) return pending ?? Promise.resolve(snapshot());
    if (win?.isSecureContext === false || !sensors.length) { attach(); return Promise.resolve(snapshot()); }
    const current = generation;
    const required = sensors.filter(([name]) => permission.get(name) !== 'granted');
    // Invoke every request synchronously while transient user activation is alive.
    const requests = required.map(([, ctor]) => {
      try { return Promise.resolve(win[ctor].requestPermission()); } catch (error) { return Promise.reject(error); }
    });
    pending = Promise.allSettled(requests).then(results => {
      if (disposed || !preferred || generation !== current) return snapshot();
      results.forEach((result, i) => permission.set(required[i][0], result.status === 'fulfilled' && result.value === 'granted' ? 'granted' : 'denied'));
      pending = null; detach(); attach();
      if (!listening) emit('denied', '传感器权限未获准；保持普通重力。请在浏览器网站设置中允许后重试，按钮仍可使用。');
      return snapshot();
    });
    emit('requesting', '请在浏览器提示中允许传感器；按钮仍可使用。');
    return pending;
  }
  function calibrate() {
    if (!preferred || !sample) return false;
    synchronizeScreenFrame();
    clearAcceleration();
    basis = calibrationBasis(sample); direction = copy(DEFAULT_GRAVITY); onDirection(copy(direction));
    emit(paused ? 'paused' : active ? 'active' : 'waiting', paused ? '当前姿势已校准；游戏仍暂停，请点“继续游玩”后缓慢倾斜。' : '当前姿势已校准；请缓慢倾斜手机。'); return true;
  }
  function setPaused(value) {
    if (paused === value) return;
    paused = value; lastTime = null; raw = null; clearWatchdog();
    active = false; clearAcceleration();
    if (paused) {
      if (sample) emit('paused', '游戏暂停，重力方向已冻结；可校准姿势，再点“继续游玩”后倾斜。');
      else emit(state, message);
    } else if (!preferred) emit('disabled', '倾斜重力已关闭，恢复普通向下重力。');
    else if (sample) {
      emit('waiting', '已继续，等待新的传感器读数；收到后将平滑跟随倾斜。');
      watchdog();
    } else attach();
  }
  function screenChanged() {
    // Browser UI rotation must not turn the current physical pose into neutral.
    synchronizeScreenFrame();
    clearAcceleration();
    if (preferred && sample) emit(paused ? 'paused' : active ? 'active' : 'waiting', '屏幕已旋转，保留原校准；可继续翻转，或手动校准当前姿势。');
  }
  win?.screen?.orientation?.addEventListener('change', screenChanged);
  win?.addEventListener('orientationchange', screenChanged);
  const api = {
    enable, disable, requestAccess, calibrate, setPaused, getState: snapshot,
    reapply() { clearAcceleration(); onDirection(copy(preferred ? direction : DEFAULT_GRAVITY)); },
    dispose() { detach(); disposed = true; generation++; win?.screen?.orientation?.removeEventListener('change', screenChanged); win?.removeEventListener('orientationchange', screenChanged); }
  };
  attach();
  return api;
}
