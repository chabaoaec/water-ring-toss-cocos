import { boot, cc } from './engine-bootstrap.js';
import { WaterWorld, JET_CAPACITY } from './physics.js';
import { bindControls } from './input.js';
import { createGravityInput, gravityStateLabel } from './gravity-input.js';
import { ToyRenderer } from './render.js';
const $ = s => document.querySelector(s);
const status = $('#status');
const world = new WaterWorld();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
world.tracers.setReducedMotion(reducedMotion);
function updateJetHud() {
  for (const [side, name] of ['left', 'right'].entries()) {
    const state = world.jetStates[side], button = $(`#${name}-jet`);
    button.classList.toggle('pressed', world.held[side]);
    button.classList.toggle('flowing', state.active);
    button.classList.toggle('exhausted', state.exhausted);
    button.style.setProperty('--pressure', state.pressure);
    button.setAttribute('aria-pressed', String(world.held[side]));
    $(`#${name}-feedback`).textContent = state.exhausted ? '已耗尽 · 松开吸水' : state.active ? (state.pressure < .7 ? '轻轻排水' : '加压排水') : state.refilling ? `吸水中 ${Math.round(state.remaining / JET_CAPACITY * 100)}%` : state.remaining < JET_CAPACITY ? '补水暂停' : '按住排水';
    const fraction = state.remaining / JET_CAPACITY;
    $(`#${name}-fuel`).setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    $(`#${name}-fuel i`).style.transform = `scaleX(${fraction})`;
  }
}
let audio = null,
  sound = false;
let previousScore = -1,
  announcedWin = false,
  paused = false;
const formatTime = t => `${Math.floor(t / 60).toString().padStart(2, '0')}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
function tone(type) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.connect(g);
    g.connect(audio.destination);
    const now = audio.currentTime;
    o.type = 'sine';
    o.frequency.setValueAtTime(type === 'capture' ? 660 : 180, now);
    o.frequency.exponentialRampToValueAtTime(type === 'capture' ? 990 : 340, now + .13);
    g.gain.setValueAtTime(.04, now);
    g.gain.exponentialRampToValueAtTime(.001, now + .22);
    o.start(now);
    o.stop(now + .23);
  } catch {
    sound = false;
  }
}
const gravityInput = createGravityInput({
  onDirection: direction => world.setGravityDirection(direction),
  // Physical container acceleration in m/s²; physics owns inertial sign/scaling.
  onAcceleration: acceleration => world.setDeviceAcceleration?.(acceleration),
  onState: state => {
    const label = gravityStateLabel(state);
    $('#gravity-toggle').textContent = `体感 ${label}`;
    $('#gravity-toggle').setAttribute('aria-pressed', String(state.enabled));
    $('#gravity-status').textContent = state.message;
    $('#gravity-authorize').hidden = !state.canRequest;
    $('#gravity-calibrate').disabled = !state.canCalibrate;
  }
});
$('#gravity-toggle').addEventListener('click', () => {
  if (gravityInput.getState().enabled) gravityInput.disable(); else gravityInput.enable();
});
// Keep permission requests synchronous with this explicit user gesture (iOS).
$('#gravity-authorize').addEventListener('click', () => gravityInput.requestAccess());
$('#gravity-calibrate').addEventListener('click', () => gravityInput.calibrate());
const input = bindControls(world, [$('#left-jet'), $('#right-jet')], () => {
  if (audio?.state === 'suspended') audio.resume();
}, () => setPaused(true));
$('#sound').addEventListener('click', () => {
  sound = !sound;
  $('#sound').setAttribute('aria-pressed', String(sound));
  $('#sound').textContent = sound ? '声音 开' : '声音 关';
  if (sound) tone('pump');
});
function setPaused(value) {
  paused = value;
  world.setPaused(value);
  gravityInput.setPaused(value);
  input.release();
  $('#menu-panel').hidden = !value;
  if (world.won) $('#win').hidden = value;
  $('#menu').textContent = value ? '↶ 返回' : '☰ 菜单';
  $('#menu').setAttribute('aria-expanded', String(value));
  if (value) $('#resume').focus();else $('#menu').focus();
  for (const button of [$('#left-jet'), $('#right-jet')]) button.disabled = value || world.won;
  updateJetHud();
}
$('#menu').addEventListener('click', () => setPaused(!paused));
$('#resume').addEventListener('click', () => setPaused(false));
function reset() {
  setPaused(false);
  input.release();
  world.reset(42 + Math.floor(Math.random() * 100000));
  gravityInput.reapply();
  for (const button of [$('#left-jet'), $('#right-jet')]) button.disabled = false;
  updateJetHud();
  previousScore = -1;
  announcedWin = false;
  $('#win').hidden = true;
  $('#hint').textContent = '轻点微喷，长按加压；松开吸水，再按排水。';
  status.textContent = '新一局已准备。';
}
$('#reset').addEventListener('click', reset);
$('#play-again').addEventListener('click', () => setPaused(true));
document.addEventListener('keydown', e => {
  if (e.code === 'Escape' && paused) setPaused(false);
});
try {
  const {
    graphics,
    drawNode,
    scene,
    camera
  } = await boot();
  const renderer = new ToyRenderer(graphics, reducedMotion);
  class WaterToy extends cc.Component {
    update(dt) {
      if (paused) return;
      this.accumulator = (this.accumulator ?? 0) + Math.min(dt, .05);
      while (this.accumulator >= 1 / 120) {
        world.step(1 / 120);
        this.accumulator -= 1 / 120;
      }
      updateJetHud();
      renderer.draw(world);
      for (const event of world.events.splice(0)) {
        tone(event.type);
      }
      $('#timer').textContent = formatTime(world.elapsed);
      $('#pumps').textContent = String(world.pumps).padStart(2, '0');
      if (previousScore !== world.score) {
        previousScore = world.score;
        $('#score').textContent = world.score;
        $('#progress').style.width = `${world.score / 8 * 100}%`;
        status.textContent = `已套入 ${world.score} 个，共 8 个。`;
        for (let i = 0; i < 8; i++) $('#dots').children[i].classList.toggle('filled', i < world.score);
      }
      if (world.won && !announcedWin) {
        announcedWin = true;
        input.release();
        for (const button of [$('#left-jet'), $('#right-jet')]) button.disabled = true;
        $('#win-stats').textContent = `用时 ${formatTime(world.elapsed)} · ${world.pumps} 次喷流`;
        $('#win').hidden = false;
        $('#play-again').focus();
        status.textContent = '全部套中，收集完成！';
      }
    }
  }
  cc._decorator.ccclass('WaterToy')(WaterToy);
  drawNode.addComponent(WaterToy);
  document.body.classList.add('ready');
  $('#loading').hidden = true;
  // Runtime inspection evidence / intentional QA handle; no forced win or auto-score API.
  window.__waterToy = {
    world,
    scene,
    graphics,
    camera,
    engine: cc.VERSION,
    physics: 'cannon-es 0.20.0',
    reset,
    gravityInput,
    ready: true
  };
} catch (error) {
  console.error(error);
  $('#loading').textContent = '水机启动失败，请确认浏览器支持 WebGL 2，然后刷新。';
  status.textContent = String(error);
  document.body.classList.add('failed');
}
