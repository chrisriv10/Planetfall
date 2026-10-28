import {PR_ROUNDS,SHOP_CATALOG,type PrCategory,type PrRoundId,type PrSnapshot,type PrSnapshotPlayer} from '@planetfall/shared';
import {PR_ART_PALETTES} from './pr-art-shared';
import './pr-event-ui.css';

export const PR_CATEGORY_ICONS:Record<PrCategory,string>={race:'➜',survival:'◎',final:'✦'};
export function applyPrRoundTheme(root:HTMLElement,roundId:PrRoundId|null,category?:PrCategory):void {
 const round=PR_ROUNDS.find(r=>r.id===roundId),id=round?.id??'cargo-cyclone';
 root.dataset.prRound=id;root.dataset.prCategory=category??round?.category??'race';
 root.style.setProperty('--pr-accent',`#${PR_ART_PALETTES[id].primary.toString(16).padStart(6,'0')}`);
 root.style.setProperty('--pr-secondary',`#${PR_ART_PALETTES[id].glow.toString(16).padStart(6,'0')}`);
}
/** Identity references the canonical catalog; there is no second cosmetic palette. */
export function prPilotIdentity(player:Pick<PrSnapshotPlayer,'color'|'equippedCosmetics'>){
 return {identity:player.color,suit:SHOP_CATALOG.find(i=>i.category==='suit'&&i.id===player.equippedCosmetics.suit)?.color??player.color,
  suitName:SHOP_CATALOG.find(i=>i.category==='suit'&&i.id===player.equippedCosmetics.suit)?.name??'Flight suit'};
}
export function createPrPilotChip(player:PrSnapshotPlayer,localId:string,owner:Document=document):HTMLElement {
 const row=owner.createElement('li'),mark=owner.createElement('span'),name=owner.createElement('strong'),state=owner.createElement('small'),identity=prPilotIdentity(player);
 row.className=`pr-pilot-chip${player.id===localId?' pr-is-you':''}`;row.dataset.status=player.status;
 mark.className='pr-pilot-insignia';mark.setAttribute('aria-hidden','true');mark.style.setProperty('--pilot-color',identity.identity);mark.style.setProperty('--pilot-suit',identity.suit);
 name.textContent=player.name+(player.id===localId?' · YOU':'');state.textContent=player.status==='qualified'?'ADVANCING':player.status==='eliminated'?'OUT OF ORBIT':'IN THE RUN';
 row.title=identity.suitName;row.append(mark,name,state);return row;
}

export interface PrEventUiElements {hud:HTMLElement;results:HTMLElement;lobby:HTMLElement;}
/** Call update AFTER the existing text renderer. setVisible follows owning screen lifecycle.
 * No RAF, timer or renderer: CSS runs only on visible screens. */
export function createPrEventUi(elements:PrEventUiElements){
 const {hud,results,lobby}=elements,owner=hud.ownerDocument,added:HTMLElement[]=[];
 const make=(tag:string,cls:string,parent:HTMLElement,text='')=>{const el=owner.createElement(tag);el.className=cls;el.textContent=text;parent.append(el);added.push(el);return el;};
 for(const root of [hud,results,lobby]){root.classList.add('pr-event-enabled');root.dataset.prVisible='false';applyPrRoundTheme(root,null);}
 const category=make('span','pr-category-medallion',hud.querySelector<HTMLElement>('.pr-hud-objective')??hud);
 const flash=make('div','pr-event-flash',hud);flash.hidden=true;flash.setAttribute('role','status');flash.setAttribute('aria-live','polite');
 const flashLabel=make('span','pr-event-kicker',flash),flashMain=make('strong','pr-event-word',flash),flashDetail=make('span','pr-event-detail',flash);
 const departed=make('ul','pr-departed-roster',hud.querySelector<HTMLElement>('#pr-round-roster')??hud);departed.setAttribute('aria-label','Eliminated pilots');departed.hidden=true;
 const stage=make('div','pr-winner-stage',results);
 make('span','pr-winner-laurel',stage,'✦  ORBITAL CHAMPION  ✦');
 let visible:'lobby'|'hud'|'results'|null=null,disposed=false,lastPhase='',lastRound=-1,lastStatus='',noticeUntil=0,notice='',rosterKey='';
 const syncVisibility=()=>{for(const [key,root] of Object.entries(elements))root.dataset.prVisible=String(key===visible&&!owner.hidden);};
 owner.addEventListener('visibilitychange',syncVisibility);
 return {setVisible(screen:typeof visible){if(disposed)return;visible=screen;syncVisibility();},
  update(snapshot:PrSnapshot,localId:string){if(disposed)return;const round=PR_ROUNDS.find(r=>r.id===snapshot.roundId),me=snapshot.players.find(p=>p.id===localId),status=me?.status??'';
   for(const root of [hud,results])applyPrRoundTheme(root,snapshot.roundId);category.textContent=`${PR_CATEGORY_ICONS[round?.category??'race']} ${round?.category.toUpperCase()??'RACE'}`;
   hud.dataset.prPhase=snapshot.phase;
   if(snapshot.roundIndex!==lastRound){lastStatus='';lastPhase='';notice='';noticeUntil=0;}
   if(snapshot.phase==='running'&&lastPhase==='countdown'){notice='GO';noticeUntil=snapshot.serverTime+950;}
   if(status!==lastStatus&&lastStatus==='active'&&(status==='qualified'||status==='eliminated')){notice=status==='qualified'?'QUALIFIED':'ELIMINATED';noticeUntil=snapshot.serverTime+1900;}
   const show=snapshot.phase==='running'&&snapshot.serverTime<noticeUntil;flash.hidden=!show;
   if(show){flash.dataset.event=notice.toLowerCase();flashLabel.textContent=notice==='GO'?'FIND YOUR ROUTE':notice==='QUALIFIED'?'PLACE SECURED':'STAY WITH THE CREW';flashMain.textContent=notice;flashDetail.textContent=notice==='ELIMINATED'?'Watching the remaining pilots':notice==='QUALIFIED'?'Next stop: the next round.':'';}
   const announce=hud.querySelector<HTMLElement>('#pr-round-announcement');if(announce){announce.dataset.event=snapshot.phase;announce.dataset.beat=String(Math.max(1,Math.ceil((snapshot.phaseEndsAt-snapshot.serverTime)/1000)));}
   departed.hidden=snapshot.phase!=='round-results';
   const key=JSON.stringify([snapshot.phase,snapshot.roundIndex,localId,snapshot.players.map(p=>[p.id,p.name,p.status,p.color,p.equippedCosmetics])]);
   if(key!==rosterKey&&snapshot.phase==='round-results'){rosterKey=key;hud.querySelector('#pr-round-survivors')?.replaceChildren(...snapshot.players.filter(p=>p.status==='qualified').map(p=>createPrPilotChip(p,localId,owner)));departed.replaceChildren(...snapshot.players.filter(p=>p.status==='eliminated').map(p=>createPrPilotChip(p,localId,owner)));}
   stage.hidden=snapshot.phase!=='results'||!snapshot.winnerId;lastPhase=snapshot.phase;lastRound=snapshot.roundIndex;lastStatus=status;
  },dispose(){if(disposed)return;disposed=true;owner.removeEventListener('visibilitychange',syncVisibility);for(const node of added)node.remove();for(const root of [hud,results,lobby]){root.classList.remove('pr-event-enabled');delete root.dataset.prVisible;delete root.dataset.prPhase;delete root.dataset.prRound;delete root.dataset.prCategory;root.style.removeProperty('--pr-accent');root.style.removeProperty('--pr-secondary');}}};
}
