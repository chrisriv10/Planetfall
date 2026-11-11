import {PG_WEAPONS,PG_PASSIVES,PG_SIEGE_COMMON_EQUIPMENT,type PgHeroDefinition,type PgOperatorDefinition,type PgWeaponId,type PgAbilityDefinition} from "@planetfall/shared";
import {pgCharacterPortraitSvg} from "./pg-character-art";
import "./pg-character-selection-screen.css";

export interface PgCharacterSelectionView {
 mode:"planetwatch"|"planetsiege"; side:"attack"|"defend";
 catalog:readonly (PgHeroDefinition|PgOperatorDefinition)[];
 draftId:string; selectedId:string|null; primary:PgWeaponId;
 team:readonly {id:string;name:string;characterId:string|null;ready:boolean;local:boolean}[];
 reserved:ReadonlyMap<string,string>;
 phaseLabel:string; secondsLeft:number|null; canConfirm:boolean; reason:string; pending:boolean;
}
const title=(s:string)=>s.replaceAll("-"," ").replace(/\b\w/g,c=>c.toUpperCase());
const portraitCache=new Map<string,string>();
function portrait(id:string){let src=portraitCache.get(id);if(!src){src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(pgCharacterPortraitSvg(id))}`;portraitCache.set(id,src);}return src;}
const passiveCopy:Record<PgHeroDefinition["passive"],string>={
 braced:`Reduced knockback (${Math.round((1-PG_PASSIVES.braced.knockbackMultiplier)*100)}%).`,
 shielded:`Starts with ${PG_PASSIVES.shielded.initialPersonalShield} personal shield; reduced incoming damage.`,
 "earned-reload":"Earn a brief reload boost through eliminations.",
 "steady-aim":"Faster aiming after standing still.",
 recovery:`Recover ${PG_PASSIVES.recovery.healingPerSecond} health per second after ${PG_PASSIVES.recovery.combatDelayMs/1000}s out of combat.`,
 "assist-resource":"Assists build additional ability resources.",
};
function abilityCopy(a:PgAbilityDefinition){
 const action:Record<PgAbilityDefinition["primitive"],string>={barrier:"Deploy protective cover.",pulse:"Release a frontal concussive pulse.",shield:"Grant temporary shields.",field:"Create an area effect.",guard:"Absorb damage with a personal guard.",dash:"Dash along a clear path.","weapon-buff":"Temporarily enhance your weapon.",recon:"Scan visible enemies ahead.",blink:"Fold to a reachable position.","heal-beam":"Maintain a healing link to an ally.",beacon:"Deploy a healing station.",relay:"Deploy or amplify a team relay.",breach:"Attach a delayed breaching charge.",emp:"Disable nearby electronics.","trip-line":"Place a warning line across a route.",heal:"Restore a living ally's health.",shutter:"Deploy a reinforced shutter.",jammer:"Suppress nearby drones and detection.",sensor:"Deploy a detection device.","floor-strip":"Place a damaging, slowing strip.",smoke:"Deploy a vision-blocking cloud."};
 const facts=[a.effect.damage?`${a.effect.damage} damage`:"",a.effect.healing?`${a.effect.healing} healing`:"",a.effect.healingPerSecond?`${a.effect.healingPerSecond} healing/s`:"",a.range?`${a.range}m range`:"",a.radius?`${a.radius}m radius`:"",a.durationMs?`${a.durationMs/1000}s duration`:"",a.recharge==="round"?`${a.charges} per round`:a.recharge==="ultimate"?"Ultimate charge required":`${a.cooldownMs/1000}s cooldown`];
 return `${action[a.primitive]} ${facts.filter(Boolean).join(" · ")}`;
}
/** DOM-only draft presentation. The owner supplies authority, timing and focus routing. */
export function createPgCharacterSelectionScreen(document:Document){
 const el=<K extends keyof HTMLElementTagNameMap>(tag:K,parent?:HTMLElement,cls="",text="")=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;parent?.append(n);return n;};
 const text=(n:HTMLElement,value:string)=>{if(n.textContent!==value)n.textContent=value;};
 const root=el("section",undefined,"pg-selection-screen");root.hidden=true;root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","Character selection");
 const header=el("header",root,"pg-selection-header"),heading=el("div",header),eyebrow=el("p",heading,"pg-selection-eyebrow"),h1=el("h1",heading,"","Choose your hero");
 const clock=el("div",header,"pg-selection-clock"),phase=el("span",clock),countdown=el("strong",clock);countdown.setAttribute("role","timer");countdown.setAttribute("aria-live","off");
 const close=el("button",header,"pg-selection-close","CLOSE");close.type="button";close.setAttribute("aria-label","Close character selection");
 const stage=el("div",root,"pg-selection-stage");stage.setAttribute("aria-hidden","true");
 const info=el("aside",root,"pg-selection-info"),role=el("p",info,"pg-selection-eyebrow"),name=el("h2",info),status=el("p",info,"pg-selection-status"),health=el("p",info,"pg-selection-health");
 const weaponLabel=el("label",info,"pg-selection-weapon","PRIMARY WEAPON"),primary=el("select",weaponLabel);primary.setAttribute("aria-label","Primary weapon");
 const secondary=el("p",info,"pg-selection-secondary"),details=el("div",info,"pg-selection-details");
 const bottom=el("section",root,"pg-selection-bottom"),teamHeading=el("h2",bottom,"pg-selection-section-title","YOUR TEAM"),teamRow=el("div",bottom,"pg-selection-team");teamRow.setAttribute("aria-label","Your team's selections");
 const picksHeading=el("h2",bottom,"pg-selection-section-title","CHOOSE A CHARACTER"),tiles=el("div",bottom,"pg-selection-portraits");tiles.setAttribute("aria-label","Available characters");
 const footer=el("footer",root,"pg-selection-footer"),reason=el("p",footer,"pg-selection-reason"),confirm=el("button",footer,"pg-selection-confirm","CONFIRM SELECTION");confirm.type="button";reason.setAttribute("role","status");reason.setAttribute("aria-live","polite");
 let view:PgCharacterSelectionView|null=null,disposed=false,catalogKey="",teamKey="",detailCharacter:PgHeroDefinition|PgOperatorDefinition|undefined;
 const tileNodes=new Map<string,{button:HTMLButtonElement;state:HTMLElement}>();
 const handlers:[HTMLElement,string,EventListener][]=[];
 const listen=(node:HTMLElement,event:string,fn:EventListener)=>{node.addEventListener(event,fn);handlers.push([node,event,fn]);};
 const api={root,stage,onDraft:null as null|((id:string)=>void),onPrimary:null as null|((id:PgWeaponId)=>void),onConfirm:null as null|(()=>void),onClose:null as null|(()=>void),
  render(next:PgCharacterSelectionView){
   if(disposed)return;view=next;root.dataset.mode=next.mode;root.dataset.side=next.side;root.setAttribute("aria-busy",String(next.pending));
   const watch=next.mode==="planetwatch",character=next.catalog.find(c=>c.id===next.draftId);
   text(eyebrow,watch?"PLANETWATCH · HERO SELECTION":`PLANETSIEGE · ${next.side.toUpperCase()}`);text(h1,watch?"Choose your hero":"Choose your operator");text(phase,next.phaseLabel);
   // Explicit display only: this helper never starts a countdown or guesses phase timing.
   const seconds=next.secondsLeft;countdown.hidden=seconds===null;
   text(countdown,seconds===null?"":Number.isFinite(seconds)?`${Math.max(0,Math.ceil(seconds))}s`:"—");countdown.setAttribute("aria-label",seconds===null?"No deployment countdown":`Deployment countdown ${countdown.textContent}`);
   const key=JSON.stringify(next.catalog.map(c=>[c.id,c.name]));
   if(key!==catalogKey){catalogKey=key;tiles.replaceChildren();tileNodes.clear();
    for(const c of next.catalog){const button=el("button",tiles,"pg-selection-tile");button.type="button";button.dataset.characterId=c.id;const img=el("img",button);img.alt="";img.src=portrait(c.id);img.width=96;img.height=96;el("strong",button,"",c.name);const state=el("small",button);tileNodes.set(c.id,{button,state});}
   }
   for(const c of next.catalog){const {button,state}=tileNodes.get(c.id)!;const owner=next.reserved.get(c.id);button.disabled=!!owner||next.pending;button.dataset.draft=String(c.id===next.draftId);button.dataset.selected=String(c.id===next.selectedId);button.setAttribute("aria-pressed",String(c.id===next.draftId));text(state,owner?`Reserved · ${owner}`:c.id===next.selectedId?"CONFIRMED":c.id===next.draftId?"PREVIEW":"role" in c?title(c.role):title(c.side));button.title=owner?`Reserved by ${owner}`:`Preview ${c.name}`;}
   if(character!==detailCharacter){detailCharacter=character;primary.replaceChildren();details.replaceChildren();
    if(character){for(const id of character.primaryChoices){const option=el("option",primary,"",PG_WEAPONS[id].name);option.value=id;}
     const entry=(label:string,heading:string,copy:string)=>{const section=el("section",details);el("small",section,"",label);el("h3",section,"",heading);el("p",section,"",copy);};
     if("abilities" in character){entry("PASSIVE",title(character.passive),passiveCopy[character.passive]);character.abilities.forEach((a,i)=>entry(i===0?"Q · ABILITY":"F · ABILITY",a.name,abilityCopy(a)));entry("G · ULTIMATE",character.ultimate.name,abilityCopy(character.ultimate));}
     else{entry("Q · SIGNATURE GADGET",character.signature.name,abilityCopy(character.signature));const equipment=PG_SIEGE_COMMON_EQUIPMENT[character.side];entry("FIELD EQUIPMENT",character.side==="attack"?"Scouting & breach":"Site preparation","scoutDrones" in equipment?`${equipment.scoutDrones} scout drone · ${equipment.breachCharges} common breach charge`:`${equipment.reinforcements} reinforcements · ${equipment.barricades} barricades · ${equipment.repairCharges} repair charge`);}
    }
   }
   text(name,character?.name??"Choose a character");text(role,character?("role" in character?`${character.role.toUpperCase()} HERO`:`${character.side.toUpperCase()} OPERATOR`):"PREVIEW");
   text(status,!character?"Select a portrait to inspect equipment":character.id===next.selectedId?"CONFIRMED SELECTION":"PREVIEW · NOT CONFIRMED");status.dataset.confirmed=String(!!character&&character.id===next.selectedId);
   text(health,character?`${character.maxHp} HP`:"");text(secondary,character?`SIDEARM · ${PG_WEAPONS[character.secondary].name}`:"");weaponLabel.hidden=!character;
   primary.value=character?.primaryChoices.find(id=>id===next.primary)??character?.primaryChoices[0]??"";primary.disabled=next.pending||!character||character.primaryChoices.length<2;
   const teamSignature=JSON.stringify([next.team,next.catalog.map(c=>[c.id,c.name])]);
   if(teamSignature!==teamKey){teamKey=teamSignature;teamRow.replaceChildren();for(const member of next.team){const chip=el("div",teamRow,"pg-selection-teammate");chip.dataset.local=String(member.local);if(member.characterId){const img=el("img",chip);img.alt="";img.src=portrait(member.characterId);img.width=40;img.height=40;}const copy=el("div",chip);el("strong",copy,"",`${member.name}${member.local?" · YOU":""}`);const pick=next.catalog.find(c=>c.id===member.characterId);el("span",copy,"",`${pick?.name??(member.characterId?title(member.characterId):"Choosing")} · ${member.ready?"READY":"NOT READY"}`);}}
   teamHeading.hidden=next.team.length===0;teamRow.hidden=next.team.length===0;text(picksHeading,watch?"HERO ROSTER":"OPERATOR ROSTER");
   confirm.disabled=!next.canConfirm||next.pending||!character;text(confirm,next.pending?"CONFIRMING…":"CONFIRM SELECTION");text(reason,next.reason||(next.pending?"Waiting for selection confirmation…":next.canConfirm?"Your choice is applied when you confirm.":"Selection is unavailable during this phase."));
  },
  focus(){if(!disposed)close.focus();},
  dispose(){if(disposed)return;disposed=true;for(const [node,event,fn] of handlers)node.removeEventListener(event,fn);handlers.length=0;api.onDraft=api.onPrimary=api.onConfirm=api.onClose=null;view=null;tileNodes.clear();root.remove();root.replaceChildren();},
 };
 listen(close,"click",()=>api.onClose?.());listen(confirm,"click",()=>{if(view?.canConfirm&&!view.pending&&!confirm.disabled)api.onConfirm?.();});
 listen(tiles,"click",event=>{const target=event.target as HTMLElement|null,button=target?.closest<HTMLButtonElement>("button[data-character-id]");if(button&&tiles.contains(button)&&!button.disabled)api.onDraft?.(button.dataset.characterId!);});
 listen(primary,"change",()=>{const character=view?.catalog.find(c=>c.id===view?.draftId),id=character?.primaryChoices.find(id=>id===primary.value);if(id&&!primary.disabled)api.onPrimary?.(id);});
 return api;
}
