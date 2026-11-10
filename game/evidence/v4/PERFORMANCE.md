# Visible Sprite candidate: final measured result

This is the current visible Sprite version after sampler-layout conversion was corrected. Root active/inactive pixel QA now reports different2627/max12; an observed copy is retained in v4_visible_sprite_visibility_evidence.json. The earlier Sprite result without the fix had different0/max0 and is INVALID as an equivalent-effect optimization. Its metrics and FINAL-SPRITE-COMPARISON.md are retained solely as diagnostics and must not be quoted as the current result.

## Environment and important limits

Chromium155 headless, WebGL2 ANGLE SwiftShader software rendering, taskset CPUs0,1, 1280×900 desktop viewport, DPR1, canvas385×533. Root owns the loopback HTTP server8787. This is not actual Brave or phone hardware performance. Each phase resets seed42, warms1.8 wall seconds and then samples8 seconds idle/10 seconds cycles. Finite cycles hold/release both pumps every1.2 simulation seconds. No source edits or Node probes occurred during this run.

**Not strictly isolated:** a separate root systemd DeepSeek review job with a Node process waiting on its API overlapped this run. Root reported an rg thread-creation Resource temporarily unavailable error. A snapshot at08:52:59 UTC observed executor pids141/153, container186/1024; cpu.pressure files were absent and those errors are preserved. v4_visible_sprite_overlap_resources.json retains the raw snapshot. No second root browser overlapped. The earlier v3/batch measurements ran at a different time, so approximate comparisons below are bounded evidence rather than a tightly controlled causal/real-device benchmark.

## Main comparison (visible effects only)

| Version | Phase | rAF FPS | rAF p95 ms | draw mean ms | world.step mean ms | sim/wall |
|---|---|---:|---:|---:|---:|---:|
| v3 long Bezier | idle_full | 29.44 | 50.0 | 2.389 | 1.056 | 0.992 |
| v3 long Bezier | finite_pump_cycles_full | 17.63 | 183.4 | 2.507 | 1.113 | 0.671 |
| intermediate batched fill | idle_full | 36.68 | 33.4 | 1.410 | 1.067 | 0.978 |
| intermediate batched fill | finite_pump_cycles_full | 22.53 | 183.2 | 1.469 | 1.061 | 0.681 |
| current visible Sprite | idle_full | 44.75 | 33.4 | 1.123 | 0.978 | 0.994 |
| current visible Sprite | finite_pump_cycles_full | 24.88 | 133.3 | 1.204 | 1.081 | 0.705 |

Observed current Sprite rAF cadence is about52% faster idle and41% faster cycling than the earlier v3 sample. Draw JavaScript time is about52–53% lower; this covers geometry/property preparation, not subsequent GPU execution. Current cycle p95 remains133 ms and sim/wall remains0.705 under the unchanged dt50ms clamp: substantial stalls and lost wall-time simulation still exist. Do not say the stutter is eliminated. Physics costs remain about1 ms per120Hz step; gameplay modules are unchanged.

## Complete current six-phase sample

| Phase | rAF FPS | rAF p95 ms | draw mean/p95 ms | step mean/p95 ms | sim/wall |
|---|---:|---:|---|---|---:|
| idle_full | 44.75 | 33.4 | 1.123/1.800 | 0.978/1.200 | 0.994 |
| finite_pump_cycles_full | 24.88 | 133.3 | 1.204/2.000 | 1.081/1.500 | 0.705 |
| idle_without_tracer_drawing | 42.25 | 33.4 | 1.156/2.000 | 1.033/1.200 | 0.998 |
| idle_no_draw | 46.90 | 33.4 | 0.000/0.000 | 0.987/1.200 | 1.001 |
| idle_reduced36 | 43.63 | 33.4 | 1.104/1.800 | 0.986/1.100 | 0.999 |
| finite_pump_cycles_reduced36 | 26.86 | 150.0 | 1.158/1.900 | 0.994/1.200 | 0.715 |

Ablation notes: no-tracer temporarily supplies an empty particle list only during drawing, leaving tracer transport/physics intact; no-draw freezes the existing render geometry instead of rebuilding it. reduced36 changes tracer count only; the existing renderer instance still uses its original32 decorative bubbles, so this is not a complete prefers-reduced-motion browser-media emulation. No second renderer/pool is constructed.

The no-tracer ablation being slower than full and reduced36 idle being nearly unchanged show sample/environment variation is material. These results do not justify further reducing particle count; the pooled Sprite draw overhead is small relative to the remaining software-renderer frame budget. The limited headroom/no-draw46.9FPS also prevents a blanket60FPS claim.

## Verification and artifacts

- Page errors: []; console errors: []; console warnings: []. Listeners were installed before navigation, covering shader compilation logs.
- v4_visible_sprite_desktop_metrics.json: full distributions, manifest, badge, source URL, simulation/wall times and environment.
- v4_visible_sprite_desktop_stdout.log: all six phases and COMPLETE.
- v4_visible_sprite_source_hashes.json: render/bootstrap/physics/tracers/input/main hashes match before and after this run; four gameplay modules exactly match frozen v3. Bootstrap differs intentionally by the sampler-layout fix.
- v4_visible_sprite_desktop_idle.png: real full-page screenshot taken after idle timing ended, using the original single renderer; synchronous screenshot-byte file write. The profiler viewed the actual screenshot: faint small dots are distributed through the tank. Root retains final visual/ZIP approval.
- v4_visible_sprite_visibility_evidence.json: copy of root pixel-diff observation for this corrected visible version.
- browser_visible_sprite_profile.py: exact reusable test; no second ToyRenderer is created for primitive counts.
- browser context and browser explicitly closed, command exit0/COMPLETE. No profiler browser or Node workload remains. Root server8787 was left untouched.

The invalid earlier Sprite file FINAL-SPRITE-COMPARISON.md retains its invalidation banner. Prior performance numbers45.03/28.90FPS refer to invisible particles and must not substitute for current44.75/24.88FPS. The original batch-fill candidate remains an actually visible fallback if further integration concerns arise.
