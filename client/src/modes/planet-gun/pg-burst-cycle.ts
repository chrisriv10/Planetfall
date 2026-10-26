import {PG_BALANCE,type PgWeaponId} from "@planetfall/shared";

export interface PgBurstAuthority {
 weapon:PgWeaponId;lifeId:number;serverTime:number;shots:number;nextFireAt:number;
 burstShots:number;intervalMs:number;recoveryMs:number;
}

/** Predicts request timing, while snapshots alone count accepted burst rounds.
 *
 * Integration: observe the local gun/profile on each accepted snapshot, then
 * setTrigger(raw trigger or queued press) before constructing movement input.
 * `pending` suppresses sprint even after trigger release. Call request(clockNow,
 * pgFireReady(...)) to claim a request, and emit/play recoil only when it returns
 * true. Do not also gate it with the old semi-auto fireHeld/nextFire fields.
 * Call cancel immediately on reload, switch (mouse AND pad), UI capture, death,
 * disconnect, or reset. A changed weapon/life also cancels automatically.
 */
export class PgBurstCycle {
 private authority:PgBurstAuthority|null=null;
 private held=false;private armed=true;private active=false;
 private startShots=0;private accepted=0;private nextAllowedAt=0;
 private flight:{sentAt:number;shots:number}|null=null;
 // A later snapshot can prove the original request can no longer accept:
 // it is older than the server rewind allowance, and no round was consumed.
 private readonly retryMs=PG_BALANCE.rewindMs+50;

 get pending():boolean{return this.active;}
 get acceptedRounds():number{return this.accepted;}
 get remaining():number{return this.active?Math.max(0,(this.authority?.burstShots??0)-this.accepted):0;}
 get inFlight():boolean{return this.flight!==null;}

 observe(state:PgBurstAuthority):void {
  const old=this.authority;
  if(old&&state.serverTime<old.serverTime)return;
  const changed=!!old&&(old.weapon!==state.weapon||old.lifeId!==state.lifeId);
  if(old&&!changed&&state.shots<old.shots)return;
  if(changed)this.cancel();
  this.authority={...state};
  if(state.burstShots<2){this.cancel();return;}
  if(!this.active)return;
  this.accepted=Math.min(state.burstShots,Math.max(0,state.shots-this.startShots));
  if(this.flight&&state.shots>this.flight.shots)this.flight=null;
  if(this.accepted>=state.burstShots){this.active=false;this.flight=null;this.nextAllowedAt=Math.max(this.nextAllowedAt,state.nextFireAt);}
 }

 setTrigger(held:boolean):void {
  if(!held){this.held=false;this.armed=true;return;}
  const pressed=!this.held;this.held=true;
  if(!pressed||!this.armed||this.active||!this.authority||this.authority.burstShots<2)return;
  this.armed=false;this.active=true;this.startShots=this.authority.shots;this.accepted=0;this.flight=null;
 }

 /** True claims one in-flight request. Repeated polls cannot emit duplicates. */
 request(at:number,ready:boolean):boolean {
  const state=this.authority;
  if(!this.active||!state||!ready||!Number.isFinite(at))return false;
  if(this.flight){
   const expires=this.flight.sentAt+this.retryMs;
   if(at<expires||state.serverTime<expires)return false;
   this.flight=null;
  }
  if(at<Math.max(state.nextFireAt,this.nextAllowedAt))return false;
  this.flight={sentAt:at,shots:state.shots};this.nextAllowedAt=at+(this.accepted+1>=state.burstShots?state.recoveryMs:state.intervalMs);return true;
 }

 cancel():void {this.active=false;this.accepted=0;this.flight=null;this.armed=false;}
}
