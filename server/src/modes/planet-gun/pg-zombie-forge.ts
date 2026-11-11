import {
 PG_PRIMARY_WEAPONS,PG_ZOMBIE_FORGE_PRICES,PG_ZOMBIE_FORGE_PROCESS_MS,PG_ZOMBIE_FORGE_COMPLETE_MS,
 type PgPrimaryWeaponId,type PgZombieForgeTier,type PgZombieForgeCompletion,type PgZombieForgeSnapshot,
} from "@planetfall/shared";

type Job=PgZombieForgeCompletion&{phase:"processing"|"complete";startedAt:number;completesAt:number};
const validTime=(now:number):boolean=>Number.isFinite(now)&&now>=0&&now<=Number.MAX_SAFE_INTEGER-PG_ZOMBIE_FORGE_PROCESS_MS-PG_ZOMBIE_FORGE_COMPLETE_MS;

/** Caller owns proximity/power/life checks and the inserted inventory object's identity lock. */
export class PgZombieForge {
 private job:Job|null=null;

 /** Does not advance jobs: only update() emits the one authoritative upgrade completion. */
 begin(owner:{id:string;points:number},weaponId:PgPrimaryWeaponId,currentTier:number,now:number):boolean {
  if(!validTime(now)||!owner||typeof owner.id!=="string"||!owner.id.length||!Number.isSafeInteger(owner.points)||owner.points<0)return false;
  if(!Number.isInteger(currentTier)||currentTier<0||currentTier>2||!PG_PRIMARY_WEAPONS.includes(weaponId)||this.job)return false;
  const price=PG_ZOMBIE_FORGE_PRICES[currentTier];
  if(owner.points<price)return false;
  const targetTier=(currentTier+1) as PgZombieForgeTier;
  owner.points-=price;
  this.job={phase:"processing",ownerId:owner.id,weaponId,targetTier,startedAt:now,completesAt:now+PG_ZOMBIE_FORGE_PROCESS_MS};
  return true;
 }

 /** Deadline is inclusive. A late tick still emits the upgrade once, even after display expiry. */
 update(now:number):PgZombieForgeCompletion|null {
  if(!validTime(now)||!this.job)return null;
  const job=this.job;
  if(now<job.completesAt)return null;
  let completion:PgZombieForgeCompletion|null=null;
  if(job.phase==="processing"){
   job.phase="complete";
   completion={ownerId:job.ownerId,weaponId:job.weaponId,targetTier:job.targetTier};
  }
  if(now>=job.completesAt+PG_ZOMBIE_FORGE_COMPLETE_MS)this.job=null;
  return completion;
 }

 /** Pure read: cannot complete a job or consume its pending completion. */
 snapshot():PgZombieForgeSnapshot {
  if(!this.job)return {phase:"idle",ownerId:null,weaponId:null,targetTier:null,startedAt:null,completesAt:null};
  return this.job.phase==="processing"?{...this.job,phase:"processing"}:{...this.job,phase:"complete"};
 }

 releaseOwner(ownerId:string):void {if(this.job?.ownerId===ownerId)this.job=null;}
 reset():void {this.job=null;}
}
