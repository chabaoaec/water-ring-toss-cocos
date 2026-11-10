# Unreleased performance candidate

Cannon SAP previously used bounding spheres for the tall pegs and thin tank walls, admitting distant compound-ring pairs to expensive sphere-box narrowphase. Enabling its existing `useBoundingBoxes` conservative compound-AABB policy reduces browser physics-step CPU53% idle and70–74% with finite pumps/tilt in a bounded development sample. All24 sphere shapes,120Hz,14solver iterations, materials, flow, glints and sensor behavior are preserved.

Two differential regressions compare9840 paired steps (all tank faces, rotated rim/post/ring contacts, supported seats, three seeds of pumping/coasting/tilt/shake): exact contacts, bodies, score, water and tracer state remain identical. All88 tests pass and the build succeeds.

The mobile-viewport4×CPU-throttled Chromium/SwiftShader sample still has long frames and sim/wall≈0.65. This is not real Android Edge FPS or proof the reported phone stutter is solved. In the sample mobile pumping rAF22.59→23.05FPS and tilt22.18→24.04FPS; software GPU/executor constraints remain. No particle-count/fidelity reduction is used.

Full before/after CPU traces, metrics, actual visible-glint screenshots, exact source provenance, resource caveats and terminal logs are in the separately registered work evidence `/work/water-ring-cocos-20261110/acceptance/v5.3/perf/REPORT.md`. This candidate is not a publication or release claim; source still carries v5.2 identity until the maintainer integrates/version-bumps it.
