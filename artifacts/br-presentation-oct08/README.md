# Orbital Isle facade and plaza review — October 8, 2026

Capture platform: DESKTOP-JL99F36, headed Chromium, 1280×720, normal High
quality, ANGLE/NVIDIA GeForce RTX 3060/D3D11. Both capture sessions reported
zero page errors. `review.json` in each folder retains GPU and actual scene
statistics. These are fixed-camera inspections, not traversal or human feel
acceptance.

`glazing/` contains the first three matched views after facade integration,
before plaza tint/UV integration. `integrated/` contains the final nine views.
Earlier committed reference views are in
`../br-review-pc-oct08/nova-facade-checkpoint/` with the same camera names.

- West Junction: the old thick bars no longer bisect display panes or end
  partway up the glazing. The replacement uprights follow the outer pane edges;
  the authoritative entrance remains open.
- Nova storefront/east block: shaded reflected glazing replaces uniform beige
  lit panes. The new material is separate from interior luminaires.
- Nova, Academy and aerial: the five existing plazas use restrained authored
  district tints. Normalized clipped-fragment UVs are scaled to eight-metre
  texture repeats, giving the existing grid 1.5m joints. Geometry, height seams,
  route markings and texture ownership are unchanged.
- Solar Service: attached frontage belts remain clear of glazing.
- Nova office threshold and Civic feeder bend: existing ramp/door and road
  layout are retained; screenshots alone do not establish traversal.

Resource additions are one shared 64×64 glazing texture, one facade material,
and five cached plaza material clones. The plaza clones share the existing
sidewalk detail textures. No new lights, props, pattern meshes or draw batches
were added. Scene visibility varies between captures, so individual FPS/call
readings are observations rather than a controlled performance comparison.

`playability/` retains the subsequent headed trusted-input smoke: pointer lock,
362.4162° ship orbit, 363.0261° ground orbit, freefall/Ion Wings and a living
grounded landing at `(272.2182,.0350,242.5702)`, with zero page errors. The
landing view is beside a wall and does not establish all-route camera feel.
`validation.json` records the completed checks and the interrupted first E2E
attempt separately from the passing stable-source run.

Large plaza footprints, repeated shells and broad interdistrict spaces remain
visible. This is a presentation checkpoint, not completion of island recovery.
