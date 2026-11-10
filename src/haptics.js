// Web Vibration controls pulse duration/rhythm, not physical motor amplitude.
// One arbiter represents both pumps and only follows actual outgoing water.
export function jetHapticPulse(jetStates = []) {
  let strength = 0;
  for (const jet of jetStates) {
    if (!jet?.active || jet.exhausted || !Number.isFinite(jet.pressure) || !Number.isFinite(jet.volumeRate)) continue;
    strength = Math.max(strength, Math.min(1, jet.pressure, jet.volumeRate));
  }
  if (strength <= 0) return null;
  return strength <= .5 ? { duration: 12, interval: 160 }
    : strength <= .8 ? { duration: 22, interval: 120 }
      : { duration: 36, interval: 90 };
}

export function createJetHaptics({ readState, vibrate = globalThis.navigator?.vibrate?.bind(globalThis.navigator), win = globalThis.window, doc = globalThis.document, now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
  let armed = false, disposed = false, failed = false, running = false;
  let timer = null, motorUntil = 0;
  const supported = typeof vibrate === 'function';
  function clearTimer() { if (timer !== null) cancel(timer); timer = null; }
  function send(duration) {
    try {
      if (vibrate(duration) !== false) return true;
    } catch { /* Unsupported/blocked devices keep ordinary button play. */ }
    failed = true; armed = false; running = false; clearTimer();
    return false;
  }
  function stop() {
    clearTimer(); running = false;
    // Cancel a potentially running short pulse once, never zero-spam idle frames.
    if (supported && !failed && motorUntil > now()) send(0);
    motorUntil = 0;
  }
  function plan() {
    if (!supported || failed || disposed || !armed) return null;
    if (doc?.hidden) { armed = false; return null; }
    const state = readState();
    if (!state || state.paused || state.won) {
      if (state?.paused || state?.won) armed = false;
      return null;
    }
    return jetHapticPulse(state.jetStates);
  }
  function pulse() {
    timer = null;
    const next = plan();
    if (!next) { stop(); return; }
    if (!send(next.duration)) return;
    motorUntil = now() + next.duration;
    running = true;
    // Read live world state at the next pulse; no cached held-time oscillator.
    timer = schedule(pulse, next.interval);
  }
  function update() {
    if (!plan()) { stop(); return; }
    if (!running) pulse();
  }
  function activate() {
    if (disposed || failed || !supported || doc?.hidden) return;
    armed = true;
  }
  function deactivate() { armed = false; stop(); }
  const visibilityChanged = () => { if (doc?.hidden) deactivate(); };
  // Installed after input aggregation so release reads the new actual pump state.
  const releases = ['pointerup', 'pointercancel', 'lostpointercapture', 'keyup'];
  for (const event of releases) win?.addEventListener(event, update);
  win?.addEventListener('blur', deactivate);
  win?.addEventListener('pagehide', deactivate);
  doc?.addEventListener('visibilitychange', visibilityChanged);
  return {
    activate, update, deactivate,
    getState: () => ({ supported, armed, failed, running, disposed }),
    dispose() {
      if (disposed) return;
      deactivate(); disposed = true;
      for (const event of releases) win?.removeEventListener(event, update);
      win?.removeEventListener('blur', deactivate);
      win?.removeEventListener('pagehide', deactivate);
      doc?.removeEventListener('visibilitychange', visibilityChanged);
    }
  };
}
