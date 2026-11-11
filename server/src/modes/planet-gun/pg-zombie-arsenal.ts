import {
 PG_ZOMBIE_ARSENAL_COST,PG_ZOMBIE_ARSENAL_REVEAL_MS,PG_ZOMBIE_ARSENAL_CLAIM_MS,
 PG_ZOMBIE_ARSENAL_WEIGHTS,type PgPrimaryWeaponId,type PgZombieArsenalSnapshot,
} from "@planetfall/shared";

type Reservation={ownerId:string;weaponId:PgPrimaryWeaponId;revealAt:number;expiresAt:number};
const validTime=(now:number):boolean=>Number.isFinite(now)&&now>=0&&now<=Number.MAX_SAFE_INTEGER-PG_ZOMBIE_ARSENAL_REVEAL_MS-PG_ZOMBIE_ARSENAL_CLAIM_MS;

/** Server-only transaction state. Caller validates life, range, power and request sequence. */
export class PgZombieArsenal {
 private reservation:Reservation|null=null;
 constructor(private readonly random:()=>number=Math.random){}

 /** Synchronous reservation and debit: rejection never changes the buyer's points. */
 purchase(owner:{id:string;points:number},now:number):boolean {
  if(!validTime(now)||typeof owner.id!=="string"||!owner.id.length||!Number.isSafeInteger(owner.points)||owner.points<PG_ZOMBIE_ARSENAL_COST)return false;
  this.update(now);
  if(this.reservation)return false;
  let roll:number;
  try {roll=this.random();}catch{return false;}
  if(!Number.isFinite(roll)||roll<0||roll>=1)return false;
  const total=PG_ZOMBIE_ARSENAL_WEIGHTS.reduce((sum,item)=>sum+item.weight,0);
  const target=roll*total;
  let cumulative=0,weaponId:PgPrimaryWeaponId|null=null;
  for(const item of PG_ZOMBIE_ARSENAL_WEIGHTS){
   cumulative+=item.weight;
   if(target<cumulative){weaponId=item.weaponId;break;}
  }
  if(!weaponId)return false;
  const revealAt=now+PG_ZOMBIE_ARSENAL_REVEAL_MS;
  owner.points-=PG_ZOMBIE_ARSENAL_COST;
  this.reservation={ownerId:owner.id,weaponId,revealAt,expiresAt:revealAt+PG_ZOMBIE_ARSENAL_CLAIM_MS};
  return true;
 }

 claim(ownerId:string,now:number):PgPrimaryWeaponId|null {
  if(!validTime(now))return null;
  this.update(now);
  const pending=this.reservation;
  if(!pending||pending.ownerId!==ownerId||now<pending.revealAt)return null;
  this.reservation=null;
  return pending.weaponId;
 }

 /** Expiration is exclusive: at expiresAt the result can no longer be claimed. */
 update(now:number):void {
  if(validTime(now)&&this.reservation&&now>=this.reservation.expiresAt)this.reservation=null;
 }

 snapshot(now:number):PgZombieArsenalSnapshot {
  if(!validTime(now))throw new RangeError("Invalid arsenal snapshot time");
  this.update(now);
  const pending=this.reservation;
  if(!pending)return {phase:"idle",ownerId:null,weaponId:null,revealAt:null,expiresAt:null};
  const {ownerId,revealAt,expiresAt}=pending;
  return now<revealAt?{phase:"revealing",ownerId,weaponId:null,revealAt,expiresAt}
   :{phase:"ready",ownerId,weaponId:pending.weaponId,revealAt,expiresAt};
 }

 releaseOwner(ownerId:string):void {if(this.reservation?.ownerId===ownerId)this.reservation=null;}
 reset():void {this.reservation=null;}
}
