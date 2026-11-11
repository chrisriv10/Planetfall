import {createPgModeHudPresentation} from "./pg-mode-hud-presentation";
import {bindingHudLabel} from "../../binding-hud-label";
import type {BindingAction,BindingContext} from "../../input-bindings";
import {PG_ZOMBIE_DOORS,PG_MODES,PG_MODE_IDS,PG_WEAPONS,PG_ZOMBIE_PRICES,pgResolveHero,pgResolveOperator,type PgModeAction,type PgModeId,type PgModeSnapshot,type PgRoomView,type PgSnapshotPlayer,type PgWeaponId} from "@planetfall/shared";
import "./pg-mode-ui.css";
import {PG_SIEGE_CAMERAS,pgCollisionMap,pgHasLineOfSight,type Vec3} from "@planetfall/shared";
type Intent<T>=T extends unknown?Omit<T,"sequence"|"lifeId">:never;
export type PgModeUiAction=Intent<PgModeAction>;
const title=(value:string)=>value.replaceAll("-"," ").replace(/\b\w/g,c=>c.toUpperCase());
/** DOM-only presentation. The caller owns input routing, life/sequence IDs and authoritative acknowledgements. */
export function createPgModeUi(document:Document){
 const root=document.createElement("section");root.className="pg-mode-picker";
 const hudRoot=document.createElement("section");hudRoot.className="pg-mode-hud";hudRoot.hidden=true;
 const element=<K extends keyof HTMLElementTagNameMap>(tag:K,parent:HTMLElement,className="")=>{const e=document.createElement(tag);e.className=className;parent.append(e);return e;};
 const row=element("div",root,"pg-mode-heading"),label=element("label",row);label.textContent="NOVA BLOCK · RULESET";
 const select=element("select",label);select.setAttribute("aria-label","PlanetGun submode");
 for(const id of PG_MODE_IDS){const option=element("option",select);option.value=id;option.textContent=PG_MODES[id].name;}
 const summary=element("p",root,"pg-mode-summary"),characterChoice=element("button",root,"pg-character-open button button-secondary"),characterCopy=element("p",root,"pg-character-description");characterChoice.type="button";characterChoice.hidden=true;
 const summaryHud=createPgModeHudPresentation(document);hudRoot.append(summaryHud.root);const abilities=element("div",hudRoot,"pg-mode-abilities");
 const signal=element("div",hudRoot,"pg-mode-signal-lost");signal.textContent="SIGNAL LOST · OPEN B TO RETURN";signal.hidden=true;
 const flash=element("div",hudRoot,"pg-mode-flash");flash.hidden=true;flash.setAttribute("aria-hidden","true");
 const help=element("p",hudRoot,"pg-mode-help"),menu=element("div",hudRoot,"pg-mode-menu");menu.hidden=true;menu.setAttribute("role","dialog");menu.setAttribute("aria-label","Mode equipment and character");
 const close=element("button",menu,"pg-mode-menu-close");close.type="button";close.textContent="CLOSE · B";
 const menuCharacter=element("button",menu,"pg-character-open");menuCharacter.type="button";menuCharacter.hidden=true;
 const scouting=element("div",menu,"pg-mode-abilities"),shop=element("details",menu,"pg-mode-buy"),shopTitle=element("summary",shop);shop.open=true;shopTitle.textContent="EQUIPMENT";const shopItems=element("div",shop,"pg-mode-purchases");
 let viewPosition:Vec3|null=null,collisionRevision=-1,collisionMap:ReturnType<typeof pgCollisionMap>|null=null;
 let room:PgRoomView|null=null,localId="",snapshot:PgModeSnapshot|null=null,lastShop="",lastAbilities="",lastScouting="";
 let returnFocus:HTMLElement|null=null;
 const api={root,hudRoot,onCharacterSelection:null as null|(()=>void),onAction:null as null|((action:PgModeUiAction)=>void),onConfigure:null as null|((mode:PgModeId)=>void),onMenuChange:null as null|((open:boolean)=>void),
  get menuOpen(){return !menu.hidden;},
  setMenuOpen(open:boolean){if(open&&!api.menuOpen)returnFocus=document.activeElement as HTMLElement|null;menu.hidden=!open;api.onMenuChange?.(open);if(open)close.focus();else if(returnFocus?.isConnected)returnFocus.focus();},
  setViewPosition(position:Vec3|null){viewPosition=position;},
  render(next:PgRoomView,id:string,state?:PgModeSnapshot|null){
   room=next;localId=id;if(state!==undefined)snapshot=state;const mode=next.configuration.mode??"deathmatch";root.dataset.mode=mode;select.value=mode;select.disabled=next.hostId!==id||next.phase!=="lobby";
   summary.textContent=PG_MODES[mode].summary;
   const me=next.players.find(player=>player.id===id),selected=next.phase==="lobby"?next.selections?.[id]:snapshot?.pilots[id]?.characterId??next.selections?.[id];
   const character=mode==="planetwatch"?pgResolveHero(selected):mode==="planetsiege"?pgResolveOperator(selected):null;
   const supported=mode==="planetwatch"||mode==="planetsiege";characterChoice.hidden=menuCharacter.hidden=characterCopy.hidden=!supported;
   characterChoice.textContent=menuCharacter.textContent=mode==="planetwatch"?"CHOOSE HERO":"CHOOSE OPERATOR";
   characterCopy.textContent=character?`${character.name} · ${PG_WEAPONS[me?.loadout.primary??character.primaryChoices[0]].name} + ${PG_WEAPONS[character.secondary].name}`:"Inspect your team, abilities and approved equipment.";
  },
  setSnapshot(next:PgModeSnapshot|null,id:string,serverTime=0,players:readonly Pick<PgSnapshotPlayer,"id"|"team"|"hp">[]=[]){const previousMode=snapshot?.id;snapshot=next;localId=id;hudRoot.hidden=!next;if(!next){lastShop="";lastAbilities="";lastScouting="";shopItems.replaceChildren();abilities.replaceChildren();scouting.replaceChildren();flash.hidden=true;signal.hidden=true;collisionMap=null;menu.hidden=true;return;}if(previousMode!==next.id)collisionMap=null;const me=next.pilots[id];if(!me)return;signal.hidden=!(next.id==="planetsiege"&&(next.pilots[id]?.cameraId||next.pilots[id]?.controllingDrone)&&next.controls?.[id]?.viewOrigin===null);
   summaryHud.render(next,id,serverTime,players);
   const sensor=next.id==="planetsiege"&&!!(next.pilots[id].cameraId||next.pilots[id].controllingDrone),spectator=players.some(player=>player.id===id&&player.hp<=0)&&!sensor;
   const context:BindingContext=spectator?"planet-gun:spectator":`planet-gun:${next.id}`;
   const key=(action:BindingAction,pad?:string)=>bindingHudLabel(context,action,document.body.dataset.input,pad);
   close.textContent=`CLOSE · ${key("buyMenu","D↓")}`;signal.textContent=`SIGNAL LOST · OPEN ${key("buyMenu","D↓")} TO RETURN`;
   help.textContent=spectator?`${key("previousTarget")} / ${key("nextTarget")}: change pilot · ${key("buyMenu","D↓")}: equipment`:next.id==="planetstrike"?`${key("interact","R3")} hold: plant / defuse / recover · ${key("drop")}: drop weapon · ${key("buyMenu","D↓")}: buy at spawn · ${key("ability1","LB")} / ${key("ability2","RB")} / ${key("ultimate","D↑")}: utility`:next.id==="planetsiege"?`${key("interact","R3")}: panel / ${key("ability1","LB")}: gadget / ${key("ability2","RB")}: ${me.side==="attack"?"breach":"barricade"} / ${key("reinforce")}: reinforce / ${key("drone")}: drone / ${key("camera")}: camera / ${key("leanLeft","D←")} / ${key("leanRight","D→")}: lean / ${key("buyMenu","D↓")}: equipment`:next.id==="planetzombies"?`${key("interact","R3")} hold: revive / power / repair entry · ${key("buyMenu","D↓")}: rack / upgrade / ammo purchases`:`${key("ability1","LB")} / ${key("ability2","RB")}: abilities · ${key("ultimate","D↑")}: ultimate · ${key("buyMenu","D↓")}: hero selection at spawn`;
   if(collisionRevision!==(next.collision.topologyRevision??next.collision.revision)||!collisionMap){collisionRevision=next.collision.topologyRevision??next.collision.revision;collisionMap=pgCollisionMap(next.collision);}
   let flashOpacity=0;if(viewPosition)for(const effect of next.effects){if(effect.kind!=="flash"||effect.startsAt>serverTime||effect.endsAt<=serverTime)continue;const distance=Math.hypot(viewPosition.x-effect.position.x,viewPosition.y-effect.position.y,viewPosition.z-effect.position.z);if(distance<=effect.radius&&pgHasLineOfSight(viewPosition,{...effect.position,y:effect.position.y+1},collisionMap))flashOpacity=Math.max(flashOpacity,.85*Math.min(1,(effect.endsAt-serverTime)/700));}flash.hidden=flashOpacity===0;flash.style.opacity=String(flashOpacity);
   const hero=pgResolveHero(me.characterId),operator=pgResolveOperator(me.characterId),moves=hero?[...hero.abilities,hero.ultimate]:operator?[operator.signature]:[];
   const abilityTexts=moves.map((ability,i)=>`${ability.name} · ${i===2?`${Math.floor(me.ultimate)}%`:me.cooldowns[i as 0|1]>serverTime?`${Math.ceil((me.cooldowns[i as 0|1]-serverTime)/1000)}s`:ability.recharge==="round"?`${me.charges[i as 0|1]} LEFT`:"READY"}`);
   if(next.id==="planetsiege")abilityTexts.push(`${key("ability2","RB")} | ${me.side==="attack"?"Common Breach":"Barricade"} | ${me.charges[1]} LEFT`);
   const scoutingSignature=JSON.stringify([next.id,me.side,next.id==="planetsiege"?next.pilots[id].cameraId:null]);if(scoutingSignature!==lastScouting){lastScouting=scoutingSignature;scouting.replaceChildren();if(next.id==="planetsiege"){
    if(me.side==="defend"){for(const camera of PG_SIEGE_CAMERAS){const button=element("button",scouting);button.textContent=title(camera.id);button.addEventListener("click",()=>api.onAction?.({kind:"camera",cameraId:camera.id}));}const exit=element("button",scouting);exit.textContent="RETURN FROM CAMERA";exit.addEventListener("click",()=>api.onAction?.({kind:"camera",cameraId:null}));}
    else for(const control of [true,false]){const button=element("button",scouting);button.textContent=control?"CONTROL DRONE":"RETURN FROM DRONE";button.addEventListener("click",()=>api.onAction?.({kind:"drone",control,moveX:0,moveZ:0,yaw:0,pitch:0}));}
   }}
   const abilitySignature=JSON.stringify([abilityTexts,me.life]);if(lastAbilities!==abilitySignature){lastAbilities=abilitySignature;abilities.replaceChildren();abilityTexts.forEach((text,i)=>{const button=element("button",abilities);button.type="button";button.textContent=text;button.disabled=me.life!=="alive"||(i<2&&me.cooldowns[i as 0|1]>serverTime)||(i===2&&me.ultimate<100)||(i<2&&moves[i]?.recharge==="round"&&me.charges[i as 0|1]===0)||(next.id==="planetsiege"&&i===1&&(me.charges[1]===0||me.side==="attack"&&next.subphase!=="action"));button.addEventListener("click",()=>api.onAction?.({kind:"ability",slot:i as 0|1|2}));});}
   const purchases:[string,number][]=[];let money=0;
   if(next.id==="planetzombies"){const p=next.pilots[id];money=p.points;for(const [item,value] of Object.entries(PG_ZOMBIE_PRICES)){if(typeof value==="number"&&item!=="door")purchases.push([item,value]);}if(p.upgrade<3)purchases.push(["upgrade",PG_ZOMBIE_PRICES.upgrade[p.upgrade as 0|1|2]]);for(const panel of next.collision.panels)if(panel.active&&PG_ZOMBIE_DOORS.some(d=>d.id===panel.id))purchases.push([`door:${panel.id}`,PG_ZOMBIE_PRICES.door]);}
   shop.hidden=purchases.length===0;const shopSignature=JSON.stringify([purchases,money,me.life]);if(lastShop!==shopSignature){lastShop=shopSignature;shopItems.replaceChildren();for(const [item,price]of purchases){const button=element("button",shopItems);button.type="button";const weapon=item.replace("rack-","") as PgWeaponId;button.textContent=`${PG_WEAPONS[weapon]?.name??title(item)} · ${price}`;button.disabled=money<price||me.life!=="alive";button.addEventListener("click",()=>api.onAction?.({kind:"buy",itemId:item}));}}
   if(room)api.render(room,localId,next);
  },
  dispose(){summaryHud.dispose();api.onAction=null;api.onConfigure=null;api.onCharacterSelection=null;root.remove();hudRoot.remove();root.replaceChildren();hudRoot.replaceChildren();room=null;snapshot=null;}
 };
 close.addEventListener("click",()=>api.setMenuOpen(false));
 menu.setAttribute("aria-modal","true");
 menu.addEventListener("keydown",event=>{if(event.key!=="Tab")return;const focusable=[...menu.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(e=>e.getClientRects().length>0),first=focusable[0]??close,last=focusable.at(-1)??close;if(event.shiftKey&&(document.activeElement===first||!menu.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!menu.contains(document.activeElement))){event.preventDefault();first.focus();}});
 const openCharacter=()=>{api.setMenuOpen(false);api.onCharacterSelection?.();};characterChoice.addEventListener("click",openCharacter);menuCharacter.addEventListener("click",openCharacter);
 select.addEventListener("change",()=>api.onConfigure?.(select.value as PgModeId));return api;
}
