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

October 14 loot expansion: Helix uses a short original triangle/noise report;
Comet combines original low sine/noise with the existing cleared metal impact;
Quasar uses original paired sine/triangle pulses; Prism uses quiet original
overlapping tones; Vortex uses original low sine/triangle/noise layers. Scanner
pulses reuse the existing cleared shield-hit sample with distance attenuation.
No third-party files were added for these sounds.
Vortex charging uses an original quiet rising sine/triangle pair. Remote Comet,
Quasar, Prism and Vortex reports reuse the cleared metal-impact, laser-large,
shield-hit and plasma-explosion samples respectively, with bounded spatial voices.

## PlanetRun — Orbital Sprint

- File: client/public/audio/pr/orbital-sprint.ogg
- Author/source: original Planetfall project synthesis, tools/compose-pr-music.py
- Date: 2026-10-20; project-authored under repository terms
- No third-party samples, recordings or melodies. Stereo 64-second race loop.
- Dedicated planet-run scene; procedural countdown, go, qualify, elimination,
  checkpoint, result, jump/dive, impact, nearby machinery and tile warning/break
  cues reuse the bounded project Web Audio system.
