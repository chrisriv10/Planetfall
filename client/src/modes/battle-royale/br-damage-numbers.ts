import * as THREE from "three";
import type { Vec3 } from "@planetfall/shared";

export type BrDamageNumberKind = "shield" | "hp";
export interface BrDamageNumberInput { targetId:string; position:Vec3; shieldDamage:number; hpDamage:number; shieldBroken:boolean; headshot:boolean; }
export interface BrDamageNumberEntry { targetId:string; kind:BrDamageNumberKind; amount:number; position:Vec3; createdAt:number; updatedAt:number; shieldBroken:boolean; headshot:boolean; }

export const BR_DAMAGE_NUMBER_LIFETIME_MS=920;
export const BR_DAMAGE_NUMBER_AGGREGATE_MS=180;

export function addBrDamageNumber(entries:readonly BrDamageNumberEntry[],input:BrDamageNumberInput,now:number,max=20):BrDamageNumberEntry[]{
  let result=entries.filter(entry=>now-entry.updatedAt<BR_DAMAGE_NUMBER_LIFETIME_MS).map(entry=>({...entry,position:{...entry.position}}));
  for(const [kind,amount] of [["shield",input.shieldDamage],["hp",input.hpDamage]] as const){
    if(!(amount>0))continue;
    const existing=result.find(entry=>entry.targetId===input.targetId&&entry.kind===kind&&now-entry.updatedAt<=BR_DAMAGE_NUMBER_AGGREGATE_MS);
    if(existing){existing.amount+=amount;existing.updatedAt=now;existing.position={...input.position};existing.shieldBroken||=input.shieldBroken;existing.headshot||=input.headshot;}
    else result.push({targetId:input.targetId,kind,amount,position:{...input.position},createdAt:now,updatedAt:now,shieldBroken:input.shieldBroken,headshot:input.headshot});
  }
  return result.slice(-max);
}

type Slot={sprite:THREE.Sprite;canvas:HTMLCanvasElement;context:CanvasRenderingContext2D;texture:THREE.CanvasTexture;key:string};

/** Fixed-pool authoritative damage readout. It never invents damage: callers
 * feed server-confirmed shield/HP amounts and target positions. */
export class BrDamageNumbers extends THREE.Group{
  private entries:BrDamageNumberEntry[]=[];
  private readonly slots:Slot[]=[];
  constructor(private readonly max=20){super();this.name="br-damage-numbers";for(let i=0;i<max;i++)this.slots.push(this.createSlot());}
  hit(input:BrDamageNumberInput,now:number):void{this.entries=addBrDamageNumber(this.entries,input,now,this.max);}
  update(now:number):void{
    this.entries=this.entries.filter(entry=>now-entry.updatedAt<BR_DAMAGE_NUMBER_LIFETIME_MS);
    for(let i=0;i<this.slots.length;i++){
      const slot=this.slots[i],entry=this.entries[i];slot.sprite.visible=Boolean(entry);if(!entry)continue;
      const age=Math.max(0,now-entry.updatedAt),progress=Math.min(1,age/BR_DAMAGE_NUMBER_LIFETIME_MS);
      const lateral=((hash(entry.targetId+entry.kind)%9)-4)*.055;
      slot.sprite.position.set(entry.position.x+lateral,entry.position.y+2.1+progress*1.05,entry.position.z);
      slot.sprite.material.opacity=Math.min(1,(1-progress)*1.45);
      const scale=(entry.headshot?1.12:1)*(1+Math.sin(Math.min(1,age/120)*Math.PI)*.12);slot.sprite.scale.set(1.55*scale,.72*scale,1);
      const key=`${Math.round(entry.amount)}:${entry.kind}:${entry.shieldBroken}:${entry.headshot}`;if(slot.key!==key){slot.key=key;this.paint(slot,entry);}
    }
  }
  clearNumbers():void{this.entries=[];for(const slot of this.slots)slot.sprite.visible=false;}
  dispose():void{for(const slot of this.slots){slot.texture.dispose();slot.sprite.material.dispose();}this.clearNumbers();}
  private createSlot():Slot{const canvas=document.createElement("canvas");canvas.width=256;canvas.height=128;const context=canvas.getContext("2d")!;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false,toneMapped:false});const sprite=new THREE.Sprite(material);sprite.visible=false;sprite.renderOrder=18;this.add(sprite);return{sprite,canvas,context,texture,key:""};}
  private paint(slot:Slot,entry:BrDamageNumberEntry):void{const c=slot.context;c.clearRect(0,0,256,128);const text=`${entry.headshot?"✦ ":""}${Math.round(entry.amount)}`;c.textAlign="center";c.textBaseline="middle";c.font=`900 ${entry.headshot?70:62}px Arial`;c.lineJoin="round";c.strokeStyle="rgba(2,5,19,.95)";c.lineWidth=16;c.strokeText(text,128,63);c.fillStyle=entry.kind==="shield"?(entry.shieldBroken?"#d8fbff":"#63d8ff"):entry.headshot?"#ffd75a":"#ffffff";c.fillText(text,128,63);if(entry.shieldBroken){c.strokeStyle="#6ef5ff";c.lineWidth=3;c.beginPath();c.moveTo(56,102);c.lineTo(200,102);c.stroke();}slot.texture.needsUpdate=true;}
}

function hash(value:string):number{let out=2166136261;for(let i=0;i<value.length;i++)out=Math.imul(out^value.charCodeAt(i),16777619);return out>>>0;}
