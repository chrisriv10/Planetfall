import type {PgMotion,Vec3} from "@planetfall/shared";

const LIMIT=480;
const summarize=(values:readonly number[])=>{const a=[...values].sort((x,y)=>x-y),n=a.length;return {count:n,mean:n?a.reduce((s,v)=>s+v,0)/n:0,median:a[Math.floor(n*.5)]??0,p95:a[Math.min(n-1,Math.floor(n*.95))]??0,max:a[n-1]??0};};
/** Bounded, development-only measurements. Simulation and camera are observed separately. */
export class PgMotionDiagnostics {
 private corrections:{at:number;distance:number;vertical:number;camera:number;pending:number;age:number;mode:string;modeChanged:boolean}[]=[];
 private inputLatencies:number[]=[];
 private modes:Record<string,number>={};
 private inputAt:number|null=null;
 input(at:number):void{this.inputAt??=at;}
 simulated(at:number,mode:string):void{if(this.inputAt!==null){this.inputLatencies.push(Math.max(0,at-this.inputAt));if(this.inputLatencies.length>LIMIT)this.inputLatencies.shift();this.inputAt=null;}this.modes[mode]=(this.modes[mode]??0)+1;}
 corrected(before:PgMotion,after:PgMotion,at:number,age:number,pending:number,cameraDelta:Vec3):void{
  const dx=before.position.x-after.position.x,dy=before.position.y-after.position.y,dz=before.position.z-after.position.z;
  this.corrections.push({at,distance:Math.hypot(dx,dy,dz),vertical:Math.abs(dy),camera:Math.hypot(cameraDelta.x,cameraDelta.y,cameraDelta.z),pending,age:Math.max(0,age),mode:after.mode,modeChanged:before.mode!==after.mode});
  if(this.corrections.length>LIMIT)this.corrections.shift();
 }
 read(){const rows=this.corrections,duration=rows.length>1?(rows.at(-1)!.at-rows[0].at)/1000:0;return {inputToSimulationMs:summarize(this.inputLatencies),correctionMeters:summarize(rows.map(r=>r.distance)),verticalCorrectionMeters:summarize(rows.map(r=>r.vertical)),cameraCorrectionMeters:summarize(rows.map(r=>r.camera)),snapshotAgeMs:summarize(rows.map(r=>r.age)),pendingInputs:summarize(rows.map(r=>r.pending)),correctionsPerSecond:duration?rows.filter(r=>r.distance>.001).length/duration:0,modeCorrections:rows.filter(r=>r.modeChanged).length,modes:{...this.modes},histogram:{under1mm:rows.filter(r=>r.distance<.001).length,under5cm:rows.filter(r=>r.distance>=.001&&r.distance<.05).length,under25cm:rows.filter(r=>r.distance>=.05&&r.distance<.25).length,under1m:rows.filter(r=>r.distance>=.25&&r.distance<1).length,over1m:rows.filter(r=>r.distance>=1).length}};}
 reset():void{this.corrections=[];this.inputLatencies=[];this.modes={};this.inputAt=null;}
}
