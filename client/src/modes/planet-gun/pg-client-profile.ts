const CAPACITY=240;
const NAMES=["frameCpuMs","inputCpuMs","viewmodelCpuMs","pilotsCpuMs","worldCpuMs","renderSubmitCpuMs","snapshotCpuMs","hudCpuMs"] as const;
type Metric=typeof NAMES[number];
/** DEV-only bounded measurements. Render submission is CPU time, not GPU time. */
export class PgClientProfile {
 private readonly values=NAMES.map(()=>new Float64Array(CAPACITY));
 private readonly counts=new Uint32Array(NAMES.length);
 private readonly cursors=new Uint32Array(NAMES.length);
 private add(index:number,value:number):void{if(!Number.isFinite(value)||value<0)return;this.values[index][this.cursors[index]]=value;this.cursors[index]=(this.cursors[index]+1)%CAPACITY;this.counts[index]=Math.min(CAPACITY,this.counts[index]+1);}
 frame(start:number,input:number,viewmodel:number,pilots:number,world:number,end:number):void{this.add(0,end-start);this.add(1,input-start);this.add(2,viewmodel-input);this.add(3,pilots-viewmodel);this.add(4,world-pilots);this.add(5,end-world);}
 snapshot(total:number,hud:number):void{this.add(6,total);this.add(7,hud);}
 read():Record<Metric,{count:number;mean:number;median:number;p95:number;p99:number}>{
  const result={} as ReturnType<PgClientProfile["read"]>;
  for(let i=0;i<NAMES.length;i++){const a=Array.from(this.values[i].subarray(0,this.counts[i])).sort((a,b)=>a-b),n=a.length;result[NAMES[i]]={count:n,mean:n?a.reduce((sum,v)=>sum+v,0)/n:0,median:a[Math.floor(n*.5)]??0,p95:a[Math.min(n-1,Math.floor(n*.95))]??0,p99:a[Math.min(n-1,Math.floor(n*.99))]??0};}
  return result;
 }
}
