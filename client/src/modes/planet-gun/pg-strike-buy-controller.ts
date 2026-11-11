import {pgWeaponValid,type PgModeActionResult,type PgSnapshot} from "@planetfall/shared";
import {createPgStrikeBuyScreen} from "./pg-strike-buy-screen";
import type {PgShowcaseLayerView} from "./pg-character-showcase-layer";
import type {createPgWeaponShowcase} from "./pg-weapon-showcase";
import {pgStrikeBuyView} from "./pg-strike-buy-state";

/** One outstanding intent; snapshots and existing acknowledged actions own equipment and credits. */
export function createPgStrikeBuyController(document:Document,options:{context:()=>{snapshot:PgSnapshot;localId:string;screen:HTMLElement}|null;capture:()=>void;showcase:(view:PgShowcaseLayerView|null,stage:HTMLElement|null)=>void;buy:(id:string)=>Promise<PgModeActionResult>}){
 const screen=createPgStrikeBuyScreen(document);screen.root.id="pg-strike-buy-screen";
 const stage=screen.root.querySelector<HTMLElement>(".pg-buy-preview")!;
 let preview:ReturnType<typeof createPgWeaponShowcase>|null=null,loading:Promise<void>|null=null,attached=false;
 let pending:string|null=null,feedback="",epoch=0,returnFocus:HTMLElement|null=null,covered:HTMLElement|null=null,visibility="";
 function close(restoreFocus=true){
  if(screen.root.hidden)return;epoch++;screen.root.hidden=true;pending=null;options.showcase(null,null);attached=false;preview?.setSelection(null);screen.root.dataset.modelPreview="false";
  if(covered)covered.style.visibility=visibility;covered=null;options.capture();
  if(restoreFocus&&returnFocus?.isConnected&&returnFocus.getClientRects().length)returnFocus.focus();returnFocus=null;
 }
 function update(){
  if(screen.root.hidden)return;const context=options.context(),view=context?pgStrikeBuyView(context.snapshot,context.localId,pending,feedback):null;
  if(!view){close(false);return;}screen.render(view);updatePreview();
 }
 function updatePreview(){
  const id=screen.selectedItem,isWeapon=pgWeaponValid(id);screen.root.dataset.modelPreview=String(!!preview&&isWeapon);
  if(!preview)return;const context=options.context();preview.setSelection(isWeapon?id:null,context?.snapshot.players.find(player=>player.id===context.localId)?.equippedCosmetics["weapon-skin"]);
  if(isWeapon&&!attached){options.showcase(preview,stage);attached=true;}
  else if(!isWeapon&&attached){options.showcase(null,null);attached=false;}
 }
 function loadPreview(){
  if(loading||preview)return;loading=import("./pg-weapon-showcase").then(({createPgWeaponShowcase})=>{preview=createPgWeaponShowcase();if(!screen.root.hidden)updatePreview();}).catch(()=>{}).finally(()=>{loading=null;});
 }
 screen.onSelect=()=>updatePreview();
 function open(){
  if(!screen.root.hidden)return;const context=options.context();if(!context||!pgStrikeBuyView(context.snapshot,context.localId))return;
  epoch++;pending=null;feedback="";returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  covered=context.screen;visibility=covered.style.visibility;covered.style.visibility="hidden";screen.root.hidden=false;options.capture();update();loadPreview();screen.focus();
 }
 screen.onClose=()=>close();
 screen.onBuy=async id=>{
  const context=options.context(),view=context?pgStrikeBuyView(context.snapshot,context.localId,pending):null;
  if(pending||!view?.items.some(item=>item.id===id&&item.available))return;
  const generation=epoch;pending=id;feedback="";update();let result:PgModeActionResult;
  try{result=await options.buy(id);}catch{result={ok:false,error:"Purchase was not confirmed. Try again."};}
  if(generation!==epoch)return;pending=null;feedback=result.ok?"Purchase confirmed.":result.error??"Purchase rejected.";update();
 };
 return {root:screen.root,open,close,update,get visible(){return !screen.root.hidden;}};
}
