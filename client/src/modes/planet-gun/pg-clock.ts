import type {GameSocket} from "../../network";

/** Midpoint clock samples, independent of renderer-delayed match snapshots. */
export class PgClock {
 private offset:number|null=null;
 private bestRtt=Infinity;
 reset():void{this.offset=null;this.bestRtt=Infinity;}
 sample(sent:number,received:number,serverTime:number):boolean{
  const rtt=received-sent;
  // Slow callback delivery cannot safely estimate the server's 50ms future
  // allowance. Keep the best lightweight home/lobby sample instead.
  if(![sent,received,serverTime].every(Number.isFinite)||rtt<0||rtt>100||rtt>=this.bestRtt)return false;
  this.bestRtt=rtt;this.offset=serverTime-(sent+received)/2;return true;
 }
 now(localNow:number,fallbackOffset:number):number{return localNow+(this.offset??fallbackOffset);}
}

const clocks=new WeakMap<GameSocket,PgClock>();
export function pgClock(socket:GameSocket):PgClock{
 let clock=clocks.get(socket);if(clock)return clock;
 clock=new PgClock();clocks.set(socket,clock);
 let generation=0,interval:ReturnType<typeof setInterval>|undefined;
 const pending=new Set<ReturnType<typeof setTimeout>>();
 const stop=()=>{generation++;clock.reset();if(interval!==undefined)clearInterval(interval);for(const timer of pending)clearTimeout(timer);pending.clear();};
 const probe=()=>{
  if(!socket.connected)return;
  const sent=performance.now(),epoch=generation;
  socket.timeout(1000).emit("pg:clock",(error:Error|null,serverTime:number)=>{
   if(!error&&socket.connected&&epoch===generation)clock.sample(sent,performance.now(),serverTime);
  });
 };
 const start=()=>{stop();probe();for(const delay of [250,750]){const timer=setTimeout(()=>{pending.delete(timer);probe();},delay);pending.add(timer);}interval=setInterval(probe,30_000);};
 socket.on("connect",start);socket.on("disconnect",stop);if(socket.connected)start();
 return clock;
}
