import {PR_BALANCE,prHash,prObstacleTransform,type BotDifficulty,type PrInput,type PrPlayerState,type PrRoundDefinition,type PrTileState} from "@planetfall/shared";
export interface PrBotMemory {goal:number;nextDecision:number;sequence:number;identitySeed?:number;}
/** Bots submit ordinary movement inputs, never position changes or tile edits. */
export function prBotInput(player:PrPlayerState,round:PrRoundDefinition,tiles:PrTileState,elapsed:number,seed:number,difficulty:BotDifficulty,memory:PrBotMemory):PrInput {
  if(memory.identitySeed===undefined){let h=0;for(let i=0;i<player.id.length;i++)h=Math.imul(h,31)+player.id.charCodeAt(i)|0;memory.identitySeed=h>>>0;}
  const identity=memory.identitySeed;
  const reaction=difficulty==="easy"?420:difficulty==="hard"?160:270;
  let target=player.position;
  if(round.id==="shatterdeck"){
    if(elapsed>=memory.nextDecision){
      const current=round.tiles.find(t=>`tile:${t.id}`===player.supportId);
      let candidates=current?current.neighbors.map(id=>round.tiles[id]):round.tiles.filter(t=>Math.abs(t.center.y-player.position.y)<2);
      candidates=candidates.filter(t=>tiles.intact(t.id,elapsed+reaction+180));
      const score=(id:number)=>{
        const t=round.tiles[id],remaining=t.neighbors.filter(n=>tiles.intact(n,elapsed+reaction+300)).length;
        return remaining*(difficulty==="easy"?.3:difficulty==="hard"?1.4:1)+(tiles.triggered.has(id)?-4:2)+(prHash(seed+identity,id+Math.floor(elapsed/1000))%100)/100;
      };
      candidates.sort((a,b)=>score(b.id)-score(a.id));memory.goal=candidates[0]?.id??-1;memory.nextDecision=elapsed+reaction;
    }
    target=round.tiles[memory.goal]?.center??player.position;
  }else if(round.category==="race"){
    memory.goal=Math.max(memory.goal,0);
    const lane=((identity%5)-2)*1.8;
    const point=round.waypoints[memory.goal];
    if(point&&Math.hypot(point.x+lane-player.position.x,point.z-player.position.z)<2.8)memory.goal=Math.min(round.waypoints.length-1,memory.goal+1);
    const waypoint=round.waypoints[memory.goal]??round.finish?.center??player.position;
    target={x:waypoint.x+lane,y:waypoint.y,z:waypoint.z};
  }else{
    if(elapsed>=memory.nextDecision){
      let best=-Infinity;
      for(let i=0;i<25;i++){
        const x=(i%5-2)*6,z=(Math.floor(i/5)-2)*6;
        let danger=0;
        for(const o of round.obstacles){const tr=prObstacleTransform(o,elapsed+reaction,seed);if((tr.active||tr.warning)&&o.kind==="meteor")danger+=Math.max(0,7-Math.hypot(x-o.center.x,z-o.center.z))*10;}
        const score=-danger-Math.hypot(x-player.position.x,z-player.position.z)*.15+(prHash(seed+identity,i+Math.floor(elapsed/2000))%10);
        if(score>best){best=score;memory.goal=i;}
      }
      memory.nextDecision=elapsed+reaction;
    }
    target={x:(memory.goal%5-2)*6,y:.6,z:(Math.floor(memory.goal/5)-2)*6};
  }
  const dx=target.x-player.position.x,dz=target.z-player.position.z,d=Math.hypot(dx,dz);
  // Read upcoming rotating machinery and jump rather than ignore its collider.
  let jump=false;
  for(const o of round.obstacles)if(o.kind==="rotator"&&Math.hypot(player.position.x-o.center.x,player.position.z-o.center.z)<o.half.x+1&&player.grounded){
    const tr=prObstacleTransform(o,elapsed+reaction,seed),relativeX=player.position.x-o.center.x,relativeZ=player.position.z-o.center.z;
    if(Math.abs(-relativeX*Math.sin(tr.yaw)+relativeZ*Math.cos(tr.yaw))<2.2)jump=true;
  }
  if(round.category==="race"&&player.grounded&&d>2&&Math.abs(player.position.z%20)>8)jump=true;
  if(round.id==="shatterdeck"&&player.grounded&&tiles.triggered.has(Number(player.supportId?.slice(5)))&&elapsed%1100<130)jump=true;
  return {sequence:++memory.sequence,moveX:d>.5?dx/d:0,moveZ:d>.5?dz/d:0,jump,dive:false};
}
