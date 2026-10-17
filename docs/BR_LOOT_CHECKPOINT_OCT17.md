# BR loot and playtest recovery checkpoint — October 17

This checkpoint preserves the local work after `c296cbca51a2b9889dd0ea8505aaf1ff583ba3e4`.
The overall recovery pass is unfinished. Continue from the current checkout and
preserve any newer laptop changes before updating; use fast-forward only when clean.

## Included work

- Seven canonical rarity tiers, weighted ground/crate/high-value loot, five new
  weapons (Helix, Comet, Quasar, Prism, Vortex) and four authoritative utilities.
- Weapon models/icons, bounded beam/utility/rarity presentation, bot integration,
  supported and spaced dropped loot, rarity recoil and blocked-shot convergence.
- Solid multiplayer rovers and flying shuttles, seat membership/driver transfer,
  shared flight collision and client prediction.
- Forward glide presentation, movement/jump feedback, distant damage numbers,
  squad HUD, mouse-button icons and held-item motion improvements.
- Server-owned guest-profile persistence for currency, progression and cosmetics,
  with atomic local files or PostgreSQL, cross-room restoration and restart tests.
- Muzzle flashes follow visible held barrels; authoritative traces, beams,
  projectiles and hit registration retain their existing origins and endpoints.

## Validation at this checkpoint

- Typecheck and build passed.
- Full suite: **1,286 tests / 247 files passed**, 258.81 seconds.
- E2E: **14 passed**, 5.5 minutes.
- Unchanged 10/20/40-player server performance cases passed in the preceding
  integration run; performance limits were not relaxed.
- Twenty-four client-render samples cover six scenes across High/Medium/Low/Auto.
  RTX 3060, 1440x900, median about 16.7ms; one High combat sample had a 33.3ms p95.
  Three matched follow-ups did not consistently reproduce that tail. This does
  not certify older physical GPUs or human subjective acceptance.
- Native mouse-fire checks passed all eleven ranged weapons, including scoped
  Pulse/Rail/Quasar with hidden-model fallback. Controlled starts/loadouts were
  used; these are not natural-match acceptance evidence.

Selected logs/metrics and the detailed development record are retained under
`artifacts/br-human-recovery-oct10/`. The larger raw screenshot/video collection
and ignored diagnostic scripts remain on the desktop; they are not required to
build or run this checkout.

## Resume here

The experimental `astronaut-arm-articulation`, `astronaut-arm-ik` and
`br-weapon-support-grip` helpers are **unimported by gameplay**. Their tests and
source are preserved for continued work. Static pitched poses have geometry
clearance coverage; do not enable them wholesale in `br-game.ts` yet.

Transition audits found that both the original attachment and the proposed rear
handles can penetrate the chest at the start of a reach. Stock retraction alone
does not fix the receiver overlap. The next step is a measured entry correction:
existing initial penetration must never increase and must disappear, with exact
final hand contacts and zero overlap after the correction. Do not visibly return
to the bad attachment during release. Dynamic actions/recoil/LOD and actual
firing presentation still require integration and native review. Keep all
authoritative geometry and aim unchanged for this animation work.

Hosted Fallbucks persistence is **not verified or deployed**. The hosted service
needs a durable PostgreSQL `DATABASE_URL`; see `docs/PLAYER_PROFILES.md`.
Do not assume a successful local restart test proves hosted durability or that
previously discarded wallets can be reconstructed. No hosting configuration,
database provisioning or deployment has been performed.

Continue the remaining human gameplay/visual acceptance work; do not declare
the full pass finished from the automated results above.
