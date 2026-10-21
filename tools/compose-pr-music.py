"""Original PlanetRun orbital race score. Standard library synthesis; no samples."""
import argparse, array, math, subprocess, tempfile, wave
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--ffmpeg',default='ffmpeg');args=parser.parse_args()
rate=24000;duration=64;pcm=array.array('h');tau=math.tau
roots=[48,53,57,55];arp=[0,7,12,16,12,7,19,14]
for i in range(rate*duration):
 t=i/rate;beat=t*2;step=int(beat*2);phase=(beat*2)%1;root=roots[int(t/16)%4]
 hz=lambda n:440*2**((n-69)/12)
 env=math.sin(math.pi*min(1,phase*8))*math.exp(-phase*4)
 melody=math.sin(tau*hz(root+arp[step%8])*t)*env*.12
 bass=math.sin(tau*hz(root-12)*t)*(.65+.35*math.cos(tau*(beat%1)))*.14
 kick=math.sin(tau*(52+30*math.exp(-(beat%1)*20))*t)*math.exp(-(beat%1)*15)*.12
 pad=sum(math.sin(tau*hz(root+n)*t) for n in [0,7,12])*.025
 fade=min(1,t/.02,(duration-t)/.02)
 for channel in range(2):pcm.append(int(math.tanh((melody*(1 if channel==step%2 else .75)+bass+kick+pad)*1.4)*fade*28000))
target=Path(__file__).resolve().parents[1]/'client/public/audio/pr/orbital-sprint.ogg';target.parent.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory() as temp:
 wav=Path(temp)/'score.wav'
 with wave.open(str(wav),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes(pcm.tobytes())
 subprocess.run([args.ffmpeg,'-y','-loglevel','error','-i',str(wav),'-c:a','libvorbis','-q:a','4',str(target)],check=True)
print(target)
