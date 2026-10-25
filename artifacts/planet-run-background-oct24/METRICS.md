# PlanetRun background rendering samples - October 24, 2026

Native in-app Chromium, RTX 3060 / D3D11, 1280x720, seed 42, Normal, 30 pilots, unchanged center camera. Each sample uses the last 180 frame times after 3.6 seconds settling. No heavy validation runner was active. High and Low have fresh matched baseline samples; Medium and Auto are post-change checks only. Auto resolved to Medium.

Refresh-capped data demonstrate maintained cadence on this PC, not uncapped GPU headroom or a guarantee for older hardware. Bot positions, eliminated pilots, meteor state and collapsing tiles vary. Global GPU calls/triangles include pilots, so individual differences are not isolated backdrop costs. World batches are visible Mesh/Points before frustum culling. Instance totals are scene capacities, including pooled zero-scaled instances; material totals include off-frustum scene materials.

B -> A is before -> after. A dash means no new baseline measurement at that preset.

| Quality | Round | World batches B -> A | GPU calls B -> A | Triangles B -> A | Instances B -> A | Materials B -> A | Median ms B -> A | p95 ms B -> A |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| high | cargo-cyclone | 77 -> 91 | 65 -> 76 | 21704 -> 24560 | 1215 -> 1424 | 291 -> 299 | 16.70 -> 16.70 | 16.80 -> 16.80 |
| high | solar-sweep | 73 -> 91 | 927 -> 817 | 86614 -> 85338 | 1783 -> 1928 | 289 -> 297 | 16.70 -> 16.70 | 16.80 -> 16.80 |
| high | meteor-garden | 108 -> 126 | 995 -> 990 | 108784 -> 145346 | 885 -> 1161 | 322 -> 333 | 16.70 -> 16.70 | 16.80 -> 16.80 |
| high | flux-gardens | 98 -> 116 | 101 -> 121 | 55126 -> 94034 | 1058 -> 1304 | 321 -> 329 | 16.70 -> 16.70 | 16.80 -> 16.80 |
| high | capacitor-causeway | 83 -> 94 | 76 -> 89 | 79546 -> 86022 | 1351 -> 1553 | 296 -> 305 | 16.70 -> 16.70 | 16.80 -> 16.80 |
| high | shatterdeck | 42 -> 52 | 883 -> 961 | 109438 -> 114966 | 2183 -> 2391 | 270 -> 289 | 16.70 -> 16.70 | 16.80 -> 16.80 |
| medium | cargo-cyclone | - -> 87 | - -> 73 | - -> 22940 | - -> 1309 | - -> 299 | - -> 16.70 | - -> 16.80 |
| medium | solar-sweep | - -> 90 | - -> 773 | - -> 81002 | - -> 1797 | - -> 297 | - -> 16.70 | - -> 16.80 |
| medium | meteor-garden | - -> 124 | - -> 1073 | - -> 148862 | - -> 1083 | - -> 331 | - -> 16.70 | - -> 16.80 |
| medium | flux-gardens | - -> 114 | - -> 119 | - -> 92694 | - -> 1246 | - -> 329 | - -> 16.70 | - -> 16.80 |
| medium | capacitor-causeway | - -> 92 | - -> 81 | - -> 84586 | - -> 1401 | - -> 297 | - -> 16.70 | - -> 16.80 |
| medium | shatterdeck | - -> 51 | - -> 926 | - -> 112598 | - -> 2331 | - -> 283 | - -> 16.70 | - -> 16.80 |
| low | cargo-cyclone | 68 -> 78 | 59 -> 67 | 19052 -> 21152 | 1039 -> 1184 | 204 -> 211 | 16.70 -> 16.70 | 16.80 -> 16.80 |
| low | solar-sweep | 67 -> 82 | 377 -> 445 | 53270 -> 64742 | 1279 -> 1375 | 202 -> 210 | 16.70 -> 16.70 | 16.80 -> 16.80 |
| low | meteor-garden | 99 -> 111 | 559 -> 593 | 86956 -> 123510 | 743 -> 922 | 231 -> 235 | 16.70 -> 16.70 | 16.80 -> 16.80 |
| low | flux-gardens | 88 -> 102 | 93 -> 109 | 46142 -> 81214 | 878 -> 1063 | 234 -> 241 | 16.70 -> 16.70 | 16.80 -> 16.80 |
| low | capacitor-causeway | 79 -> 87 | 77 -> 84 | 77422 -> 83794 | 1228 -> 1369 | 212 -> 216 | 16.70 -> 16.70 | 16.80 -> 16.80 |
| low | shatterdeck | 35 -> 42 | 502 -> 462 | 80434 -> 79488 | 1564 -> 1734 | 202 -> 194 | 16.70 -> 16.70 | 16.80 -> 16.80 |
| auto | cargo-cyclone | - -> 87 | - -> 74 | - -> 22952 | - -> 1309 | - -> 299 | - -> 16.70 | - -> 16.80 |
| auto | solar-sweep | - -> 90 | - -> 893 | - -> 88646 | - -> 1797 | - -> 297 | - -> 16.70 | - -> 16.80 |
| auto | meteor-garden | - -> 124 | - -> 930 | - -> 139807 | - -> 1091 | - -> 332 | - -> 16.70 | - -> 16.80 |
| auto | flux-gardens | - -> 114 | - -> 119 | - -> 92694 | - -> 1246 | - -> 329 | - -> 16.70 | - -> 16.80 |
| auto | capacitor-causeway | - -> 92 | - -> 80 | - -> 84522 | - -> 1393 | - -> 296 | - -> 16.70 | - -> 16.80 |
| auto | shatterdeck | - -> 51 | - -> 858 | - -> 109950 | - -> 2331 | - -> 271 | - -> 16.70 | - -> 16.80 |

All 24 final samples were in running phase with 30 roster entries. See client-render-samples.json for raw records. Background-specific batch costs: Cargo12, Solar16, Meteor16, Flux16, Capacitor11, Shatter8; sky adds2. All-world Mesh/Points including hidden detail:89/92/190/115/108/50, respectively, against the unchanged <200 assertion. Browser canvas labels are additional small meshes and remain under200.

Player-camera checks used real W and Space input in all six rounds, with before/after native screenshots and authoritative positions in player-checks.json. No errors appeared in the native browser log. These are targeted movement/readability checks, not a claim of full human gameplay acceptance for the entire mode.
