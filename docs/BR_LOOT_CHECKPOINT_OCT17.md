# BR loot and playtest recovery checkpoint — October 17

Latest continuation: [October 20 supported-pose integration](BR_SUPPORTED_POSE_OCT20.md).
The chronological prototype notes below describe earlier states; the new
supported-arm controller is now integrated for Helix/Quasar/Prism/Vortex.

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

## Local continuation after this pushed checkpoint

Newer local changes may include a per-player firing-pose clock (including new
weapon modes and remote confirmations), and safe `/health.profileStorage`
reporting. Local mouse-input checks covered Helix/Quasar/Prism firing while
strafing; local profile-health/reward/restart checks passed. The latest full
suite passed 1,292 tests across 249 files. These changes have not been pushed.

The entry prototype now has measured monotonic penetration recovery and exact
final grip tests, plus forty sampled native entry frames. Its local pitch range
is [-1.15, .8]. It remains unimported: turning locomotion requires additional
local yaw and slightly wider pitch compensation after inverting the upper-body
transform. Scratch shoulder protraction can restore reach, but extreme yaw can
detach a shoulder pad. Do not promote that scratch solution or clamp away aim
error. Resolve shoulder continuity and actual world-space aim before integration.

October 18 validation: the fresh full suite passed 1,295 tests across 250 files;
build passed. The added `br-held-aim` helper is still unintegrated. It converts
world shot direction through the animated parent matrix without changing or
clamping authoritative aim. Two-client native checks also confirmed remote
Helix/Prism firing-facing presentation.

Scratch sleeve work found folds in the two-bone deformation and surface
intersections missed by coarse vertex tests. A midpoint blend bone visibly
improves the elbow, but stronger triangle clipping still rejects some poses.
Do not promote the scratch rig based on the earlier distal-only checks. Keep
the full-surface clearance tests and native silhouette review as acceptance
requirements. Details and failed candidates are recorded in the development
log; scratch experiments remain under the ignored desktop `.local-runtime`.

The October 18 static margin candidate now passes full sleeve-triangle/body
clipping, pad/helmet checks and sampled fold checks, and its native static views
were reviewed. It is still scratch-only. The next gate is entry recovery:
`arm-margin-entry-oct18` fails idle/ADS/crouch when Prism aims upward at local
pitch -1.2 and entry weight .075. The telescoping rear box at local position
(0,.01,.1476) enters the chest module; penetration grows from about 53.2mm to
58.5mm instead of decreasing. Sprint passes. Preserve the failed assertions and
diagnostic witness; fix the stock/receiver/aim transition sequencing before
promoting the candidate. Passing the static pose is insufficient.

October 18 held-fire correction: native Helix strafe/held-fire baseline reproduced
body-facing oscillation between bursts. `br-game.ts` now retains local camera-facing
pose while eligible fire input is held, independently of the recent-shot timer.
The identical after check passed 72 settled samples with maximum yaw error about
.04 radians. Separate native lifecycle checks passed release back to travel-facing
(1.55 radians), UI capture clearing held-fire, and pointer-lock release. No weapon
cooldowns, ammo, shot geometry or authoritative state changed. Typecheck, build
and 18 focused tests pass; a fresh E2E run is in progress. Raw evidence uses
`firing-hold-*-oct18` names. No commit/push/deployment.

Fresh E2E after held-fire correction: 14/14 passed in6.1min
(`firing-hold-e2e-oct18.txt`). Three permanent integration regression cases
verify confirmed burst/beam/charge shot clocks for local and remote pilots
without changing flash deduplication (`br-firing-pose.test.ts`); typecheck passes.
Scratch stock-before-rotation sequencing and temporary .06m forward arm margin
now pass corrected full-surface entry and lifecycle checks. The initial arm
baseline comparison had omitted the original CapsuleGeometry sleeve; its false
increase was rejected. Corrected comparison includes both sleeve versions with
the same proximal cutoff. Dynamic aim/actions/recoil/LOD are not yet accepted.

October18 native follow-up: sustained strafe/held LMB passes Helix, Prism and
Vortex, including charge wind-up (9/13/1 confirmed shots during sampled holds;
no browser errors). Evidence firing-modes-hold-native-oct18.json. Native scratch
Prism entry24frames passes sleeve uniqueness and exact hidden-unequip restoration;
parent reviewed .25 side and .1 front samples. Settled moving aim/locomotion
sweeps pass in scratch, but recoil/actions and abrupt unsupported local aim
remain unaccepted. The articulation is still not imported by gameplay.

October 18 latest validation: full suite passed 1,298 tests / 251 files in
322.01 seconds (`firing-pose-full-test-oct18.txt`). E2E remains 14/14 passed
after the held-fire correction; build and typecheck pass. No commit/push/deploy.
Scratch moving aim, aim-changing entry and coordinated 20mm recoil pulses pass
within the bounded domain. Near-vertical expansion remains rejected: Quasar
optic/helmet, Helix endpoint/helmet and alternate sleeve/body witnesses exist.
Reload at arbitrary aimed orientation can exceed left-arm reach; deliberate
receiver lowering plus asymmetric hand path is still under investigation.
The new articulation remains outside gameplay.

