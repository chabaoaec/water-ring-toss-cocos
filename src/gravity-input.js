// Coordinates: device +x right, +y toward its top, +z out of its screen.
// Game +x right, +y up, +z toward the viewer before pose calibration.
export const DEFAULT_GRAVITY = Object.freeze({ x: 0, y: -1, z: 0 });
const copy = v => ({ x: v.x, y: v.y, z: v.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export function normalizeGravity(v) {
  if (!v || !['x', 'y', 'z'].every(k => Number.isFinite(v[k]))) return null;
  const scale = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
  if (scale < 1e-6) return null;
  const x = v.x / scale, y = v.y / scale, z = v.z / scale, length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
}
export function motionGravity(event) {
  const v = event?.accelerationIncludingGravity;
  if (!v || !['x', 'y', 'z'].every(k => Number.isFinite(v[k]))) return null;
  const length = Math.hypot(v.x, v.y, v.z);
  if (length < .5 || length > 30) return null;
  // Accelerometers report specific force: at rest face-up z is +g,
  // whereas physical downward gravity is -z. Linear acceleration is not separable.
  return { x: -v.x, y: -v.y, z: -v.z };
}
export function orientationGravity(event) {
  if (!Number.isFinite(event?.beta) || !Number.isFinite(event?.gamma)) return null;
  const beta = Math.max(-180, Math.min(180, event.beta)) * Math.PI / 180;
  const gamma = Math.max(-90, Math.min(90, event.gamma)) * Math.PI / 180;
  // W3C intrinsic Z(alpha) X(beta) Y(gamma): R^T * world-down.
  // Alpha is rotation around vertical and cancels out of gravity.
  return { x: Math.cos(beta) * Math.sin(gamma), y: -Math.sin(beta), z: -Math.cos(beta) * Math.cos(gamma) };
}
export function toScreenGravity(v, angle = 0) {
  if (!normalizeGravity(v)) return null;
  const a = (Number.isFinite(angle) ? angle : 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  // screen.orientation.angle 90: device-left becomes displayed screen-down.
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
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

// No permission request occurs at construction, automatic start, or enable().
// requestAccess() must be called directly inside the user's click handler.
export function createGravityInput({ onDirection, onState = () => {}, win = globalThis.window, now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
  let preferred = true, active = false, paused = false, listening = false, disposed = false;
  let basis = null, raw = null, sample = null, direction = copy(DEFAULT_GRAVITY), source = null;
  let lastTime = null, lastMotionTime = -Infinity, timer = null, generation = 0, pending = null;
  let state = 'waiting', message = '倾斜重力默认开启，正在等待传感器。';
  const permission = new Map();
  const sensors = [['motion', 'DeviceMotionEvent', 'devicemotion'], ['orientation', 'DeviceOrientationEvent', 'deviceorientation']].filter(([, name]) => typeof win?.[name] !== 'undefined');
  for (const [name, ctor] of sensors) permission.set(name, typeof win[ctor].requestPermission === 'function' ? 'prompt' : 'granted');
  const needsPermission = () => sensors.some(([name]) => ['prompt', 'denied'].includes(permission.get(name)));
  const snapshot = () => ({ enabled: preferred, active, state, message, source, paused, canRequest: preferred && needsPermission() && !pending && win?.isSecureContext !== false, canCalibrate: preferred && !!sample });
  function emit(next, text) { state = next; message = text; onState(snapshot()); }
  function clearWatchdog() { if (timer !== null) cancel(timer); timer = null; }
  function watchdog() {
    clearWatchdog();
    if (paused || !preferred || !listening) return;
    timer = schedule(() => {
      timer = null; active = false; sample = raw = null;
      emit(needsPermission() ? 'permission' : 'unavailable', needsPermission() ? '倾斜重力待授权：点“授权传感器”；也可继续用按钮。' : '未收到有效传感器数据；保持当前重力，可继续用按钮。请用支持传感器的手机浏览器。');
    }, 3500);
  }
  function handle(event, kind) {
    if (!preferred || disposed || permission.get(kind) !== 'granted') return;
    const time = now();
    if (kind === 'orientation' && time - lastMotionTime < 1000) return;
    const value = kind === 'motion' ? motionGravity(event) : orientationGravity(event);
    if (!value) return;
    if (kind === 'motion') lastMotionTime = time;
    const dt = lastTime === null ? 1 / 60 : Math.max(.001, Math.min(.05, (time - lastTime) / 1000));
    // Motion's low-pass estimate reduces shaking; it cannot remove sustained acceleration.
    raw = !raw || source !== kind ? value : blend(raw, value, 1 - Math.exp(-dt / .18));
    const screen = toScreenGravity(raw, win.screen?.orientation?.angle ?? win.orientation ?? 0);
    const hadSample = !!sample;
    sample = normalizeGravity(screen);
    if (!sample) return;
    source = kind; lastTime = time;
    if (paused) {
      if (!hadSample) emit('paused', '游戏暂停，已收到传感器读数；可校准当前舒适姿势。');
      return;
    }
    basis ??= calibrationBasis(sample);
    const target = calibratedGravity(sample, basis);
    const filtered = smoothGravity(direction, target, dt);
    if (!filtered) return;
    direction = filtered; active = true;
    onDirection(copy(direction)); watchdog();
    const nextMessage = paused ? '暂停期间重力方向已冻结。' : '倾斜重力已启用 · 缓慢倾斜，快速摇动可能干扰方向。';
    // Avoid rewriting an aria-live region on every sensor tick.
    if (state !== 'active' || message !== nextMessage) emit('active', nextMessage);
  }
  const motion = e => handle(e, 'motion'), orientation = e => handle(e, 'orientation');
  function detach() {
    win?.removeEventListener('devicemotion', motion); win?.removeEventListener('deviceorientation', orientation);
    listening = false; clearWatchdog();
  }
  function attach() {
    if (disposed || !preferred) return;
    if (win?.isSecureContext === false) { emit('insecure', '倾斜重力不可用：请通过 HTTPS（或本机 localhost）打开；按钮仍可使用。'); return; }
    if (!sensors.length) { emit('unsupported', '此浏览器未提供手机传感器；保持普通重力，按钮和键盘照常使用。'); return; }
    if (!listening) {
      for (const [name, , event] of sensors) if (permission.get(name) === 'granted') win.addEventListener(event, name === 'motion' ? motion : orientation);
      listening = sensors.some(([name]) => permission.get(name) === 'granted');
    }
    if (!active) emit(needsPermission() ? 'permission' : 'waiting', needsPermission() ? '倾斜重力默认开启，待授权：点“授权传感器”。' : '正在等待有效传感器数据，保持当前姿势自动校准。');
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
    basis = calibrationBasis(sample); direction = copy(DEFAULT_GRAVITY); onDirection(copy(direction));
    emit(paused ? 'paused' : active ? 'active' : 'waiting', '已将当前姿势设为正向下；继续时缓慢倾斜手机。'); return true;
  }
  function setPaused(value) {
    if (paused === value) return;
    paused = value; lastTime = null; raw = null; clearWatchdog();
    if (paused && active) emit('paused', '游戏暂停，重力方向已冻结；可调整姿势后点击校准。');
    else if (!paused) { if (active) emit('active', '继续后平滑更新重力；可在菜单校准舒适姿势。'); watchdog(); }
  }
  function screenChanged() {
    // Screen axes changed: recapture neutral on next valid sample, then blend.
    basis = raw = sample = null; lastTime = null;
    if (preferred && active) emit('waiting', '屏幕方向已改变；下一次有效读数会重新校准，方向平滑过渡。');
  }
  win?.screen?.orientation?.addEventListener('change', screenChanged);
  win?.addEventListener('orientationchange', screenChanged);
  const api = {
    enable, disable, requestAccess, calibrate, setPaused, getState: snapshot,
    reapply() { onDirection(copy(preferred ? direction : DEFAULT_GRAVITY)); },
    dispose() { detach(); disposed = true; generation++; win?.screen?.orientation?.removeEventListener('change', screenChanged); win?.removeEventListener('orientationchange', screenChanged); }
  };
  attach();
  return api;
}
