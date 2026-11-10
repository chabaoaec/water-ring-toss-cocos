# v5.2 ring reachability / physical input owner

Base3034ba0; isolated branchv5.2-side-return. Parent-owned geometry/inertia/parcel-boundary changes were locally cherry-picked solely for integration tests (locald05e38c/8873ce1/7f6c718, equivalent56f9a9e/5a375a9/df8219d). Parent should cherry-pick ONLY the final owner commit, not those already integrated modules.

## Red reproduction and roots

old-edge.json/old-edge.txt record the original actual World at120Hz, eightseconds, ordinary matching-side1.1s press/.8s release, at most5finite pumps. Six isolated real rigid corner poses: horizontal floor left/right and depth-contact variants never rise above31.6002; side-on left/right never above51, never approach nozzle closer than~64. The ring body is positioned only to establish each controlled initial physical test pose; no edits during simulation.

Three concrete defects: actual collider inner faces were12/408,floor28,depth±57, while fluid starts20/400,32,±52; flat rings can rest at center31.6 and side-on rings partly/entirely outside sampled water. Uniform return compensation could turn outer bottom streamlines away from a jet. Cannon0.20 GSSolver also treats equation bounds as lambda/impulse, while friction creation sets mu*g*mass; at120Hz and24compound sphere contacts this supplies an excessive independent static friction budget per contact. Lowering static mu to.01 still gave only.001/.003/.004units ground motion at10/20/30deg over2s and no useful floor recovery. No giant jet or body nudge was added to overpower it.

## Changes

All six solid inner faces now match20..400,32..540,±52. Initial offset rings usez28 so every sphere clears narrowed walls AND posts. The closed streamfunction has a floor-slip return sheet and analytically normalized wall-weighted descending branches, concentrated toward the relevant side's return. It retains the same finite pump/source/FIFO/bulk decay; the same new field advects markers and supplies ring drag.

Static contact friction is normalized immediately before solver.solve. For each actual enabled dynamic-static body pair, estimate mean compressive normal load from current force (gravity has already been applied by Cannon), infer originalmu from generated equation bounds, distribute totalmu*load*dt impulse across that pair's actual contact count. Two tangent directions retain Cannon's friction-pyramid approximation. Originalmu.12, restitution, ring-ring contact handling, support/contact multipliers and scoring rules remain. Approximation: this uses external-force normal load, not fully solved coupled impact/stack normal reactions. It corrects timestep/contact multiplication without changing vendor code or supplying a special ring force.

getWaterSurface() caches exact hydrostatic clipped-box plane by gravity/volume; equivalent getWaterSurfaceY() retained. Buoyancy wet fraction uses signed plane depth and torus extent projected on its normal. Closed pump/intake vector potentials are multiplied by a free-plane envelope; curl(phi*A) is implemented asphi*curl(A)+gradphi crossA. They remain divergence-free/tangent to the plane and no-penetration at the aligned solid walls. Q displacement at an oblique moving free plane remains a known kinematic approximation; it is NOT a complete free-boundary/source-flow solution. Parent's deterministic parcel reflection handles finite-step crossings, not particle renewal.

setDeviceAcceleration consumes physical linear container acceleration in game coordinates,m/s²,cap3g. A ring gets negative container acceleration plus displaced-fluid pressure response: inertial density factor(mass−136/210*wet), using210/9.81 game scaling. Parent's shared water-inertia mode is advanced and added to sampleFlow; rings and tracers both use it. No normalization of shake magnitude, body impulse teleport, autoalign/attach or angle clamp. Pause zeroes device input and freezes dynamics; reset zeroes state.

## Green evidence

`node --test game/tests/*.test.js`:73/73 pass; final-tests.txt. No weakened collision/root support conditions.

Eight physically legal corner poses (same against-wall poses translated to corrected walls, not same now-penetrating old coordinates), flat/side-on/front/back, reach the lift stream with ordinary finite input within8s/5pumps: maximum heights262.73–537.68, closest nozzle distance<.24. Complete records in final-tests.txt and edge-final-tests.txt. Controlled setups assert every initial torus sphere is inside all six faces; normal reset seeds42/43 also do.

Ground tilt10/20/30deg over2s, no pump: displacements3.2637/13.3691/17.8771. This reflects correct finite friction and density response, not artificially amplified gravity.

+8m/s² physicalshake for.2s against matched nomotion world: airborne ringdx−3.5678, grounded ringdx−.9385. Zero input and.3s coast extends differences to−13.3059/−2.3496.104persistent water markers move>.5during coast; shared field−15.8955. A subsequent−8input reverses target. Tests also verify3gcap, no pump water use, pause and reset.

Oblique closed-curl finite-difference divergence2.53e-7, free-plane normal flux3.3e-13. Existing actual60s bilateral distribution/water volume/identity checks pass with parent's boundary module. Existing finite pump/refill, inertia, true capture, all8placed-contact win, collision and elastic rebound regressions pass.

Ordinary natural play regression: seed43, one left1.1s stroke, release20s, score1; ring1ends(140.3082,41.6682,−.4538),peg0 rooted. Previous.7s protocol no longer scored after the physically changed return/collider model; no scoring condition was relaxed. Natural initial quaternion/position evidence is emitted by the test.

Limitations: one-way analytic fluid with unresolved pipe and no pressure/slosh PDE; field ignores fluid-solid obstacle displacement; linear torus wet fraction; approximate tilted-Q displacement and reflected finite-step parcels; friction normal-load estimate described above. Root owns actual browser/mobile/render QA, full tilted/shake marker distribution, independent review and publishing. Nothing was pushed or published by this owner.
