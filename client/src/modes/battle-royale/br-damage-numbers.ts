import * as THREE from "three";
import type { Vec3 } from "@planetfall/shared";

export type BrDamageNumberKind = "shield" | "hp";
export interface BrDamageNumberInput { targetId:string; position:Vec3; shieldDamage:number; hpDamage:number; shieldBroken:boolean; headshot:boolean; }
export interface BrDamageNumberEntry { targetId:string; kind:BrDamageNumberKind; amount:number; position:Vec3; createdAt:number; updatedAt:number; shieldBroken:boolean; headshot:boolean; }

export const BR_DAMAGE_NUMBER_LIFETIME_MS=920;
export const BR_DAMAGE_NUMBER_AGGREGATE_MS=180;

/** Sprite.center is in billboard space, so the two channels stay separated from
 * every camera angle. World-X jitter collapses when viewed along the X axis.
 * Opposite anchors also leave the center reticle/target face unobscured. */
export function brDamageNumberLayout(entry:BrDamageNumberEntry,now:number){
  const age=Math.max(0,now-entry.updatedAt),progress=Math.min(1,age/BR_DAMAGE_NUMBER_LIFETIME_MS);
  const text=String(Math.round(entry.amount));
  const shieldBreak=entry.kind==="shield"&&entry.shieldBroken;
  const emphasized=entry.headshot||shieldBreak;
  const easedRise=1-Math.pow(1-progress,2);
  return {
    centerX:entry.kind==="shield"?1.02:-.02,
    rise:2.16+easedRise*1.12,
    opacity:Math.min(1,(1-progress)*1.45),
    scale:(entry.headshot?1.14:shieldBreak?1.07:1)*(1+Math.sin(Math.min(1,age/130)*Math.PI)*.15),
    text,
    // Leave 24px margins plus stroke; headshot/break marks occupy separate rows
    // and never prepend a font-dependent glyph to the numeric value.
    fontSize:Math.min(emphasized?72:66,Math.floor(190/(Math.max(1,text.length)*.65))),
    color:entry.kind==="shield"?(shieldBreak?"#c9fbff":"#63d8ff"):entry.headshot?"#ffd75a":"#ffffff",
    glowColor:entry.kind==="shield"?"rgba(74,220,255,.8)":entry.headshot?"rgba(255,198,54,.78)":"rgba(255,255,255,.42)",
  };
}

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
      const layout=brDamageNumberLayout(entry,now);
      // Independent bursts retain one lane per damage channel. Stack older
      // same-target/channel entries instead of painting them on the fresh hit.
      let newer=0;for(let j=i+1;j<this.entries.length;j++)if(this.entries[j].targetId===entry.targetId&&this.entries[j].kind===entry.kind)newer++;
      slot.sprite.center.set(layout.centerX,.5);
      slot.sprite.position.set(entry.position.x,entry.position.y+layout.rise+newer*.68,entry.position.z);
      slot.sprite.material.opacity=layout.opacity;
      slot.sprite.scale.set(1.68*layout.scale,.78*layout.scale,1);
      const key=`${Math.round(entry.amount)}:${entry.kind}:${entry.shieldBroken}:${entry.headshot}`;if(slot.key!==key){slot.key=key;this.paint(slot,entry);}
    }
  }
  clearNumbers():void{this.entries=[];for(const slot of this.slots)slot.sprite.visible=false;}
  dispose():void{for(const slot of this.slots){slot.texture.dispose();slot.sprite.material.dispose();}this.clearNumbers();this.clear();this.slots.length=0;}
  private createSlot():Slot{const canvas=document.createElement("canvas");canvas.width=256;canvas.height=128;const context=canvas.getContext("2d")!;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false,toneMapped:false});const sprite=new THREE.Sprite(material);sprite.visible=false;sprite.renderOrder=18;this.add(sprite);return{sprite,canvas,context,texture,key:""};}
  private paint(slot:Slot,entry:BrDamageNumberEntry):void{
    const c=slot.context,layout=brDamageNumberLayout(entry,entry.updatedAt);c.clearRect(0,0,256,128);
    c.textAlign="center";c.textBaseline="middle";c.font=`900 ${layout.fontSize}px Arial`;c.lineJoin="round";
    c.shadowBlur=0;c.strokeStyle="rgba(2,5,19,.95)";c.lineWidth=12;c.strokeText(layout.text,128,66,204);
    c.shadowColor=layout.glowColor;c.shadowBlur=entry.headshot||entry.kind==="shield"&&entry.shieldBroken?9:5;
    c.fillStyle=layout.color;c.fillText(layout.text,128,66,204);c.shadowBlur=0;
    if(entry.headshot){c.beginPath();c.moveTo(128,8);c.lineTo(134,14);c.lineTo(128,20);c.lineTo(122,14);c.closePath();c.lineWidth=3;c.stroke();c.fill();}
    // A broken-shield cue belongs to the shield channel only, even when the
    // same confirmed impact also damages HP. Split underline avoids a solid bar.
    if(entry.kind==="shield"&&entry.shieldBroken){
      c.strokeStyle="#6ef5ff";c.lineWidth=3;c.beginPath();
      c.moveTo(86,110);c.lineTo(118,110);c.moveTo(138,110);c.lineTo(170,110);
      c.moveTo(132,101);c.lineTo(125,109);c.lineTo(132,109);c.lineTo(125,119);c.stroke();
    }
    slot.texture.needsUpdate=true;
  }
}
