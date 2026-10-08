import {BR_MAP,BR_POIS,BR_SECONDARY_LOCATIONS,type BrPlayerState,type BrRoomView} from "@planetfall/shared";
import {brMapPercent,createBrMapArt} from "./br-map-art";

type MarkerPlayer=Pick<BrPlayerState,"id"|"position"|"color">;
type Layers={art:HTMLImageElement;circle:HTMLElement;next:HTMLElement;route:HTMLElement;player:HTMLElement;teammates:Map<string,HTMLElement>};
const layers=new WeakMap<HTMLElement,Layers>();
const position=(node:HTMLElement,x:number,z:number)=>{node.style.left=`${brMapPercent(x)}%`;node.style.top=`${brMapPercent(z)}%`;};
const node=(className:string)=>{const element=document.createElement("i");element.className=className;return element;};

/** Static authored map art and labels survive snapshot updates. Replacing the
 * SVG image and its entire DOM every 120ms caused needless decode/layout work
 * and detached nodes while the player was reading the tactical map.
 * Teammates are supplied by the existing visibility/team policy, not inferred
 * here. No enemies, authority changes, timers or event listeners are owned.
 */
export function updateBrTacticalMap(container:HTMLElement,player:Pick<BrPlayerState,"position">,room:BrRoomView|null,teammates:readonly MarkerPlayer[]):void{
  let state=layers.get(container);
  if(!state||state.art.parentElement!==container){
    const art=createBrMapArt();
    const secondary=BR_SECONDARY_LOCATIONS.map(location=>{const dot=node("br-map-secondary");position(dot,location.position.x,location.position.z);dot.title=location.name;return dot;});
    const pois=BR_POIS.map(poi=>{const label=document.createElement("span");label.className="br-map-poi";label.textContent=poi.name;position(label,poi.position.x,poi.position.z);label.style.setProperty("--poi-color",poi.color);return label;});
    state={art,circle:node("br-map-circle"),next:node("br-map-circle next"),route:node("br-map-route"),player:node("br-map-player"),teammates:new Map()};
    container.replaceChildren(art,...secondary,...pois,state.circle,state.next,state.route,state.player);
    layers.set(container,state);
  }
  state.circle.hidden=state.next.hidden=!room;
  if(room)for(const [circle,center,radius] of [[state.circle,room.storm.center,room.storm.radius],[state.next,room.storm.nextCenter,room.storm.nextRadius]] as const){
    position(circle,center.x,center.z);circle.style.width=circle.style.height=`${radius/BR_MAP.radius*96}%`;
  }
  state.route.hidden=!room?.ship;
  if(room?.ship){
    const startX=brMapPercent(room.ship.start.x),startZ=brMapPercent(room.ship.start.z),endX=brMapPercent(room.ship.end.x),endZ=brMapPercent(room.ship.end.z);
    position(state.route,room.ship.start.x,room.ship.start.z);
    state.route.style.width=`${Math.hypot(endX-startX,endZ-startZ)}%`;
    state.route.style.transform=`rotate(${Math.atan2(endZ-startZ,endX-startX)}rad)`;
  }
  position(state.player,player.position.x,player.position.z);
  const active=new Set(teammates.map(teammate=>teammate.id));
  for(const [id,marker] of state.teammates)if(!active.has(id)){marker.remove();state.teammates.delete(id);}
  for(const teammate of teammates){
    let marker=state.teammates.get(teammate.id);
    if(!marker){marker=node("br-map-player teammate");state.teammates.set(teammate.id,marker);container.append(marker);}
    position(marker,teammate.position.x,teammate.position.z);marker.style.setProperty("--teammate-color",teammate.color);
  }
}