Native actual-input domain capture (`held-pose-domain-native-oct18.json`)
confirms abrupt mouse turning while strafing/firing produces local yaw near
[-3.03,3.09] and pitch[-1.23,.95]. The bounded scratch articulation cannot
be enabled as-is. Never clamp authoritative aim or quietly fall back to the
clipped attachment. Presentation body-following/stabilization is being probed
without production changes.

Additional diagnostic status: the two live-transform facing probes are invalid
because quaternion restoration can choose an equivalent Euler decomposition
that contaminates subsequent component-only edits. Retained as failed probes.
The pure-matrix probe performs no live transform writes: planar body alignment
reduces local yaw to approximately zero, but sampled pitch[-1.23,.99] still
exceeds the bounded helper. This is mathematical diagnostic evidence, not native
acceptance of a visible body-following transition. No production pose integration.

Development log recovery: an encoding failure during append truncated the log.
Recovered HEAD text plus 13 exact session append blocks and the two original
prose corrections; backup retained under ignored .local-runtime. Subsequent
writes explicitly use UTF-8. Gameplay source and raw evidence were unaffected.

Filtering the valid matrix probe to eligible held fire and unblocked shots
still shows actual local yaw[-2.39,1.12], proving the issue is not only blocked
carry. The same47 frames under hypothetical aligned/stabilized parent produce
local yaw approximately zero and pitch[-1.231,.763]. This supports further
body-presentation investigation; no live body-following change is shipped.
A separate settled geometry grid passes[-1.25,1.05] pitch across5yaws/fourstates,
but its entry/recoil/action acceptance is pending.

Latest native modest-domain check: 96 captures (Prism/Quasar, pitch-1.25/+1.05,
yaw +/-.4, six entry weights, front/side) completed without browser errors.
One visible sleeve per arm and exact hidden-unequip restoration asserted for
every sample. Parent reviewed Quasar-up final side and Prism-down final front.
`arm-modest-entry-native-oct18.json` retains the report. Scratch only: body
following, visible action/reload/LOD transitions and full vertical convergence
remain unaccepted. No new commit, push or deployment.

October19 continuation: execution verified on DESKTOP-JL99F36, local dirty
work preserved. Two independent clients pass sustained Helix fire/strafe
observer check:72 settled samples, maximum facing error .04012rad, no browser
errors (`remote-held-pose-before-oct18.json`). Despite the filename, this was a
read-only regression check and passed: authority already includes held fire in
the remote aiming hint. No new networking change is needed. Reload remains
isolated scratch work; no commit/push/deploy.

October19 moving preview: scratch-only live adapter performs reset before
locomotion, true-shot planar body following, torso stabilization, inverse-parent
local aim and supported entry. Actual mouse turning/strafe/heldfire produced
140 frames, all in-domain;134 settled samples match visible barrel direction
to shot direction within4.02e-16. No browser errors. Evidence
`supported-moving-preview-oct19.json` and screenshot. This omits recoil/actions
and unrestricted convergence, and does not establish gameplay acceptance.
Production source is unchanged by this preview.

Scratch torso/arm split preview passed166 real-input frames,158settled visible
barrel direction checks (max3.73e-16 error). Rawpitch[-1.23,.93] is shared between
torso[-.13,.03] and arms[-1.1,.9], preserving true shot direction. Extra front/side
views were corrected to follow character yaw; first world-fixed front labels
were invalid as front appearance evidence. Parent reviewed corrected up-front
and down-side; camera pitch labels do not assert actual close-range shot pitch.
Full-body clearance, full vertical convergence, actions/recoil and lifecycle
remain pending. This is an isolated browser adapter, not production changes.

Reload scratch sequence currently passes receiver/body/helmet clearance but
additional checks rejected brace contact and then actual glove-to-glove overlap.
The latter is39.07mm faceted-mesh penetration (center distance310.5mm explains
it; it is not merely a sphere-only rejection). Intentional handle grasp is
separate from unintended brace/receiver/glove intersections. Preserve the failed
witnesses and require actual clearance before folding braces. No promotion.

October19 reload validation: direct installed Vitest invocation passes the saved
centered-service contract4/4 in30.70s (`reload-centered-contract-parent-oct19.txt`).
The earlier npx attempt stalled before test startup and was interrupted; it is
not counted. Native sampled reload72frames across4weapons/9progress/front-side
passes zero errors, sleeve uniqueness and exact hidden teardown; reviewed Quasar
service-front/Vortex brace-fold-side. Actual R-key reload while strafing in an
isolated adapter passes194frames,127reloadframes, no errors, restored exact
barrel/shot alignment (`supported-live-reload-oct19.json`). This uses the older
bounded reload arm adapter and is NOT integrated with modest-domain torso/recoil
or unrestricted action/LOD lifecycle. Those combined gates still remain.
Visuals agent reached usage limit; new presentation implementation is unavailable
for now, while saved candidate validation was completed by Sol. No production
promotion, commit, push or deployment.

Moving-aim reload regression: actualR while strafing, mouse turns during reload,
then settles before completion. Cached-start adapter fails at progress.9942
with barrel/shot direction error.18887 (`moving-aim-reload-before-oct19.json`).
Current-aim/current-wrist each-frame combined adapter passes the SAME check at
progress.9944 with error.000598 (`moving-aim-reload-after-oct19.json`). The
assertion remains.05; no test weakening. This is scratch browser integration,
not yet gameplay source. New combined helper production preparation is delegated
to visuals after its remaining focused gates.
