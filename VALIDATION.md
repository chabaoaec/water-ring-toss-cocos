# Demo validation · v2 · 2026-11-10

This version adds finite per-press water capacity, pressure-dependent speed/force, translucent flow tracers and elastic ring collisions. Short taps are weaker; holding ramps pressure until the independent left/right budget is exhausted. All inputs for that side must be released before a new press refills it. The main view stays portrait and restart stays in the secondary menu.

## Scoring correction and actual tests

The initial feedback demo had a confirmed defect: a jet-held ring could score while hovering above the base. Passing its original 11 tests did not rule that out. V2 requires real upward loaded contacts connected to the matching platform, directly or through lower rings; only the scored ring must also contain the corresponding peg. Walls/post sides and floating ring-contact cycles cannot create a support root. Conservative peg-radius/tilt clearance fixes the earlier static containment gap.

The implementation-side final Node suite executed **22 tests, all passing, zero failures/skips**. It covers exhaustion/release/repress and independent budgets; short/long same-point flow; suspended rings not scoring; no floating support root; actual base/stacked support; hole clearance; rebound relative-velocity reversal and water damping; particle caps/reduced-motion; reset and finite states; and actual eight-ring physical falling/seating/win. New capacity/support regressions were first red on the old implementation. Existing failed iterations and their causes are retained in the private project evidence root rather than relabeled as passes.

A bounded finite-pulse sequence from the untouched initial state earned genuinely supported points. Two bounded searches did **not** reach 8/8; this is not claimed as a new pump-only complete playthrough. The controlled eight-ring falling test verifies the actual support/win flow separately.

## Browser and visual evidence

Implementation-side final Chromium desktop 1280×900 and mobile/touch 390×844 tests pass without JS/WebGL errors. Root separately executed final-dist mobile QA: same-point short flow185.66 versus long381.06; cap exhaustion; A+ArrowLeft partial release cannot refill; last release/repress; real CDP same-side dual-touch full release/cancel; and pause/Esc. Root inspected actual tracer and exhausted-button screenshots. Partial pointer release uses a controller-only synthetic PointerEvent test; it is not claimed as real-CDP partial touch or a hardware phone test. Current evidence is in `game/evidence/v2/`; root-level `game/evidence/` files are historical v1 evidence.

Browsers encountered thread/process failures before entering a page on some attempts. The RT_i executor subtree was observed at TasksMax153; container-wide1024 did not prove spare executor capacity. Two-CPU affinity reduced test pressure and successful checks were preserved, but one optional paused-touch probe still closed before new_page and has no assertion result. No service limit was changed. Headless SwiftShader is not a hardware performance measurement.

## Cross-model review

DeepSeek's original completed review found the initial scoring defect. The v2 incremental continuation read the exact changed production files but hit its480s deadline without a final; it is not counted as a completed verdict. A same-session, no-more-tools conclusion continuation then completed in23.738s with a real final: B1 and M1 resolved to the reviewed extent, no confirmed new blocker in the requested capacity/pressure/tracer/elastic scope. It executed no tests; root accepted that static judgment against the actual tests and browser evidence above. Production src/index/style hashes remained identical to the review manifest; late README/test changes were checked by root and retained as a scope boundary.

Cocos Engine3.8.7 WebGL2 and cannon-es0.20.0 are real runtime dependencies. Water forces and torus collisions are approximations. This is an independently bootstrapped Cocos Web demo, not a Creator Editor scene/export. Other browser engines, iOS hardware, low-end performance, platform packaging and advertisement integration remain unverified.

## v2.1 packaging verification

Following feedback that v2 felt like v1, the exact Feishu-delivered v2 ZIP was downloaded back and its 620807 bytes/SHA256 matched the original tested ZIP. All 25 runtime files matched the v2 build. A fresh extraction passed actual WebGL browser checks for finite capacity, release/repress, increasing flow speed, tracers, touch cancel, and menu pause without page errors. This does not identify what the user's browser was serving.

v2.1 adds only a visible version label and a Python launcher anchored to its own directory, default port8082, no-store responses, explicit occupied-port failure. Gameplay JavaScript is byte-identical to v2 commit3817be0. The v2.1 ZIP was independently extracted and browser-tested, including the visible label. Launcher checks also ran from a different working directory and verified occupied-port failure. Windows/macOS launcher behavior is not separately hardware-tested.
