# Audio sources

Classic and menu music remain unchanged. Battle Royale uses an original quiet ambient score alongside procedural Web Audio cues and the locally hosted CC0 sample set below. Samples are accents rather than complete replacements, so input feedback remains immediate if a browser has not decoded an asset yet.

## Planetfall — Orbital Drift

- File: `client/public/audio/br/orbital-drift.ogg`
- Original asset name: Orbital Drift
- Author: Planetfall project; original synthesized composition, 2026-10-10
- Source: `tools/compose-br-music.py` in this repository
- License: project-authored asset under the repository's terms; no third-party samples, melodies or recordings
- Modifications: synthesized stereo pads and sparse notes, phase-aligned loop, encoded as Vorbis; 192 seconds
- Runtime: independent `battle-royale` music scene, approximately half Classic's music gain, smooth scene fades; stays on the same track through lobby, Starliner and combat

The existing Starliner sample is now low-pass filtered at 680 Hz, given a modest low shelf and played at lower gain/rate. Remote shots use the existing listed weapon samples with bounded distance attenuation, stereo direction and a distant low-pass treatment. No additional third-party assets were introduced on 2026-10-10.

## Kenney — Sci-fi Sounds

- Author: Kenney
- Source: <https://kenney.nl/assets/sci-fi-sounds>
- License: Creative Commons Zero (CC0 1.0); the downloaded pack's `License.txt` is retained beside the files.
- Accessed: 2026-10-04
- Modification: renamed only; runtime playback rate and gain vary by cue.

| Local file | Original file | Use |
| --- | --- | --- |
| `client/public/audio/br/br-starliner-engine.ogg` | `spaceEngineLarge_002.ogg` | Starliner engine loop |
| `client/public/audio/br/br-skimmer-engine.ogg` | `thrusterFire_002.ogg` | Hover-skimmer engine and quiet drop-wind layer |
| `client/public/audio/br/br-laser-small.ogg` | `laserSmall_001.ogg` | Pulse Rifle / Nova SMG transient |
| `client/public/audio/br/br-laser-large.ogg` | `laserLarge_002.ogg` | Photon Shotgun / Rail Laser transient |
| `client/public/audio/br/br-shield-hit.ogg` | `forceField_003.ogg` | Shield and Arc impact accent |
| `client/public/audio/br/br-shield-break.ogg` | `forceField_004.ogg` | Shield-break accent |
| `client/public/audio/br/br-metal-impact.ogg` | `impactMetal_003.ogg` | HP/headshot confirmation accent |
| `client/public/audio/br/br-plasma-explosion.ogg` | `explosionCrunch_002.ogg` | Plasma Launcher transient |

Kenney's support page also states that game assets on the asset pages are public domain/CC0 and do not require attribution: <https://kenney.nl/support>.

## GboxMikeFozzy — Footsteps

- Author: GboxMikeFozzy
- Source: <https://opengameart.org/content/footsteps-0>
- License: Creative Commons Zero (CC0 1.0)
- Accessed: 2026-10-04
- Modification: renamed only; runtime playback rate and gain vary slightly to reduce repetition.

| Local file | Original file | Use |
| --- | --- | --- |
| `client/public/audio/br/br-footstep-1.ogg` | `01-footstep_0.ogg` | Alternating astronaut footstep |
| `client/public/audio/br/br-footstep-2.ogg` | `04-footstep.ogg` | Alternating astronaut footstep |

No attribution is required by CC0, but the sources are recorded here for provenance and future replacement review.
