# PlanetRun validation evidence

See ../../docs/PLANETRUN_IMPLEMENTATION.md for architecture, rules and final validation.

## Native client samples

Actual in-app browser, 1280x720, NVIDIA RTX 3060 ANGLE Direct3D11.
Thirty-pilot starting rosters; survival captures may follow human elimination.
Short vsync-capped samples do not certify weak hardware or establish an
optimization gain. Scene instances/materials are inventories, not exact
frustum-visible counts. Earlier SwiftShader evidence is separate.

| Selection | Six-round samples | Median ms | P95 ms | Snapshot calls |
| --- | ---: | ---: | ---: | ---: |
| low | 6 | 16.7-16.7 | 16.8-16.8 | 42-251 |
| medium | 6 | 16.7-16.7 | 16.8-16.8 | 42-431 |
| high | 6 | 16.7-16.7 | 16.8-16.8 | 41-460 |
| auto | 6 | 16.7-16.7 | 16.8-16.8 | 42-1040 |

Auto selected Medium. native-final-hazard-metrics.json adds three matched
High and three Low samples after the machinery presentation changes, retaining
16.7ms median/16.8ms P95.

## Native play

Normal held keyboard/mouse input was used, without injecting positions, clocks
or finishes. Verified successful race qualifications:

- capacitor-native-finish-attempt.png: successful qualification despite filename.
- flux-native-continuous-route.png: successful complete route (Easy bots).
- cargo-native-finish-verified.png: successful complete route (Easy bots).

Failed Flux/Cargo attempts are retained as failure evidence; files named
flux-native-full-route.png, flux-native-route-after.png, cargo-native-finish.png
must not be presented as successful qualifications. Other captures cover Solar
impacts/recovery, Meteor warnings, Shatterdeck lower-deck routing/elimination,
spectating, pause, shared shop/pass and responsive home/lobby.

Embedded Chromium rejected pointer lock. The implemented gameplay-only drag
fallback was verified with real mouse input: yaw 0 to -0.5, pitch .38 to .46;
Escape opened pause and restored UI control. Final E2E also checks right-drag.

Physical controller hardware was unavailable. Mapping, sensitivity/invert and
fixed-step camera behavior have regression coverage; physical-device acceptance
is not claimed. Final logs are included: typecheck/build pass, 1,355 tests across 262 files pass,
and all 22 E2E paths pass in 12.0 minutes. Automated-final JSON/PNG files capture
the final hazard presentation; these software-renderer samples are separate
from the native RTX 3060 measurements. No test budgets or timeouts were relaxed.

Repository log copies normalize trailing whitespace; original process logs remain
in .local-runtime. Automated final filenames identify the requested selector;
the JSON quality field records the effective preset (Auto chose Medium).
