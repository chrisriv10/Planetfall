import {PG_SIEGE_CAMERAS,type PgModeActionResult,type PgSnapshot} from "@planetfall/shared";
import {createPgSiegeFeedUi} from "./pg-siege-feed-ui";

/** Sensor controls are cursor UI; returning to gameplay still requires an explicit capture click. */
export function createPgSiegeFeedController(document:Document,options:{context:()=>{snapshot:PgSnapshot;localId:string}|null;capture:()=>void;select:(id:string|null)=>Promise<PgModeActionResult>}){
 const screen=createPgSiegeFeedUi(document);let pending=false;
 function update(){
  const wasVisible=!screen.root.hidden,context=options.context(),mode=context?.snapshot.mode;
  const pilot=mode?.id==="planetsiege"?mode.pilots[context!.localId]:null,index=PG_SIEGE_CAMERAS.findIndex(camera=>camera.id===pilot?.cameraId),camera=PG_SIEGE_CAMERAS[index];
  const status=mode?.id==="planetsiege"?mode.cameras?.find(state=>state.id===camera?.id):null;
  screen.render(camera&&mode?.id==="planetsiege"?{name:camera.name,index,count:PG_SIEGE_CAMERAS.length,team:pilot!.side,signal:status?.hp===0?"destroyed":!status||status.disabled?"jammed":"live",disabledUntil:status?.disabledUntil}:null);
  if(wasVisible!==!screen.root.hidden){options.capture();if(!screen.root.hidden)screen.root.querySelector<HTMLButtonElement>(".pg-siege-feed-exit")?.focus();}
 }
 async function select(id:string|null){if(pending)return;pending=true;try{await options.select(id);}finally{pending=false;}}
 function cycle(direction:-1|1){const context=options.context(),mode=context?.snapshot.mode;if(mode?.id!=="planetsiege")return;const index=PG_SIEGE_CAMERAS.findIndex(camera=>camera.id===mode.pilots[context!.localId]?.cameraId);void select(PG_SIEGE_CAMERAS[(Math.max(0,index)+direction+PG_SIEGE_CAMERAS.length)%PG_SIEGE_CAMERAS.length].id);}
 screen.onCycle=cycle;screen.onExit=()=>void select(null);
 return {root:screen.root,update,cycle,exit:()=>void select(null),get visible(){return !screen.root.hidden;}};
}
