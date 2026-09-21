import { BR_POIS, BR_SECONDARY_LOCATIONS } from "@planetfall/shared";

/** Opt-in local art-review surface. No server commands or gameplay mutation. */
export function createBrReview(selectView:(id:string|null)=>void, quality:(value:"low"|"medium"|"high")=>void) {
  const root=document.createElement("aside");root.id="br-art-review";
  root.style.cssText="position:fixed;right:12px;bottom:88px;z-index:9999;max-width:300px;background:#0b1528e8;color:#d6eaf5;padding:9px;border:1px solid #57778b;border-radius:8px;font:11px system-ui;pointer-events:auto";
  const select=document.createElement("select");select.setAttribute("aria-label","BR review view");
  const options=[
    ["","Gameplay camera"],["aerial","Island aerial"],["nova-street","Nova street"],["nova-storefront","Nova storefront"],["nova-roof","Nova rooftop"],
    ["mall-interior","Mall interior"],["hotel-lobby","Hotel lounge"],["housing-lounge","Housing lounge"],["hotel-stairs","Hotel stairs"],["hotel-landing","Hotel upper landing"],["helios-interior","Helios interior"],["crash-interior","Crash fuselage interior"],
    ["foundry-interior","Foundry interior"],["foundry-roof","Foundry roof access"],
    ["storm-boundary","Storm boundary (art preview)"],["storm-final","Final circle (art preview)"],
    ...BR_POIS.map(p=>[p.id,p.name]),...BR_SECONDARY_LOCATIONS.map(p=>[p.id,p.name])
  ];
  for(const [value,label] of options){const option=document.createElement("option");option.value=value;option.textContent=label;select.append(option);}
  select.value=new URLSearchParams(location.search).get("brView")??"";
  select.onchange=()=>selectView(select.value||null);
  const preset=document.createElement("select");preset.setAttribute("aria-label","BR review quality");
  for(const value of ["high","medium","low"] as const){const option=document.createElement("option");option.value=value;option.textContent=value.toUpperCase();preset.append(option);}
  preset.onchange=()=>quality(preset.value as "low"|"medium"|"high");
  const hide=document.createElement("button");hide.textContent="Hide HUD";
  hide.style.cssText="background:#24364e;color:#d6eaf5;border:1px solid #57778b;padding:4px 8px;margin-top:4px";
  hide.onclick=()=>{const hidden=document.body.classList.toggle("br-review-clean");hide.textContent=hidden?"Show HUD":"Hide HUD";};
  const style=document.createElement("style");style.textContent=".br-review-clean #br-hud{visibility:hidden}";
  const output=document.createElement("output");output.style.cssText="display:block;white-space:pre-line;margin-top:5px";
  root.append(select,preset,hide,output,style);document.body.append(root);
  let frames=0,started=performance.now();
  return {
    root,
    frame(now:number,stats:()=>{calls:number;triangles:number;textures:number;materials:number;instances:number}){
      frames++;
      if(now-started<1500)return;
      const s=stats();output.textContent=`${(frames*1000/(now-started)).toFixed(1)} FPS · ${s.calls} calls\n${s.triangles.toLocaleString()} triangles · ${s.textures} textures\n${s.materials} world materials · ${s.instances.toLocaleString()} enabled instances`;
      frames=0;started=now;
    },
    dispose(){root.remove();document.body.classList.remove("br-review-clean");}
  };
}
