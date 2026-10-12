"""Rebuild Planetfall's original Orbital Drift score (NumPy + ffmpeg).

No samples or third-party musical material are used. Slow overlapping minor
chords, a restrained sub voice and sparse glass notes leave room for combat.
"""
import argparse
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument("--ffmpeg", default="ffmpeg")
args = parser.parse_args()
rate, duration = 24000, 192
t = np.arange(rate * duration, dtype=np.float64) / rate
score = np.zeros((len(t), 2), dtype=np.float64)
roots = [42, 38, 45, 40, 42, 47, 38, 40]

def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)

def loop_frequency(frequency):
    return round(frequency * duration) / duration

for chord, root in enumerate(roots):
    # Circular distance makes the first and last chord overlap across the loop.
    distance = (t - chord * 24 + duration / 2) % duration - duration / 2
    envelope = np.where(np.abs(distance) < 22, .5 + .5 * np.cos(np.pi * distance / 22), 0)
    for voice, interval in enumerate([0, 7, 15, 22]):
        frequency = hz(root + interval)
        for channel, detune in enumerate([-.0012, .0012]):
            tone = np.sin(2 * np.pi * loop_frequency(frequency * (1 + detune)) * t + voice * .7)
            tone += .16 * np.sin(2 * np.pi * loop_frequency(frequency * 2) * t + chord)
            score[:, channel] += tone * envelope * (.055 if voice == 0 else .024)
    for note, interval in enumerate([24, 31, 27, 34]):
        start = chord * 24 + 3 + note * 5.25
        elapsed = (t - start) % duration
        env = (1 - np.exp(-elapsed * 8)) * np.exp(-elapsed / 2.6) * (elapsed < 17)
        for channel in range(2):
            score[:, channel] += np.sin(2 * np.pi * loop_frequency(hz(root + interval)) * t) * env * (.014 if channel == note % 2 else .008)

# Integer oscillator cycles and circular chord envelopes meet at the loop seam.
score = np.tanh(score * 1.2) * .78
pcm = (score * 32767).astype("<i2")
target = Path(__file__).resolve().parents[1] / "client/public/audio/br/orbital-drift.ogg"
with tempfile.TemporaryDirectory() as temp:
    wav = Path(temp) / "score.wav"
    with wave.open(str(wav), "wb") as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(rate)
        stream.writeframes(pcm.tobytes())
    subprocess.run([args.ffmpeg, "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libvorbis", "-q:a", "4", str(target)], check=True)
print(f"{target}: {duration}s, peak={np.max(np.abs(score)):.3f}, RMS={np.sqrt(np.mean(score**2)):.3f}")
