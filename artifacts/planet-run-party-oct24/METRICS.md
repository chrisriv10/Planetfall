# PlanetRun matched client rendering samples — October 24, 2026

Native in-app Chromium, NVIDIA RTX 3060 / D3D11, 1280×720, seed 42, Normal difficulty, 30 pilots, deterministic center camera. Each sample retains 180 frame times after a 3.7-second settling window. High repeats the baseline movement/jump/dive input sequence; other presets remain at the normal spawn. No heavy validation runner was active during measurements.

Frame times are refresh capped. These data establish maintained cadence on this PC, not an uncapped speedup or a guarantee for every GPU. Meteor timing, pilot survival, tile collapse and visibility vary between samples. Global GPU calls/triangles and scene material/instance totals therefore vary even with matching setup. The landmark camera was refined after baseline, but these measurements use the unchanged center camera.

World batches below are visible scene Mesh/Points objects before frustum culling; GPU calls are renderer.info.render.calls for the entire frame, including pilots. Visible-instance totals are InstancedMesh capacities in visible scene nodes, including zero-scaled pooled instances/cells; they are not a count of surviving physical cells. Material totals include visible scene materials even when outside the camera frustum.

B→A means baseline → after. Auto resolved to the existing Medium runtime preset here.

| Quality | Round | World batches B→A | GPU calls B→A | Instances B→A | Materials B→A | Median ms B→A | p95 ms B→A |
|---|---|---:|---:|---:|---:|---:|---:|
| high | cargo-cyclone | 90 → 77 | 504 → 609 | 734 → 1215 | 279 → 291 | 16.70 → 16.70 | 16.80 → 16.80 |
| high | solar-sweep | 93 → 73 | 603 → 792 | 389 → 1775 | 243 → 271 | 16.70 → 16.70 | 16.80 → 16.80 |
| high | meteor-garden | 92 → 99 | 972 → 1036 | 477 → 853 | 298 → 304 | 16.70 → 16.70 | 16.80 → 16.80 |
| high | flux-gardens | 90 → 98 | 348 → 185 | 652 → 834 | 281 → 293 | 16.70 → 16.70 | 16.80 → 16.80 |
| high | capacitor-causeway | 85 → 81 | 151 → 197 | 537 → 1241 | 280 → 287 | 16.70 → 16.70 | 16.80 → 16.80 |
| high | shatterdeck | 10 → 42 | 392 → 354 | 543 → 2119 | 118 → 123 | 16.70 → 16.70 | 16.80 → 16.80 |
| medium | cargo-cyclone | 90 → 74 | 66 → 63 | 734 → 1109 | 279 → 291 | 16.70 → 16.70 | 16.80 → 16.80 |
| medium | solar-sweep | 93 → 72 | 895 → 946 | 405 → 1652 | 279 → 289 | 16.70 → 16.70 | 16.80 → 16.80 |
| medium | meteor-garden | 90 → 101 | 1035 → 1055 | 497 → 843 | 308 → 321 | 16.70 → 16.70 | 16.80 → 16.80 |
| medium | flux-gardens | 90 → 96 | 65 → 97 | 652 → 984 | 281 → 319 | 16.70 → 16.70 | 16.80 → 16.80 |
| medium | capacitor-causeway | 85 → 79 | 62 → 65 | 537 → 1153 | 280 → 287 | 16.70 → 16.70 | 16.80 → 16.80 |
| medium | shatterdeck | 10 → 41 | 693 → 669 | 587 → 2107 | 208 → 219 | 16.70 → 16.70 | 16.80 → 16.80 |
| low | cargo-cyclone | 90 → 68 | 66 → 59 | 734 → 1039 | 192 → 204 | 16.70 → 16.70 | 16.80 → 16.80 |
| low | solar-sweep | 93 → 67 | 497 → 446 | 405 → 1279 | 192 → 202 | 16.70 → 16.70 | 16.80 → 16.80 |
| low | meteor-garden | 90 → 95 | 566 → 565 | 457 → 759 | 216 → 231 | 16.70 → 16.70 | 16.80 → 16.80 |
| low | flux-gardens | 90 → 88 | 65 → 91 | 652 → 862 | 194 → 232 | 16.70 → 16.70 | 16.80 → 16.80 |
| low | capacitor-causeway | 85 → 77 | 62 → 65 | 537 → 1094 | 193 → 200 | 16.70 → 16.70 | 16.80 → 16.80 |
| low | shatterdeck | 10 → 35 | 415 → 320 | 599 → 1520 | 169 → 133 | 16.70 → 16.70 | 16.80 → 16.80 |
| auto | cargo-cyclone | 90 → 74 | 66 → 63 | 734 → 1109 | 279 → 291 | 16.70 → 16.70 | 16.80 → 16.80 |
| auto | solar-sweep | 93 → 72 | 876 → 989 | 405 → 1652 | 279 → 289 | 16.70 → 16.70 | 16.80 → 16.80 |
| auto | meteor-garden | 90 → 102 | 976 → 914 | 473 → 839 | 305 → 321 | 16.70 → 16.70 | 16.80 → 16.80 |
| auto | flux-gardens | 90 → 96 | 65 → 95 | 652 → 968 | 281 → 317 | 16.70 → 16.70 | 16.80 → 16.80 |
| auto | capacitor-causeway | 85 → 79 | 62 → 65 | 537 → 1153 | 280 → 287 | 16.70 → 16.70 | 16.80 → 16.80 |
| auto | shatterdeck | 10 → 41 | 629 → 547 | 579 → 2079 | 190 → 174 | 16.70 → 16.70 | 16.80 → 16.80 |

All samples remain in the running phase with 30 roster entries. Measured world batches: 35–102. The unchanged renderer tests additionally check every world mesh, including hidden detail, against the <200 budget.

Raw records: [baseline](before/client-render-samples.json), [after](after/client-render-samples.json). Preliminary Cargo sampling used different configuration and is deliberately excluded.
