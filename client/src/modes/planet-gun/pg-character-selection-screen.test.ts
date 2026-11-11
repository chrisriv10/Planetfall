import {describe,it,expect,vi} from "vitest";
import {PG_HEROES,PG_OPERATORS} from "@planetfall/shared";
import {createPgCharacterSelectionScreen,type PgCharacterSelectionView} from "./pg-character-selection-screen";

// Lightweight DOM adapter: verify presentation ownership and updates without WebGL.
class Element {
 children:Element[]=[];parent:Element|null=null;className="";textContent="";hidden=false;disabled=false;value="";title="";src="";type="";alt="";width=0;height=0;
 dataset:Record<string,string>={};attrs=new Map<string,string>();listeners=new Map<string,EventListener>();
 constructor(readonly owner:Owner,readonly tag:string){}
 append(...nodes:Element[]){for(const n of nodes){n.remove();n.parent=this;this.children.push(n);}}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
 replaceChildren(...nodes:Element[]){for(const n of this.children)n.parent=null;this.children=[];this.append(...nodes);}
 setAttribute(key:string,value:string){this.attrs.set(key,value);}
 addEventListener(event:string,fn:EventListener){this.listeners.set(event,fn);}
 removeEventListener(event:string){this.listeners.delete(event);}
 contains(n:Element):boolean{return n===this||this.children.some(c=>c.contains(n));}
 closest():Element|null{return this.tag==="button"?this:this.parent?.closest()??null;}
 focus(){this.owner.active=this;}
 fire(event:string,target:Element=this){this.listeners.get(event)?.({target} as unknown as Event);}
 find(cls:string):Element{if(this.className.split(" ").includes(cls))return this;for(const c of this.children){const result=c.search(cls);if(result)return result;}throw Error(`Missing ${cls}`);}
 search(cls:string):Element|undefined {if(this.className.split(" ").includes(cls))return this;for(const c of this.children){const found=c.search(cls);if(found)return found;}}
}
class Owner {active:Element|null=null;created=0;createElement(tag:string){this.created++;return new Element(this,tag);}}
function setup(){const owner=new Owner(),screen=createPgCharacterSelectionScreen(owner as unknown as Document);return {owner,screen,root:screen.root as unknown as Element};}
const base=():PgCharacterSelectionView=>({mode:"planetwatch",side:"attack",catalog:Object.values(PG_HEROES),draftId:"cairn",selectedId:null,primary:"photon",team:[{id:"me",name:"Pilot",characterId:null,ready:false,local:true}],reserved:new Map(),phaseLabel:"Choose your hero",secondsLeft:20,canConfirm:true,reason:"",pending:false});
describe("dedicated character selection presentation",()=>{
 it("keeps drafting separate from confirmation and obeys authority/pending",()=>{
  const {screen,root}=setup(),view=base();expect(root.hidden).toBe(true);expect(root.parent).toBe(null);expect(root.attrs.get("aria-modal")).toBe("true");screen.render(view);
  const draft=vi.fn(),confirm=vi.fn();screen.onDraft=draft;screen.onConfirm=confirm;
  const tiles=root.find("pg-selection-portraits"),tile=tiles.children[1];tiles.fire("click",tile);expect(draft).toHaveBeenCalledWith("kepler");expect(confirm).not.toHaveBeenCalled();
  root.find("pg-selection-confirm").fire("click");expect(confirm).toHaveBeenCalledOnce();
  screen.render({...view,pending:true});root.find("pg-selection-confirm").fire("click");tiles.fire("click",tile);expect(confirm).toHaveBeenCalledOnce();expect(draft).toHaveBeenCalledOnce();
  screen.render({...view,canConfirm:false,reason:"Return to spawn to change hero."});expect(root.find("pg-selection-reason").textContent).toContain("Return to spawn");expect(root.find("pg-selection-confirm").disabled).toBe(true);screen.dispose();
 });
 it("patches countdown and selection without rebuilding portraits or team",()=>{
  const {screen,root,owner}=setup(),view=base();screen.render(view);const count=owner.created,tiles=root.find("pg-selection-portraits"),tile=tiles.children[0],team=root.find("pg-selection-team").children[0];
  screen.render({...view,secondsLeft:19.2});expect(owner.created).toBe(count);expect(tiles.children[0]).toBe(tile);expect(root.find("pg-selection-team").children[0]).toBe(team);expect(root.find("pg-selection-clock").children[1].textContent).toBe("20s");
  screen.render({...view,selectedId:"cairn",reserved:new Map([["kepler","<b>Teammate</b>"]])});expect(tile.dataset.selected).toBe("true");expect(root.find("pg-selection-status").textContent).toBe("CONFIRMED SELECTION");expect(tiles.children[1].disabled).toBe(true);expect(tiles.children[1].children[2].textContent).toBe("Reserved · <b>Teammate</b>");
  screen.render({...view,secondsLeft:null});expect(root.find("pg-selection-clock").children[1].hidden).toBe(true);screen.dispose();
 });
 it("offers only definition-approved operator weapons and literal team names",()=>{
  const {screen,root}=setup(),view:PgCharacterSelectionView={...base(),mode:"planetsiege",catalog:Object.values(PG_OPERATORS).filter(c=>c.side==="attack"),draftId:"rivet",primary:"pulse",team:[{id:"me",name:"<img src=x>",characterId:"rivet",ready:true,local:true}]};screen.render(view);
  const select=root.find("pg-selection-weapon").children[0];expect(select.children.map(c=>c.value)).toEqual([...PG_OPERATORS.rivet.primaryChoices]);const primary=vi.fn();screen.onPrimary=primary;
  select.value="rail";select.fire("change");expect(primary).not.toHaveBeenCalled();select.value="photon";select.fire("change");expect(primary).toHaveBeenCalledWith("photon");
  expect(root.find("pg-selection-teammate").children[1].children[0].textContent).toBe("<img src=x> · YOU");expect(root.find("pg-selection-details").children[0].children[1].textContent).toBe(PG_OPERATORS.rivet.signature.name);screen.dispose();
 });
 it("focuses close and removes event handlers on idempotent disposal",()=>{
  const {screen,root,owner}=setup();screen.render(base());screen.focus();expect(owner.active).toBe(root.find("pg-selection-close"));const close=vi.fn();screen.onClose=close;const button=root.find("pg-selection-close");button.fire("click");expect(close).toHaveBeenCalledOnce();screen.dispose();screen.dispose();button.fire("click");screen.render(base());expect(close).toHaveBeenCalledOnce();expect(root.children).toHaveLength(0);expect(screen.onClose).toBe(null);
 });
});
