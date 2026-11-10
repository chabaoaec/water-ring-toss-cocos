# Scoring stability and tilted-hole geometry

This patch keeps the initial capture requirement: a genuinely threaded ring must
have a real platform-rooted support chain, speed below10, angular speed below1.1,
and continuous qualification for0.7s. Once captured, it remains counted while
threaded on the same post; transient support gaps do not remove its score.
Leaving that post resets both capture and the qualification timer. Physics keeps
running, and contacts, forces, geometry and water accounting are unchanged.

The previous circle bounding an oblique post section lost the direction of ring
center offset. The new conservative32-sided circumscribed polygon encloses the
post ellipse. Vertices are precomputed; a circle fast accept and radius fast
reject avoid the polygon for ordinary seated rings. The taper bound is
`min(4.6,r_axis/(1-|slope|tan(tilt)))`, slightly more conservative than the old
axis-radius circle. The denominator is positive for the retained normal cutoff.

A thin hole-plane containment test is insufficient for a thick ring. Additional
acceptances must also clear every one of the24actual sphere shapes against a
closed round tapered frustum enclosing Cannon's16-sided post. Closest distance
uses endpoints and the stationary points of the inner/outer radial regimes.
This additional3D guarantee does not cover the pre-existing circle fast path.
Touching the post can still be conservatively rejected; this is not a new claim
that all visually overlapping or physically threaded poses can be recognized.

Focused tests cover a verified60-degree tilted offset ring, a steep-tilt tube
intersection, post caps/interior, dense independent tapered-section samples,
real8-ring contact jitter and departure, plus the unchanged never-captured
suspended-ring rule. Artificial placements are diagnostic fixtures, not proof of
natural completion. A normal seed43 finite-button score remains covered by the
existing gameplay regression.

Detailed original-mass and denser-mass timelines, old failures and independent
math review are retained in the project acceptance directory
`acceptance/v5.4/scoring/README.md`. The exact reported screenshot's live rigid
body/contact state is unavailable; these are reproducible bugs, not a claimed
reconstruction of that particular screenshot. Whether first threading alone
should count is a separate user-facing rule decision, not changed here.
