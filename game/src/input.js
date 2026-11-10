export function bindControls(world, buttons, onActivity = () => {}) {
  const pointers = [new Set(), new Set()],
    keys = [new Set(), new Set()];
  const sync = i => {
    world.setJet(i, pointers[i].size + keys[i].size > 0);
    buttons[i].classList.toggle('pressed', world.jets[i]);
    buttons[i].setAttribute('aria-pressed', String(world.jets[i]));
  };
  buttons.forEach((button, i) => {
    button.addEventListener('pointerdown', e => {
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      pointers[i].add(e.pointerId);
      sync(i);
      onActivity();
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, e => {
      pointers[i].delete(e.pointerId);
      sync(i);
    });
    button.addEventListener('click', e => {
      if (e.detail === 0) {
        keys[i].add('accessible-click');
        sync(i);
        onActivity();
        setTimeout(() => {
          keys[i].delete('accessible-click');
          sync(i);
        }, 180);
      }
    });
  });
  const side = code => ['ArrowLeft', 'KeyA'].includes(code) ? 0 : ['ArrowRight', 'KeyD'].includes(code) ? 1 : -1;
  window.addEventListener('keydown', e => {
    const i = side(e.code);
    if (i < 0 || buttons[i].disabled || e.target instanceof HTMLInputElement) return;
    e.preventDefault();
    keys[i].add(e.code);
    sync(i);
    onActivity();
  });
  window.addEventListener('keyup', e => {
    const i = side(e.code);
    if (i >= 0) {
      e.preventDefault();
      keys[i].delete(e.code);
      sync(i);
    }
  });
  function release() {
    for (let i = 0; i < 2; i++) {
      pointers[i].clear();
      keys[i].clear();
      sync(i);
    }
  }
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) release();
  });
  return {
    release
  };
}
