import type {BrWeaponDefinition} from "@planetfall/shared";

/** Server-only timing state, scoped to an inventory instance. It never accepts
 * client-supplied heat, charge progress or burst counters. */
export class BrWeaponCycle {
  heat=0;
  overheated=false;
  chargeStartedAt:number|null=null;
  private remaining=0;
  private nextBurstAt=0;
  private latched=false;
  private lastShotAt=-Infinity;

  release():void {this.latched=false;this.chargeStartedAt=null;}
  cancel():void {this.release();this.remaining=0;}
  cool(definition:BrWeaponDefinition,dt:number):void {
    this.heat=Math.max(0,this.heat-(definition.cooldownRate??0)*Math.max(0,dt));
    if(this.heat<=(definition.heatCapacity??Infinity)*.35)this.overheated=false;
  }
  /** One call per authority tick. Returns at most one shot, so a stalled server
   * never catches up a burst by delivering several unavoidable hits at once. */
  request(definition:BrWeaponDefinition,held:boolean,now:number):boolean {
    if(!held)this.release();
    const mode=definition.fireMode??"automatic";
    if(mode==="burst"&&this.remaining>0){
      if(now<this.nextBurstAt)return false;
      this.remaining--;this.nextBurstAt=now+(definition.burstIntervalMs??90);
      return true;
    }
    if(!held||now-this.lastShotAt<definition.fireIntervalMs)return false;
    if(mode==="semi"&&this.latched)return false;
    if(mode==="charge"){
      this.chargeStartedAt??=now;
      if(now-this.chargeStartedAt<(definition.chargeMs??0))return false;
      this.chargeStartedAt=null;
    }
    if(mode==="beam"){
      if(this.overheated)return false;
      this.heat=Math.min(definition.heatCapacity??100,this.heat+(definition.heatPerSecond??0)*definition.fireIntervalMs/1000);
      if(this.heat>=(definition.heatCapacity??100))this.overheated=true;
    }
    if(mode==="burst"){
      this.remaining=Math.max(0,(definition.burstCount??1)-1);
      this.nextBurstAt=now+(definition.burstIntervalMs??90);
    }
    this.latched=true;this.lastShotAt=now;
    return true;
  }
}
