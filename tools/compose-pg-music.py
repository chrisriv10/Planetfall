"""Original PlanetGun ambient arena score. Synthesized tones; no external samples."""
from pathlib import Path
import array, math, wave
rate=16000
duration=48
pcm=array.array('h')
for i in range(rate*duration):
    t=i/rate
    # A restrained minor suspended progression; integer cycles and edge fades loop cleanly.
    root=[45,48,43,50][int(t/12)%4]
    hz=lambda n:440*2**((n-69)/12)
    pulse=t*1.5%1
    bass=math.sin(math.tau*hz(root-12)*t)*.1
    pad=sum(math.sin(math.tau*hz(root+n)*t)*.023 for n in [0,7,14])
    note=root+[12,19,24,26,19,14,24,19][int(t*3)%8]
    arp=math.sin(math.tau*hz(note)*t)*math.exp(-(t*3%1)*7)*.035
    beat=math.sin(math.tau*55*t)*math.exp(-pulse*18)*.045
    fade=min(1,t/1.5,(duration-t)/1.5)
    pcm.append(int(math.tanh(bass+pad+arp+beat)*fade*24000))
target=Path(__file__).resolve().parents[1]/'client/public/audio/pg/nova-afterlight.wav'
target.parent.mkdir(parents=True,exist_ok=True)
with wave.open(str(target),'wb') as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(pcm.tobytes())
print(target)
