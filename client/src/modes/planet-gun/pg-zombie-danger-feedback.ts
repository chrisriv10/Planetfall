import type {PgModeSnapshot} from "@planetfall/shared";

/** Snapshot-edge cue only: one warning on entering the final accepted hit. */
export class PgZombieDangerFeedback {
 private critical=false;private lifeId=-1;private lastCue=-Infinity;
 update(mode:PgModeSnapshot|undefined,id:string,lifeId:number,now:number):boolean {
  if(mode?.id!=="planetzombies"){this.critical=false;this.lifeId=-1;this.lastCue=-Infinity;return false;}
  if(lifeId!==this.lifeId){this.lifeId=lifeId;this.critical=false;}
  const pilot=mode.pilots[id],critical=!!pilot&&pilot.life==="alive"&&pilot.hitCapacity-pilot.hitCount<=1&&pilot.hitCount>0;
  const entering=critical&&!this.critical;this.critical=critical;
  if(!entering||now-this.lastCue<2000)return false;
  this.lastCue=now;return true;
 }
}
