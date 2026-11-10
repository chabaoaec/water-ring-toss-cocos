# v5 fluid candidate evidence

Scope: game/src/physics.js, game/src/fluid-tracers.js, new game/src/recirculating-flow.js, directly related tests. No render, input, version, publishing or AEC operations.

## Reproduction and acceptance

Base 7fd314e actual WaterWorld at 120Hz,20s, bilateral1.1s press/.8s release reproduced117/128 in top quarter and112/128 within5px of ceiling; idle32/128 topquarter. See old-red.json. This was run before source edits, with original lifetime/home drift intact.

`node --test game/tests/*.test.js` passed33/33. See final-tests.txt. A later input-edge cleanup (zero stale volumeRate on setJet) passed focused3 tests in edge-final-tests.txt; a final explicit-quality-toggle correction seeds CURRENT chamber/surface state and passed2 relevant tests in quality-final-tests.txt. Initial reset/ordinary120Hz simulation unchanged by this final quality correction.

Analytic field finite-difference grid maximum absolute divergence1.391435855424561e-7; sampled max speed1615.571 game units/s (a grid observation, not a global extremum proof). Tests cover combined pump/refill curls, zero solid-side/depth flux, moving-top v=sum(Q)/A, numerically integrated exchange-port flux matching ledger Q. Source terms have nonzero bottom-port flux intentionally. The closed recirculation part has zero bottom/top flux and genuine descending return.

Actual World60s bilateral128pool: every ID saw both up/down flow; sampled5s histograms in final-tests.txt, none near-total top concentration;128total objects retained, visible pool fluctuates through real chamber exchange; max boundary violation0; max total water error1.20e-12. Bilateral60s integration took8.09s wall time in this Node run; this includes Cannon and is not browser/GPU/mobile performance evidence.

Actual World60s single-left128pool and reduced-both36pool, same120Hz/1.1/.8 schedule, executed by final-scenarios.mjs. Both retain exact objects/IDs, zero visible boundary violations, water error<=1.20e-12. Single-left: maximum top-quarter fraction32.32%, maximum top5px fraction2.86%,117 IDs saw both up/down;11 IDs legitimately remain in never-used right chamber. Reduced-both: max top-quarter38.24%, max top5px5.88%, all36 IDs saw up/down. Complete5s snapshots/timings in final-scenarios.json. These thresholds concern finite-sample distribution, not exact incompressibility proof.

Button-only scoring regression (full World, all tracers enabled, no edits to bodies, no gravity steering): left1.1s, release.7s, left.1s, release16s. Second release is t1.90s at ring1(133.2766,454.3303,0),vx11.3568,vy-16.5052. At least one ring achieves actual supported/contained/stable score;2pumps. All original support/collision/elasticity/hole/win/finite-budget tests retain their rules. The former model-specific10pulse scoring script is preserved in old-unsteered-protocol-test.js and earlier candidate failures in *score.txt. Continued pumping can carry a ring through the top recirculation turn; changing to release timing is a model/play protocol change, not weakened support scoring. Delaying plume bending until y350 (above peg tip322) avoids prescribing lateral motion straight through a solid peg.

A separate exploratory bounded-tilt3pump controller also scored (t17.308s, release t3.95 near139.01/436.23/0); not required for the desktop regression and not an8/8 manual-completion claim.

## Geometry, volume and integration contracts

WaterWorld.getWaterSurfaceY() and water.surfaceY expose horizontal surface. Effective constant area A=initialTank/(450-32)=8/418. Surface=32+tank/A, initial450, max533.6 with both.8 chambers discharged, leaving6.4 below outer marker tank top540. Chamber+visible-tank ledger total remains9.6. Marker fluid domain is x20..400,y32..surfaceY,z[-52,52]. RK2 interpolates surface over each120Hz step; no projection, ceiling clamp, home drift, life renewal or ordinary-step reseeding. Side/depth walls are impermeable; bottom exchange ports and moving top are explicit exceptions to a closed-box boundary statement.

Markers are128TOTAL (36reduced), initially106/30 in tank and11/3 per chamber. `inChamber` is null for visible tank water,0/1 for bank. IDs and objects persist during ordinary simulation. Entering a sink port records a FIFO exit-volume threshold; cumulative pump discharge releases that same marker at the nozzle flux coordinate. This is physical modeled pipe transport, with no random spawn. Explicit reset/quality changes rebuild the visualization at current water/chamber volumes; this is not a periodic distribution mechanism. Root renderer must hide chamber markers.

setGravityDirection normalizes valid vectors to210 and preserves prior valid direction for invalid input. Reset returns to(0,-1,0). Buoyancy opposes gravity; restoring torque follows opposite gravity. Water-force terms fade across an approximate torus vertical extent and vanish above it. Ring compound24sphere geometry, contacts/support scoring and120Hz caller remain.

## Known approximations

Kinematic game approximation, not Navier–Stokes/CFD, pressure solve, molecular model or two-way fluid/solid coupling. The flow passes through peg/ring solids, which still collide as rigid bodies; effective rectangular section ignores their small displaced-volume changes. Pump pressure determines a quasisteady circulation; fluid momentum persistence after input is not solved. Water height matches the chosen constant-section volume ledger, rather than a resolved free-surface mesh.

The free surface stays HORIZONTAL even when gravity tilts: no hydrostatic tilted plane or sloshing. Partial submersion is a linear bounding-extent estimate, not exact submerged torus volume. Existing Cannon angularDamping remains a phenomenological body damping term.

Actual mass flux crosses floor ports at x42/378,y32 and returns at x91/329,y32. Visible intake grates remain at y74 with a separate local approach curl; an unresolved internal conduit connects grate and exchange port. Do not claim actual net flux through the interior visible-grate point. The pipe's spatial shape is unresolved; FIFO volume/flux coordinates carry markers. Small uniform vertical displacement away from port boundary layers is required by changing water height, not an unbudgeted upward background.

Costs are bounded by2 RK2 velocity samples per visible marker per120Hz substep, each sampling2pump states plus constant analytic terms; pipe inverse CDF uses24 bisections only on an actual nozzle exit. No spatial grids, particle-pair fluid solves, new render nodes or unbounded growing collections. Root will profile integrated browser performance separately.
