import {pgLeanOffset,type PgPlayer,type Vec3} from "@planetfall/shared";

interface Pose {at:number;lifeId:number;position:Vec3;crouched:boolean;lean:Vec3;}
/** Bounded authoritative poses. Never interpolate across death/respawn. */
export class PgHistory {
  private poses=new Map<string,Pose[]>();
  record(players:Iterable<Pick<PgPlayer,"id"|"hp"|"lifeId"|"position"|"crouched">&Partial<Pick<PgPlayer,"yaw"|"lean">>>,at:number):void {
    const present=new Set<string>();
    for(const p of players){
      present.add(p.id);
      if(p.hp<=0){this.poses.delete(p.id);continue;}
      let list=this.poses.get(p.id);
      if(!list||list.at(-1)?.lifeId!==p.lifeId){list=[];this.poses.set(p.id,list);}
      if(list.length&&at<=list.at(-1)!.at)continue;
      list.push({at,lifeId:p.lifeId,position:{...p.position},crouched:p.crouched,lean:pgLeanOffset({yaw:p.yaw??0,lean:p.lean??0})});
      while(list.length>32||list.length>1&&list[1].at<at-250)list.shift();
    }
    for(const id of this.poses.keys())if(!present.has(id))this.poses.delete(id);
  }
  sample(id:string,lifeId:number,at:number):Pose|null {
    const list=this.poses.get(id);
    if(!list?.length||list[0].lifeId!==lifeId||at<list[0].at)return null;
    for(let i=1;i<list.length;i++)if(at<=list[i].at){
      const a=list[i-1],b=list[i],t=(at-a.at)/(b.at-a.at);
      return {at,lifeId,position:{x:a.position.x+(b.position.x-a.position.x)*t,y:a.position.y+(b.position.y-a.position.y)*t,z:a.position.z+(b.position.z-a.position.z)*t},crouched:t<.5?a.crouched:b.crouched,lean:{x:a.lean.x+(b.lean.x-a.lean.x)*t,y:a.lean.y+(b.lean.y-a.lean.y)*t,z:a.lean.z+(b.lean.z-a.lean.z)*t}};
    }
    return list.at(-1)!;
  }
  clear():void{this.poses.clear();}
}
