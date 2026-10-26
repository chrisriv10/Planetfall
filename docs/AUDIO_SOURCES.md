# Audio sources

## Active sample refresh — 2026-10-25

The user's existing David KBD music is preserved: **Low Battery** remains the
menu theme at .14 base gain and **Bot City** remains Classic's track at .18.
Both predate this pass and their audio bytes are unchanged. The user clarified
that the replacement request concerned generated audio, not these found themes.
The [creator's original pack page](https://davidkbd.itch.io/my-little-bots-crazy-music-for-robots-asset-pack)
was rechecked on2026-10-25 and explicitly identifies **CC BY4.0**. Attribution
remains in README.md and THIRD_PARTY_NOTICES.md; original filenames, unchanged
SHA256 hashes, source/license URLs and this clarification are recorded in
`client/public/audio/preserved-music-sources.json`.

All normal player-facing SFX now use locally hosted CC0 recordings. No oscillator,
random-noise generator, AI audio, ripped recording or generated fallback is used
by `GameAudio`. Layering, subtle playback variation, filtering, panning and gain
operate only on the licensed source recordings below.

New selections are **provisional pending actual listening in gameplay**. Automated
decoding/level measurements and source verification have been performed; this
document does not claim perceptual audition or finished artistic acceptance.
The audition checklist follows the source table.

Runtime: `client/src/audio-catalog.ts` defines cue pools, weapon identities,
phase contacts, environment beds and five music scenes. `audio-sample-bank.ts`
caches decoded buffers, fetches/decodes at most three recordings concurrently,
uses at most 16 one-shot voices plus four continuous loops, and releases all
per-voice nodes at completion. Effects never clone HTML audio elements or create
media-element source routes per shot. Music streams through five persistent
HTML audio elements, unlocked by player gesture, with scene fades and ducking.
Unknown/missing assets remain silent rather than synthesizing a replacement.

Short physical footsteps use four independent OwlishMedia takes. Weapon family
reports use different recording identities, including Helix, Arc, Prism and Orbit;
distant reports preserve their family and use distance attenuation, stereo pan
and lowpass. UI is centered. Music gain starts highest in menu, moderate in
Classic/PR and quiet in BR/PG; user Music/SFX settings still apply. Reload phases
are explicit events (`start`, `remove`, `insert`, `lock`, `settle`), not scheduled
completion timers that could fire after a weapon switch. BR's legacy start
method emits its first contact only.

One persistent compressor on the combined music/effects output guards against
overload from simultaneous recorded transients (threshold -5 dB, ratio 16:1,
1 ms attack and 140 ms release). This is playback processing, not a generated
audio source. Individual recorded assets retain measured true-peak headroom.

## Original creator pages and retained license evidence

Every active source page below was rechecked on **2026-10-25** and explicitly
identifies CC0 1.0/public domain. Compact creator/license/download records and
included Kenney `License.txt` files are retained under
`docs/audio-license-evidence/<pack>/`. Full page snapshots remain in the local
research archive; they are not served or redistributed with the game. The machine-readable
`client/public/audio/refresh/source-manifest.json` records every original and
derivative SHA256, source page SHA256, edits, creator, license, original filename,
and measured original/derivative levels.

- **Interface Sounds — Kenney**: [original asset page](https://kenney.nl/assets/interface-sounds); CC0 1.0/public domain.
- **Sci-fi Sounds — Kenney**: [original asset page](https://kenney.nl/assets/sci-fi-sounds); CC0 1.0/public domain.
- **Brute Force — vitalezzz**: [original asset page](https://opengameart.org/content/brute-force); CC0 1.0/public domain.
- **Claimed by the Void — vitalezzz**: [original asset page](https://opengameart.org/content/claimed-by-the-void); CC0 1.0/public domain.
- **Dark Sci-Fi Audio Pack — SRG774**: [original asset page](https://opengameart.org/content/dark-sci-fi-audio-pack); CC0 1.0/public domain.
- **Footsteps — GboxMikeFozzy**: [original asset page](https://opengameart.org/content/footsteps-0); CC0 1.0/public domain.
- **Sound Effects Pack — OwlishMedia**: [original asset page](https://opengameart.org/content/sound-effects-pack); CC0 1.0/public domain.
- **Space Flight Sound Effects — Bret Bernhoft**: [original asset page](https://opengameart.org/content/space-flight-sound-effects); CC0 1.0/public domain.
- **Virtual Rush — vitalezzz**: [original asset page](https://opengameart.org/content/virtual-rush); CC0 1.0/public domain.

Two unused music candidates, [Exploration Theme](https://opengameart.org/content/exploration-theme)
and [Warp Drive](https://opengameart.org/content/warp-drive), are preserved only
in the local review archive. Their recordings are not shipped. The active
refresh contains116 files (113 SFX/loops and three new music tracks),9,430,915
bytes; the two existing David KBD theme files remain separate and unchanged.

Name checks: Vitalezzz's Singularity is `/content/singularity-0`; the similarly
named Macro track is not used. Bret Bernhoft's collection is Space Flight Sound
Effects, not wipics' similarly named music. No third-party mirror or remix was
used for licensing authority.

## Processing and measured mix

Only edits to existing recordings were performed: leading-silence removal on
recorded foley, excerpt trimming, conservative measured gain, short fades,
resampling to 44.1 kHz and Vorbis encoding (q3 mono effects/loops, q4 stereo music).
Short foley excerpts are at most 0.9 seconds; one-shot masters at most 3 seconds.
Kenney's authored engine beds stay five seconds. Selected Space Flight originals
are eight-second excerpts with 30 ms edge fades. Exact loop seams and transient
trim choices still need listening review.

Source peak, RMS-like mean level, integrated EBU R128 loudness and true peak were
measured serially with ffmpeg; the encoded derivatives were then measured again.
Music targets about -18 LUFS before runtime mix where peak headroom permits.
Effects target -3 dBFS sample peak with capped gain and true-peak headroom; cue
gains and durations then differ by role rather than playing every sample at 1.
Short transient LUFS measurements can be less useful than their peak/mean values.
All exact source/derivative measurements and gain edits are in the JSON manifest.

## Selected soundtrack

| Scene | Original track | Creator | Runtime base gain | License / source |
| --- | --- | --- | ---: | --- |
| menu | Low Battery | David KBD | 0.14 | [CC BY4.0](https://davidkbd.itch.io/my-little-bots-crazy-music-for-robots-asset-pack) |
| game | Bot City | David KBD | 0.18 | [CC BY4.0](https://davidkbd.itch.io/my-little-bots-crazy-music-for-robots-asset-pack) |
| battle-royale | claimed_by_the_void_loop.mp3 | vitalezzz | 0.045 | [CC0](https://opengameart.org/content/claimed-by-the-void) |
| planet-run | virtual_rush_loop_0.mp3 | vitalezzz | 0.13 | [CC0](https://opengameart.org/content/virtual-rush) |
| planet-gun | brute_force_loop.mp3 | vitalezzz | 0.04 | [CC0](https://opengameart.org/content/brute-force) |

## Every active local file

Paths are under `client/public/audio/refresh/`. Each row links the original page;
all rows were accessed 2026-10-25 and use CC0 1.0. The edits column gives measured
gain and excerpt cap; all files also receive the format conversion noted above.
Runtime use lists the cue/scene keys that resolve the recording. The JSON
manifest preserves the full list if several cues share one physical recording.

| Local filename | Original filename / creator | Original source / license | Edits | Runtime use |
| --- | --- | --- | --- | --- |
| `brute-force-brute_force_loop.ogg` | `brute_force_loop.mp3` — vitalezzz | [Brute Force · CC0](https://opengameart.org/content/brute-force) | -6.70 dB; full music loop | `music.planet-gun` |
| `claimed-by-void-claimed_by_the_void_loop.ogg` | `claimed_by_the_void_loop.mp3` — vitalezzz | [Claimed by the Void · CC0](https://opengameart.org/content/claimed-by-the-void) | -8.10 dB; full music loop | `music.battle-royale` |
| `dark-sci-fi-victory.ogg` | `victory.ogg` — SRG774 | [Dark Sci-Fi Audio Pack · CC0](https://opengameart.org/content/dark-sci-fi-audio-pack) | -2.00 dB; ≤3 s | `match.win`, `pr.qualify` |
| `footsteps-01-footstep_0.ogg` | `01-footstep_0.ogg` — GboxMikeFozzy | [Footsteps · CC0](https://opengameart.org/content/footsteps-0) | +12.00 dB; ≤0.1539 s | `movement.footstep-alternative` |
| `footsteps-02-footstep.ogg` | `02-footstep.ogg` — GboxMikeFozzy | [Footsteps · CC0](https://opengameart.org/content/footsteps-0) | +12.00 dB; ≤0.1687 s | `movement.footstep-alternative` |
| `footsteps-03-footstep.ogg` | `03-footstep.ogg` — GboxMikeFozzy | [Footsteps · CC0](https://opengameart.org/content/footsteps-0) | +12.00 dB; ≤0.3167 s | `movement.footstep-alternative` |
| `footsteps-04-footstep.ogg` | `04-footstep.ogg` — GboxMikeFozzy | [Footsteps · CC0](https://opengameart.org/content/footsteps-0) | +12.00 dB; ≤0.333 s | `movement.footstep-alternative` |
| `kenney-interface-back_001.ogg` | `back_001.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.00 dB; ≤0.0639 s | `ui.cancel` |
| `kenney-interface-back_002.ogg` | `back_002.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.00 dB; ≤0.0698 s | `ui.cancel` |
| `kenney-interface-click_001.ogg` | `click_001.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -1.60 dB; ≤0.1 s | `ui.click` |
| `kenney-interface-click_002.ogg` | `click_002.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.01 s | `ui.click` |
| `kenney-interface-close_001.ogg` | `close_001.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.1478 s | `ui.close` |
| `kenney-interface-close_002.ogg` | `close_002.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.00 dB; ≤0.3138 s | `ui.close` |
| `kenney-interface-confirmation_001.ogg` | `confirmation_001.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.2898 s | `ui.confirm`, `social.high-five`, `br.loot` |
| `kenney-interface-confirmation_002.ogg` | `confirmation_002.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.00 dB; ≤0.539 s | `ui.confirm`, `classic.pickup`, `br.loot`, `pr.checkpoint` |
| `kenney-interface-confirmation_003.ogg` | `confirmation_003.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.00 dB; ≤0.322 s | `classic.pickup`, `br.use-health`, `br.zone-safe`, `pr.checkpoint` |
| `kenney-interface-confirmation_004.ogg` | `confirmation_004.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.4904 s | `classic.stolen`, `classic.repair`, `match.go`, `pr.go`, `pr.machinery` |
| `kenney-interface-error_003.ogg` | `error_003.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -6.00 dB; ≤0.5335 s | `ui.error` |
| `kenney-interface-error_004.ogg` | `error_004.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -1.70 dB; ≤0.1027 s | `ui.error` |
| `kenney-interface-error_005.ogg` | `error_005.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.00 dB; ≤0.5 s | `classic.intruder`, `br.void` |
| `kenney-interface-error_006.ogg` | `error_006.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.20 dB; ≤0.5 s | `match.critical` |
| `kenney-interface-error_007.ogg` | `error_007.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.192 s | `classic.incoming-heavy`, `match.callout-urgent`, `br.void-urgent`, `br.zone-final`, `pr.meteor-warning` |
| `kenney-interface-glass_002.ogg` | `glass_002.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.00 dB; ≤0.1253 s | `br.hit-headshot` |
| `kenney-interface-glitch_001.ogg` | `glitch_001.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.00 dB; ≤0.02 s | `classic.stolen` |
| `kenney-interface-glitch_002.ogg` | `glitch_002.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -5.30 dB; ≤0.03 s | `classic.sabotage` |
| `kenney-interface-glitch_003.ogg` | `glitch_003.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.50 dB; ≤0.01 s | `classic.sabotage`, `weapon.arc-blaster.fire`, `weapon.arc-blaster.distant` |
| `kenney-interface-glitch_004.ogg` | `glitch_004.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -5.60 dB; ≤0.0229 s | `match.chaos` |
| `kenney-interface-maximize_008.ogg` | `maximize_008.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.2254 s | `match.level-up` |
| `kenney-interface-minimize_005.ogg` | `minimize_005.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.20 dB; ≤0.5264 s | `match.loss`, `pr.eliminate` |
| `kenney-interface-open_001.ogg` | `open_001.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.1478 s | `ui.open` |
| `kenney-interface-open_002.ogg` | `open_002.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.3138 s | `ui.open`, `ui.inventory` |
| `kenney-interface-question_002.ogg` | `question_002.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.3325 s | `br.zone-closing` |
| `kenney-interface-question_003.ogg` | `question_003.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.3325 s | `match.callout` |
| `kenney-interface-question_004.ogg` | `question_004.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.3325 s | `classic.incoming` |
| `kenney-interface-select_001.ogg` | `select_001.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -1.90 dB; ≤0.0433 s | `ui.hover` |
| `kenney-interface-select_002.ogg` | `select_002.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -5.50 dB; ≤0.0433 s | `ui.hover` |
| `kenney-interface-switch_001.ogg` | `switch_001.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -5.50 dB; ≤0.6177 s | `classic.cannon-trigger`, `weapon.pulse-rifle.reload.insert`, `weapon.pulse-rifle.empty`, `weapon.helix-burst-rifle.reload.insert`, `weapon.helix-burst-rifle.empty` |
| `kenney-interface-switch_002.ogg` | `switch_002.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.611 s | `classic.cannon-trigger`, `weapon.nova-smg.reload.insert`, `weapon.nova-smg.empty`, `weapon.comet-hand-cannon.reload.insert`, `weapon.comet-hand-cannon.empty` |
| `kenney-interface-switch_003.ogg` | `switch_003.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -5.60 dB; ≤0.5 s | `weapon.photon-shotgun.reload.insert`, `weapon.photon-shotgun.empty`, `weapon.quasar-carbine.reload.insert`, `weapon.quasar-carbine.empty` |
| `kenney-interface-switch_004.ogg` | `switch_004.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -5.50 dB; ≤0.5 s | `weapon.rail-laser.reload.insert`, `weapon.rail-laser.empty`, `weapon.prism-beam.reload.insert`, `weapon.prism-beam.empty`, `weapon.orbit-sidearm.reload.insert` |
| `kenney-interface-switch_005.ogg` | `switch_005.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.6119 s | `weapon.plasma-launcher.reload.insert`, `weapon.plasma-launcher.empty`, `weapon.vortex-cannon.reload.insert`, `weapon.vortex-cannon.empty` |
| `kenney-interface-switch_006.ogg` | `switch_006.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.6105 s | `weapon.arc-blaster.reload.insert`, `weapon.arc-blaster.empty`, `weapon.orbit-sidearm.empty` |
| `kenney-interface-switch_007.ogg` | `switch_007.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.00 dB; ≤0.6144 s | `weapon.energy-saber.empty`, `weapon.orbit-sidearm.reload.release` |
| `kenney-interface-tick_001.ogg` | `tick_001.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.20 dB; ≤0.0232 s | `match.countdown`, `br.hit-hp`, `pr.countdown` |
| `kenney-interface-tick_002.ogg` | `tick_002.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.60 dB; ≤0.0232 s | `match.countdown`, `pr.countdown` |
| `kenney-interface-toggle_002.ogg` | `toggle_002.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.1393 s | `weapon.energy-saber.reload.lock` |
| `kenney-interface-toggle_004.ogg` | `toggle_004.ogg` — Kenney | [Interface Sounds · CC0](https://kenney.nl/assets/interface-sounds) | -2.10 dB; ≤0.0662 s | `weapon.orbit-sidearm.reload.lock` |
| `kenney-sci-fi-computernoise_001.ogg` | `computerNoise_001.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤3 s | `classic.sabotage` |
| `kenney-sci-fi-computernoise_002.ogg` | `computerNoise_002.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤5 s | `environment.pr.capacitor` |
| `kenney-sci-fi-doorclose_000.ogg` | `doorClose_000.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.5316 s | `weapon.pulse-rifle.reload.lock`, `weapon.rail-laser.reload.lock`, `weapon.quasar-carbine.reload.lock` |
| `kenney-sci-fi-doorclose_001.ogg` | `doorClose_001.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.5286 s | `weapon.nova-smg.reload.lock`, `weapon.plasma-launcher.reload.lock`, `weapon.helix-burst-rifle.reload.lock`, `weapon.prism-beam.reload.lock` |
| `kenney-sci-fi-doorclose_002.ogg` | `doorClose_002.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤0.5326 s | `weapon.photon-shotgun.reload.lock`, `weapon.arc-blaster.reload.lock`, `weapon.comet-hand-cannon.reload.lock`, `weapon.vortex-cannon.reload.lock` |
| `kenney-sci-fi-dooropen_000.ogg` | `doorOpen_000.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.5316 s | `br.crate` |
| `kenney-sci-fi-dooropen_001.ogg` | `doorOpen_001.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤0.5286 s | `movement.wings` |
| `kenney-sci-fi-enginecircular_000.ogg` | `engineCircular_000.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤5 s | `environment.pr.cargo` |
| `kenney-sci-fi-enginecircular_001.ogg` | `engineCircular_001.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤5 s | `environment.br.skimmer` |
| `kenney-sci-fi-enginecircular_002.ogg` | `engineCircular_002.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤5 s | `environment.pr.solar` |
| `kenney-sci-fi-enginecircular_003.ogg` | `engineCircular_003.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤5 s | `environment.pg.machinery` |
| `kenney-sci-fi-explosioncrunch_000.ogg` | `explosionCrunch_000.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤0.7775 s | `classic.cluster-burst`, `classic.explosion`, `pr.tile-break` |
| `kenney-sci-fi-explosioncrunch_001.ogg` | `explosionCrunch_001.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤1.3568 s | `classic.cluster-burst`, `classic.explosion`, `pr.tile-break` |
| `kenney-sci-fi-explosioncrunch_002.ogg` | `explosionCrunch_002.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤1.2558 s | `classic.cluster-burst`, `classic.explosion`, `pr.tile-break`, `weapon.plasma-launcher.fire`, `weapon.plasma-launcher.distant` |
| `kenney-sci-fi-explosioncrunch_003.ogg` | `explosionCrunch_003.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤1.5534 s | `classic.explosion-heavy` |
| `kenney-sci-fi-explosioncrunch_004.ogg` | `explosionCrunch_004.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤1.9801 s | `classic.asteroid`, `classic.explosion-heavy`, `weapon.vortex-cannon.fire`, `weapon.vortex-cannon.distant` |
| `kenney-sci-fi-forcefield_000.ogg` | `forceField_000.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.954 s | `classic.gravity-bomb`, `br.charge`, `br.use-shield`, `pr.gravity`, `weapon.pulse-rifle.reload.charge`, `weapon.arc-blaster.reload.charge`, `weapon.prism-beam.fire`, `weapon.prism-beam.distant`, `weapon.prism-beam.reload.charge` |
| `kenney-sci-fi-forcefield_001.ogg` | `forceField_001.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.9534 s | `classic.tether`, `br.scanner`, `weapon.nova-smg.reload.charge`, `weapon.energy-saber.fire`, `weapon.energy-saber.distant`, `weapon.energy-saber.reload.charge`, `weapon.vortex-cannon.reload.charge` |
| `kenney-sci-fi-forcefield_002.ogg` | `forceField_002.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.9551 s | `match.chaos`, `weapon.photon-shotgun.reload.charge`, `weapon.arc-blaster.fire`, `weapon.arc-blaster.distant`, `weapon.helix-burst-rifle.reload.charge` |
| `kenney-sci-fi-forcefield_003.ogg` | `forceField_003.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.9559 s | `br.hit-shield`, `weapon.rail-laser.reload.charge`, `weapon.comet-hand-cannon.reload.charge` |
| `kenney-sci-fi-forcefield_004.ogg` | `forceField_004.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.9544 s | `br.hit-break`, `weapon.plasma-launcher.reload.charge`, `weapon.quasar-carbine.reload.charge` |
| `kenney-sci-fi-impactmetal_000.ogg` | `impactMetal_000.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.6349 s | `movement.footstep-metal`, `movement.land-heavy`, `br.impact`, `pr.tile`, `weapon.pulse-rifle.impact`, `weapon.nova-smg.impact`, `weapon.photon-shotgun.impact`, `weapon.rail-laser.impact`, `weapon.plasma-launcher.impact`, `weapon.arc-blaster.impact`, `weapon.energy-saber.impact`, `weapon.helix-burst-rifle.impact`, `weapon.comet-hand-cannon.fire`, `weapon.comet-hand-cannon.distant`, `weapon.comet-hand-cannon.impact`, `weapon.quasar-carbine.impact`, `weapon.prism-beam.impact`, `weapon.vortex-cannon.impact`, `weapon.orbit-sidearm.impact` |
| `kenney-sci-fi-impactmetal_001.ogg` | `impactMetal_001.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.6876 s | `movement.footstep-metal`, `movement.land-heavy`, `br.impact`, `pr.tile`, `weapon.pulse-rifle.impact`, `weapon.nova-smg.impact`, `weapon.photon-shotgun.impact`, `weapon.rail-laser.impact`, `weapon.plasma-launcher.impact`, `weapon.arc-blaster.impact`, `weapon.energy-saber.impact`, `weapon.helix-burst-rifle.impact`, `weapon.comet-hand-cannon.impact`, `weapon.quasar-carbine.impact`, `weapon.prism-beam.impact`, `weapon.vortex-cannon.impact`, `weapon.orbit-sidearm.impact` |
| `kenney-sci-fi-impactmetal_002.ogg` | `impactMetal_002.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.4711 s | `movement.footstep-metal`, `br.impact`, `pr.tile`, `weapon.pulse-rifle.impact`, `weapon.nova-smg.impact`, `weapon.photon-shotgun.impact`, `weapon.rail-laser.impact`, `weapon.plasma-launcher.impact`, `weapon.arc-blaster.impact`, `weapon.energy-saber.impact`, `weapon.helix-burst-rifle.impact`, `weapon.comet-hand-cannon.impact`, `weapon.quasar-carbine.impact`, `weapon.prism-beam.impact`, `weapon.vortex-cannon.impact`, `weapon.orbit-sidearm.impact` |
| `kenney-sci-fi-impactmetal_003.ogg` | `impactMetal_003.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.7768 s | `br.crate` |
| `kenney-sci-fi-impactmetal_004.ogg` | `impactMetal_004.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.3895 s | `weapon.comet-hand-cannon.fire`, `weapon.comet-hand-cannon.distant` |
| `kenney-sci-fi-laserlarge_000.ogg` | `laserLarge_000.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.6766 s | `classic.rocket`, `weapon.photon-shotgun.fire`, `weapon.photon-shotgun.distant` |
| `kenney-sci-fi-laserlarge_001.ogg` | `laserLarge_001.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.721 s | `weapon.photon-shotgun.fire`, `weapon.photon-shotgun.distant` |
| `kenney-sci-fi-laserlarge_003.ogg` | `laserLarge_003.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.7158 s | `weapon.plasma-launcher.fire`, `weapon.plasma-launcher.distant` |
| `kenney-sci-fi-laserlarge_004.ogg` | `laserLarge_004.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.6932 s | `weapon.rail-laser.fire`, `weapon.rail-laser.distant` |
| `kenney-sci-fi-laserretro_000.ogg` | `laserRetro_000.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.70 dB; ≤0.2354 s | `weapon.orbit-sidearm.fire`, `weapon.orbit-sidearm.distant` |
| `kenney-sci-fi-laserretro_001.ogg` | `laserRetro_001.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.50 dB; ≤0.2355 s | `weapon.helix-burst-rifle.fire`, `weapon.helix-burst-rifle.distant` |
| `kenney-sci-fi-laserretro_002.ogg` | `laserRetro_002.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.70 dB; ≤0.2551 s | `classic.cluster` |
| `kenney-sci-fi-laserretro_003.ogg` | `laserRetro_003.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.60 dB; ≤0.2548 s | `weapon.orbit-sidearm.fire`, `weapon.orbit-sidearm.distant` |
| `kenney-sci-fi-laserretro_004.ogg` | `laserRetro_004.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤0.2786 s | `weapon.helix-burst-rifle.fire`, `weapon.helix-burst-rifle.distant` |
| `kenney-sci-fi-lasersmall_000.ogg` | `laserSmall_000.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | +2.70 dB; ≤0.2392 s | `weapon.nova-smg.fire`, `weapon.nova-smg.distant`, `weapon.orbit-sidearm.reload.charge` |
| `kenney-sci-fi-lasersmall_001.ogg` | `laserSmall_001.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -0.50 dB; ≤0.2473 s | `weapon.pulse-rifle.fire`, `weapon.pulse-rifle.distant` |
| `kenney-sci-fi-lasersmall_002.ogg` | `laserSmall_002.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -1.20 dB; ≤0.3443 s | `weapon.pulse-rifle.fire`, `weapon.pulse-rifle.distant` |
| `kenney-sci-fi-lasersmall_003.ogg` | `laserSmall_003.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | +0.50 dB; ≤0.3004 s | `classic.grapple`, `weapon.nova-smg.fire`, `weapon.nova-smg.distant` |
| `kenney-sci-fi-lasersmall_004.ogg` | `laserSmall_004.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -3.30 dB; ≤0.4143 s | `br.flyby`, `weapon.quasar-carbine.fire`, `weapon.quasar-carbine.distant` |
| `kenney-sci-fi-lowfrequency_explosion_000.ogg` | `lowFrequency_explosion_000.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -5.60 dB; ≤2.0 s | `classic.asteroid`, `classic.explosion-heavy`, `weapon.vortex-cannon.fire`, `weapon.vortex-cannon.distant` |
| `kenney-sci-fi-lowfrequency_explosion_001.ogg` | `lowFrequency_explosion_001.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -5.70 dB; ≤1.0 s | `classic.explosion-heavy`, `weapon.comet-hand-cannon.fire`, `weapon.comet-hand-cannon.distant` |
| `kenney-sci-fi-spaceenginelarge_002.ogg` | `spaceEngineLarge_002.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤5 s | `environment.br.starliner` |
| `kenney-sci-fi-spaceenginelow_000.ogg` | `spaceEngineLow_000.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤5 s | `environment.pr.flux` |
| `kenney-sci-fi-spaceenginelow_001.ogg` | `spaceEngineLow_001.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤5 s | `environment.pr.meteor` |
| `kenney-sci-fi-spaceenginelow_002.ogg` | `spaceEngineLow_002.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤5 s | `environment.pr.shatterdeck` |
| `kenney-sci-fi-spaceenginelow_003.ogg` | `spaceEngineLow_003.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤5 s | `environment.pg.outdoor` |
| `kenney-sci-fi-spaceenginelow_004.ogg` | `spaceEngineLow_004.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤5 s | `environment.pg.indoor` |
| `kenney-sci-fi-spaceenginesmall_001.ogg` | `spaceEngineSmall_001.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤5 s | `environment.br.ion-wings` |
| `kenney-sci-fi-thrusterfire_000.ogg` | `thrusterFire_000.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤3 s | `movement.thrust`, `classic.rocket`, `pr.boost` |
| `kenney-sci-fi-thrusterfire_001.ogg` | `thrusterFire_001.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.10 dB; ≤3 s | `movement.thrust`, `movement.wings`, `pr.boost` |
| `kenney-sci-fi-thrusterfire_003.ogg` | `thrusterFire_003.ogg` — Kenney | [Sci-fi Sounds · CC0](https://kenney.nl/assets/sci-fi-sounds) | -2.00 dB; ≤3 s | `classic.launch`, `br.jump-ship` |
| `owlish-320138__owlstorm__blanket-movement-2.ogg` | `320138__owlstorm__blanket-movement-2.wav` — OwlishMedia | [Sound Effects Pack · CC0](https://opengameart.org/content/sound-effects-pack) | +10.90 dB; ≤0.9 s; silence trim | `movement.jump`, `movement.slide`, `movement.mantle`, `pr.dive`, `weapon.pulse-rifle.reload.manipulate`, `weapon.nova-smg.reload.manipulate`, `weapon.photon-shotgun.reload.manipulate`, `weapon.rail-laser.reload.manipulate`, `weapon.plasma-launcher.reload.manipulate`, `weapon.arc-blaster.reload.manipulate`, `weapon.helix-burst-rifle.reload.manipulate`, `weapon.comet-hand-cannon.reload.manipulate`, `weapon.quasar-carbine.reload.manipulate`, `weapon.prism-beam.reload.manipulate`, `weapon.vortex-cannon.reload.manipulate` |
| `owlish-320141__owlstorm__blanket-movement-3.ogg` | `320141__owlstorm__blanket-movement-3.wav` — OwlishMedia | [Sound Effects Pack · CC0](https://opengameart.org/content/sound-effects-pack) | +10.40 dB; ≤0.9 s; silence trim | `movement.jump`, `movement.slide`, `movement.mantle`, `pr.dive`, `weapon.pulse-rifle.reload.manipulate`, `weapon.nova-smg.reload.manipulate`, `weapon.photon-shotgun.reload.manipulate`, `weapon.rail-laser.reload.manipulate`, `weapon.plasma-launcher.reload.manipulate`, `weapon.arc-blaster.reload.manipulate`, `weapon.helix-burst-rifle.reload.manipulate`, `weapon.comet-hand-cannon.reload.manipulate`, `weapon.quasar-carbine.reload.manipulate`, `weapon.prism-beam.reload.manipulate`, `weapon.vortex-cannon.reload.manipulate` |
| `owlish-hard-footstep1.ogg` | `hard-footstep1.wav` — OwlishMedia | [Sound Effects Pack · CC0](https://opengameart.org/content/sound-effects-pack) | +10.50 dB; ≤0.5805 s; silence trim | `movement.footstep-composite`, `movement.jump`, `movement.land-light`, `movement.wallrun`, `pr.land` |
| `owlish-hard-footstep2.ogg` | `hard-footstep2.wav` — OwlishMedia | [Sound Effects Pack · CC0](https://opengameart.org/content/sound-effects-pack) | +12.00 dB; ≤0.4876 s; silence trim | `movement.footstep-composite`, `movement.jump`, `movement.land-light`, `movement.mantle`, `movement.wallrun`, `pr.land` |
| `owlish-hard-footstep3.ogg` | `hard-footstep3.wav` — OwlishMedia | [Sound Effects Pack · CC0](https://opengameart.org/content/sound-effects-pack) | +12.00 dB; ≤0.5805 s; silence trim | `movement.footstep-composite`, `movement.land-light`, `movement.mantle`, `movement.wallrun`, `pr.land` |
| `owlish-hard-footstep4.ogg` | `hard-footstep4.wav` — OwlishMedia | [Sound Effects Pack · CC0](https://opengameart.org/content/sound-effects-pack) | +3.10 dB; ≤0.7082 s; silence trim | `movement.footstep-composite`, `movement.land-light`, `movement.wallrun`, `pr.land` |
| `owlish-hit.ogg` | `hit.wav` — OwlishMedia | [Sound Effects Pack · CC0](https://opengameart.org/content/sound-effects-pack) | -2.90 dB; ≤0.3473 s; silence trim | `movement.land-heavy`, `classic.launch`, `classic.shove`, `pr.impact`, `weapon.photon-shotgun.fire`, `weapon.photon-shotgun.distant` |
| `owlish-plugpull.ogg` | `plugpull.wav` — OwlishMedia | [Sound Effects Pack · CC0](https://opengameart.org/content/sound-effects-pack) | +1.20 dB; ≤0.415 s; silence trim | `classic.grapple`, `classic.grapple-release`, `classic.cannon-trigger-heavy`, `weapon.pulse-rifle.reload.release`, `weapon.nova-smg.reload.release`, `weapon.photon-shotgun.reload.release`, `weapon.rail-laser.reload.release`, `weapon.plasma-launcher.reload.release`, `weapon.arc-blaster.reload.release`, `weapon.helix-burst-rifle.reload.release`, `weapon.comet-hand-cannon.reload.release`, `weapon.quasar-carbine.reload.release`, `weapon.prism-beam.reload.release`, `weapon.vortex-cannon.reload.release`, `weapon.orbit-sidearm.reload.manipulate` |
| `owlish-robotics1.ogg` | `robotics1.wav` — OwlishMedia | [Sound Effects Pack · CC0](https://opengameart.org/content/sound-effects-pack) | +12.00 dB; ≤0.8108 s; silence trim | `classic.repair`, `pr.machinery` |
| `owlish-robotics2.ogg` | `robotics2.wav` — OwlishMedia | [Sound Effects Pack · CC0](https://opengameart.org/content/sound-effects-pack) | +12.00 dB; ≤0.8403 s; silence trim | `classic.repair`, `pr.machinery` |
| `owlish-scrape1.ogg` | `scrape1.wav` — OwlishMedia | [Sound Effects Pack · CC0](https://opengameart.org/content/sound-effects-pack) | +12.00 dB; ≤0.6169 s; silence trim | `movement.slide`, `pr.dive` |
| `owlish-scrape2.ogg` | `scrape2.wav` — OwlishMedia | [Sound Effects Pack · CC0](https://opengameart.org/content/sound-effects-pack) | +12.00 dB; ≤0.9 s; silence trim | `movement.slide`, `pr.dive` |
| `owlish-slap2.ogg` | `slap2.wav` — OwlishMedia | [Sound Effects Pack · CC0](https://opengameart.org/content/sound-effects-pack) | -2.70 dB; ≤0.4799 s; silence trim | `classic.shove`, `social.high-five`, `pr.impact` |
| `space-flight-spaceflight3.ogg` | `spaceflight3.wav` — Bret Bernhoft | [Space Flight Sound Effects · CC0](https://opengameart.org/content/space-flight-sound-effects) | -3.00 dB; ≤8 s | `environment.br.starliner-alternative` |
| `space-flight-spaceflight4.ogg` | `spaceflight4.wav` — Bret Bernhoft | [Space Flight Sound Effects · CC0](https://opengameart.org/content/space-flight-sound-effects) | -6.50 dB; ≤8 s | `environment.br.drop` |
| `space-flight-spaceflight5.ogg` | `spaceflight5.wav` — Bret Bernhoft | [Space Flight Sound Effects · CC0](https://opengameart.org/content/space-flight-sound-effects) | -6.50 dB; ≤8 s | `environment.pg.station-distant` |
| `virtual-rush-virtual_rush_loop_0.ogg` | `virtual_rush_loop_0.mp3` — vitalezzz | [Virtual Rush · CC0](https://opengameart.org/content/virtual-rush) | -9.30 dB; full music loop | `music.planet-run` |

## In-game audition and acceptance checklist

This checklist is intentionally pending. Decoding and test coverage do not prove
good sound selection, intelligibility or seamless musical loops.

- [ ] Menu: all UI actions, cancellation/errors, music level and loop seam.
- [ ] Classic/Chaos: jump/light-heavy landing/burst, grapple/tether/release,
  cannon trigger/denial/launch, shove/sabotage/intruder/incoming, every projectile
  and explosion, repair, countdown/chaos/result/high-five/level-up/callout.
- [ ] BR: Starliner/drop/Ion Wings/skimmer beds, local and remote footsteps,
  slide/mantle, every local/distant weapon, reload contact/empty, shield/health/
  shield break/headshot, loot/crate, scanner/charge/Void/storm/flyby/elimination.
- [ ] PR: all 14 state cues and all six round beds; machinery approach, tile
  destabilization/collapse, meteor warning/impact, gravity/boost/landing.
- [ ] PG: ten weapon families including Orbit, local/distant reports, all five
  phase contacts, no late reload completion on switch/death, movement/thrust/
  wall run/slide/mantle/landing, low ambience and footsteps above quiet music.
- [ ] Review the original source packs and selected alternatives where a chosen
  transient, footstep, alarm or loop sounds wrong; update the actual manifest.
- [ ] Check all five music transitions/loops, including browser gesture unlock,
  results/rematch continuity, muted settings and tab suspension/resumption.
- [ ] Review simultaneous combat under the voice cap with direction/distance
  readable and no audible clipping. Capture real listening notes before marking
  this refresh artistically accepted.

## Retained, inactive pre-refresh assets

Previous project-generated BR/PR/PG tracks and old licensed source files remain
on disk for history; normal `GameAudio` no longer references them. Their original
provenance is preserved below. Do not invoke the old synthesis scripts to create
new effects/music for this pass.

### Original pre-refresh source record

Classic and menu music remain unchanged. Battle Royale uses an original quiet ambient score alongside procedural Web Audio cues and the locally hosted CC0 sample set below. Samples are accents rather than complete replacements, so input feedback remains immediate if a browser has not decoded an asset yet.

## Planetfall â€” Orbital Drift

- File: `client/public/audio/br/orbital-drift.ogg`
- Original asset name: Orbital Drift
- Author: Planetfall project; original synthesized composition, 2026-10-10
- Source: `tools/compose-br-music.py` in this repository
- License: project-authored asset under the repository's terms; no third-party samples, melodies or recordings
- Modifications: synthesized stereo pads and sparse notes, phase-aligned loop, encoded as Vorbis; 192 seconds
- Runtime: independent `battle-royale` music scene, approximately half Classic's music gain, smooth scene fades; stays on the same track through lobby, Starliner and combat

The existing Starliner sample is now low-pass filtered at 680 Hz, given a modest low shelf and played at lower gain/rate. Remote shots use the existing listed weapon samples with bounded distance attenuation, stereo direction and a distant low-pass treatment. No additional third-party assets were introduced on 2026-10-10.

## Kenney â€” Sci-fi Sounds

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

## GboxMikeFozzy â€” Footsteps

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

## PlanetRun â€” Orbital Sprint

- File: client/public/audio/pr/orbital-sprint.ogg
- Author/source: original Planetfall project synthesis, tools/compose-pr-music.py
- Date: 2026-10-20; project-authored under repository terms
- No third-party samples, recordings or melodies. Stereo 64-second race loop.
- Dedicated planet-run scene; procedural countdown, go, qualify, elimination,
  checkpoint, result, jump/dive, impact, nearby machinery and tile warning/break
  cues reuse the bounded project Web Audio system.


## PlanetGun â€” Nova Afterlight

- File: client/public/audio/pg/nova-afterlight.wav
- Author/source: original Planetfall project synthesis, tools/compose-pg-music.py
- Date: 2026-10-21; project-authored under repository terms.
- Original 48-second mono ambient arena loop; no external samples or melodies.
- Dedicated planet-gun music scene at 0.09 base gain, beneath combat effects.
- Weapon reports, impacts and footsteps reuse the already documented project BR
  sample library with existing bounded spatial voices. Reload, jump, landing,
  slide, mantle, hit/headshot and match cues reuse project-authored synthesis.
- No additional third-party assets or licensing obligations were introduced.
