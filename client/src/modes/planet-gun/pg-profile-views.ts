import {PG_MAP,type PgSnapshotPlayer,type Vec3} from "@planetfall/shared";

/** Read-only DEV camera selection from real, current pilot positions. */
export function pgCrowdReviewPose(players:readonly PgSnapshotPlayer[],targetCount:number):{position:Vec3;target:Vec3;nearby:number}{
 const alive=players.filter(p=>p.hp>0);
 let best={position:{x:0,y:1.6,z:-12},target:{x:0,y:1.6,z:0},nearby:0},bestScore=Infinity;
 for(const node of PG_MAP.navigation){
  const position={x:node.position.x,y:node.position.y+1.6,z:node.position.z};
  let count=0,x=0,y=0,z=0;
  for(const p of alive){if(Math.hypot(p.position.x-position.x,p.position.y+1-position.y,p.position.z-position.z)<15){count++;x+=p.position.x;y+=p.position.y+1;z+=p.position.z;}}
  const score=Math.abs(count-targetCount)*100+Math.abs(position.x)*.01+Math.abs(position.z)*.005;
  if(count&&score<bestScore){bestScore=score;best={position,target:{x:x/count,y:y/count,z:z/count},nearby:count};}
 }
 return best;
}
