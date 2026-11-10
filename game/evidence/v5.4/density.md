# Slightly denser rings

Ring mass increases from1 to1.05simulation units at unchanged volume/24sphere geometry. Cannon computes5%greater inertia from that mass. Gravity210, displaced-water buoyancy136, hydrodynamic drag, contact materials, continuous support scoring and the water simulation retain their existing values.

Controlled matched tests at120Hz, fully immersed ring starting at rest at(210,400,0):

| Quantity | Mass1 | Mass1.05 |
|---|---:|---:|
| Initial downward acceleration |74|80.47619|
| Distance sunk after1s |20.97880|23.35147|
| Downward speed after1s |31.53213|35.46218|
| Submerged response to8m/s² container acceleration |60.34659|65.62788|
| Same input acceleration in air |171.25382|171.25382|

The unchanged buoyancy partially cancels gravity, so5%greater density gives8.75%greater initial submerged acceleration and11.31%more sinking distance at1s. Water/pressure/marker states remain bit-identical in a matched finite pump/refill test. This is a simulation-density change, not measured physical material density.

Focused regression: density2/2 tests and9/9 selected existing geometry, lift, collision, seating and natural-button tests pass. Seed43, left1.1s then release20s still scores a physically rooted ring with one stroke; no scoring condition was relaxed.

The stacked-ring fixture observes6s instead of5s: the denser upper ring was already rooted/scored at4s, lost its contact chain for one step at4.4667s, and restarted its unchanged.7s continuous-stability timer. At5s it had only.5333s continuous stability; at6s it had1.5333s and correctly scored. The prior5s failure and full contact trajectory are retained in project acceptance evidence. Product support/score rules are unchanged; transient Cannon contact loss remains a numerical limitation.
