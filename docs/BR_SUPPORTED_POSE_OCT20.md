# Supported held-item integration — October 20

Continued on DESKTOP-JL99F36 from `76796b0a278c85a33efcbde8688d8a2b6c32cc6c`.
Existing tracked and untracked work was preserved. No reset, restore, stash,
deployment or hosting configuration change was performed.

## Current implementation

Helix, Quasar, Prism and Vortex now use the integrated supported-arm helpers.
The older articulation/support prototypes remain preserved separately. The new
controller coordinates the original sleeves, gloves, weapon grips, stock entry,
recoil and reload service path. It borrows canonical materials and the game's
shared support geometry; it owns and disposes its sleeve geometry and skeletons.

True shot direction determines presentation facing. A belt-pivot torso tilt
carries extreme aim outside the comfortable arm range, preserving world aim.
Shot origins, hit registration, camera direction, physics and networking are
unchanged. Confirmed remote shots and held local fire retain the firing pose
between bursts, independently of legacy muzzle-flash anticipation.

Reload follows the current wrist and aim every frame. Visible interruption
finishes the existing clear return path; hidden/model-swap boundaries dispose
the controller. Reload interruption during equip cannot resume an older,
partially completed equip blend. Optimistic local slot selection chooses the
correct model immediately instead of waiting for the held-item snapshot.

## Native checks completed

- Actual mouse firing/strafe and R-key reload with mouse turning passed for
  Helix, Quasar and Prism in the current game. Vortex passed in a fresh room,
  firing from two rounds to one and reloading back to two. The earlier reused
  room's Vortex reload timeout is retained; its fixture did not reset or record
  reserve plasma after preceding cases, so it cannot establish a reload defect.
  These checks use controlled authoritative loadouts.
- Actual slot changes during reload, V-key emote, E-key rover boarding/exit,
  controlled downing/deployment and game deactivation passed. Hidden states
  had zero articulated sleeves; visible recovery restored exactly two with a
  valid supported pose. No browser errors were recorded.
- Matched full-body front/side seam views retain the same sprint leg pose.
  The extreme upward torso split did not introduce a visible boot fragment,
  sole penetration or floating hip gap in those reviewed views.
- Visual review found no confirmed new clipping or detached support hardware
  in the four live weapon screenshots. Straight rear Helix/Prism screenshots
  obscure grip contact and cannot independently certify it.

These checks are agent-driven native-input and controlled geometry evidence,
not a claim of subjective human acceptance or certification of every pose.

## Completed local validation

Fresh typecheck and build passed. The full suite passed **1,314 tests across
257 files**, including unchanged server performance cases. Two independent
clients passed remote held-fire facing and repeated near/impostor/near
transitions: two sleeves when supported, zero when hidden, no browser errors.

Twenty-four matched client samples completed across Starliner, Nova street,
Mall interior, south Transfer approach, storm boundary and nine-bot combat,
each at High/Medium/Low/Auto. On this RTX 3060 at 1440x900 DPR1, medians were
about 16.7ms; p95s ranged from 16.8 to 17.3ms. Low used 1036x648 internal
resolution versus High's 1440x900 and reduced world detail. Vsync limits
performance conclusions; live combat draw counts vary with effects and bots.

An additional supported-weapon crowd fixture failed its explicit multiple-pose
check in a reused room. That failure remains recorded; its exact cause was not
established. A fresh-room diagnostic passed at all four qualities with multiple
valid supported pilots and real authoritative shot events. High/Medium p95s
were 33.4ms; Low/Auto were about 16.8ms. A settled High follow-up measured all
player updates at 0.5ms median, 1.1ms p95 and 2.5ms maximum, while the total
frame p95 remained 33.3ms. Pose work averaged about 0.23ms per frame. These
results do not establish the cause of every slow frame or certify older GPUs.

Fresh E2E passed **14/14 in 5.9 minutes**. Actual mouse turns, vertical aiming,
strafing and jumping retained valid supported poses and barrel/shot alignment
within the unchanged 0.01 direction-error threshold. Twelve additional native
source screenshots cover carry front/side and reload front for all four
weapons; no confirmed grip detachment or body penetration was found. Direct
front reload framing can obscure the face behind larger barrels.

The Shop/Pass static copy now describes browser-profile persistence instead of
incorrectly claiming progress resets when the room closes. Pass captions are
larger/brighter with horizontally scrolling reward cards; desktop hotbar names
have three lines within the existing slot bounds. Desktop and 390px Pass views
pass bounds, close-button visibility and cursor checks. Three targeted E2E
checks pass after these CSS changes; the post-copy/CSS build passes.

A fresh normal ten-player round passes native gameplay acceptance: natural
loot, actual skimmer boarding, four driving legs, nine confirmed outgoing
damage events, results, home exit, pointer lock released and zero remaining
server rooms. Recorded inputs include 1,196 trusted key events and 773 trusted
mouse events, zero untrusted inputs and zero browser errors. No fixture
mutation, teleport, loadout or result injection was used. A separate natural
route collected a Helix and exited cleanly, but did not board its targeted
vehicle; it is not counted as vehicle acceptance. The first direct-to-loot
route failed against an exterior wall; corrected guidance uses entrances.

An exact hotel camera check reproduced the wall-filled view from an indoor
route. Camera and player remain on the same correct side of the partition;
the player was looking toward that nearby wall. This is not demonstrated
camera penetration, and no collision geometry was removed to clear the view.

### Initial hosted storage diagnosis

Initial read-only checks found the deployed profile-token handshake but health
reported file storage. After sign-in, the dashboard confirmed Free/Oregon,
checkpoint `259dc61`, no DATABASE_URL, no linked environment groups and no
database in the project. Render Free local files are ephemeral. A paid Render
Postgres proposal was prepared but never submitted; the user requested a free
alternative. See [PLAYER_PROFILES.md](PLAYER_PROFILES.md).

### Subsequent authorized free hosting setup

The user declined paid storage and explicitly authorized Neon Free setup.
Created Planetfall / production / planetfall_profiles in Oregon on Neon Free;
connected the pooled TLS DATABASE_URL to the existing Free Render server.
The successful environment deploy `dep-dbc1123ncjis73fvd6r0` reports PostgreSQL
storage through public health. No paid database was created. This supersedes
the unsubmitted paid proposal and earlier no-deployment authorization above
only for this database setup and its required restart acceptance. The normal
private hosted match and durability results follow.

### Hosted durability acceptance completed

Normal private hosted BR match awarded **10 Fallbucks / 60 XP** from zero.
Both values survived BR leave, Classic room creation and a fresh Socket.IO
client handshake using the same guest identity. With no rooms active, restarted
the Render service and verified uptime reset from over 500 seconds to 25.9
seconds. A new handshake against that restarted PostgreSQL-backed process
restored the same 10 Fallbucks / 60 XP. All checks passed without injected
wallet values, forced results, fixture endpoints or modified match clocks.

Evidence: `artifacts/br-human-recovery-oct10/hosted-neon-earned-oct20.json` and
`hosted-neon-profile-oct20.json`; Free plan proof `neon-free-project-oct20.png`;
masked environment proof `render-neon-connected-oct20.png`. The reconnect check
validates server durability, not a fresh visual browser-refresh playtest. The
guest token remains in an ignored local diagnostic file, never in this evidence.
No source changes were necessary for this hosting correction. Existing full
suite/build/E2E results belong to checkpoint 259dc61; they were not rerun for
these documentation-only changes. Previously lost wallets remain unrecoverable.
