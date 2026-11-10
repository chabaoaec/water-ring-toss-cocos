# Hydrostatic box surface geometry

`src/water-surface.js` is a pure geometry module. It has no renderer, rigid-body,
marker or pump dependencies. The main owner must connect the returned plane to
those systems. This module alone does not change gameplay or deployed output.

```js
import {createWaterSurfaceCache} from './water-surface.js';
const surfaces=createWaterSurfaceCache();
const surface=surfaces.get({
  gravity:world.gravityDirection,
  volume:world.water.tank,
  area:world.water.area,
  bounds:{min:{x:20,y:32,z:-52},max:{x:400,y:540,z:52}}
});
const depth=surface.signedDepth({x:100,y:400,z:0});
const wetFront=surface.frontFacePolygon(52);
const airFront=surface.frontFacePolygon(52,{water:false});
const freeSurface=surface.surfacePolygon3D();
```

`createWaterSurface(options)` solves directly; `createWaterSurfaceCache()` returns
`{get(options),clear()}`. Get returns the same immutable snapshot for unchanged
normalized gravity, volume, area and bounds. Recreate only when those inputs
change; point depth and containment queries do not run a solve.

Defaults are downward gravity, volume48, area48/488 and the bounds above. Area is
the existing game ledger conversion from volume to upright height; it is not the
geometric XZ area. Capacity is `area*(max.y-min.y)`. Upright volume48 gives exactly
`offset=520`. Negative/excess volumes clamp to empty/full. Invalid gravity, area,
volume or bounds fail explicitly with RangeError.

Snapshot API:

- `normal`: normalized `-gravity`, pointing toward the air.
- `offset`: free plane is `normal·point=offset`; wet side is `<=offset`.
- `signedDepth(point)`: positive beneath the plane, negative in air. Uses a
  centered representation for numerical stability; it does not check box bounds.
- `contains(point,tolerance)`: point lies in the box and on the wet side; always
  false for an empty tank. Default tolerance is `1e-11*largestBoxExtent`.
- `inBounds(point,tolerance)`: box test only.
- `volume`, `capacity`, `fraction`, `area`, `center`, `centeredOffset`, `bounds`:
  immutable normalized inputs and result.
- `volumeFractionAt(absolutePlaneOffset)`: analytic box fraction below a parallel
  plane, primarily useful for diagnostics.
- `clipPolygon(points,{water=true})`: clips an ordered convex 3D polygon to the
  requested side of this plane, preserving order and removing duplicate points.
- `facePolygon(axis,side,{water=true})`: clipped box face, axis `x/y/z` and side
  `min/max`. Ordering is valid for filling; outward winding is not guaranteed
  consistently between different faces.
- `frontFacePolygon(z=bounds.max.z,{water=true})`: clipped XY rectangular slice.
- `frontFaceLine(z=bounds.max.z)`: two plane/face intersection points, or empty
  when absent, empty/full tank or the entire face is coincident with the plane.
- `surfacePolygon3D()`: ordered 3–6 vertex plane/box cross section for rendering;
  empty for empty/full tank. Order is around the plane normal. Project these
  points using the existing `y+.32*z` projection to retain depth geometry.

The volume equation uses a stable piecewise convolution CDF for the projection
of a uniform rectangular box. It handles exactly zero components without
threshold-dropping small axes, reflects the upper tail, and uses at most52
bisections. Axis-aligned gravity is solved directly. Geometry helper allocations
are bounded by the six faces and twelve edges; per-point queries allocate none.

Tests: `node --test tests/water-surface.test.js`. Eight meaningful cases include
399 planes checked against independent tetrahedron integration of the clipped
polyhedron, inversion and mirror symmetry, extreme near-axis directions,
upright height, face partitions, projection bounds and cache behavior. Maximum
observed independent geometric fraction error was `5.551115123125783e-16`.

Limits: instant hydrostatic equilibrium only. No slosh, pressure or momentum
solver, marker remapping, obstacle displacement, surface tension or physical
transient free boundary. No real-phone or browser frame-rate validation is
claimed by this module. A Node development microbenchmark was recorded
separately; it is not browser performance evidence.
