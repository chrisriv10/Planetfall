import {describe,it,expect} from 'vitest';
import {DEFAULT_COSMETICS,SHOP_CATALOG,type PrSnapshot,type PrSnapshotPlayer} from '@planetfall/shared';
import {createPrEventUi,createPrPilotChip,applyPrRoundTheme,prPilotIdentity} from './pr-event-ui';

// Small DOM adapter exercises ownership/text updates without a browser or WebGL.
class Element {
 children:Element[]=[];parent?:Element;className='';id='';textContent='';title='';hidden=false;dataset:Record<string,string>={};props=new Map<string,string>();attrs=new Map<string,string>();
 style={setProperty:(key:string,value:string)=>this.props.set(key,value),removeProperty:(key:string)=>this.props.delete(key)};
 classList={add:(value:string)=>{this.className+=' '+value;},remove:(value:string)=>{this.className=this.className.split(' ').filter(v=>v!==value).join(' ');}};
 constructor(readonly ownerDocument:Owner){}
 append(...nodes:Element[]){for(const node of nodes){node.remove();node.parent=this;this.children.push(node);}}
 prepend(node:Element){node.remove();node.parent=this;this.children.unshift(node);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=undefined;}
 replaceChildren(...nodes:Element[]){for(const n of this.children)n.parent=undefined;this.children=[];this.append(...nodes);}
 setAttribute(key:string,value:string){this.attrs.set(key,value);}
 querySelector(selector:string):Element|null {for(const child of this.children){if(selector[0]==='#'?child.id===selector.slice(1):child.className.split(' ').includes(selector.slice(1)))return child;const found=child.querySelector(selector);if(found)return found;}return null;}
}
class Owner {hidden=false;listeners=new Map<string,()=>void>();createElement(){return new Element(this);}addEventListener(name:string,fn:()=>void){this.listeners.set(name,fn);}removeEventListener(name:string){this.listeners.delete(name);}}
const pilot=(status:PrSnapshotPlayer['status']='active')=>({id:'local',name:'<img src=x onerror=alert(1)>',color:'#123456',status,equippedCosmetics:{...DEFAULT_COSMETICS,suit:'solar-gold'}} as PrSnapshotPlayer);
const snapshot=(phase:PrSnapshot['phase'],serverTime=100,status:PrSnapshotPlayer['status']='active')=>({phase,serverTime,phaseEndsAt:3100,roundIndex:0,roundId:'solar-sweep',players:[pilot(status)],winnerId:null} as PrSnapshot);
const asHtml=(el:Element)=>el as unknown as HTMLElement;
describe('PlanetRun event UI',()=>{
 it('uses canonical cosmetic colors and literal names in chips',()=>{
  const owner=new Owner(),p=pilot('qualified'),chip=createPrPilotChip(p,'local',owner as unknown as Document) as unknown as Element;
  expect(prPilotIdentity(p).suit).toBe(SHOP_CATALOG.find(i=>i.id==='solar-gold')!.color);expect(chip.children[1].textContent).toBe(p.name+' · YOU');expect(chip.children[1].children).toHaveLength(0);expect(chip.dataset.status).toBe('qualified');
  applyPrRoundTheme(asHtml(chip),'solar-sweep');expect(chip.dataset.prCategory).toBe('survival');expect(chip.props.get('--pr-accent')).toBe('#eebf48');
 });
 it('bounds GO/qualification events, pauses hidden screens and disposes owned DOM',()=>{
  const owner=new Owner(),hud=owner.createElement(),lobby=owner.createElement(),results=owner.createElement(),roster=owner.createElement(),survivors=owner.createElement();roster.id='pr-round-roster';survivors.id='pr-round-survivors';roster.append(survivors);hud.append(roster);
  const ui=createPrEventUi({hud:asHtml(hud),lobby:asHtml(lobby),results:asHtml(results)});ui.setVisible('hud');expect(hud.dataset.prVisible).toBe('true');expect(lobby.dataset.prVisible).toBe('false');
  ui.update(snapshot('countdown'),'local');ui.update(snapshot('running',3200),'local');const flash=hud.querySelector('.pr-event-flash')!;expect(flash.hidden).toBe(false);expect(flash.dataset.event).toBe('go');
  ui.update(snapshot('running',4200),'local');expect(flash.hidden).toBe(true);ui.update(snapshot('running',4400,'qualified'),'local');expect(flash.dataset.event).toBe('qualified');expect(flash.hidden).toBe(false);
  ui.update(snapshot('running',6400,'qualified'),'local');expect(flash.hidden).toBe(true);ui.update(snapshot('round-results',6500,'qualified'),'local');expect(survivors.children).toHaveLength(1);
  owner.hidden=true;owner.listeners.get('visibilitychange')!();expect(hud.dataset.prVisible).toBe('false');ui.dispose();ui.dispose();expect(owner.listeners.size).toBe(0);expect(hud.querySelector('.pr-event-flash')).toBe(null);expect(hud.children).toContain(roster);
 });
});
