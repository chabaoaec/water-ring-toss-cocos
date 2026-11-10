# v5.4 fixed viewport — owner handoff

Source worktree: `/work/water-ring-cocos-20261110/layout-v54`, branch
`tune/v54-viewport`, based exactly on main
`81888b73be5c719a3a297a51f3e5a772a414aa6e` (v5.3). Root owns integration,
release versioning, final validation and external publication. This owner did not
call AEC, publish, push or change physics/haptics/main.js.

## Change

- Added `.water-stage` around the existing glass rim. The stage receives the
  remaining height after the HUD, hint, buttons and shell, then fits the original
  canvas aspect ratio420/580. It does not crop the controls or distort the physics
  design coordinates.
- Appended one readable override block to existing `style.css`; the previous
  minified stylesheet was not reformatted. Fixed html/body do not scroll or
  overscroll. The complete toy, buttons and bottom labels fit the visible area.
- Top/right/bottom/left safe-area environment insets plus explicit outer margins
  remain accounted for. The optional footer is hidden on shorter screens.
- Short landscape uses a tank-left / controls-right shell to retain useful
  dimensions, rather than shrinking all touch targets. Both pump buttons and
  the menu targets are at least44px high at tested sizes. Desktop portrait toy
  stays at most410px wide (680px for the short landscape arrangement).
- New independent `src/viewport.js` listens to window/visualViewport resizing
  and stage ResizeObserver changes, coalesced through requestAnimationFrame.
  It measures the available stage, updates the canvas dimensions, and informs
  Cocos when only a visualViewport change occurred. Unchanged dimensions do
  not repeatedly dispatch browser resize events.
- User pinch zoom remains enabled by the unchanged viewport meta. At non-unit
  zoom the fitter does not shrink/reflow the toy to cancel the zoom.
- The pause menu retains bounded internal scrolling, including dragging from
  its buttons. All menu actions and the bottom sensor/help text remain reachable.
  The external44px menu/return button stays outside the scrolling panel.

## Actual verification

`browser-result.json` is the final Chromium/Cocos run, exit0, six sequential
contexts at320×568,390×844,430×932,844×390,1280×720 and1280×900. The sole
browser/heavy-test slot was reserved and released after completion. No browser
or server remains from this owner run. This is functional QA, not an FPS test.

- Toy, canvas, menu and both pump hit boxes lie within every viewport. All labels
  and shell bottom remained visible. Actual screenshots were inspected at all
  six sizes, plus the mobile visualViewport-height fixture and small/landscape
  menu screenshots. The canvas keeps420/580 CSS aspect; Cocos design/visible size
  remains420×580 (within1e-9 floating tolerance), orthographic height290.
- Actual browser mouse or CDP touch pointer presses reach each pump, yielding
  exactly two new pump strokes in every context without direct world mutation.
- Body wheel, touch swipe and scrollTo attempts leave `scrollY=0`; final menu
  interactions also leave `scrollY=0`. Scrollable menus genuinely respond to
  wheel/touch:320×568 wheel150/touch85px;844×390 wheel150/touch85px.
- Menu title can be scrolled back to the top; resume, reset, gravity toggle,
  calibration and bottom help can all be reached. Native sensor-shaped events
  enable calibration; actual clicks on calibration/reset/resume succeed.
- A native viewport change390×844→390×620 refits controls. A separately labeled
  synthetic visualViewport-only height700 event (layout viewport still844)
  also refits the whole toy. Screenshot `390x844-visible700.png` retains the
  full844px screenshot canvas, so its blank lower144px is the fixture's
  deliberately excluded visual area, not a screenshot of actual browser chrome.
- CDP page scale1.5 proves browser zoom remains possible; the fitter retains its
  pre-zoom620px height instead of canceling the zoom. The viewport meta has no
  maximum-scale or user-scalable=no restriction.
- No page errors, console errors or failed requests. `node tools/build.mjs`
  succeeded and included33 runtime files with the new versioned viewport entry;
  owner build revision `da5ba548dfa3788cd6f4` before root release integration.

Final screenshots: `320x568-initial.png`, `390x844-initial.png`,
`430x932-initial.png`, `844x390-initial.png`, `1280x720-initial.png`,
`1280x900-initial.png`, corresponding `-menu.png`, and
`390x844-visible700.png`. Actual check script: `browser-check.py`; repository
copy `game/tests/browser-viewport-check.py` supports GAME_DIR and OUT_DIR.

One intermediate augmented test used strict floating equality and rejected
visible width420.00000000000006 at landscape; its unmodified evidence is retained
as `first-strict-float-assert.json`/`.stderr`. It was a test precision error;
product code was not changed to pass it. Final test uses tolerance1e-9. An early
command ran from the wrong directory, failed to write any source and rebuilt the
unchanged v5.3 tree; corrected working directory then produced the tested changes.

## Limits

Real phone Edge/in-app browser chrome, physical notches and native pinch gestures
were not tested on hardware. Safe-area env rules are present; nonzero native
safe-area values were not emulated in this run. Small decorative captions remain
small; important menu/pump targets are kept large, and browser zoom is available.
Menu scrolling is intentional; the outer page stays fixed. This owner does not
claim a mobile performance gain, haptic correctness, sensor hardware behavior or
unchanged final integrated build hashes after root combines other agents' work.
