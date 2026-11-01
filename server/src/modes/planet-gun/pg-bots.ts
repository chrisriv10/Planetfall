import {PG_MAP,pgRayBox,type BotDifficulty,type PgInput,type PgPlayer,type Vec3,type PgMap,type PgSolid} from "@planetfall/shared";
export interface PgBotContext {map:PgMap;goal:Vec3|null;visible:(a:Vec3,b:Vec3)=>boolean;grounded?:boolean;steering?:Vec3|null;}
export interface PgBotMemory {sequence:number;nextDecision:number;targetId:string|null;goal:number;path:number[];fireAt:number;stuckAt:number;last:Vec3;}
export const pgBotMemory=():PgBotMemory=>({sequence:0,nextDecision:0,targetId:null,goal:0,path:[],fireAt:0,stuckAt:0,last:{x:0,y:0,z:0}});
const navigationSolids=new WeakMap<PgMap,PgSolid[]>();
function reachableNode(from:Vec3,to:Vec3,map:PgMap):boolean{let solids=navigationSolids.get(map);if(!solids){solids=map.solids.map(s=>({...s,half:{x:s.half.x+.43,y:s.half.y,z:s.half.z+.43}}));navigationSolids.set(map,solids);}const delta={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z},length=Math.hypot(delta.x,delta.y,delta.z);if(length<.01)return true;const direction={x:delta.x/length,y:delta.y/length,z:delta.z/length},origin={...from,y:from.y+.95};return !solids.some(s=>{const hit=pgRayBox(origin,direction,s);return hit!==null&&hit<length-.05;});}
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);
function visible(a:Vec3,b:Vec3):boolean {const n=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);if(n<.001)return true;const direction={x:(b.x-a.x)/n,y:(b.y-a.y)/n,z:(b.z-a.z)/n};return !PG_MAP.solids.some(box=>{const t=pgRayBox(a,direction,box);return t!==null&&t<n;});}
function route(from:number,to:number,map:PgMap=PG_MAP,grounded=false):number[]{const queue=[from],previous=new Map<number,number>([[from,-1]]);for(let i=0;i<queue.length;i++){const id=queue[i];if(id===to)break;for(const link of map.navigation[id].links)if((!grounded||link.kind!=="wall-run")&&!previous.has(link.to)){previous.set(link.to,id);queue.push(link.to);}}if(!previous.has(to))return [];const path:number[]=[];for(let id=to;id!==from;id=previous.get(id)!)path.unshift(id);return path;}
export function pgBotInput(p:PgPlayer,players:Iterable<PgPlayer>,now:number,difficulty:BotDifficulty,m:PgBotMemory,context?:PgBotContext):{input:PgInput;fire:boolean} {
  const map=context?.map??PG_MAP,canSee=context?.visible??visible,steered=context?.steering!==undefined;
  const reaction=difficulty==="easy"?500:difficulty==="hard"?170:300;
  const eye={...p.position,y:p.position.y+1.4};
  const enemies=[...players].filter(e=>e.hp>0&&e.team!==p.team&&canSee(eye,{...e.position,y:e.position.y+1})).sort((a,b)=>distance(a.position,p.position)-distance(b.position,p.position));
  const target=enemies[0];
  if(target?.id!==m.targetId){m.targetId=target?.id??null;m.fireAt=now+reaction;}
  if(!steered&&now>=m.nextDecision){m.nextDecision=now+reaction;
    const nodes=map.navigation.filter(n=>difficulty!=="easy"||n.position.y===0);
    const metric=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
    const ordered=context?[...nodes].sort((a,b)=>metric(a.position,p.position)-metric(b.position,p.position)):nodes;const nearest=context?ordered.find(n=>reachableNode(p.position,n.position,map))??ordered[0]:nodes.reduce((a,b)=>metric(a.position,p.position)<metric(b.position,p.position)?a:b);
    const upper=nodes.filter(n=>n.position.y>=2&&n.links.length>0),identity=p.id.charCodeAt(p.id.length-1);
    const goal=context?.goal?([...nodes].sort((a,b)=>metric(a.position,context.goal!)-metric(b.position,context.goal!)).find(n=>reachableNode(context.goal!,n.position,map))??nearest):target?nodes.reduce((a,b)=>metric(a.position,target.position)<metric(b.position,target.position)?a:b):difficulty!=="easy"&&upper.length&&Math.floor(now/6000)%3===identity%3?upper[(identity+Math.floor(now/6000))%upper.length]:nodes[(Math.floor(now/3500)+identity*7)%nodes.length];
    m.path=route(nearest.id,goal.id,map,context?.grounded);m.goal=goal.id;
  }
  if(!steered)while(m.path.length&&distance(map.navigation[m.path[0]].position,p.position)<.85&&Math.abs(map.navigation[m.path[0]].position.y-p.position.y)<.6)m.path.shift();
  const destination=steered?(context.steering??p.position):context?.goal&&!m.path.length?context.goal:map.navigation[m.path.length?m.path[0]:m.goal].position;
  const dx=destination.x-p.position.x,dz=destination.z-p.position.z,n=Math.max(1,Math.hypot(dx,dz));
  let yaw=target?Math.atan2(p.position.x-target.position.x,p.position.z-target.position.z):Math.atan2(-dx,-dz);
  const error=difficulty==="easy"?.05:difficulty==="hard"?.007:.022;
  yaw+=target?Math.sin(now*.003+p.id.length)*error:0;
  const pitch=target?Math.atan2(target.position.y+1.05-eye.y,Math.max(1,distance(target.position,p.position))):0;
  const c=Math.cos(yaw),s=Math.sin(yaw),forwardX=dx/n,forwardZ=dz/n;
  let jump=difficulty!=="easy"&&destination.y>p.position.y+.55;if(now-m.stuckAt>700){jump||=distance(m.last,p.position)<.5;m.last={...p.position};m.stuckAt=now;}
  if(context?.goal&&distance(context.goal,p.position)<.65)jump=false;
  if(p.mode==="wall-run"&&now>p.wallUntil-350)jump=!p.jumpHeld;
  if(steered)jump=false;
  const close=!steered&&!context?.goal&&target&&distance(target.position,p.position)<12;
  const advancing=!!context?.goal&&distance(context.goal,p.position)>5&&(!target||distance(target.position,p.position)>14);
  const slide=!steered&&!target&&difficulty!=="easy"&&p.grounded&&Math.hypot(p.velocity.x,p.velocity.z)>8&&Math.floor((now+p.id.charCodeAt(p.id.length-1)*71)/650)%11===0;
  return {input:{sequence:++m.sequence,moveX:close?Math.sin(now*.001)*.65:forwardX*c-forwardZ*s,moveZ:close?0:forwardX*s+forwardZ*c,yaw,pitch,jump,sprint:advancing||!target,crouch:slide,ads:!!target&&!advancing},fire:!!target&&!advancing&&now>=m.fireAt};
}
