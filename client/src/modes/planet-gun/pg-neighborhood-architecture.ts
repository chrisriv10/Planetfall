import { PG_MAP } from "@planetfall/shared";
import type { PgArtContext, PgArtMaterial } from "./pg-environment-builder";

/** Architecture decorates authored collision volumes. Nothing here creates a
 * doorway, walking surface or freestanding cover. Low retains the silhouette. */
export function buildPgNeighborhoodArchitecture(ctx: PgArtContext): void {
  const box = (name:string, material:PgArtMaterial, x:number,y:number,z:number,sx:number,sy:number,sz:number,detail=false) =>
    ctx.add(name,"box",material,[x,y,z,sx,sy,sz],undefined,detail);
  const solid = (id:string) => { const s=PG_MAP.solids.find(s=>s.id===id); if(!s)throw new Error(`Missing architecture backing: ${id}`); return s; };
  // Every cassette fits its own wall segment; the space between segments stays open.
  function facade(id:string, axis:"x"|"z", sign:number, style:"habitat"|"service") {
    const s=solid(id),c=s.center,h=s.half,wide=axis==="z",half=wide?h.x:h.z;
    const put=(suffix:string,m:PgArtMaterial,along:number,y:number,w:number,height:number,offset:number,detail=false)=>
      box(`${id}:${suffix}`,m,wide?c.x+along:c.x+sign*(h.x+offset),y,wide?c.z+sign*(h.z+offset):c.z+along,wide?w:.012,height,wide?.012:w,detail);
    const interior=style==="habitat"?"ivory":"frame";
    put("base", "dark",0,c.y-h.y+.15,half*2,.3,.010);
    put("crown",interior,0,c.y+h.y-.18,half*2,.36,.013);
    put("light",style==="habitat"?"amber":"cyan",0,c.y+h.y-.26,half*2-.12,.045,.026);
    const bays=Math.max(1,Math.floor(half*2/2.5)),step=(half*2-.18)/bays;
    for(let i=0;i<bays;i++) {
      const a=(i-(bays-1)/2)*step,w=step-.18,ph=h.y*1.18;
      put("window-reveal","dark",a,c.y,w+.08,ph+.12,.016);
      put("window", "glass",a,c.y,w,ph,.028);
      for(const side of[-1,1])put("window-jamb",interior,a+side*(w/2+.04),c.y,.065,ph+.12,.042);
      put("window-sill",interior,a,c.y-ph/2-.05,w+.16,.10,.043);
      put("transom",interior,a,c.y+.22,w,.065,.043);
      if(style==="service")for(let row=0;row<3;row++)put("vent","frame",a,c.y-.35+row*.11,w*.8,.04,.044,true);
    }
  }
  for(const [id,axis]of [["nova-suite-north","z"],["nova-suite-west","x"],["nova-suite-east","x"],["nova-suite-front-west","z"],["nova-suite-front-east","z"]]as const)
    for(const sign of[-1,1])facade(id,axis,sign,"habitat");
  // Roof fascia is part of the existing slab. Rounded portals are shallow
  // embossed discs backed by the outer upper wall, not pretend windows/holes.
  const roof=solid("nova-suite-roof");
  for(const sign of[-1,1]){
    box("nova-roof-reveal","dark",roof.center.x,6.46,roof.center.z+sign*(roof.half.z+.013),11.5,.12,.018);
    box("nova-roof-coping","ivory",roof.center.x,6.72,roof.center.z+sign*(roof.half.z+.013),11.5,.14,.018);
  }
  for(const x of[-30.25,-22.25]){
    ctx.add("nova-observation-medallion","torus","frame",[x,4.95,-13.407,.43,.43,.22]);
    box("nova-medallion-core","amber",x,4.95,-13.393,.08,.08,.012);
  }
  // Entry canopy has a layered bright soffit with a generous clear lower entry.
  const canopy=solid("nova-entry-canopy");
  box("nova-canopy-soffit","ivory",-25,canopy.center.y-canopy.half.y-.012,.1,6.8,.018,4.0);
  box("nova-canopy-nose","ivory",-25,3.5,2.218,7,.32,.025);
  box("nova-canopy-shadow","dark",-25,3.38,2.234,6.9,.065,.012);
  box("nova-canopy-entry-light","amber",-25,3.305,1.5,5.6,.012,.16);
  // The continuous lower west bulkhead is a smooth running surface. Its broad
  // three service cassettes stay within 3cm of the collision face and below
  // the gallery; no projecting fins or vertical sticks catch the silhouette.
  box("ion-run-face","dark",12.637,1.6,25,.018,3.12,15.9);
  box("ion-run-base","dark",12.624,.16,25,.012,.28,15.9);
  box("ion-run-guide","cyan",12.619,.72,25,.008,.045,15.6);
  // A closed shutter, diagnostic console and cooling hatch have distinct silhouettes.
  box("ion-run-shutter-border","ivory",12.625,1.7,19.7,.01,2.45,3.9);
  box("ion-run-shutter","dark",12.618,1.7,19.7,.008,2.26,3.68);
  for(let row=0;row<6;row++)box("ion-run-shutter-leaf","frame",12.613,.74+row*.38,19.7,.005,.31,3.52);
  box("ion-run-shutter-lock","amber",12.614,1,19.7,.004,.12,.35);
  box("ion-run-diagnostic-bezel","dark",12.624,1.93,24.55,.012,1.35,2.65);
  box("ion-run-diagnostic-screen","glass",12.616,1.93,24.55,.006,1.18,2.46);
  for(let row=0;row<4;row++)box("ion-run-diagnostic-readout","cyan",12.614,1.58+row*.22,24.15+row*.12,.004,.055,1.32-row*.2);
  box("ion-run-keypad","ivory",12.617,1.4,26.3,.01,.52,.36);
  box("ion-run-keypad-key","amber",12.613,1.4,26.3,.002,.08,.18);
  for(let row=0;row<7;row++)box("ion-run-cooling-louvre","dark",12.622,1.02+row*.23,31.35,.014,.12,1.55);
  ctx.add("ion-run-round-hatch","torus","frame",[12.623,1.9,29.4,.71,.71,.12],[0,Math.PI/2,0]);
  ctx.add("ion-run-hatch-lock","torus","frame",[12.619,1.9,29.4,.16,.16,.1],[0,Math.PI/2,0]);
  box("ion-run-hatch-label","amber",12.617,2.75,29.4,.006,.055,.75);
  // Small service codes stay legible as distinct one/two/three-bar patterns.
  // Their deliberately quiet warm marks do not compete with diagnostic data.
  for(const [z,count]of [[19.7,1],[24.55,2],[29.4,3]]as const)
    for(let i=0;i<count;i++)box("ion-run-bay-code","amber",12.615,2.97,z+(i-(count-1)/2)*.19,.006,.075,.09);
  // Ion's narrow two-storey service wing is darker and asymmetrical. Its actual
  // stair entrance and west upper doorway are not spanned by any facade piece.
  for(const [id,axis]of [["ion-service-back","x"],["ion-service-south","z"],["ion-control-back","x"],["ion-control-south","z"],["ion-control-front-a","x"],["ion-control-front-b","x"]]as const)
    for(const sign of[-1,1])facade(id,axis,sign,"service");
  for(const [id,accent]of [["ion-gallery","cyan"],["ion-control-roof","ivory"]]as const){
    const s=solid(id);
    for(const sign of[-1,1]){
      box(`${id}:beam`,"frame",s.center.x+sign*(s.half.x+.014),s.center.y,s.center.z,.02,s.half.y*2,s.half.z*2);
      box(`${id}:edge`,accent,s.center.x+sign*(s.half.x+.028),s.center.y+.08,s.center.z,.012,.045,s.half.z*2-.1);
    }
  }
  // Louvres and turbine face all sit on the real 2m-wide tower. The upper
  // silhouette is authored collision, rather than solid-looking floating art.
  const tower=solid("ion-vent-tower");
  for(const sign of[-1,1]){
    box("ion-tower-face","dark",16+sign*1.013,7.85,31.2,.018,2.65,2.02);
    for(let i=0;i<8;i++)box("ion-tower-louvre","ivory",16+sign*1.027,6.68+i*.31,31.2,.015,.1,1.8,true);
    box("ion-tower-status","cyan",16+sign*1.032,8.92,31.2,.012,.045,1.5);
  }
  ctx.add("ion-turbine-collar","torus","frame",[tower.center.x,7.85,30.13,.76,.76,.20]);
  ctx.add("ion-turbine-core","torus","frame",[tower.center.x,7.85,30.118,.5,.5,.12]);
  box("ion-tower-cap","ivory",16,9.19,31.2,2,.025,2.1);
  // Purposeful terminal tops stay within their existing cover's footprint.
  for(const id of["west-interior-console","west-gallery-terminal","east-interior-console","east-observatory-optics","maintenance-workbench"]){
    const s=solid(id),c=s.center,h=s.half;
    box(`${id}:work-surface`,"frame",c.x,c.y+h.y+.009,c.z,h.x*1.9,.014,h.z*1.9);
    box(`${id}:touch-display`,"glass",c.x,c.y+h.y+.02,c.z,h.x*1.3,.008,h.z*1.3);
    for(let i=0;i<3;i++)box(`${id}:display-row`,id.startsWith("east")?"cyan":"amber",c.x,c.y+h.y+.026,c.z+(i-1)*h.z*.32,h.x*.8,.004,.035);
  }
  // Furniture is backed by deliberate collision volumes. Cushion crowns rise
  // only four centimetres above the real bench top.
  const seat=solid("nova-lounge-seat");
  for(const dx of[-1.08,0,1.08])ctx.add("nova-lounge-seat:cushion","sphere","frame",[seat.center.x+dx,.46,-18.5,.51,.08,.59]);
  box("nova-lounge-seat:front-rail","ivory",-30.5,.19,-17.838,3.35,.14,.018);
  for(const dx of[-1.08,0,1.08])box("nova-lounge-back:upholstery","frame",-30.5+dx,.75,-18.916,1.01,.64,.02);
  box("nova-suite-table:top","ivory",-30,4.5,-17.5,1.98,.024,1.48);
  box("nova-suite-table:inset","glass",-30,4.517,-17.5,1.6,.008,1.08);
  ctx.add("nova-suite-table:interface","torus","frame",[-30,4.524,-17.5,.34,.34,.1],[Math.PI/2,0,0]);
  for(const id of["ion-repair-bench","ion-control-console"]){
    const s=solid(id),c=s.center,h=s.half;
    box(`${id}:countertop`,"ivory",c.x,c.y+h.y+.01,c.z,h.x*1.95,.018,h.z*1.96);
    box(`${id}:front-cabinet`,"frame",c.x-h.x-.014,c.y,c.z,.018,h.y*1.8,h.z*1.9);
    for(const dz of[-.95,0,.95]){
      box(`${id}:drawer`,"dark",c.x-h.x-.026,c.y,c.z+dz,.006,h.y*1.25,.8);
      box(`${id}:handle`,"ivory",c.x-h.x-.033,c.y+.15,c.z+dz,.008,.055,.35);
    }
    if(id==="ion-control-console"){
      box(`${id}:screen`,"glass",c.x,c.y+h.y+.024,c.z,1,.008,2.5);
      for(let row=0;row<4;row++)box(`${id}:controls`,"cyan",c.x,c.y+h.y+.031,c.z-.9+row*.6,.65,.004,.06);
    }else{
      box(`${id}:work-mat`,"dark",c.x,c.y+h.y+.023,c.z,1.03,.006,2.5);
      for(const dz of[-.7,.4])ctx.add(`${id}:tool-ring`,"torus","frame",[c.x,c.y+h.y+.032,c.z+dz,.20,.20,.1],[Math.PI/2,0,0]);
    }
  }
  solid("ion-diagnostic-rack");
  box("ion-diagnostic-rack:backplate","ivory",17.426,1.95,30,.018,.87,2.95);
  for(const dz of[-.94,0,.94]){
    box("ion-diagnostic-rack:screen","glass",17.413,2.01,30+dz,.008,.51,.77);
    box("ion-diagnostic-rack:status","cyan",17.405,1.66,30+dz,.006,.04,.42);
  }
  for(const x of[-27.9,-22.1])ctx.add("nova-canopy-round-socket","torus","frame",[x,3.51,2.232,.12,.12,.12]);
  // Central relay cap shades a real console and has an illuminated underside;
  // its four approach lanes remain entirely free below the collision canopy.
  const cap=solid("center-relay-canopy");
  box("relay-soffit","ivory",-2,cap.center.y-cap.half.y-.013,-7,7.05,.018,4.85);
  for(const sign of[-1,1]){
    box("relay-cap-rim","frame",-2,5.7,-7+sign*2.516,7.2,.35,.022);
    box("relay-cap-light","cyan",-2,5.56,-7+sign*2.531,6.85,.045,.012);
    box("relay-core-casing","ivory",-2+sign*.437,4,-7,.02,3.12,.8);
    box("relay-core-energy","cyan",-2+sign*.452,4,-7,.01,2.6,.18);
  }
  for(const x of[-4.7,.7])box("relay-under-strip","amber",x,5.5,-7,.1,.012,3.8);
}
