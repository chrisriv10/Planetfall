import {PG_BALANCE as B} from "./balance.js";
import type {PgMap,PgSolid,PgSpawn,PgNavNode} from "./types.js";
import type {Vec3} from "../index.js";
import {pgRayBox} from "./math.js";
const v=(x:number,y:number,z:number):Vec3=>({x,y,z});
const solids:PgSolid[]=[];
function box(id:string,kind:PgSolid["kind"],x:number,y:number,z:number,hx:number,hy:number,hz:number,mantle=false,wallRunFaces?:PgSolid["wallRunFaces"]){solids.push({id,kind,center:v(x,y,z),half:v(hx,hy,hz),mantle,wallRunFaces});}
box("orbital-deck","floor",0,-.5,0,46,.5,38);
// The two compounds intentionally differ in orientation, massing and entrances.
box("west-habitat-north","habitat",-25,1.6,-21,10,1.6,.4);
box("west-habitat-south-a","habitat",-31,1.6,-1,4,1.6,.4);box("west-habitat-south-b","habitat",-19,1.6,-1,4,1.6,.4);
box("west-habitat-end-a","habitat",-35,1.6,-17, .4,1.6,4);box("west-habitat-end-b","habitat",-35,1.6,-5,.4,1.6,4);
box("west-upper-gallery","floor",-25,3.25,-17,10,.25,4,true);
box("west-gallery-east","floor",-21.5,3.25,-11,6.5,.25,2,true);box("west-gallery-edge","floor",-34,3.25,-11,1,.25,2,true);
box("east-habitat-east-north","habitat",35,1.6,7,.4,1.6,4);box("east-habitat-east-south","habitat",35,1.6,23,.4,1.6,4);
box("east-habitat-south","habitat",27,1.6,27,8,1.6,.4);
box("east-habitat-west-a","habitat",19,1.6,23,.4,1.6,4);box("east-habitat-west-b","habitat",19,1.6,7,.4,1.6,4);
box("east-upper-observatory","floor",28,3.25,23,7,.25,4,true);box("east-gallery-west","floor",24.5,3.25,15,3.5,.25,4,true);box("east-gallery-edge","floor",34.5,3.25,15,.5,.25,4,true);box("east-stair-landing","floor",32,3.25,17.6,2,.25,1.4,true);
box("east-service-wing","habitat",25,1.3,-3,10,1.3,.4);
box("transit-crossover","floor",0,4,1,12,.25,3,true);
for(let i=0;i<9;i++){box(`west-gallery-stair-${i}`,"stair",-31, Math.min(1.75,.2+i*.2),-3-i*1.2,2,Math.min(1.75,.2+i*.2),.6,true);box(`east-gallery-stair-${i}`,"stair",32,Math.min(1.75,.2+i*.2),6+i*1.2,2,Math.min(1.75,.2+i*.2),.6,true);}
box("transit-console","transit",-2,1.2,-7,3,1.2,2,true);
box("transit-ticket-bank","transit",7,.65,11,2,.65,4,true);
box("hydroponic-planter-west","planter",-15,.6,22,5,.6,2,true);
box("hydroponic-planter-east","planter",9,.6,-23,5,.6,2,true);
box("service-capacitor-bank","utility",27,1,-15,2,1,3,true);
box("west-air-handler","utility",-27,1,13,3,1,2,true);
box("hydro-run-north","wall-run",-6,2.5,-31,15,2.5,.35,false,["z+"]);
box("hydro-run-turn","wall-run",-21,2.5,-26,.35,2.5,5,false,["x+"]);
box("service-run-east","wall-run",13,2.5,25,.35,2.5,8,false,["x-"]);
box("center-mantle-plinth","utility",-8,.75,3,2,.75,2,true);
// Ground-level cover is structural: every visible bulkhead, counter and
// maintenance bay also blocks movement and bullets.
box("transit-pier-west","transit",-10,2,2.5,.65,2,.45);
box("transit-pier-east","transit",10,2,2.5,.65,2,.45);
box("west-interior-console","utility",-19,.6,-17,1.4,.6,1.2,true);
box("west-interior-partition","habitat",-23,1.2,-10,.25,1.2,2.2);
box("east-interior-console","utility",24,.65,24,1.6,.65,1,true);
box("east-observatory-optics","utility",26,4.15,23,1.1,.65,1.1,true);
box("west-gallery-terminal","utility",-20,4.1,-17,1.25,.6,1,true);
// A third, smaller maintenance room breaks the southern cross-map sightline
// and provides a real alternate interior between the habitats.
box("maintenance-west","habitat",-7,1.45,25,.35,1.45,4);
box("maintenance-east","habitat",3,1.45,25,.35,1.45,4);
box("maintenance-back-a","habitat",-5,1.45,29,2,1.45,.35);
box("maintenance-back-b","habitat",1,1.45,29,2,1.45,.35);
box("maintenance-roof","floor",-2,3.15,25,5.4,.25,4.4,true);
box("maintenance-workbench","utility",-5,.6,26,.9,.6,1.8,true);
box("hydro-control-island","utility",-4,.7,-21,1.8,.7,1,true);
box("hydro-planted-screen","planter",-5,.9,-14,3.5,.9,.65,true);
box("service-charge-station","utility",23,.85,4,1.2,.85,2,true);
// Readable safety edges retain intentional jump/void risk while preventing
// accidental walks off an unmarked tabletop.
box("deck-rail-west","rail",-45.5,.65,0,.25,.65,37.5);
box("deck-rail-east","rail",45.5,.65,0,.25,.65,37.5);
box("deck-rail-north","rail",0,.65,-37.5,45,.65,.25);
box("deck-rail-south","rail",0,.65,37.5,45,.65,.25);
const spawns:PgSpawn[]=[];for(const team of ["solar","void"] as const)for(let i=0;i<6;i++)spawns.push({id:`${team}-${i}`,team,position:v((team==="solar"?-1:1)*(i<3?40:36),0,[-27,0,29][i%3]),yaw:team==="solar"?-Math.PI/2:Math.PI/2});
// Ground waypoints are visibility-linked once at map construction, not searched in 3D each frame.
const ground:Vec3[]=[];
const free=(p:Vec3)=>!solids.some(b=>p.y<b.center.y+b.half.y-.02&&p.y+B.height>b.center.y-b.half.y+.02&&Math.abs(p.x-b.center.x)<b.half.x+.46&&Math.abs(p.z-b.center.z)<b.half.z+.46);
for(let x=-40;x<=40;x+=8)for(let z=-32;z<=32;z+=8){const p=v(x,0,z);if(free(p))ground.push(p);}
for(const [x,z]of [[-38,-11],[-32,-11],[-25,-3],[-25,3],[38,17.5],[28,17.5],[16,15],[-31,-2],[32,4]]){const p=v(x,0,z);if(free(p))ground.push(p);}
const navigation:PgNavNode[]=ground.map((position,id)=>({id,position,links:[]}));
for(let a=0;a<navigation.length;a++)for(let b=a+1;b<navigation.length;b++){
 const from=navigation[a].position,to=navigation[b].position,dx=to.x-from.x,dz=to.z-from.z,d=Math.hypot(dx,dz);if(d>12||d<.1)continue;
 const origin=v(from.x,1,from.z),direction=v(dx/d,0,dz/d);
 if(solids.some(box=>{const hit=pgRayBox(origin,direction,{...box,half:{x:box.half.x+.46,y:box.half.y,z:box.half.z+.46}});return hit!==null&&hit<d;}))continue;
 navigation[a].links.push({to:b,kind:"walk"});navigation[b].links.push({to:a,kind:"walk"});
}
const nearest=(p:Vec3)=>navigation.filter(n=>n.position.y===0).sort((a,b)=>Math.hypot(a.position.x-p.x,a.position.z-p.z)-Math.hypot(b.position.x-p.x,b.position.z-p.z))[0].id;
const addTraversal=(position:Vec3,from:number,kind:"jump"|"mantle"|"wall-run")=>{const id=navigation.length;navigation.push({id,position,links:[{to:from,kind}]});navigation[from].links.push({to:id,kind});return id;};
const west=addTraversal(v(-25,3.5,-15),nearest(v(-31,0,-2)),"mantle");
const crossover=addTraversal(v(0,4.25,1),nearest(v(-8,0,3)),"jump");
addTraversal(v(-8,1.5,3),nearest(v(-8,0,7)),"mantle");
const east=addTraversal(v(28,3.5,23),nearest(v(32,0,4)),"mantle");
// Route the galleries through the actual stair flights, rather than fictitious
// direct jumps across the transit plaza. Bots and audits share these anchors.
for(const [end,x,baseZ,direction]of [[west,-31,-3,-1],[east,32,6,1]]){
 let previous=nearest(v(x,0,baseZ-direction*2));
 for(let i=0;i<9;i++){const id=navigation.length;navigation.push({id,position:v(x,Math.min(3.5,.4+i*.4),baseZ+direction*i*1.2),links:[{to:previous,kind:"walk"}]});navigation[previous].links.push({to:id,kind:"walk"});previous=id;}
 if(end===east){const id=navigation.length;navigation.push({id,position:v(32,3.5,17.7),links:[{to:previous,kind:"walk"}]});navigation[previous].links.push({to:id,kind:"walk"});previous=id;}
 navigation[previous].links.push({to:end,kind:"walk"});navigation[end].links.push({to:previous,kind:"walk"});
 // Remove the old nonphysical ground-to-gallery shortcut.
 const shortcut=navigation[end].links.find(l=>l.kind==="mantle");if(shortcut){navigation[shortcut.to].links=navigation[shortcut.to].links.filter(l=>l.to!==end);navigation[end].links=navigation[end].links.filter(l=>l!==shortcut);}
}
addTraversal(v(-6,2,-30.2),nearest(v(-14,0,-27)),"wall-run");addTraversal(v(12.2,2,25),nearest(v(8,0,23)),"wall-run");
export const PG_MAP:PgMap={id:"nova-block",name:"Nova Block",halfWidth:46,halfDepth:38,solids,spawns,navigation};
export const PG_REVIEW_VIEWS={overhead:{position:v(0,95,4),target:v(0,0,0)},solar:{position:v(-40,1.57,0),target:v(0,1.57,0)},void:{position:v(40,1.57,0),target:v(0,1.57,0)},center:{position:v(-12,1.57,4),target:v(8,1.57,0)},left:{position:v(-16,1.57,-27),target:v(12,1.57,-25)},right:{position:v(12,1.57,18),target:v(30,1.57,12)},upper:{position:v(0,5.82,1),target:v(25,3.5,17)},wallRun:{position:v(-18,2,-27),target:v(10,2,-28)},westInterior:{position:v(-25,1.57,-17),target:v(-15,1.57,-13)},eastInterior:{position:v(28,1.57,23),target:v(26,1.57,14)}} as const;
