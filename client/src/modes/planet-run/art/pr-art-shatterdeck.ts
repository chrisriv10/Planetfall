import {PR_BALANCE} from "@planetfall/shared";
import {createPrArtKit,PR_ART_PALETTES,type PrArtContext,type PrArtQuality,type PrRoundArt} from "./pr-art-shared";

/** Containment art is peripheral or deep below elimination, never a false landing. */
export function createPrShatterdeckArt(ctx:PrArtContext):PrRoundArt {
 const kit=createPrArtKit(ctx,{...PR_ART_PALETTES.shatterdeck,primary:0x85c5ff,secondary:0xe19cea,hazard:0xff815c,glow:0xbefcff}),{add,group}=kit;
 // The shared torus is unit-radius with a .035 tube: scaling it to arena size
 // made opaque 3m collars. Narrow the owned geometry once, and break the arcs
 // into six open sectors so the layered cells remain the scene's visual centre.
 const hoop=kit.geometries.torus,vertices=hoop.getAttribute("position");
 for(let i=0;i<vertices.count;i++){
  const x=vertices.getX(i),y=vertices.getY(i),length=Math.hypot(x,y),cx=x/length,cy=y/length;
  vertices.setXYZ(i,cx+(x-cx)*.1,cy+(y-cy)*.1,vertices.getZ(i)*.1);
 }
 vertices.needsUpdate=true;
 const index=hoop.getIndex()!,openIndices:number[]=[];
 for(let i=0;i<index.count;i+=3){
  const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2),angle=Math.atan2(vertices.getY(a)+vertices.getY(b)+vertices.getY(c),vertices.getX(a)+vertices.getX(b)+vertices.getX(c));
  const sector=((angle%(Math.PI/3))+Math.PI/3)%(Math.PI/3);
  if(sector>.12&&sector<Math.PI/3-.12)openIndices.push(a,b,c);
 }
 hoop.setIndex(openIndices);hoop.computeBoundingBox();hoop.computeBoundingSphere();
 const decks=new Map<number,{low:number;high:number}>();
 let footprint=0;
 for(const {deck,center} of ctx.round.tiles){
  const level=decks.get(deck);
  if(level){level.low=Math.min(level.low,center.y);level.high=Math.max(level.high,center.y);}
  else decks.set(deck,{low:center.y,high:center.y});
  footprint=Math.max(footprint,Math.hypot(center.x,center.z)+PR_BALANCE.tileRadius);
 }
 const levels=[...decks.values()].sort((a,b)=>b.high-a.high);
 if(!levels.length){kit.dispose();throw Error("Shatterdeck containment requires a playable deck");}
 const top=levels[0].high,bottom=Math.min(...levels.map(level=>level.low));
 const spacing=Math.max(3,(top-bottom)/Math.max(1,levels.length-1));
 const radius=footprint+12,deep=ctx.round.killY-24;
 const crownY=top+spacing*1.7,spireTop=crownY+spacing*.6,spireBase=ctx.round.killY-2;
 const spireY=(spireTop+spireBase)/2,spireHeight=spireTop-spireBase,spectatorY=top+spacing;
 const cage=group("shatterdeck-final-containment"),rotor=group("shatterdeck-rotating-crown"),traffic=group("shatterdeck-spectator-orbit",undefined,1),flow=group("shatterdeck-conduit-flow",undefined,1);
 // Four external collars repeat the deck color progression without spanning its holes.
 const layers=["white","primary","secondary","hazard"] as const;
 for(const [deck,level] of levels.entries()){
  const y=(level.low+level.high)/2,mat=layers[deck%layers.length];
  add("layer-containment-collar","torus",mat,[0,y,0,radius,radius,radius],cage,[Math.PI/2,0,0]);
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6,x=Math.cos(a)*radius,z=Math.sin(a)*radius;
   add("layer-outboard-node","hex",mat,[x,y,z,.55,.2,.55],cage);
   add("tower-insulator","box","dark",[x,y,z,.6,.85,.6],cage,[0,-a,0]);
  }
 }
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3+Math.PI/6,x=Math.cos(a)*radius,z=Math.sin(a)*radius;
  add("final-arena-spire","cone","dark",[x,spireY,z,1.25,spireHeight,1.25],cage);
  add("spire-energy-spine","box","secondary",[x,spireY,z,.13,spireHeight*.92,.13],cage);
  add("spire-crown","hex","neutral",[x,spireTop,z,.8,.5,.8],cage);
  add("spire-beacon","sphere","glow",[x,spireTop+1,z,.4,.9,.4],cage);
  add("conduit-packet","hex","glow",[x,0,z,.25,.8,.25],flow);
 }
 // A segmented orbital crown has no horizontal fill; spectators see through its centre.
 rotor.position.y=crownY;
 add("crown-track","torus","primary",[0,0,0,radius+4,radius+4,radius+4],rotor,[Math.PI/2,0,0]);
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6;
  add("crown-collector","box","primary",[Math.cos(a)*(radius+4),0,Math.sin(a)*(radius+4),.35,1.6,2.8],rotor,[0,-a,0]);
 }
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2+.4,r=radius-5,x=Math.cos(a)*r,z=Math.sin(a)*r;
  add("spectator-drone-shell","sphere","white",[x,spectatorY,z,1.7,.7,1.1],traffic);
  add("spectator-drone-lens","sphere","dark",[x,spectatorY,z+1,.65,.55,.3],traffic);
  add("spectator-drone-thruster","torus","glow",[x,spectatorY-.5,z,1,1,1],traffic,[Math.PI/2,0,0]);
 }
 // Displays sit beyond the containment perimeter; their central field remains open.
 for(const side of [-1,1]){
  const display=group(`shatterdeck-final-display-${side}`);display.position.set(side*(radius+6),top+spacing*.8,-radius*.6);display.rotation.y=-side*.55;
  add("display-back","box","dark",[0,0,0,22,7,1],display);
  for(const y of [-3.55,3.55])add("display-luminous-border","box","secondary",[0,y,.55,22,.14,.12],display);
  kit.label("SHATTERDECK / FINAL",[0,.8,.52,20,2.1,1],display);
  kit.label("LAST PILOT STANDING",[0,-1.45,.53,16,1.1,1],display);
 }
 // Reactor throat begins 24 m below the kill plane; it cannot conceal a live gap.
 const throatRadius=footprint*.75;
 const reactor=group("shatterdeck-deep-reactor");reactor.position.y=deep;
 for(let i=0;i<5;i++)add("reactor-depth-ring","torus",i%2?"hazard":"secondary",[0,-i*11,0,throatRadius*(1-i*.1),throatRadius*(1-i*.1),throatRadius*(1-i*.1)],reactor,[Math.PI/2,0,0]);
 add("reactor-terminal-core","sphere","hazard",[0,-55,0,5,9,5],reactor);
 const turbine=group("shatterdeck-void-turbine",reactor,2);
 for(let i=0;i<10;i++){const a=i*Math.PI/5;add("deep-rotor-fin","box","primary",[Math.cos(a)*throatRadius*.78,-12,Math.sin(a)*throatRadius*.78,2,6,8],turbine,[0,-a,0]);}
 kit.finish();let disposed=false,quality:PrArtQuality="high";
 return {
  update(ms){if(disposed)return;if(quality!=="low"){rotor.rotation.y=ms*.000035;traffic.rotation.y=-ms*.00005;traffic.position.y=Math.sin(ms*.0006)*.7;flow.position.y=bottom+((ms*.002)%Math.max(1,top-bottom));}if(quality==="high")turbine.rotation.y=-ms*.00009;},
  setQuality(q){quality=q;kit.setQuality(q);},
  dispose(){if(disposed)return;disposed=true;kit.dispose();},
 };
}
