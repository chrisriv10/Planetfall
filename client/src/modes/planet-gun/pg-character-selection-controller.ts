import type {PgModeActionResult,PgRoomView,PgSnapshot} from "@planetfall/shared";
import {createPgCharacterSelectionScreen} from "./pg-character-selection-screen";
import {pgCharacterSelectionView,type PgCharacterDraft} from "./pg-character-selection-state";
import type {PgCharacterShowcase} from "./pg-character-showcase-layer";
import type {PgModeUiAction} from "./pg-mode-ui-art";

interface Context {room:PgRoomView;snapshot:PgSnapshot|null;localId:string;screen:HTMLElement;}
export function createPgCharacterSelectionController(document:Document,options:{context:()=>Context|null;capture:()=>void;showcase:(view:PgCharacterShowcase|null,stage:HTMLElement|null)=>void;confirm:(action:PgModeUiAction)=>Promise<PgModeActionResult>}){
 const screen=createPgCharacterSelectionScreen(document);screen.root.id="pg-character-selection-screen";
 let draft:PgCharacterDraft={characterId:null,primary:null,pending:false},epoch=0,returnFocus:HTMLElement|null=null,covered:HTMLElement|null=null,coveredVisibility="",serverError="";
 let showcase:PgCharacterShowcase|null=null,loading:Promise<PgCharacterShowcase>|null=null,previewSignature="",previewOwner:HTMLElement|null=null;
 const current=()=>{const context=options.context();return context?{context,view:pgCharacterSelectionView(context.room,context.snapshot,context.localId,draft)}:null;};
 function close(restoreFocus=true){
  if(screen.root.hidden)return;epoch++;screen.root.hidden=true;options.showcase(null,null);previewOwner=null;
  if(covered)covered.style.visibility=coveredVisibility;covered=null;draft.pending=false;options.capture();
  if(restoreFocus&&returnFocus?.isConnected&&returnFocus.getClientRects().length)returnFocus.focus();returnFocus=null;
 }
 function update(){
  if(screen.root.hidden)return;const state=current();if(!state?.view){close(false);return;}
  const {context,view}=state;draft.characterId=view.draftId;draft.primary=view.primary;
  screen.render(serverError&&!view.reason?{...view,reason:serverError}:view);
  if(showcase){
   const me=context.room.players.find(player=>player.id===context.localId);if(!me)return;
   const signature=JSON.stringify([view.draftId,view.primary,me.color,me.equippedCosmetics.suit,me.equippedCosmetics["weapon-skin"]]);
   if(signature!==previewSignature){previewSignature=signature;showcase.setSelection({characterId:view.draftId,primary:view.primary,color:me.color,suit:me.equippedCosmetics.suit,finishId:me.equippedCosmetics["weapon-skin"]});}
   if(previewOwner!==context.screen){previewOwner=context.screen;options.showcase(showcase,screen.stage);}
  }
 }
 async function open(){
  if(!screen.root.hidden)return;const state=current();if(!state?.view)return;
  const generation=++epoch;draft={characterId:state.view.selectedId,primary:null,pending:false};serverError="";previewSignature="";
  returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;covered=state.context.screen;coveredVisibility=covered.style.visibility;covered.style.visibility="hidden";
  screen.root.hidden=false;options.capture();update();screen.focus();
  loading??=import("./pg-character-showcase").then(({createPgCharacterShowcase})=>createPgCharacterShowcase());
  try{showcase=await loading;if(generation===epoch&&!screen.root.hidden)update();}
  catch{loading=null;if(generation===epoch&&!screen.root.hidden){serverError="Character preview could not load. Close and try again.";update();}}
 }
 screen.onClose=()=>close();
 screen.onDraft=id=>{const state=current();if(draft.pending||!state?.view||state.view.reserved.has(id)||!state.view.catalog.some(character=>character.id===id))return;draft.characterId=id;draft.primary=null;serverError="";update();};
 screen.onPrimary=primary=>{const state=current(),character=state?.view?.catalog.find(character=>character.id===draft.characterId);if(!draft.pending&&character?.primaryChoices.some(id=>id===primary)){draft.primary=primary;serverError="";update();}};
 screen.onConfirm=async()=>{
  const state=current();if(!state?.view?.canConfirm||draft.pending)return;const {context,view}=state,character=view.catalog.find(character=>character.id===view.draftId)!;
  const primary=character.primaryChoices.find(weapon=>weapon===view.primary);if(!primary)return;
  const me=context.room.players.find(player=>player.id===context.localId);
  if(view.selectedId===view.draftId&&me?.loadout.primary===view.primary){close();return;}
  const generation=epoch;draft.pending=true;serverError="";update();
  let result:PgModeActionResult;
  try{result=await options.confirm({kind:"select",characterId:view.draftId,loadout:{primary,secondary:character.secondary,primaryModules:[],secondaryModules:[]}});}
  catch{result={ok:false,error:"Selection was not confirmed. Try again."};}
  if(generation!==epoch)return;draft.pending=false;if(result.ok)close();else{serverError=result.error??"Selection was not confirmed.";update();}
 };
 return {root:screen.root,open,close,update,get visible(){return !screen.root.hidden;}};
}
