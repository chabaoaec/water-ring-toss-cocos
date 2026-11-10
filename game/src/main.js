import { boot, cc } from './engine-bootstrap.js';
import { WaterWorld } from './physics.js';
import { bindControls } from './input.js';
import { ToyRenderer } from './render.js';
const $ = s => document.querySelector(s);
const status = $('#status');
const world = new WaterWorld();
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
const input = bindControls(world, [$('#left-jet'), $('#right-jet')], () => {
  if (audio?.state === 'suspended') audio.resume();
});
$('#sound').addEventListener('click', () => {
  sound = !sound;
  $('#sound').setAttribute('aria-pressed', String(sound));
  $('#sound').textContent = sound ? '声音 开' : '声音 关';
  if (sound) tone('pump');
});
function setPaused(value) {
  paused = value;
  input.release();
  $('#menu-panel').hidden = !value;
  if (world.won) $('#win').hidden = value;
  $('#menu').textContent = value ? '↶ 返回' : '☰ 菜单';
  $('#menu').setAttribute('aria-expanded', String(value));
  if (value) $('#resume').focus();else $('#menu').focus();
  for (const button of [$('#left-jet'), $('#right-jet')]) button.disabled = value;
}
$('#menu').addEventListener('click', () => setPaused(!paused));
$('#resume').addEventListener('click', () => setPaused(false));
function reset() {
  setPaused(false);
  input.release();
  world.reset(42 + Math.floor(Math.random() * 100000));
  previousScore = -1;
  announcedWin = false;
  $('#win').hidden = true;
  $('#hint').textContent = '按住喷流，让彩环升起；松开，让它缓缓落柱。';
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
  const renderer = new ToyRenderer(graphics, matchMedia('(prefers-reduced-motion: reduce)').matches);
  class WaterToy extends cc.Component {
    update(dt) {
      if (paused) return;
      this.accumulator = (this.accumulator ?? 0) + Math.min(dt, .05);
      while (this.accumulator >= 1 / 120) {
        world.step(1 / 120);
        this.accumulator -= 1 / 120;
      }
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
    ready: true
  };
} catch (error) {
  console.error(error);
  $('#loading').textContent = '水机启动失败，请确认浏览器支持 WebGL 2，然后刷新。';
  status.textContent = String(error);
  document.body.classList.add('failed');
}
