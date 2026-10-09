# Bridge, greenway, neon and overlap review — October 8

Execution host: DESKTOP-JL99F36. Headed Chromium at 1280×720 used the NVIDIA
RTX 3060. `before/`, `draft/`, `neon-draft/` and `after/` preserve successive
fixed-camera reviews; their JSON records include renderer statistics and page
errors. The first neon draft revealed scene softness and was replaced by
native-resolution scene rendering with bloom's own downsampled blur targets.

`after/` covers the island aerial, Nova storefront, Comet Hotel frontage,
Civic feeder bend, South transfer bridge, Southwest salvage grade, North
garden promenade, Helios–Farms corridor and West Junction frontage. All nine
views loaded with zero page errors. These screenshots preceded the final Void
Market accent-panel repair found by the new overlap audit.

`quality/` records High → Medium → Low → High → Low → High at the same Nova
view. All three High samples used 55 textures, with zero page errors. High
uses HDR bloom; other quality levels retain bright LED cores. Every composer
draw is included in renderer statistics. This checks repeated quality changes
in one view, not a universal GPU budget or performance guarantee.

The shared map appends 46 paired bridge piers and 66 real tree trunks in 15
planting bands. It has 1,669 solids, 183 structures, 267 loot sockets and 22
crate sockets. Existing road planes, structures and socket identities remain
intact. New piers are 1.25m wide and trunk colliders are 0.7m wide at every
quality. Trees reserve full canopy clearance from streets, structures and
interaction sockets. Caps and inside fillets round supported level road
elbows without shortening the original travel corridor or extending beyond
the island; grades retain their authored planes.

## Reusable overlap check

Run `npm run audit:br-overlaps`, or pass a destination JSON path to
`node --import tsx tools/br-overlap-audit.mjs` after building shared.

`overlap-audit.json` checks every pair of 183 building envelopes (16,653
pairs) and 25,804 generated facade, storefront-upright and LED boxes. The
first facade audit found two broad accent panels intersecting upper glazing
on Void Market's north and south walls. Their height now follows the actual
clear interval above the panes. The subsequent audit reports zero building
envelope intersections and zero flagged facade/glazing penetrations.

Backing panels behind windows, foliage and narrow mullions are intentional
joins. The audit flags broad opaque boxes penetrating the outward glass face;
it is not a certification of every decorative triangle or animated figure.
Existing and new physics/route tests separately check authoritative movement,
prediction parity, standing clearance and new supports. Screenshots remain
necessary for silhouette, visual contact and overlap review.

The Classic home preview astronaut is now parented beside the cannon. The
authoritative match spawn is also moved beside the cannon at the same radial
surface height, within the unchanged interaction range. `classic-preview/`
contains the iterative desktop/countdown/compact review.

The island recovery and human art/control-feel acceptance remain open.

Close renders in `void-market/` use the production world builder and BR light
values with fixed north/south cameras. They omit shadows, sky backdrop and
animated figures. The first close render found a generic balcony/railing kit
crossing the south upper facade. That kit had no matching authoritative slab
and is now removed across the map; the saved close views are the final repair.
This additional finding lies outside the facade-box audit's stated scope.

Final typecheck/build and the full unit/system suite are recorded in
`validation.json`. The full E2E run passed 11/11 in 7.3 minutes before this last
visual-only balcony removal. Typecheck/build, full unit/system tests, direct
renders and trusted-input smoke were repeated after that removal. No E2E
deadline, assertion, gameplay condition or performance budget was relaxed.
All five unchanged 10/20/40-participant server performance cases pass within
the full unit suite; no additional standalone timing measurements are claimed.
